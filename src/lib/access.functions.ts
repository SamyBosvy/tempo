import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { revokeAndDelete } from "./google.server";
import { isOwnerEmail, normaliseEmail, buildInviteLink } from "./access-rules";

const emailSchema = z.string().trim().email().max(255);

export type SetupResult = { ok: true } | { ok: false; code: "not_invited" | "exists" | "weak" | "error" };

/**
 * Public: create an account for an invited email (or OWNER_EMAIL).
 * Open sign-up is disabled in auth settings, so this is the only way in.
 */
export const setupAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: emailSchema, password: z.string().max(200) }).parse(d))
  .handler(async ({ data }): Promise<SetupResult> => {
    if (data.password.length < 8) return { ok: false, code: "weak" };
    const email = normaliseEmail(data.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const owner = isOwnerEmail(email, process.env["OWNER_EMAIL"]);
    if (!owner) {
      const { data: allowed, error } = await supabaseAdmin
        .from("allowed_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      if (error) return { ok: false, code: "error" };
      if (!allowed) return { ok: false, code: "not_invited" };
    }
    const { data: existingId, error: lookupErr } = await supabaseAdmin.rpc("get_user_id_by_email", { _email: email });
    if (lookupErr) return { ok: false, code: "error" };
    let userId = existingId as string | null;
    if (userId) {
      const { data: roles, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId);
      if (roleErr) return { ok: false, code: "error" };
      if (roles && roles.length > 0) return { ok: false, code: "exists" };
      // Invited placeholder (created by the invite email) — finish it.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (error) return { ok: false, code: error.message.toLowerCase().includes("password") ? "weak" : "error" };
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
      });
      if (error || !created.user) {
        const m = error?.message.toLowerCase() ?? "";
        return { ok: false, code: m.includes("already") ? "exists" : m.includes("password") ? "weak" : "error" };
      }
      userId = created.user.id;
    }
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: owner ? "owner" : "member" });
    if (insErr) return { ok: false, code: "error" };
    return { ok: true };
  });

async function assertOwner(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "owner" });
  if (error) throw new Error("Could not check permissions");
  if (!data) throw new Error("Only the owner can do that");
}

export const inviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: emailSchema, origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const email = normaliseEmail(data.email);
    const origin = new URL(data.origin).origin;
    const link = buildInviteLink(origin, email);
    const { error } = await context.supabase
      .from("allowed_emails")
      .upsert({ email, added_by: context.userId }, { onConflict: "email" });
    if (error) throw new Error("Couldn't save the invite");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: sendErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: link });
    if (sendErr) return { saved: true, sent: false, link };
    await supabaseAdmin.from("allowed_emails").update({ invited_at: new Date().toISOString() }).eq("email", email);
    return { saved: true, sent: true, link };
  });

export const removeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const email = normaliseEmail(data.email);
    const { error } = await context.supabase.from("allowed_emails").delete().eq("email", email);
    if (error) throw new Error("Couldn't remove the invite");
    // Clean up an unused invite placeholder account (no role = never set up).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id } = await supabaseAdmin.rpc("get_user_id_by_email", { _email: email });
    if (id) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", id as string);
      if (!roles?.length) await supabaseAdmin.auth.admin.deleteUser(id as string);
    }
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ page: z.number().int().min(0).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const size = 20;
    const { data: rows, error } = await supabaseAdmin.rpc("list_members", { _limit: size, _offset: data.page * size });
    if (error) throw new Error("Couldn't load members");
    const list = (rows ?? []) as { user_id: string; email: string; created_at: string; role: string; total: number }[];
    return { members: list.map(({ total: _t, ...r }) => r), total: Number(list[0]?.total ?? 0), size };
  });

const USER_TABLES = ["interruptions", "focus_sessions", "energy_ratings", "prime_sessions", "event_flags", "manual_blocks", "recurring_skips", "recurring_blocks", "checkin_dismissals", "user_settings"] as const;

async function wipeUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await revokeAndDelete(userId);
  for (const t of USER_TABLES) {
    const { error } = await supabaseAdmin.from(t).delete().eq("user_id", userId);
    if (error) throw new Error("Couldn't delete data");
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error("Couldn't delete the account");
}

export const revokeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.userId === context.userId) throw new Error("You can't revoke yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !u.user) throw new Error("Member not found");
    if (u.user.email) await supabaseAdmin.from("allowed_emails").delete().eq("email", normaliseEmail(u.user.email));
    await wipeUser(data.userId);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await wipeUser(context.userId);
    return { ok: true };
  });

export const myRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (error) throw new Error("Could not load role");
    const roles = (data ?? []).map((r) => r.role);
    return { role: roles.includes("owner") ? "owner" : roles.includes("member") ? "member" : null };
  });

export type GoogleAccessResult = { ok: true } | { ok: false; code: "not_invited" | "error" };

/**
 * Called right after a Google sign-in. Open sign-up stays disabled; this
 * checks the server-side allowlist (or OWNER_EMAIL) and grants the role.
 * A Google account that isn't invited is removed and must be signed out.
 */
export const finishGoogleSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleAccessResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (uErr || !u.user?.email) return { ok: false, code: "error" };
    const { data: roles, error: rErr } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", context.userId);
    if (rErr) return { ok: false, code: "error" };
    if (roles && roles.length > 0) return { ok: true };
    const email = normaliseEmail(u.user.email);
    const owner = isOwnerEmail(email, process.env["OWNER_EMAIL"]);
    if (!owner) {
      const { data: allowed, error } = await supabaseAdmin.from("allowed_emails").select("email").eq("email", email).maybeSingle();
      if (error) return { ok: false, code: "error" };
      if (!allowed) {
        await supabaseAdmin.auth.admin.deleteUser(context.userId);
        return { ok: false, code: "not_invited" };
      }
    }
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: owner ? "owner" : "member" });
    if (insErr) return { ok: false, code: "error" };
    return { ok: true };
  });

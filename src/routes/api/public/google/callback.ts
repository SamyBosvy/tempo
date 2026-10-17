import { createFileRoute } from "@tanstack/react-router";
import { encrypt, verifyState } from "@/lib/google.server";
import { googleResultUrl, type GOOGLE_FAILURES } from "@/lib/google-connect";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let returnPath: string | undefined;
        let origin = url.origin;
        const result = (ok: boolean, error?: keyof typeof GOOGLE_FAILURES) =>
          new Response(null, {
            status: 303,
            headers: {
              Location: googleResultUrl(origin, returnPath, ok, error),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        try {
          const state = verifyState(url.searchParams.get("state") ?? "");
          if (!state) return result(false, "expired");
          // Only signed state chooses a public origin; localhost may be the proxy.
          const callback = new URL(state.r);
          if (callback.pathname !== "/api/public/google/callback" ||
              (url.hostname !== "localhost" && callback.origin !== url.origin)) return result(false, "expired");
          origin = callback.origin;
          returnPath = state.p;
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const [{ data: account, error: accountError }, { data: roles, error: roleError }] = await Promise.all([
            supabaseAdmin.auth.admin.getUserById(state.u),
            supabaseAdmin.from('user_roles').select('role').eq('user_id', state.u),
          ]);
          if (accountError || !account.user || roleError || !roles?.length) return result(false, 'access');
          const code = url.searchParams.get("code");
          if (!code || url.searchParams.has("error")) return result(false, "cancelled");
          const clientId = process.env["GOOGLE_CLIENT_ID"];
          const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
          if (!clientId || !clientSecret) return result(false, "unavailable");
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: state.r,
              grant_type: "authorization_code",
            }),
          });
          if (!res.ok) return result(false, "access");
          const tok = (await res.json()) as { refresh_token?: string; id_token?: string; scope?: string };
          if (!tok.refresh_token) return result(false, "access");
          if (!tok.scope?.split(" ").includes("https://www.googleapis.com/auth/calendar.readonly")) return result(false, "scope");
          let email: string | null = null;
          try {
            const payload = tok.id_token?.split(".")[1];
            if (payload) {
              const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
              email = typeof claims.email === "string" ? claims.email : null;
            }
          } catch {
            email = null;
          }
          // Recheck after external consent exchange in case access was revoked meanwhile.
          const { data: active, error: activeError } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', state.u);
          if (activeError || !active?.length) return result(false, 'access');
          const { error } = await supabaseAdmin.from("google_tokens").upsert({
            user_id: state.u,
            refresh_token_ciphertext: encrypt(tok.refresh_token),
            google_email: email,
            updated_at: new Date().toISOString(),
          });
          if (error) return result(false, "save");
          const { error: settingsError } = await supabaseAdmin.from("user_settings").upsert({
            user_id: state.u, google_email: email, google_connected_at: new Date().toISOString(),
          });
          if (settingsError) return result(false, "save");
          return result(true);
        } catch {
          // Never render a bare error page or leak OAuth codes/tokens in logs.
          return result(false, "unavailable");
        }
      },
    },
  },
});

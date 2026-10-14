// Server-only Google helpers: token encryption, signed OAuth state, token refresh.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function encKey(): Buffer {
  const raw = process.env["TOKEN_ENCRYPTION_KEY"];
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", encKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

type State = { u: string; r: string; exp: number; n: string };

export function signState(s: State): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  const sig = createHmac("sha256", encKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token: string): State | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", encKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const s = JSON.parse(Buffer.from(body, "base64url").toString()) as State;
  if (s.exp < Date.now()) return null;
  return s;
}

export function newNonce() {
  return randomBytes(12).toString("base64url");
}

export class ReconnectRequired extends Error {}

/** Returns a fresh access token, or null when the user has no connection. */
export async function getAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("google_tokens")
    .select("refresh_token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not read calendar connection");
  if (!data) return null;
  const refresh = decrypt(data.refresh_token_ciphertext);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["GOOGLE_CLIENT_ID"]!,
      client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant" || res.status === 400 || res.status === 401) {
      // Expired (Testing mode: 7 days) or revoked. Drop the dead token; settings keep the email so Today can offer Reconnect.
      await supabaseAdmin.from("google_tokens").delete().eq("user_id", userId);
      throw new ReconnectRequired("reconnect");
    }
    throw new Error("Google token refresh failed");
  }
  return body.access_token;
}

import { createFileRoute } from "@tanstack/react-router";
import { encrypt, verifyState } from "@/lib/google.server";

function page(ok: boolean, msg: string) {
  const payload = JSON.stringify({ type: "tempo-google", ok }).replace(/</g, "\\u003c");
  const safe = msg.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new Response(
    `<!doctype html><html><head><meta name="robots" content="noindex, nofollow"><title>Tempo</title></head>
<body style="background:#0F1B2D;color:#F3EFE6;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0">
<p>${safe}</p><script>
var m=${payload};
if(window.opener&&window.opener!==window){window.opener.postMessage(m,location.origin);window.close();}
else{location.replace('/settings?google='+(m.ok?'connected':'failed'));}
</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = verifyState(url.searchParams.get("state") ?? "");
        const code = url.searchParams.get("code");
        if (!state) return page(false, "That link has expired. Try connecting again.");
        if (!code) return page(false, "Connection cancelled.");
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env["GOOGLE_CLIENT_ID"]!,
            client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
            redirect_uri: state.r,
            grant_type: "authorization_code",
          }),
        });
        const tok = (await res.json().catch(() => ({}))) as {
          refresh_token?: string;
          id_token?: string;
          scope?: string;
        };
        if (!res.ok || !tok.refresh_token) return page(false, "Google didn't return access. Try again.");
        if (!tok.scope?.includes("calendar.readonly"))
          return page(false, "Calendar access wasn't granted. Try again and tick the calendar box.");
        let email: string | null = null;
        try {
          const p = JSON.parse(Buffer.from(tok.id_token!.split(".")[1], "base64url").toString());
          email = typeof p.email === "string" ? p.email : null;
        } catch {
          email = null;
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("google_tokens").upsert({
          user_id: state.u,
          refresh_token_ciphertext: encrypt(tok.refresh_token),
          google_email: email,
          updated_at: new Date().toISOString(),
        });
        if (error) return page(false, "Couldn't save the connection. Try again.");
        const { error: e2 } = await supabaseAdmin
          .from("user_settings")
          .upsert({ user_id: state.u, google_email: email, google_connected_at: new Date().toISOString() });
        if (e2) return page(false, "Couldn't save the connection. Try again.");
        return page(true, "Calendar connected. You can close this window.");
      },
    },
  },
});

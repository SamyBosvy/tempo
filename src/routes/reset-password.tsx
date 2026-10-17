import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Reset password · Tempo" },
      { name: "description", content: "Choose a new Tempo password." },
      { property: "og:title", content: "Reset password · Tempo" },
      { property: "og:description", content: "Choose a new Tempo password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    if (hash.get("error") || q.get("error")) return setState("invalid");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setState("ready");
    });
    const t = window.setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      setState((cur) => (cur === "checking" ? (s.session && hash.get("type") === "recovery" ? "ready" : s.session ? "ready" : "invalid") : cur));
    }, 1200);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr("Something went wrong. Try again.");
    setState("done");
    window.setTimeout(() => navigate({ to: "/today" }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl border border-subtle bg-card p-5">
        <h1 className="mb-4 text-2xl font-semibold">New password</h1>
        {state === "checking" && (
          <div role="status" aria-busy="true" className="h-24 animate-enter rounded-xl bg-secondary">
            <span className="sr-only">Loading</span>
          </div>
        )}
        {state === "invalid" && (
          <div className="space-y-4">
            <p>This reset link is invalid or has expired. Request a new one from the sign-in screen.</p>
            <Button asChild size="lg" className="w-full">
              <Link to="/">Back to sign in</Link>
            </Button>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" autoComplete="new-password" className="h-12 text-base" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Button size="lg" className="w-full" type="submit">Save password</Button>
          </form>
        )}
        {state === "done" && <p className="text-gold-text font-semibold">Password saved.</p>}
      </div>
    </div>
  );
}

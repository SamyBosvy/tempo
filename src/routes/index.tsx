import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setupAccount } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const search = z.object({
  setup: z.coerce.number().optional(),
  email: z.string().optional(),
  noaccess: z.coerce.number().optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in · Tempo" },
      { name: "description", content: "Sign in to Tempo, your private focus companion." },
      { property: "og:title", content: "Sign in · Tempo" },
      { property: "og:description", content: "Sign in to Tempo, your private focus companion." },
    ],
  }),
  component: AuthPage,
});

const MSG = {
  not_invited: "This email hasn't been invited yet. Ask the owner for an invite.",
  exists: "An account with this email already exists. Sign in instead.",
  weak: "Password must be at least 8 characters.",
  error: "Something went wrong. Try again.",
};

function AuthPage() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const doSetup = useServerFn(setupAccount);
  const [mode, setMode] = useState<"signin" | "setup">(s.setup ? "setup" : "signin");
  const [email, setEmail] = useState(s.email ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(s.noaccess ? MSG.not_invited : null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      // An invite email link signs the user in without a password; set-up mode finishes it properly.
      if (s.setup) {
        await supabase.auth.signOut();
        setChecking(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const safe = s.next && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "/today";
        navigate({ to: safe as "/today", replace: true });
      } else setChecking(false);
    })();
  }, [s.setup, s.next, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) return setError(MSG.weak);
    setBusy(true);
    try {
      if (mode === "setup") {
        const r = await doSetup({ data: { email, password } });
        if (!r.ok) return setError(MSG[r.code]);
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return setError(mode === "signin" ? "That email and password don't match." : MSG.error);
      navigate({ to: "/today", replace: true });
    } catch {
      setError(MSG.error);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    if (!email.trim()) return setError("Enter your email first.");
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setInfo("If that email has an account, a reset link is on its way.");
  }

  if (checking)
    return (
      <div role="status" aria-busy="true" className="flex min-h-screen items-center justify-center">
        <span className="sr-only">Loading</span>
        <div className="h-24 w-24 rounded-full border-2 border-primary animate-metronome" aria-hidden />
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-primary animate-metronome" aria-hidden />
        <h1 className="text-3xl font-semibold">Tempo</h1>
        <p className="mt-1 text-muted-foreground">Deep work, steady meetings.</p>
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-subtle bg-card p-5">
        <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1">
          {(["signin", "setup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
                setInfo(null);
              }}
              className={cn(
                "h-11 rounded-lg text-sm font-semibold",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {m === "signin" ? "Sign in" : "Set up account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" inputMode="email" className="h-12 text-base" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "setup" ? "new-password" : "current-password"}
                className="h-12 pr-14 text-base"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="tap absolute right-0 top-0 flex items-center justify-center text-muted-foreground"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {mode === "setup" && <p className="text-sm text-muted-foreground">At least 8 characters.</p>}
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {info && <p role="status" className="text-sm text-accent-text">{info}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {mode === "signin" && (
            <button type="button" onClick={forgot} className="tap w-full text-sm font-semibold text-accent-text underline underline-offset-4">
              Forgot password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

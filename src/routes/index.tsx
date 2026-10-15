import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, CalendarSearch, Wind, ChartLine } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { finishGoogleSignIn, setupAccount } from "@/lib/access.functions";
import { lovable } from "@/integrations/lovable";
import { passwordStrength, safeNextPath } from "@/lib/access-rules";
import { DayRibbon } from "@/components/tempo/DayRibbon";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Sign in · Tempo" },
      { name: "description", content: "Sign in to Tempo, your private focus companion." },
      { property: "og:title", content: "Sign in · Tempo" },
      { property: "og:description", content: "Sign in to Tempo, your private focus companion." },
    ],
  }),
  component: AuthPage,
});

const NEXT_KEY = "tempo.signin.next";

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
  const [locked, setLocked] = useState(!!(s.setup && s.email));
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const finishGoogle = useServerFn(finishGoogleSignIn);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const goNext = () => {
    const stored = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    navigate({ to: safeNextPath(s.next ?? stored) as "/today", replace: true });
  };

  // Server-side allowlist check for Google sign-ins (password users already have a role).
  async function admitGoogle() {
    try {
      const r = await finishGoogle();
      if (r.ok) return true;
      await supabase.auth.signOut();
      setError(r.code === "not_invited" ? MSG.not_invited : MSG.error);
    } catch {
      await supabase.auth.signOut();
      setError(MSG.error);
    }
    return false;
  }

  async function google() {
    setError(null);
    setInfo(null);
    setBusy(true);
    if (s.next) sessionStorage.setItem(NEXT_KEY, safeNextPath(s.next));
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.redirected) return;
    if (res.error) {
      setBusy(false);
      setError(/sign.?ups? not allowed|not allowed|signup/i.test(res.error.message) ? MSG.not_invited : MSG.error);
      return;
    }
    if (await admitGoogle()) goNext();
    setBusy(false);
  }

  useEffect(() => {
    (async () => {
      // An invite email link signs the user in without a password; set-up mode finishes it properly.
      if (s.setup) {
        await supabase.auth.signOut();
        setChecking(false);
        return;
      }
      const params = new URLSearchParams(window.location.search + "&" + window.location.hash.replace(/^#/, ""));
      const oauthErr = params.get("error_description") ?? params.get("error");
      if (oauthErr) {
        setError(/not allowed|signup/i.test(oauthErr) ? MSG.not_invited : MSG.error);
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { data } = await supabase.auth.getSession();
      if (data.session && (await admitGoogle())) goNext();
      else setChecking(false);
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
      goNext();
    } catch {
      setError(MSG.error);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError("Enter your email first.");
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error && !/rate|seconds/i.test(error.message)) return setError(MSG.error);
    setInfo("If that email has an account, a reset link is on its way.");
    setCooldown(60);
  }

  const strength = passwordStrength(password);

  if (checking)
    return (
      <div role="status" aria-busy="true" className="flex min-h-screen items-center justify-center">
        <span className="sr-only">Loading</span>
        <DayRibbon animate={false} className="w-56" />
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <DayRibbon className="mx-auto mb-6 w-60 max-w-full" />
        <h1 className="font-display text-5xl font-bold tracking-tighter">Tempo</h1>
        <p className="mt-2 text-lg text-muted-foreground">Deep work, steady meetings.</p>
        <ul className="mx-auto mt-5 w-fit space-y-2 text-left text-sm">
          <li className="flex items-center gap-2"><CalendarSearch className="h-4 w-4 shrink-0 text-primary" aria-hidden />Finds your focus windows</li>
          <li className="flex items-center gap-2"><Wind className="h-4 w-4 shrink-0 text-gold-text" aria-hidden />Settles you before big meetings</li>
          <li className="flex items-center gap-2"><ChartLine className="h-4 w-4 shrink-0 text-primary" aria-hidden />Shows when you work best</li>
        </ul>
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-subtle bg-card p-5">
        {mode === "setup" && locked && <p role="status" className="mb-4 text-center font-semibold text-accent-text">You've been invited to Tempo.</p>}
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
        <form onSubmit={submit} className="space-y-4" noValidate method="post" action="#">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="email">Email</Label>
              {mode === "setup" && locked && (
                <button type="button" className="text-sm font-semibold text-accent-text underline underline-offset-4" onClick={() => { setLocked(false); setEmail(""); }}>
                  Not you?
                </button>
              )}
            </div>
            <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" className="h-12 text-base" value={email} readOnly={mode === "setup" && locked} aria-readonly={mode === "setup" && locked} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name={mode === "setup" ? "new-password" : "password"}
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
            {mode === "setup" && (
              <div aria-live="polite">
                <div className="mt-2 grid grid-cols-3 gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={cn("h-1.5 rounded-full", password && i <= ["weak", "okay", "strong"].indexOf(strength) ? (strength === "weak" ? "bg-destructive" : strength === "okay" ? "bg-gold" : "bg-primary") : "bg-secondary")} />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {password ? `Strength: ${strength}. ` : ""}At least 8 characters.
                </p>
              </div>
            )}
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {info && <p role="status" className="text-sm text-accent-text">{info}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {mode === "signin" && (
            <button type="button" onClick={forgot} disabled={sending || cooldown > 0} className="tap w-full text-sm font-semibold text-accent-text underline underline-offset-4 disabled:no-underline disabled:opacity-70">
              {sending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Forgot password?"}
            </button>
          )}
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} onClick={google}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.72 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.98 0-.6-.07-1.06-.15-1.52z" /></svg>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

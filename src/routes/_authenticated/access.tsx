import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inviteEmail, listMembers, removeInvite, revokeMember } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, ScreenSkeleton } from "@/components/tempo/bits";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/access")({
  beforeLoad: ({ context }) => {
    if ((context as { role?: string }).role !== "owner") throw redirect({ to: "/settings" });
  },
  head: () => ({
    meta: [
      { title: "Access · Tempo" },
      { name: "description", content: "Invite people and manage members." },
      { property: "og:title", content: "Access · Tempo" },
      { property: "og:description", content: "Invite people and manage members." },
    ],
  }),
  component: Access,
});

const PAGE = 20;

function Access() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteEmail);
  const remove = useServerFn(removeInvite);
  const members = useServerFn(listMembers);
  const revoke = useServerFn(revokeMember);
  const [email, setEmail] = useState("");
  const [manual, setManual] = useState<string | null>(null);
  const [ip, setIp] = useState(0);
  const [mp, setMp] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string; email: string } | null>(null);

  const invites = useQuery({
    queryKey: ["invites", ip],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("allowed_emails")
        .select("email, created_at, invited_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(ip * PAGE, ip * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });
  const mem = useQuery({ queryKey: ["members", mp], queryFn: () => members({ data: { page: mp } }) });

  const add = useMutation({
    mutationFn: () => invite({ data: { email: email.trim(), origin: window.location.origin } }),
    onSuccess: (r) => {
      setEmail("");
      if (r.sent) {
        setManual(null);
        toast.success("Invite sent.");
      } else setManual(r.link);
    },
    onError: () => toast.error("Couldn't save the invite. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const del = useMutation({
    mutationFn: (e: string) => remove({ data: { email: e } }),
    onSuccess: () => toast.success("Invite removed."),
    onError: () => toast.error("Couldn't remove the invite. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const rev = useMutation({
    mutationFn: (id: string) => revoke({ data: { userId: id } }),
    onSuccess: () => toast.success("Member revoked."),
    onError: () => toast.error("Couldn't revoke that member. Try again."),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to Settings"><Link to="/settings"><ChevronLeft /></Link></Button>
        <h1 className="text-2xl font-semibold">Access</h1>
      </header>

      <Card className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) add.mutate(); }} className="space-y-2">
          <Label htmlFor="inv">Invite by email</Label>
          <Input id="inv" type="email" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" disabled={add.isPending}>{add.isPending ? "Sending…" : "Send invite"}</Button>
        </form>
        {manual && (
          <div role="alert" className="space-y-2 rounded-xl border border-gold-text p-3">
            <p className="text-sm">Invite saved, but the email couldn't be sent. Share the link manually.</p>
            <Button variant="secondary" className="w-full" onClick={async () => {
              try {
                await navigator.clipboard.writeText(manual);
                toast.success("Link copied.");
              } catch {
                toast.error("Couldn't copy. Long-press the link instead.");
              }
            }}><Copy /> Copy link</Button>
            <p className="break-all text-xs text-muted-foreground">{manual}</p>
          </div>
        )}
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Invited</h2>
        {invites.isLoading ? <ScreenSkeleton rows={2} header={false} /> : invites.isError ? <p role="alert">Couldn't load invites.</p> : (
          <>
            {invites.data!.rows.length === 0 && <p className="text-muted-foreground">No invites yet.</p>}
            <ul className="space-y-2">
              {invites.data!.rows.map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-2 rounded-2xl border border-subtle bg-card p-3">
                  <span className="min-w-0 truncate">{r.email}</span>
                  <Button variant="ghost" size="sm" disabled={del.isPending} onClick={() => del.mutate(r.email)}>Remove</Button>
                </li>
              ))}
            </ul>
            <Pager page={ip} total={invites.data!.total} size={PAGE} onPage={setIp} />
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Signed up</h2>
        {mem.isLoading ? <ScreenSkeleton rows={2} header={false} /> : mem.isError ? <p role="alert">Couldn't load members.</p> : (
          <>
            <ul className="space-y-2">
              {mem.data!.members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-2xl border border-subtle bg-card p-3">
                  <div className="min-w-0">
                    <div className="truncate">{m.email}</div>
                    <div className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner" : "Member"} · {new Date(m.created_at).toLocaleDateString("en-GB")}</div>
                  </div>
                  {m.role !== "owner" && (
                    <Button variant="ghost" size="sm" className="text-destructive" disabled={rev.isPending} onClick={() => setConfirm({ id: m.user_id, email: m.email })}>Revoke</Button>
                  )}
                </li>
              ))}
            </ul>
            <Pager page={mp} total={mem.data!.total} size={mem.data!.size} onPage={setMp} />
          </>
        )}
      </section>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="break-all font-semibold text-foreground">{confirm?.email}</span> will be signed out and their account and all their data permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Keep member</AlertDialogCancel>
            <AlertDialogAction className="h-12 bg-destructive text-destructive-foreground" onClick={() => { if (confirm) rev.mutate(confirm.id); setConfirm(null); }}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-sm text-muted-foreground">{page + 1} / {pages}</span>
      <Button variant="ghost" size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

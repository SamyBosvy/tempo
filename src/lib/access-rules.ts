export function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

/** Owner is decided only by the server-side OWNER_EMAIL secret. */
export function isOwnerEmail(email: string, ownerEmail: string | undefined): boolean {
  if (!ownerEmail || !ownerEmail.trim()) return false;
  return normaliseEmail(email) === normaliseEmail(ownerEmail);
}

export type InviteStatus = { status: "invited" | "joined"; date: string };

/** Match an allowlist entry against signed-up members (case-insensitive). */
export function inviteStatus(
  invite: { email: string; invited_at: string | null; created_at: string },
  members: { email: string; created_at: string }[],
): InviteStatus {
  const m = members.find((x) => normaliseEmail(x.email) === normaliseEmail(invite.email));
  if (m) return { status: "joined", date: m.created_at };
  return { status: "invited", date: invite.invited_at ?? invite.created_at };
}

export function buildInviteLink(origin: string, email: string): string {
  return `${origin}/?setup=1&email=${encodeURIComponent(normaliseEmail(email))}`;
}

/** Same-origin path to go to after sign-in; anything unsafe falls back to /today. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/today";
  if (/[\u0000-\u001f]/.test(next)) return "/today";
  return next;
}

export type Strength = "weak" | "okay" | "strong";
/** Simple password strength: length plus variety of character types. */
export function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return "weak";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && kinds >= 3) return "strong";
  if (kinds >= 2 || pw.length >= 12) return "okay";
  return "weak";
}

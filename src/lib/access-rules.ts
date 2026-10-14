export function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

/** Owner is decided only by the server-side OWNER_EMAIL secret. */
export function isOwnerEmail(email: string, ownerEmail: string | undefined): boolean {
  if (!ownerEmail || !ownerEmail.trim()) return false;
  return normaliseEmail(email) === normaliseEmail(ownerEmail);
}

export function buildInviteLink(origin: string, email: string): string {
  return `${origin}/?setup=1&email=${encodeURIComponent(normaliseEmail(email))}`;
}

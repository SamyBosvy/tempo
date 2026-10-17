import { describe, it, expect } from "vitest";
import { isOwnerEmail, buildInviteLink } from "./access-rules";

describe("owner rule", () => {
  it("owner only when normalised email equals OWNER_EMAIL", () => {
    expect(isOwnerEmail("  Samy.Bosvy@Gmail.com ", "samy.bosvy@gmail.com")).toBe(true);
    expect(isOwnerEmail("someone@gmail.com", "samy.bosvy@gmail.com")).toBe(false);
  });
  it("no owner when the secret is missing", () => {
    expect(isOwnerEmail("samy.bosvy@gmail.com", undefined)).toBe(false);
    expect(isOwnerEmail("", "")).toBe(false);
  });
  it("invite link opens set-up mode with the email", () => {
    expect(buildInviteLink("https://x.app", "A@B.com")).toBe("https://x.app/?setup=1&email=a%40b.com");
  });
});

import { passwordStrength, safeNextPath } from "./access-rules";
describe("L8 safe next path", () => {
  it("keeps same-origin paths", () => expect(safeNextPath("/history")).toBe("/history"));
  it("rejects protocol-relative paths", () => expect(safeNextPath("//evil.com")).toBe("/today"));
  it("rejects absolute URLs", () => expect(safeNextPath("https://evil.com")).toBe("/today"));
  it("defaults to /today", () => expect(safeNextPath(undefined)).toBe("/today"));
});
describe("L5 password strength", () => {
  it("under 8 is weak", () => expect(passwordStrength("Ab1!")).toBe("weak"));
  it("8 letters+digits is okay", () => expect(passwordStrength("abcdefg1")).toBe("okay"));
  it("12+ mixed is strong", () => expect(passwordStrength("Abcdefgh123!")).toBe("strong"));
});

import { inviteStatus } from "./access-rules";
describe("S10 invite status", () => {
  const members = [{ email: "Joined@Example.com", created_at: "2026-10-14T09:00:00Z" }];
  it("joined when the email matches a member, using the member date", () => {
    const s = inviteStatus({ email: "joined@example.com", invited_at: "2026-10-10T08:00:00Z", created_at: "2026-10-09T08:00:00Z" }, members);
    expect(s).toEqual({ status: "joined", date: "2026-10-14T09:00:00Z" });
  });
  it("invited with the invited_at date when no member matches", () => {
    const s = inviteStatus({ email: "new@example.com", invited_at: "2026-10-10T08:00:00Z", created_at: "2026-10-09T08:00:00Z" }, members);
    expect(s).toEqual({ status: "invited", date: "2026-10-10T08:00:00Z" });
  });
  it("falls back to created_at when the invite email was never sent", () => {
    const s = inviteStatus({ email: "new@example.com", invited_at: null, created_at: "2026-10-09T08:00:00Z" }, []);
    expect(s).toEqual({ status: "invited", date: "2026-10-09T08:00:00Z" });
  });
});

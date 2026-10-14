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

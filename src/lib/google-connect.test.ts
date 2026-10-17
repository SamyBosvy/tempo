import { describe, expect, it, vi } from "vitest";
import { googleCallbackUri, googleResultUrl, googleReturnPath, navigateToGoogle } from "./google-connect";

describe("Calendar OAuth navigation", () => {
  it('preserves the Calendar settings return path without allowing arbitrary children', () => {
    expect(googleReturnPath('/settings/calendar?google=failed#connection')).toBe('/settings/calendar#connection');
    expect(googleReturnPath('/settings/unknown')).toBe('/settings');
    expect(googleResultUrl('https://tempo.example.com', '/settings/calendar', true)).toBe('https://tempo.example.com/settings/calendar?google=connected');
    expect(googleResultUrl('https://tempo.example.com', '/settings/calendar', false, 'scope')).toBe('https://tempo.example.com/settings/calendar?google=failed&google_error=scope');
  });
  it("redirects in the same tab without opening a popup", () => {
    const assign = vi.fn();
    const open = vi.fn();
    const same = {} as Window["self"];
    navigateToGoogle("https://accounts.google.com/oauth", { self: same, top: same, location: { assign } as unknown as Location, open });
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/oauth");
    expect(open).not.toHaveBeenCalled();
  });
  it("opens the actual Google URL with noopener when iframe navigation is blocked", () => {
    const assign = vi.fn();
    const open = vi.fn();
    const top = { location: { assign: () => { throw new Error("Blocked"); } } } as unknown as Window;
    navigateToGoogle("https://accounts.google.com/oauth", { self: {} as Window["self"], top, location: { assign } as unknown as Location, open });
    expect(open).toHaveBeenCalledWith("https://accounts.google.com/oauth", "_blank", "noopener");
    expect(assign).not.toHaveBeenCalled();
  });
  it("uses each current origin for its callback", () => {
    expect(googleCallbackUri("https://id-preview--ae9b9f97-a708-451b-9d71-81a2402a7b21.lovable.app")).toBe("https://id-preview--ae9b9f97-a708-451b-9d71-81a2402a7b21.lovable.app/api/public/google/callback");
    expect(googleCallbackUri("https://tempo.example.com")).toBe("https://tempo.example.com/api/public/google/callback");
  });
  it("returns to Today or Settings and rejects external destinations", () => {
    expect(googleReturnPath("/today")).toBe("/today");
    expect(googleReturnPath("/settings")).toBe("/settings");
    expect(googleReturnPath("//evil.example/today")).toBe("/settings");
    expect(googleReturnPath("/\\evil.example/today")).toBe("/settings");
    expect(googleReturnPath("https://evil.example")).toBe("/settings");
    expect(googleResultUrl("https://tempo.example.com", "/today", true)).toBe("https://tempo.example.com/today?google=connected");
    expect(googleResultUrl("https://tempo.example.com", "/settings", false, "scope")).toBe("https://tempo.example.com/settings?google=failed&google_error=scope");
  });
});
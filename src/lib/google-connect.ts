export const GOOGLE_RETURN_KEY = "tempo.google.returnPath";
export const GOOGLE_CALLBACK_PATH = "/api/public/google/callback";

export function googleReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/settings";
  try {
    const url = new URL(value, "https://tempo.invalid");
    if (url.origin !== "https://tempo.invalid" || !["/today", "/settings", "/settings/calendar"].includes(url.pathname)) return "/settings";
    url.searchParams.delete("google");
    url.searchParams.delete("google_error");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/settings";
  }
}

export function googleCallbackUri(origin: string) {
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new Error("Invalid app origin");
  }
  return `${url.origin}${GOOGLE_CALLBACK_PATH}`;
}

export const GOOGLE_FAILURES = {
  expired: "That link has expired. Try connecting again.",
  cancelled: "Connection cancelled.",
  access: "Google didn't return access. Try again.",
  scope: "Calendar access wasn't granted. Try again and tick the calendar box.",
  save: "Couldn't save the connection. Try again.",
  unavailable: "Couldn't finish the connection. Try again.",
};

export function googleResultUrl(origin: string, path: unknown, ok: boolean, error?: keyof typeof GOOGLE_FAILURES) {
  const target = new URL(googleReturnPath(path), origin);
  target.searchParams.set("google", ok ? "connected" : "failed");
  if (error) target.searchParams.set("google_error", error);
  return target.toString();
}

export function navigateToGoogle(url: string, browser: Pick<Window, "self" | "top" | "location" | "open">) {
  if (browser.self === browser.top) {
    browser.location.assign(url);
    return;
  }
  try {
    if (!browser.top) throw new Error("No top-level window");
    browser.top.location.assign(url);
  } catch {
    // Open the actual URL, never a blank window with an opener relationship.
    browser.open(url, "_blank", "noopener");
  }
}
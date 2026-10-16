import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GOOGLE_SCOPES,
  ReconnectRequired,
  getAccessToken,
  newNonce,
  revokeAndDelete,
  signState,
} from "./google.server";
import { googleCallbackUri, googleReturnPath } from "./google-connect";

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ origin: z.string().url(), returnPath: z.string().max(2048) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const request = getRequest();
    // The browser Origin header is authoritative, including preview proxy hosts.
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    if (data.origin !== origin) throw new Error("The connection must start from this app.");
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    if (!clientId) throw new Error("Google isn't configured yet.");
    const redirectUri = googleCallbackUri(origin);
    const state = signState({
      u: context.userId,
      r: redirectUri,
      p: googleReturnPath(data.returnPath),
      exp: Date.now() + 10 * 60_000,
      n: newNonce(),
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

export type LiveEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
};

export type EventsResult =
  | { status: "connected"; events: LiveEvent[] }
  | { status: "disconnected" | "reconnect"; events: [] };

export const getCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ timeMin: z.string().datetime(), timeMax: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<EventsResult> => {
    let token: string | null;
    try {
      token = await getAccessToken(context.userId);
    } catch (e) {
      if (e instanceof ReconnectRequired) return { status: "reconnect", events: [] };
      throw e;
    }
    if (!token) return { status: "disconnected", events: [] };
    const { data: settings, error } = await context.supabase
      .from("user_settings")
      .select("calendar_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load settings");
    const ids = settings?.calendar_ids?.length ? settings.calendar_ids : ["primary"];
    const out: LiveEvent[] = [];
    for (const calId of ids.slice(0, 10)) {
      let pageToken: string | undefined;
      do {
        const qs = new URLSearchParams({
          timeMin: data.timeMin,
          timeMax: data.timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
          fields: "nextPageToken,items(id,summary,start,end,status,transparency)",
          ...(pageToken ? { pageToken } : {}),
        });
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${qs}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.status === 401) return { status: "reconnect", events: [] };
        if (res.status === 404) break;
        if (!res.ok) throw new Error("Google Calendar request failed");
        const body = (await res.json()) as {
          nextPageToken?: string;
          items?: {
            id: string;
            summary?: string;
            status?: string;
            transparency?: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
          }[];
        };
        pageToken = body.nextPageToken;
        for (const it of body.items ?? []) {
          if (it.status === "cancelled" || it.transparency === "transparent") continue;
          const allDay = !it.start.dateTime;
          out.push({
            id: `${calId}:${it.id}`,
            title: it.summary ?? "Busy",
            start: allDay
              ? new Date(it.start.date + "T00:00:00").toISOString()
              : new Date(it.start.dateTime ?? "").toISOString(),
            end: allDay
              ? new Date(it.end.date + "T00:00:00").toISOString()
              : new Date(it.end.dateTime ?? "").toISOString(),
            allDay,
            calendarId: calId,
          });
        }
      } while (pageToken);
    }
    out.sort((a, b) => a.start.localeCompare(b.start));
    return { status: "connected", events: out };
  });

export const getCalendarList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let token: string | null;
    try {
      token = await getAccessToken(context.userId);
    } catch (e) {
      if (e instanceof ReconnectRequired) return { status: "reconnect" as const, calendars: [] };
      throw e;
    }
    if (!token) return { status: "disconnected" as const, calendars: [] };
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,primary,backgroundColor)",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401) return { status: "reconnect" as const, calendars: [] };
    if (!res.ok) throw new Error("Could not load calendars");
    const body = (await res.json()) as {
      items?: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[];
    };
    return {
      status: "connected" as const,
      calendars: (body.items ?? []).map((c) => ({
        id: c.primary ? "primary" : c.id,
        name: c.summary,
        primary: !!c.primary,
        color: /^#[0-9a-f]{6}$/i.test(c.backgroundColor ?? "") ? c.backgroundColor! : null,
      })),
    };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await revokeAndDelete(context.userId);
    const { error } = await context.supabase
      .from("user_settings")
      .update({ google_email: null, google_connected_at: null })
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not update settings");
    return { ok: true };
  });

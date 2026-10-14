import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { GoogleConnectResult } from "./GoogleConnectResult";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

describe("Calendar connection result", () => {
  it("refreshes settings and both calendar queries on successful return, only once", async () => {
    window.history.replaceState({}, "", "/today?google=connected");
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => { render(<QueryClientProvider client={qc}><GoogleConnectResult /></QueryClientProvider>); });
    expect(toast.success).toHaveBeenCalledWith("Calendar connected.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["settings"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["calendars"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["gcal"] });
    expect(window.location.search).toBe("");
  });
  it("shows the specific failure without refreshing calendar queries", () => {
    sessionStorage.setItem("tempo.google.returnPath", "/today");
    window.history.replaceState({}, "", "/settings?google=failed&google_error=scope");
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<QueryClientProvider client={qc}><GoogleConnectResult /></QueryClientProvider>);
    expect(toast.error).toHaveBeenCalledWith("Calendar access wasn't granted. Try again and tick the calendar box.");
    expect(invalidate).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/settings");
    expect(sessionStorage.getItem("tempo.google.returnPath")).toBeNull();
  });
});
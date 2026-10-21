import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { DiscardFocusSession } from "./DiscardFocusSession";
import { focusTimer, setTimerUser } from "@/lib/focus-timer";
import { dayFocusMinutes, focusDestination } from "@/lib/focus-extras";
import { __resetQueueForTests, attentionRows, pendingRows, setQueueUser } from "@/lib/offline-queue";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/haptics", () => ({ tapHaptic: vi.fn() }));

describe("Discard focus session", () => {
  beforeEach(() => {
    localStorage.clear();
    setTimerUser("discard-test");
    focusTimer.clear();
    __resetQueueForTests();
    setQueueUser("discard-test");
    vi.clearAllMocks();
    focusTimer.start({ targetMin: 25, intention: "Unsaved work", energyBefore: 3, nextEventAt: null });
    focusTimer.park("Unsaved thought");
    focusTimer.interrupt("message", "external");
    focusTimer.setElapsedMin(7);
  });
  afterEach(() => { cleanup(); focusTimer.clear(); });

  it("clears the entire timer without enqueuing or writing a session or interruption", () => {
    const onDiscard = vi.fn();
    render(<DiscardFocusSession onDiscard={onDiscard} />);
    expect(focusTimer.get()?.parked).toEqual(["Unsaved thought"]);
    expect(focusTimer.get()?.interruptions).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Discard session" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard", exact: true }));
    expect(focusTimer.get()).toBeNull();
    expect(localStorage.getItem("tempo.focus.v1.discard-test")).toBeNull();
    expect(pendingRows("focus_sessions")).toEqual([]);
    expect(pendingRows("interruptions")).toEqual([]);
    expect(attentionRows()).toEqual([]);
    expect(localStorage.getItem("tempo.queue.v1.discard-test")).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Session discarded.");
  });

  it("Keep it preserves the session and its thoughts and interruptions", () => {
    const before = focusTimer.get();
    const onDiscard = vi.fn();
    render(<DiscardFocusSession onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard session" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(focusTimer.get()).toEqual(before);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("removes live minutes from Today, keeps saved minutes, and allows a fresh start", () => {
    const day = new Date();
    const saved = [{ id: "saved-session", actual_min: 25 }];
    expect(dayFocusMinutes(saved, focusTimer.get(), day, Date.now())).toBe(32);
    render(<DiscardFocusSession onDiscard={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard session" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard", exact: true }));
    expect(dayFocusMinutes(saved, focusTimer.get(), day, Date.now())).toBe(25);
    expect(focusDestination({ minutes: 50 })).toEqual({ to: "/focus", search: { minutes: 50 } });
    focusTimer.start({ targetMin: 50, intention: "Fresh work", energyBefore: null, nextEventAt: null });
    expect(focusTimer.get()).toMatchObject({ targetMin: 50, intention: "Fresh work", interruptions: [] });
    expect(focusTimer.get()?.parked).toBeUndefined();
  });
});
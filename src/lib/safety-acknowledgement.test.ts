import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(cleanup);

describe("Safety acknowledgement", () => {
  it("dismisses immediately before saving completes", async () => {
    const { useSafetyAcknowledgement } = await import("./safety-acknowledgement");
    const save = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() => useSafetyAcknowledgement({ userId: "immediate", acknowledged: false, save }));
    act(() => result.current.acknowledge());
    expect(result.current.open).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("tempo.safetyAck.pending.immediate")).toBeTruthy();
  });

  it("stays dismissed after failure, rollback and remount in this session", async () => {
    const { useSafetyAcknowledgement } = await import("./safety-acknowledgement");
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const props = { userId: "failed", acknowledged: false, save };
    const first = renderHook(() => useSafetyAcknowledgement(props));
    await act(async () => first.result.current.acknowledge());
    expect(first.result.current.open).toBe(false);
    first.unmount();
    const second = renderHook(() => useSafetyAcknowledgement(props));
    expect(second.result.current.open).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("tempo.safetyAck.pending.failed")).toBeTruthy();
  });

  it("retries the original acknowledgement on next launch and clears it on success", async () => {
    const timestamp = "2026-10-14T12:31:00.000Z";
    localStorage.setItem("tempo.safetyAck.pending.retry", timestamp);
    const { useSafetyAcknowledgement } = await import("./safety-acknowledgement");
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSafetyAcknowledgement({ userId: "retry", acknowledged: false, save }));
    expect(result.current.open).toBe(false);
    expect(save).toHaveBeenCalledWith({ safety_ack_at: timestamp });
    await waitFor(() => expect(localStorage.getItem("tempo.safetyAck.pending.retry")).toBeNull());
  });

  it("does not write without an explicit current or pending acknowledgement", async () => {
    const { useSafetyAcknowledgement } = await import("./safety-acknowledgement");
    const save = vi.fn();
    const { result } = renderHook(() => useSafetyAcknowledgement({ userId: "new", acknowledged: false, save }));
    expect(result.current.open).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not reuse another user's pending acknowledgement", async () => {
    localStorage.setItem("tempo.safetyAck.pending.someone-else", "2026-10-14T12:31:00.000Z");
    const { useSafetyAcknowledgement } = await import("./safety-acknowledgement");
    const save = vi.fn();
    const { result } = renderHook(() => useSafetyAcknowledgement({ userId: "current", acknowledged: false, save }));
    expect(result.current.open).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
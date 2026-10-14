// Ordered, durable write queue. Every log (sessions, primes, ratings) goes
// through here so nothing is lost offline. Rows carry client-generated ids,
// so replays are idempotent.
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QueueTable = "focus_sessions" | "interruptions" | "energy_ratings" | "prime_sessions";
type Op = { qid: string; table: QueueTable; row: Record<string, unknown> };

const KEY = "tempo.queue.v1";
const listeners = new Set<() => void>();
let qc: QueryClient | null = null;
let flushing = false;
let snapshot: Op[] = [];
let loaded = false;

function read(): Op[] {
  if (typeof window === "undefined") return [];
  if (!loaded) {
    try {
      snapshot = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      snapshot = [];
    }
    loaded = true;
  }
  return snapshot;
}
function write(ops: Op[]) {
  snapshot = ops;
  localStorage.setItem(KEY, JSON.stringify(ops));
  listeners.forEach((l) => l());
}

export function bindQueryClient(client: QueryClient) {
  qc = client;
}

export function pendingRows(table: QueueTable) {
  return read().filter((o) => o.table === table).map((o) => o.row);
}

export function enqueue(table: QueueTable, row: Record<string, unknown>) {
  write([...read(), { qid: crypto.randomUUID(), table, row }]);
  void flush();
}

function isNetworkError(msg: string) {
  return !navigator.onLine || /fetch|network|load failed/i.test(msg);
}

export async function flush() {
  if (flushing || typeof window === "undefined") return;
  const start = read();
  if (!start.length) return;
  flushing = true;
  const wasOffline = !navigator.onLine || start.length > 1;
  let synced = 0;
  try {
    while (read().length) {
      const op = read()[0];
      const { error } = await supabase
        .from(op.table)
        .upsert(op.row as never, { onConflict: "id", ignoreDuplicates: true });
      if (error && error.code !== "23505") {
        if (!isNetworkError(error.message)) toast.error("Couldn't save an entry. Will retry.");
        break;
      }
      write(read().slice(1));
      synced++;
    }
  } catch {
    // network down — keep the queue
  } finally {
    flushing = false;
  }
  if (synced > 0) {
    qc?.invalidateQueries();
    if (wasOffline && read().length === 0) toast.success("Synced. Everything's saved.");
  }
}

export function useQueueSize() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read().length,
    () => 0,
  );
}

export function startQueueSync() {
  const on = () => void flush();
  window.addEventListener("online", on);
  const t = window.setInterval(on, 30_000);
  void flush();
  return () => {
    window.removeEventListener("online", on);
    window.clearInterval(t);
  };
}

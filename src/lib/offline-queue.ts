// Ordered, durable write queue. Every log (sessions, primes, ratings) goes
// through here so nothing is lost offline. Rows carry client-generated ids,
// so replays are idempotent. A row that keeps failing (non-network) moves to
// a local "needs attention" list after 3 attempts so it never blocks others.
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QueueTable = "focus_sessions" | "interruptions" | "energy_ratings" | "prime_sessions";
export type Op = { qid: string; table: QueueTable; row: Record<string, unknown>; attempts?: number; lastError?: string };

export const MAX_ATTEMPTS = 3;
const KEY = "tempo.queue.v1";
const ATTENTION_KEY = "tempo.queue.attention.v1";
const listeners = new Set<() => void>();
let qc: QueryClient | null = null;
let flushing = false;
let snapshot: Op[] = [];
let attention: Op[] = [];
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    snapshot = [];
  }
  try {
    attention = JSON.parse(localStorage.getItem(ATTENTION_KEY) ?? "[]");
  } catch {
    attention = [];
  }
  loaded = true;
}
function read(): Op[] {
  load();
  return snapshot;
}
function readAttention(): Op[] {
  load();
  return attention;
}
function write(ops: Op[]) {
  snapshot = ops;
  localStorage.setItem(KEY, JSON.stringify(ops));
  listeners.forEach((l) => l());
}
function writeAttention(ops: Op[]) {
  attention = ops;
  localStorage.setItem(ATTENTION_KEY, JSON.stringify(ops));
  listeners.forEach((l) => l());
}

/** Test hook: forget the in-memory copy so state is re-read from storage. */
export function __resetQueueForTests() {
  loaded = false;
  flushing = false;
  snapshot = [];
  attention = [];
}

export function bindQueryClient(client: QueryClient) {
  qc = client;
}

export function pendingRows(table: QueueTable) {
  return read().filter((o) => o.table === table).map((o) => o.row);
}

export function enqueue(table: QueueTable, row: Record<string, unknown>) {
  write([...read(), { qid: crypto.randomUUID(), table, row, attempts: 0 }]);
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
  let movedToAttention = 0;
  let failedNow = false;
  try {
    // Visit each queued row at most once per flush, in order.
    for (const qid of start.map((o) => o.qid)) {
      const op = read().find((o) => o.qid === qid);
      if (!op) continue;
      let message: string | null = null;
      try {
        const { error } = await supabase
          .from(op.table)
          .upsert(op.row as never, { onConflict: "id", ignoreDuplicates: true });
        if (error && error.code !== "23505") message = error.message || "error";
      } catch (e) {
        message = e instanceof Error ? e.message : "network";
        if (isNetworkError(message)) break; // offline: stop, keep everything
      }
      if (message === null) {
        write(read().filter((o) => o.qid !== qid));
        synced++;
        continue;
      }
      if (isNetworkError(message)) break;
      const attempts = (op.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        write(read().filter((o) => o.qid !== qid));
        writeAttention([...readAttention(), { ...op, attempts, lastError: message }]);
        movedToAttention++;
      } else {
        write(read().map((o) => (o.qid === qid ? { ...o, attempts, lastError: message! } : o)));
        failedNow = true;
      }
    }
  } finally {
    flushing = false;
  }
  if (movedToAttention) toast.error("An entry couldn't be saved. See Settings to retry or discard it.");
  else if (failedNow) toast.error("Couldn't save an entry. Will retry.");
  if (synced > 0) {
    qc?.invalidateQueries();
    if (wasOffline && read().length === 0 && !movedToAttention) toast.success("Synced. Everything's saved.");
  }
}

export function attentionRows() {
  return readAttention();
}

export function retryAttention(qid: string) {
  const op = readAttention().find((o) => o.qid === qid);
  if (!op) return;
  writeAttention(readAttention().filter((o) => o.qid !== qid));
  write([...read(), { ...op, attempts: 0, lastError: undefined }]);
  return flush();
}

export function discardAttention(qid: string) {
  writeAttention(readAttention().filter((o) => o.qid !== qid));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useQueueSize() {
  return useSyncExternalStore(subscribe, () => read().length, () => 0);
}

const EMPTY: Op[] = [];
export function useAttentionRows() {
  return useSyncExternalStore(subscribe, readAttention, () => EMPTY);
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

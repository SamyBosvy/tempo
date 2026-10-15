import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
const listeners = new Set<() => void>();
let lastSynced: number | null = null;
export function markSynced(at = Date.now()) {
  lastSynced = at;
  listeners.forEach(listener => listener());
}
export function useLastSynced() {
  return useSyncExternalStore(listener => {listeners.add(listener); return () => {listeners.delete(listener);};}, () => lastSynced, () => null);
}
export function trackQuerySync(client: QueryClient) {
  return client.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'success' && !event.action.manual) markSynced(event.query.state.dataUpdatedAt);
  });
}
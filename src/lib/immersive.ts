// UI-only flag: the running focus screen asks the shell to hide nav and banners.
import { useSyncExternalStore } from "react";

let on = false;
const ls = new Set<() => void>();
export function setImmersive(v: boolean) {
  if (on === v) return;
  on = v;
  ls.forEach((l) => l());
}
export function useImmersive() {
  return useSyncExternalStore(
    (cb) => {
      ls.add(cb);
      return () => ls.delete(cb);
    },
    () => on,
    () => false,
  );
}

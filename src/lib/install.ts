import { useEffect, useState } from 'react';
import { installPlatform, type InstallPlatform } from './install-rules';
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
let attached = false;
export function initialiseInstall() {
 if (attached || typeof window === 'undefined') return;
 attached = true;
 window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e as InstallPrompt; listeners.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { prompt = null; listeners.forEach(f => f()); });
}
export function useInstall() {
  const [state, setState] = useState({ installed: false, dismissed: false, ios: false, available: false, platform: 'other' as InstallPlatform });
  useEffect(() => {
    const refresh = () => { const installed = matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); const platform = installPlatform(navigator.userAgent, navigator.maxTouchPoints); const ios = platform === 'ios-safari'; let dismissed = false; try { dismissed = localStorage.getItem('tempo.install.dismissed') === '1'; } catch {} setState({ installed, ios, dismissed, available: ios || Boolean(prompt), platform }); };
    initialiseInstall();
    listeners.add(refresh); const m = matchMedia('(display-mode: standalone)'); m.addEventListener('change', refresh); refresh(); return () => { listeners.delete(refresh); m.removeEventListener('change', refresh); };
  }, []);
  return { ...state, dismiss() { try { localStorage.setItem('tempo.install.dismissed', '1'); } catch {} setState(s => ({ ...s, dismissed: true })); }, async install() { const current = prompt; if (!current) return false; prompt = null; listeners.forEach(f => f()); await current.prompt(); await current.userChoice; return true; } };
}

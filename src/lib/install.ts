import { useEffect, useState } from 'react';
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
let attached = false;
let appInstalled = false;
export function initialiseInstall() {
 if (attached || typeof window === 'undefined') return;
 attached = true;
 window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e as InstallPrompt; listeners.forEach(f => f()); });
 window.addEventListener('appinstalled', () => { appInstalled = true; prompt = null; listeners.forEach(f => f()); });
}
export function useInstall() {
  const [state, setState] = useState({ installed: true, dismissed: false, ios: false, available: false });
  useEffect(() => {
    const refresh = () => { const installed = appInstalled || matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent); let dismissed = false; try { dismissed = localStorage.getItem('tempo.install.dismissed') === '1'; } catch {} setState({ installed, ios, dismissed, available: ios || Boolean(prompt) }); };
    initialiseInstall();
    listeners.add(refresh); const m = matchMedia('(display-mode: standalone)'); m.addEventListener('change', refresh); refresh(); return () => { listeners.delete(refresh); m.removeEventListener('change', refresh); };
  }, []);
  return { ...state, dismiss() { try { localStorage.setItem('tempo.install.dismissed', '1'); } catch {} setState(s => ({ ...s, dismissed: true })); }, async install() { if (!prompt) return; await prompt.prompt(); const result = await prompt.userChoice; if (result.outcome === 'accepted') { prompt = null; listeners.forEach(f => f()); } } };
}

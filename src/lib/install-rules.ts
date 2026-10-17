export function installVisible(installed: boolean, dismissed: boolean, available: boolean, permanent = false) {
  return !installed && (permanent || (available && !dismissed));
}
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android-chrome' | 'samsung' | 'firefox' | 'desktop-chromium' | 'other';
export function installPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (ios) return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent) ? 'ios-safari' : 'ios-other';
  if (/SamsungBrowser/.test(userAgent)) return 'samsung';
  if (/Firefox/.test(userAgent)) return 'firefox';
  if (/Android/.test(userAgent) && /Chrome/.test(userAgent)) return 'android-chrome';
  if (/Chrome|Edg\//.test(userAgent)) return 'desktop-chromium';
  return 'other';
}
export const INSTALL_STEPS: Record<InstallPlatform, readonly string[]> = {
  'ios-safari': ['Tap Share in Safari.', 'Choose Add to Home Screen (under More if needed).', 'Tap Add.'],
  'ios-other': ['Open this Tempo address in Safari first.', 'Tap Share, then Add to Home Screen.', 'Tap Add.'],
  'android-chrome': ['Open Chrome’s ⋮ menu.', 'Choose Install app or Add to Home screen.', 'Confirm Install or Add.'],
  samsung: ['Open Samsung Internet’s ☰ menu.', 'Choose Add page to, then Home screen (or Add to Home screen).', 'Confirm Add or Install.'],
  firefox: ['On Android, open Firefox’s ⋮ menu and choose Install or Add to Home screen.', 'Confirm Add. On desktop, open this address in Chrome or Edge to install.'],
  'desktop-chromium': ['Click the install icon in the address bar, or open the ⋮ / … menu.', 'Choose Install Tempo (in Chrome, it may be under Cast, save and share; in Edge, under Apps).', 'Confirm Install.'],
  other: ['Open this address in Chrome or Edge on desktop, Chrome on Android, or Safari on iPhone/iPad.', 'Choose Install app or Add to Home Screen from the browser menu.'],
};
export function updateCanRefresh(waiting: boolean, focusRunning: boolean, primeRunning: boolean) {
  return waiting && !focusRunning && !primeRunning;
}

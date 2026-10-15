import { useEffect } from 'react';
import { resolveTheme } from './settings-rules';

export function useApplyTheme(choice: string | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      document.documentElement.classList.toggle('light', resolveTheme(choice, media.matches) === 'light');
      const colour = getComputedStyle(document.documentElement).getPropertyValue('--theme-colour').trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colour);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [choice]);
}
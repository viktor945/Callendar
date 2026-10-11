import { staticPreview } from './api';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | null = null;
if (!staticPreview) window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPrompt; });
export async function installApp() {
  if (!installPrompt) return false;
  await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return true;
}
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export async function registerWorker() { await navigator.serviceWorker.register('/sw.js'); return navigator.serviceWorker.ready; }
export function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bytes, char => char.charCodeAt(0));
}

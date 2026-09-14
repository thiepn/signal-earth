export type ServiceWorkerReleaseState = 'unsupported' | 'registering' | 'ready' | 'offline-ready' | 'error';

export async function registerSignalEarthServiceWorker(onState?: (state: ServiceWorkerReleaseState) => void): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    onState?.('unsupported');
    return null;
  }
  onState?.('registering');
  try {
    const base = import.meta.env.BASE_URL || './';
    const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    await navigator.serviceWorker.ready;
    onState?.(registration.active ? 'offline-ready' : 'ready');
    return registration;
  } catch (error) {
    console.warn('Signal Earth service worker registration failed.', error);
    onState?.('error');
    return null;
  }
}

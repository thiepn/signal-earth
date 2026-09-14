const LAST_SHARE_URL_KEY = 'signal-earth:last-share-url:v1';

export function rememberCanonicalShareUrl(url: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_SHARE_URL_KEY, url);
  } catch {
    // Storage can be unavailable in privacy modes. Sharing itself must still work.
  }
}

export function readCanonicalShareUrl(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LAST_SHARE_URL_KEY);
  } catch {
    return null;
  }
}

export function clearCanonicalShareUrl(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LAST_SHARE_URL_KEY);
  } catch {
    // fail open
  }
}

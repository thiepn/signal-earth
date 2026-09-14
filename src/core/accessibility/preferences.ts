export type MotionPreference = 'system' | 'reduced' | 'full';
export type ContrastPreference = 'system' | 'high' | 'normal';

export interface AccessibilityPreferences {
  motion: MotionPreference;
  contrast: ContrastPreference;
}

export interface SystemAccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  forcedColors: boolean;
}

const STORAGE_KEY = 'signal-earth:accessibility:v1';

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  motion: 'system',
  contrast: 'system',
};

function mediaMatches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function detectSystemAccessibilityPreferences(): SystemAccessibilityPreferences {
  return {
    reducedMotion: mediaMatches('(prefers-reduced-motion: reduce)'),
    highContrast: mediaMatches('(prefers-contrast: more)'),
    forcedColors: mediaMatches('(forced-colors: active)'),
  };
}

export function effectiveReducedMotion(preferences: AccessibilityPreferences, system: SystemAccessibilityPreferences): boolean {
  if (preferences.motion === 'reduced') return true;
  if (preferences.motion === 'full') return false;
  return system.reducedMotion;
}

export function effectiveHighContrast(preferences: AccessibilityPreferences, system: SystemAccessibilityPreferences): boolean {
  if (preferences.contrast === 'high') return true;
  if (preferences.contrast === 'normal') return false;
  return system.highContrast || system.forcedColors;
}

export function loadAccessibilityPreferences(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): AccessibilityPreferences {
  if (!storage) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    const motion: MotionPreference = parsed.motion === 'reduced' || parsed.motion === 'full' || parsed.motion === 'system' ? parsed.motion : 'system';
    const contrast: ContrastPreference = parsed.contrast === 'high' || parsed.contrast === 'normal' || parsed.contrast === 'system' ? parsed.contrast : 'system';
    return { motion, contrast };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

export function saveAccessibilityPreferences(preferences: AccessibilityPreferences, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  if (!storage) return;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* storage may be unavailable */ }
}

export function subscribeSystemAccessibilityPreferences(listener: (preferences: SystemAccessibilityPreferences) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const queries = [
    window.matchMedia('(prefers-reduced-motion: reduce)'),
    window.matchMedia('(prefers-contrast: more)'),
    window.matchMedia('(forced-colors: active)'),
  ];
  const emit = () => listener(detectSystemAccessibilityPreferences());
  for (const query of queries) query.addEventListener?.('change', emit);
  return () => { for (const query of queries) query.removeEventListener?.('change', emit); };
}

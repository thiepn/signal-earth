import { describe, expect, it } from 'vitest';
import {
  effectiveHighContrast,
  effectiveReducedMotion,
  loadAccessibilityPreferences,
  saveAccessibilityPreferences,
  type AccessibilityPreferences,
} from '../core/accessibility/preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

describe('accessibility preferences', () => {
  it('defaults to system preferences', () => {
    const prefs = loadAccessibilityPreferences(memoryStorage());
    expect(prefs).toEqual({ motion: 'system', contrast: 'system' });
    expect(effectiveReducedMotion(prefs, { reducedMotion: true, highContrast: false, forcedColors: false })).toBe(true);
  });

  it('allows explicit motion and contrast overrides', () => {
    const system = { reducedMotion: true, highContrast: false, forcedColors: false };
    expect(effectiveReducedMotion({ motion: 'full', contrast: 'system' }, system)).toBe(false);
    expect(effectiveHighContrast({ motion: 'system', contrast: 'high' }, system)).toBe(true);
  });

  it('persists only valid values', () => {
    const storage = memoryStorage();
    const prefs: AccessibilityPreferences = { motion: 'reduced', contrast: 'high' };
    saveAccessibilityPreferences(prefs, storage);
    expect(loadAccessibilityPreferences(storage)).toEqual(prefs);
  });
});

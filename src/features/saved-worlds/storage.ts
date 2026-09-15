import type { LayerId } from '../../shared/types/layers';
import { parseShareView } from '../share/shareState';
import type { SavedWorld, SavedWorldSummary } from './types';

export const SAVED_WORLDS_STORAGE_KEY = 'signal-earth:saved-worlds:v1';
export const MAX_SAVED_WORLDS = 24;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const LAYER_ORDER: LayerId[] = ['weather', 'earthquakes', 'events', 'orbit', 'aurora'];

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function normalizeSavedWorldName(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return (collapsed || 'Saved World').slice(0, 48);
}

function safeId(now: number): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `world-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeSavedWorldUrl(url: string): SavedWorldSummary | null {
  const parsed = parseShareView(url);
  if (!parsed?.pointOfView || !parsed.visualMode || !parsed.layers || !parsed.timelineRange) return null;
  return {
    visualMode: parsed.visualMode,
    timelineRange: parsed.timelineRange,
    enabledLayers: LAYER_ORDER.filter((layer) => parsed.layers?.[layer]),
    target: parsed.selectedEntityId ? String(parsed.selectedEntityId) : null,
    timeMode: parsed.clock?.mode ?? 'unknown',
  };
}

export function createSavedWorld(name: string, url: string, now = Date.now(), id = safeId(now)): SavedWorld | null {
  const summary = summarizeSavedWorldUrl(url);
  if (!summary) return null;
  return {
    id,
    name: normalizeSavedWorldName(name),
    url,
    createdAt: now,
    updatedAt: now,
    summary,
  };
}

function validWorld(value: unknown): SavedWorld | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedWorld>;
  if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.name !== 'string' || typeof candidate.url !== 'string') return null;
  if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) return null;
  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) return null;
  const summary = summarizeSavedWorldUrl(candidate.url);
  if (!summary) return null;
  return {
    id: candidate.id.slice(0, 120),
    name: normalizeSavedWorldName(candidate.name),
    url: candidate.url,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    summary,
  };
}

export function loadSavedWorlds(storage: StorageLike | null = safeStorage()): SavedWorld[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_WORLDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(validWorld).filter((world): world is SavedWorld => world !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SAVED_WORLDS);
  } catch {
    return [];
  }
}

export function persistSavedWorlds(worlds: SavedWorld[], storage: StorageLike | null = safeStorage()): SavedWorld[] {
  const normalized = worlds.map(validWorld).filter((world): world is SavedWorld => world !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SAVED_WORLDS);
  if (!storage) return normalized;
  try { storage.setItem(SAVED_WORLDS_STORAGE_KEY, JSON.stringify(normalized)); } catch { /* quota/privacy: keep runtime state */ }
  return normalized;
}

export function upsertSavedWorld(world: SavedWorld, storage: StorageLike | null = safeStorage()): SavedWorld[] {
  const current = loadSavedWorlds(storage);
  const existing = current.find((item) => item.id === world.id);
  const next = {
    ...world,
    name: normalizeSavedWorldName(world.name),
    createdAt: existing?.createdAt ?? world.createdAt,
  };
  return persistSavedWorlds([next, ...current.filter((item) => item.id !== next.id)], storage);
}

export function renameSavedWorld(id: string, name: string, now = Date.now(), storage: StorageLike | null = safeStorage()): SavedWorld[] {
  return persistSavedWorlds(loadSavedWorlds(storage).map((world) => world.id === id ? { ...world, name: normalizeSavedWorldName(name), updatedAt: now } : world), storage);
}

export function removeSavedWorld(id: string, storage: StorageLike | null = safeStorage()): SavedWorld[] {
  return persistSavedWorlds(loadSavedWorlds(storage).filter((world) => world.id !== id), storage);
}

export function clearSavedWorlds(storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try { storage.removeItem?.(SAVED_WORLDS_STORAGE_KEY); } catch { /* fail open */ }
}

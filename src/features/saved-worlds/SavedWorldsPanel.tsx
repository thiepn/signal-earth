import { useMemo, useState } from 'react';
import { readCanonicalShareUrl } from './capture';
import { createSavedWorld, loadSavedWorlds, MAX_SAVED_WORLDS, removeSavedWorld, upsertSavedWorld } from './storage';
import type { SavedWorld } from './types';

interface SavedWorldsPanelProps {
  onCaptureCurrentView(): void;
}

function layerLabel(value: string): string {
  if (value === 'earthquakes') return 'Quakes';
  if (value === 'events') return 'Events';
  if (value === 'weather') return 'Weather';
  if (value === 'orbit') return 'Orbit';
  if (value === 'aurora') return 'Aurora';
  return value;
}

function worldMeta(world: SavedWorld): string {
  const layers = world.summary.enabledLayers.map(layerLabel).join(' + ') || 'Globe only';
  const time = world.summary.timeMode === 'live' ? 'LIVE' : world.summary.timeMode.toUpperCase();
  return `${world.summary.visualMode.toUpperCase()} · ${layers} · ${world.summary.timelineRange.toUpperCase()} · ${time}`;
}

function localLoadUrl(savedUrl: string): string | null {
  try {
    const source = new URL(savedUrl);
    const target = new URL(window.location.href);
    target.search = source.search;
    target.hash = '';
    return target.toString();
  } catch {
    return null;
  }
}

async function copy(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    input.remove();
    return ok;
  } catch {
    return false;
  }
}

export function SavedWorldsPanel({ onCaptureCurrentView }: SavedWorldsPanelProps) {
  const [worlds, setWorlds] = useState<SavedWorld[]>(() => loadSavedWorlds());
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const remaining = useMemo(() => Math.max(0, MAX_SAVED_WORLDS - worlds.length), [worlds.length]);

  const captureUrl = (): string | null => {
    onCaptureCurrentView();
    return readCanonicalShareUrl();
  };

  const saveCurrent = () => {
    const url = captureUrl();
    if (!url) {
      setStatus('Current view could not be serialized.');
      return;
    }
    const world = createSavedWorld(name, url);
    if (!world) {
      setStatus('Current view is not a valid share-state snapshot.');
      return;
    }
    const next = upsertSavedWorld(world);
    setWorlds(next);
    setName('');
    setStatus(`Saved locally as “${world.name}”. The canonical view link was also copied.`);
  };

  const updateWorld = (world: SavedWorld) => {
    const url = captureUrl();
    if (!url) {
      setStatus('Current view could not be serialized.');
      return;
    }
    const updated = createSavedWorld(world.name, url, Date.now(), world.id);
    if (!updated) {
      setStatus('Current view is not a valid share-state snapshot.');
      return;
    }
    setWorlds(upsertSavedWorld(updated));
    setStatus(`Updated “${world.name}” from the current observatory state.`);
  };

  const loadWorld = (world: SavedWorld) => {
    const url = localLoadUrl(world.url);
    if (!url) {
      setStatus('Saved view is invalid and cannot be loaded.');
      return;
    }
    window.location.assign(url);
  };

  const deleteWorld = (world: SavedWorld) => {
    setWorlds(removeSavedWorld(world.id));
    setStatus(`Deleted “${world.name}”.`);
  };

  const copyWorld = async (world: SavedWorld) => {
    const copied = await copy(world.url);
    setStatus(copied ? `Copied share link for “${world.name}”.` : 'Clipboard access is unavailable.');
  };

  return (
    <section className="saved-worlds" aria-label="Saved Worlds">
      <div className="saved-worlds__capture">
        <label>
          <span>Name this view</span>
          <input value={name} maxLength={48} placeholder="Home, Europe weather, ISS…" onChange={(event) => setName(event.target.value)} />
        </label>
        <button className="primary-button" type="button" onClick={saveCurrent}>Save current world</button>
      </div>

      <div className="saved-worlds__capacity">
        <span>{worlds.length.toLocaleString()} saved</span>
        <span>{remaining.toLocaleString()} slots free</span>
      </div>

      {status && <p className="saved-worlds__status" role="status">{status}</p>}

      {worlds.length === 0 ? (
        <div className="saved-worlds__empty">
          <strong>No saved worlds yet</strong>
          <span>Save the current observatory state to return to the same camera, layers, time, filters and public selection later.</span>
        </div>
      ) : (
        <div className="saved-worlds__list">
          {worlds.map((world) => (
            <article className="saved-world-card" key={world.id}>
              <button className="saved-world-card__load" type="button" onClick={() => loadWorld(world)}>
                <span className="saved-world-card__glyph" aria-hidden="true">◉</span>
                <span className="saved-world-card__copy">
                  <strong>{world.name}</strong>
                  <small>{worldMeta(world)}</small>
                  {world.summary.target && <em>Target · {world.summary.target.replace(/^satellite:|^earthquake:|^event:/, '')}</em>}
                </span>
              </button>
              <div className="saved-world-card__actions">
                <button type="button" onClick={() => updateWorld(world)}>Update</button>
                <button type="button" onClick={() => void copyWorld(world)}>Copy</button>
                <button type="button" className="is-destructive" onClick={() => deleteWorld(world)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="settings-hint saved-worlds__privacy">Saved Worlds stay in this browser. Observer coordinates and accessibility preferences are not embedded; a remembered observer location remains governed by Above Me’s separate privacy control.</p>
    </section>
  );
}

import type { EntityId } from '../../shared/types/entities';
import type { OrbitTrailMode } from './playback';

export type OrbitScaleMode = 'true' | 'visual';
export type OrbitCameraMode = 'none' | 'follow' | 'orbit';
export type OrbitTrackKind = 'orbit' | OrbitTrailMode;

export interface OrbitTrack {
  sequence: number;
  satelliteId: EntityId;
  kind: OrbitTrackKind;
  centerTimestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  periodMinutes: number;
  sampleCount: number;
  /** Packed [latitude deg, longitude deg, true altitude km]. */
  positions: Float32Array;
}

/**
 * Visual mode exaggerates low orbits strongly while keeping MEO/GEO useful.
 * The factor is always exposed in the UI so this cannot be mistaken for true scale.
 */
export function visualAltitudeFactor(altitudeKm: number): number {
  if (!Number.isFinite(altitudeKm) || altitudeKm <= 0) return 1;
  if (altitudeKm <= 2_000) return 4;
  if (altitudeKm <= 12_000) return 2.2;
  if (altitudeKm <= 28_000) return 1.55;
  return 1.18;
}

export function displayAltitudeKm(altitudeKm: number, mode: OrbitScaleMode): number {
  return mode === 'true' ? altitudeKm : altitudeKm * visualAltitudeFactor(altitudeKm);
}

import type { EntityId, GeoCoordinates } from '../../shared/types/entities';

export type CameraMode = 'free' | 'focusing' | 'focused' | 'following' | 'cinematic';

export interface CameraState {
  mode: CameraMode;
  targetEntityId: EntityId | null;
}

export interface CameraTarget {
  coordinates: GeoCoordinates;
  /** Globe.gl camera altitude in globe-radius units, not kilometers. */
  altitude?: number;
  durationMs?: number;
}

export interface CameraPointOfView {
  lat?: number;
  lng?: number;
  altitude?: number;
}

export interface CameraRuntime {
  pointOfView(target: CameraPointOfView, durationMs?: number): void;
  currentPointOfView(): { lat: number; lng: number; altitude: number };
}

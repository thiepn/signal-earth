import type { SourceRef } from './sources';
import type { TemporalType } from '../../core/time/temporal';

export type EntityId = string & { readonly __entityId: unique symbol };

export type SignalKind =
  | 'earthquake'
  | 'natural-event'
  | 'satellite'
  | 'space-weather'
  | 'location';

export interface GeoCoordinates {
  lat: number;
  lon: number;
  altitudeKm?: number;
}

export interface SignalEntity {
  id: EntityId;
  kind: SignalKind;
  name: string;
  source: SourceRef;
  temporalType: TemporalType;
  startTime?: number;
  endTime?: number;
  coordinates?: GeoCoordinates;
}

export function asEntityId(value: string): EntityId {
  return value as EntityId;
}

import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import { asEntityId, type EntityId, type SignalEntity } from '../../shared/types/entities';
import type { OMMRecord, OrbitalObject, SatelliteCategory } from '../../shared/types/orbit';

export interface SatelliteRecord extends Omit<OrbitalObject, 'id' | 'category'> {
  id: EntityId;
  category: SatelliteCategory;
  categories: SatelliteCategory[];
  omm: OMMRecord;
}

export interface OrbitCatalog {
  satellites: SatelliteRecord[];
  categoryCounts: Record<SatelliteCategory, number>;
  newestElementEpoch: number | null;
  oldestElementEpoch: number | null;
  loadedGroups: string[];
  failedGroups: Array<{ group: string; category: SatelliteCategory; message: string }>;
  partial: boolean;
}

export interface SatelliteTelemetry {
  id: EntityId;
  timestamp: number;
  lat: number;
  lon: number;
  altitudeKm: number;
  speedKmS: number;
}

export const ORBIT_CATEGORIES: SatelliteCategory[] = [
  'stations',
  'weather',
  'earth-observation',
  'navigation',
  'science',
];

export const ORBIT_CATEGORY_LABELS: Record<SatelliteCategory, string> = {
  stations: 'Stations',
  weather: 'Weather',
  'earth-observation': 'Earth observation',
  navigation: 'Navigation',
  science: 'Science',
  communications: 'Communications',
};

export function satelliteToSignalEntity(record: SatelliteRecord): SignalEntity {
  return {
    id: record.id,
    kind: 'satellite',
    name: record.name,
    source: SOURCE_REGISTRY.celestrak,
    temporalType: 'propagated',
  };
}

export function asSatelliteId(noradId: string | number): EntityId {
  return asEntityId(`satellite:${String(noradId)}`);
}

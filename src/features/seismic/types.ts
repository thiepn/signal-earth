import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import { asEntityId, type EntityId, type SignalEntity } from '../../shared/types/entities';

export type EarthquakeTimeWindow = 'hour' | 'day' | 'week' | 'month';
export type EarthquakeAlert = 'green' | 'yellow' | 'orange' | 'red' | null;

export interface EarthquakeRecord {
  id: EntityId;
  usgsId: string;
  place: string;
  magnitude: number;
  magnitudeType: string | null;
  time: number;
  updated: number;
  coordinates: {
    lat: number;
    lon: number;
    depthKm: number;
  };
  url: string;
  detailUrl: string;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: EarthquakeAlert;
  status: string;
  tsunami: boolean;
  significance: number;
  network: string;
  code: string;
}

export interface EarthquakeFeed {
  generatedAt: number;
  title: string;
  count: number;
  window: EarthquakeTimeWindow;
  earthquakes: EarthquakeRecord[];
}

export function earthquakeToSignalEntity(record: EarthquakeRecord): SignalEntity {
  return {
    id: record.id,
    kind: 'earthquake',
    name: record.place || `M${record.magnitude.toFixed(1)} earthquake`,
    source: SOURCE_REGISTRY.usgs,
    temporalType: 'observed',
    startTime: record.time,
    coordinates: {
      lat: record.coordinates.lat,
      lon: record.coordinates.lon,
      altitudeKm: 0,
    },
  };
}

export function asEarthquakeId(usgsId: string): EntityId {
  return asEntityId(`earthquake:${usgsId}`);
}

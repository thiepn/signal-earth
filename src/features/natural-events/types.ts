import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import { asEntityId, type EntityId, type SignalEntity } from '../../shared/types/entities';

export type NaturalEventCategory = 'wildfire' | 'severe-storm' | 'volcano';
export type NaturalEventGeometryType = 'point' | 'polygon';

export interface NaturalEventPoint {
  lat: number;
  lon: number;
}

export interface NaturalEventGeometryFrame {
  timestamp: number;
  type: NaturalEventGeometryType;
  point: NaturalEventPoint;
  rings?: NaturalEventPoint[][];
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  magnitudeDescription: string | null;
}

export interface NaturalEventSourceLink {
  id: string;
  url: string;
}

export interface NaturalEventRecord {
  id: EntityId;
  eonetId: string;
  title: string;
  description: string | null;
  category: NaturalEventCategory;
  categoryTitle: string;
  link: string;
  sources: NaturalEventSourceLink[];
  startTime: number;
  closedAt: number | null;
  updatedAt: number;
  geometry: NaturalEventGeometryFrame[];
}

export interface NaturalEventFeed {
  fetchedAt: number;
  sourceUpdatedAt: number;
  events: NaturalEventRecord[];
  categoryCounts: Record<NaturalEventCategory, number>;
  partial: boolean;
}

export const NATURAL_EVENT_CATEGORIES: NaturalEventCategory[] = ['severe-storm', 'wildfire', 'volcano'];

export const NATURAL_EVENT_CATEGORY_LABELS: Record<NaturalEventCategory, string> = {
  'severe-storm': 'Severe storms',
  wildfire: 'Wildfires',
  volcano: 'Volcanoes',
};

export const NATURAL_EVENT_CATEGORY_GLYPHS: Record<NaturalEventCategory, string> = {
  'severe-storm': '◉',
  wildfire: '▲',
  volcano: '△',
};

export function asNaturalEventId(eonetId: string): EntityId {
  return asEntityId(`event:${eonetId}`);
}

export function naturalEventToSignalEntity(event: NaturalEventRecord): SignalEntity {
  const latest = event.geometry[event.geometry.length - 1];
  return {
    id: event.id,
    kind: 'natural-event',
    name: event.title,
    source: SOURCE_REGISTRY.eonet,
    temporalType: 'observed',
    startTime: event.startTime,
    ...(event.closedAt === null ? {} : { endTime: event.closedAt }),
    ...(latest ? { coordinates: { lat: latest.point.lat, lon: latest.point.lon } } : {}),
  };
}

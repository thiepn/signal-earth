import type { ProviderAdapter } from '../../core/data/ProviderAdapter';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import type {
  NaturalEventCategory,
  NaturalEventFeed,
  NaturalEventGeometryFrame,
  NaturalEventPoint,
  NaturalEventRecord,
  NaturalEventSourceLink,
} from '../../features/natural-events/types';
import { asNaturalEventId } from '../../features/natural-events/types';
import type { EonetCombinedRaw, EonetEventRaw, EonetGeometryRaw, EonetResponseRaw } from './types';

const API = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const CATEGORY_QUERY = 'wildfires,severeStorms,volcanoes';
const MAX_RAW_EVENTS = 500;
const MAX_GEOMETRY_FRAMES = 2_000;

export const EONET_CACHE_POLICY = {
  ttlMs: 15 * 60_000,
  staleForMs: 24 * 60 * 60_000,
} as const;

const CATEGORY_MAP: Record<string, NaturalEventCategory> = {
  wildfires: 'wildfire',
  wildfire: 'wildfire',
  severestorms: 'severe-storm',
  'severe storms': 'severe-storm',
  volcanoes: 'volcano',
  volcano: 'volcano',
};

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeHttpUrl(value: unknown): string | null {
  const raw = safeString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseTimestamp(value: unknown): number | null {
  const text = safeString(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeCategory(raw: EonetEventRaw): { id: NaturalEventCategory; title: string } | null {
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  for (const entry of categories) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { id?: unknown; title?: unknown };
    const id = safeString(record.id)?.toLowerCase();
    const title = safeString(record.title);
    const mapped = (id && CATEGORY_MAP[id]) || (title && CATEGORY_MAP[title.toLowerCase()]);
    if (mapped) return { id: mapped, title: title ?? mapped };
  }
  return null;
}

function pointFromCoordinate(value: unknown): NaturalEventPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [lon, lat] = value;
  if (!finite(lon) || !finite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return { lat, lon };
}

function normalizePolygon(value: unknown): { point: NaturalEventPoint; rings: NaturalEventPoint[][] } | null {
  if (!Array.isArray(value)) return null;
  const rings: NaturalEventPoint[][] = [];
  for (const ringRaw of value.slice(0, 20)) {
    if (!Array.isArray(ringRaw)) continue;
    const ring = ringRaw.slice(0, 2_000).map(pointFromCoordinate).filter((point): point is NaturalEventPoint => point !== null);
    if (ring.length >= 3) rings.push(ring);
  }
  if (!rings.length) return null;
  const outer = rings[0]!;
  const centroidPoints = outer.length > 3 && outer[0]!.lat === outer[outer.length - 1]!.lat && outer[0]!.lon === outer[outer.length - 1]!.lon
    ? outer.slice(0, -1)
    : outer;
  let x = 0; let y = 0; let z = 0;
  for (const point of centroidPoints) {
    const lat = point.lat * Math.PI / 180;
    const lon = point.lon * Math.PI / 180;
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }
  const lon = Math.atan2(y, x) * 180 / Math.PI;
  const hyp = Math.hypot(x, y);
  const lat = Math.atan2(z, hyp) * 180 / Math.PI;
  return { point: { lat, lon }, rings };
}

function normalizeGeometry(raw: EonetGeometryRaw): NaturalEventGeometryFrame | null {
  const timestamp = parseTimestamp(raw.date);
  const type = safeString(raw.type)?.toLowerCase();
  if (timestamp === null || !type) return null;
  const magnitudeValue = finite(raw.magnitudeValue) ? raw.magnitudeValue : null;
  const magnitudeUnit = safeString(raw.magnitudeUnit);
  const magnitudeDescription = safeString(raw.magnitudeDescription);

  if (type === 'point') {
    const point = pointFromCoordinate(raw.coordinates);
    if (!point) return null;
    return { timestamp, type: 'point', point, magnitudeValue, magnitudeUnit, magnitudeDescription };
  }
  if (type === 'polygon') {
    const polygon = normalizePolygon(raw.coordinates);
    if (!polygon) return null;
    return { timestamp, type: 'polygon', point: polygon.point, rings: polygon.rings, magnitudeValue, magnitudeUnit, magnitudeDescription };
  }
  return null;
}

function normalizeSources(raw: EonetEventRaw): NaturalEventSourceLink[] {
  const sources = Array.isArray(raw.sources) ? raw.sources : [];
  const result: NaturalEventSourceLink[] = [];
  for (const source of sources.slice(0, 12)) {
    if (!source || typeof source !== 'object') continue;
    const record = source as { id?: unknown; url?: unknown };
    const url = safeHttpUrl(record.url);
    if (!url) continue;
    result.push({ id: safeString(record.id) ?? 'Source', url });
  }
  return result;
}

function normalizeEvent(raw: EonetEventRaw): NaturalEventRecord | null {
  const eonetId = safeString(raw.id);
  const title = safeString(raw.title);
  const category = normalizeCategory(raw);
  if (!eonetId || !title || !category) return null;

  const geometryRaw = Array.isArray(raw.geometry) ? raw.geometry.slice(0, MAX_GEOMETRY_FRAMES) : [];
  const geometry = geometryRaw
    .map((entry) => entry && typeof entry === 'object' ? normalizeGeometry(entry as EonetGeometryRaw) : null)
    .filter((frame): frame is NaturalEventGeometryFrame => frame !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!geometry.length) return null;

  const hasClosedValue = raw.closed !== null && raw.closed !== undefined;
  const closedAt = hasClosedValue ? parseTimestamp(raw.closed) : null;
  if (hasClosedValue && closedAt === null) return null;
  const link = safeHttpUrl(raw.link) ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(eonetId)}`;
  return {
    id: asNaturalEventId(eonetId),
    eonetId,
    title,
    description: safeString(raw.description),
    category: category.id,
    categoryTitle: category.title,
    link,
    sources: normalizeSources(raw),
    startTime: geometry[0]!.timestamp,
    closedAt,
    updatedAt: geometry[geometry.length - 1]!.timestamp,
    geometry,
  };
}

function responseEvents(response: EonetResponseRaw): EonetEventRaw[] {
  return Array.isArray(response.events)
    ? response.events.filter((entry): entry is EonetEventRaw => Boolean(entry && typeof entry === 'object')).slice(0, MAX_RAW_EVENTS)
    : [];
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<EonetResponseRaw> {
  const response = await fetch(url, {
    ...(signal ? { signal } : {}),
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`NASA EONET request failed (${response.status})`);
  return await response.json() as EonetResponseRaw;
}

export class EonetProvider implements ProviderAdapter<EonetCombinedRaw, NaturalEventFeed> {
  readonly id = 'eonet' as const;
  readonly source = SOURCE_REGISTRY.eonet;
  readonly temporalType = 'observed' as const;
  readonly cachePolicy = EONET_CACHE_POLICY;

  async fetchRaw(signal?: AbortSignal): Promise<EonetCombinedRaw> {
    const openUrl = `${API}?status=open&category=${CATEGORY_QUERY}&limit=300`;
    const recentUrl = `${API}?status=closed&category=${CATEGORY_QUERY}&days=30&limit=200`;
    const [openResult, recentResult] = await Promise.allSettled([
      fetchJson(openUrl, signal),
      fetchJson(recentUrl, signal),
    ]);
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (openResult.status === 'rejected' && recentResult.status === 'rejected') {
      throw openResult.reason instanceof Error ? openResult.reason : new Error('NASA EONET requests failed.');
    }
    return {
      open: openResult.status === 'fulfilled' ? openResult.value : null,
      recentClosed: recentResult.status === 'fulfilled' ? recentResult.value : null,
      fetchedAt: Date.now(),
      partial: openResult.status === 'rejected' || recentResult.status === 'rejected',
    };
  }

  normalize(raw: EonetCombinedRaw): NaturalEventFeed {
    const merged = new Map<string, NaturalEventRecord>();
    for (const eventRaw of [...responseEvents(raw.open ?? {}), ...responseEvents(raw.recentClosed ?? {})]) {
      const event = normalizeEvent(eventRaw);
      if (!event) continue;
      const existing = merged.get(event.eonetId);
      if (!existing || event.updatedAt >= existing.updatedAt) merged.set(event.eonetId, event);
    }
    const events = [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    const categoryCounts: Record<NaturalEventCategory, number> = { 'severe-storm': 0, wildfire: 0, volcano: 0 };
    let sourceUpdatedAt = 0;
    for (const event of events) {
      categoryCounts[event.category] += 1;
      sourceUpdatedAt = Math.max(sourceUpdatedAt, event.updatedAt);
    }
    return { fetchedAt: raw.fetchedAt, sourceUpdatedAt: sourceUpdatedAt || raw.fetchedAt, events, categoryCounts, partial: raw.partial };
  }

  validate(feed: NaturalEventFeed): boolean {
    return typeof feed.partial === 'boolean'
      && Array.isArray(feed.events)
      && feed.events.length <= MAX_RAW_EVENTS * 2
      && Number.isFinite(feed.fetchedAt)
      && Number.isFinite(feed.sourceUpdatedAt)
      && feed.events.every((event) => event.geometry.length > 0 && Number.isFinite(event.startTime));
  }
}

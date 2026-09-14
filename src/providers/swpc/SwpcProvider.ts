import type { ProviderAdapter } from '../../core/data/ProviderAdapter';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import type {
  AuroraModel,
  KpObservationKind,
  KpSample,
  SolarWindObservation,
  SpaceWeatherFeed,
  SpaceWeatherScaleSnapshot,
  SpaceWeatherScaleValue,
  SwpcMessageKind,
  SwpcOperationalMessage,
} from '../../features/space-weather/types';
import type { SwpcCombinedRaw } from './types';

const BASE = 'https://services.swpc.noaa.gov';
const ENDPOINTS = {
  kp: `${BASE}/products/noaa-planetary-k-index-forecast.json`,
  scales: `${BASE}/products/noaa-scales.json`,
  windSpeed: `${BASE}/products/summary/solar-wind-speed.json`,
  windMag: `${BASE}/products/summary/solar-wind-mag-field.json`,
  alerts: `${BASE}/products/alerts.json`,
  aurora: `${BASE}/json/ovation_aurora_latest.json`,
} as const;

export const SWPC_CACHE_POLICY = {
  ttlMs: 5 * 60_000,
  staleForMs: 2 * 60 * 60_000,
} as const;

const MAX_KP = 256;
const MAX_MESSAGES = 40;
const MAX_AURORA_POINTS = 80_000;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseTimestamp(value: unknown, assumeUtc = true): number | null {
  const raw = safeString(value);
  if (!raw) return null;
  const hasZone = /(?:Z|[+-]\d\d:?\d\d)$/i.test(raw);
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const text = assumeUtc && !hasZone ? `${normalized}Z` : normalized;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeKp(raw: unknown): KpSample[] {
  if (!Array.isArray(raw)) return [];
  const samples: KpSample[] = [];
  for (const row of raw.slice(-MAX_KP)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const timestamp = parseTimestamp(record.time_tag);
    const kp = finiteNumber(record.kp);
    const kindRaw = safeString(record.observed)?.toLowerCase();
    const kind: KpObservationKind | null = kindRaw === 'observed' || kindRaw === 'estimated' || kindRaw === 'predicted' ? kindRaw : null;
    if (timestamp === null || kp === null || kp < 0 || kp > 9 || !kind) continue;
    samples.push({ timestamp, kp, kind, noaaScale: safeString(record.noaa_scale) });
  }
  return samples.sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeScaleValue(raw: unknown): SpaceWeatherScaleValue {
  if (!raw || typeof raw !== 'object') return { scale: 0, text: null };
  const record = raw as Record<string, unknown>;
  const scale = finiteNumber(record.Scale) ?? 0;
  return { scale: Math.max(0, Math.min(5, Math.round(scale))), text: safeString(record.Text) };
}

function normalizeScales(raw: unknown): SpaceWeatherScaleSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const current = (raw as Record<string, unknown>)['0'];
  if (!current || typeof current !== 'object') return null;
  const record = current as Record<string, unknown>;
  const date = safeString(record.DateStamp);
  const time = safeString(record.TimeStamp);
  const timestamp = date && time ? Date.parse(`${date}T${time}Z`) : NaN;
  if (!Number.isFinite(timestamp)) return null;
  return {
    timestamp,
    G: normalizeScaleValue(record.G),
    R: normalizeScaleValue(record.R),
    S: normalizeScaleValue(record.S),
  };
}

function firstRecord(raw: unknown): Record<string, unknown> | null {
  if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== 'object') return null;
  return raw[0] as Record<string, unknown>;
}

function normalizeSolarWind(speedRaw: unknown, magRaw: unknown): SolarWindObservation | null {
  const speed = firstRecord(speedRaw);
  const mag = firstRecord(magRaw);
  if (!speed && !mag) return null;
  const speedTime = parseTimestamp(speed?.time_tag, false);
  const magTime = parseTimestamp(mag?.time_tag, false);
  const timestamp = Math.max(speedTime ?? 0, magTime ?? 0);
  if (!timestamp) return null;
  return {
    timestamp,
    speedKmS: finiteNumber(speed?.proton_speed),
    btNt: finiteNumber(mag?.bt),
    bzGsmNt: finiteNumber(mag?.bz_gsm),
  };
}

function messageKind(message: string): SwpcMessageKind {
  const upper = message.toUpperCase();
  if (upper.includes('CANCEL') || upper.includes('EXPIRED')) return 'cancel';
  if (upper.includes('WARNING')) return 'warning';
  if (upper.includes('WATCH')) return 'watch';
  if (upper.includes('ALERT')) return 'alert';
  return 'message';
}

function messageTitle(message: string, kind: SwpcMessageKind): string {
  const lines = message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const preferred = lines.find((line) => /(?:CONTINUED |EXTENDED )?(?:ALERT|WARNING|WATCH)|CANCEL/i.test(line));
  if (preferred) return preferred.slice(0, 140);
  return kind === 'message' ? (lines[0]?.slice(0, 140) ?? 'SWPC message') : `NOAA ${kind}`;
}

function normalizeMessages(raw: unknown): SwpcOperationalMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages: SwpcOperationalMessage[] = [];
  for (const row of raw.slice(0, MAX_MESSAGES)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const productId = safeString(record.product_id);
    const message = safeString(record.message);
    const issuedAt = parseTimestamp(record.issue_datetime, true);
    if (!productId || !message || issuedAt === null) continue;
    const kind = messageKind(message);
    messages.push({ productId, issuedAt, kind, title: messageTitle(message, kind), message });
  }
  return messages.sort((a, b) => b.issuedAt - a.issuedAt);
}

function normalizeAurora(raw: unknown): AuroraModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const observationTime = parseTimestamp(record['Observation Time'], false);
  const forecastTime = parseTimestamp(record['Forecast Time'], false);
  const rows = record.coordinates;
  if (observationTime === null || forecastTime === null || !Array.isArray(rows)) return null;

  const packed: number[] = [];
  for (const row of rows.slice(0, MAX_AURORA_POINTS)) {
    if (!Array.isArray(row) || row.length < 3) continue;
    let lon = finiteNumber(row[0]);
    const lat = finiteNumber(row[1]);
    const value = finiteNumber(row[2]);
    if (lon === null || lat === null || value === null || lat < -90 || lat > 90 || value < 0 || value > 100) continue;
    if (lon > 180 && lon <= 360) lon -= 360;
    if (lon < -180 || lon > 180) continue;
    packed.push(lon, lat, value);
  }
  if (packed.length < 3) return null;
  return { observationTime, forecastTime, coordinates: new Float32Array(packed), pointCount: packed.length / 3 };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    ...(signal ? { signal } : {}),
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`NOAA SWPC request failed (${response.status})`);
  return await response.json() as unknown;
}

export class SwpcProvider implements ProviderAdapter<SwpcCombinedRaw, SpaceWeatherFeed> {
  readonly id = 'swpc' as const;
  readonly source = SOURCE_REGISTRY.swpc;
  readonly temporalType = 'forecast' as const;
  readonly cachePolicy = SWPC_CACHE_POLICY;

  async fetchRaw(signal?: AbortSignal): Promise<SwpcCombinedRaw> {
    const keys = Object.keys(ENDPOINTS) as Array<keyof typeof ENDPOINTS>;
    const settled = await Promise.allSettled(keys.map((key) => fetchJson(ENDPOINTS[key], signal)));
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const values = new Map<string, unknown | null>();
    const unavailableSources: string[] = [];
    settled.forEach((result, index) => {
      const key = keys[index]!;
      if (result.status === 'fulfilled') values.set(key, result.value);
      else { values.set(key, null); unavailableSources.push(key); }
    });
    if (unavailableSources.length === keys.length) throw new Error('NOAA SWPC feeds are unavailable.');
    return {
      kpForecast: values.get('kp') ?? null,
      scales: values.get('scales') ?? null,
      solarWindSpeed: values.get('windSpeed') ?? null,
      solarWindMag: values.get('windMag') ?? null,
      alerts: values.get('alerts') ?? null,
      aurora: values.get('aurora') ?? null,
      fetchedAt: Date.now(),
      partial: unavailableSources.length > 0,
      unavailableSources,
    };
  }

  normalize(raw: SwpcCombinedRaw): SpaceWeatherFeed {
    const kp = normalizeKp(raw.kpForecast);
    const scales = normalizeScales(raw.scales);
    const solarWind = normalizeSolarWind(raw.solarWindSpeed, raw.solarWindMag);
    const messages = normalizeMessages(raw.alerts);
    const aurora = normalizeAurora(raw.aurora);
    const times = [
      ...kp.filter((sample) => sample.kind !== 'predicted').map((sample) => sample.timestamp),
      scales?.timestamp ?? 0,
      solarWind?.timestamp ?? 0,
      messages[0]?.issuedAt ?? 0,
      aurora?.observationTime ?? 0,
    ];
    const latestSourceTime = Math.max(0, ...times.filter((value) => Number.isFinite(value) && value > 0));
    const sourceUpdatedAt = latestSourceTime || raw.fetchedAt;
    return {
      fetchedAt: raw.fetchedAt,
      sourceUpdatedAt,
      kp,
      scales,
      solarWind,
      messages,
      aurora,
      partial: raw.partial,
      unavailableSources: [...raw.unavailableSources],
    };
  }

  validate(feed: SpaceWeatherFeed): boolean {
    return Number.isFinite(feed.fetchedAt)
      && Number.isFinite(feed.sourceUpdatedAt)
      && typeof feed.partial === 'boolean'
      && Array.isArray(feed.unavailableSources)
      && Array.isArray(feed.kp)
      && feed.kp.every((sample) => Number.isFinite(sample.timestamp) && sample.kp >= 0 && sample.kp <= 9)
      && (!feed.aurora || (feed.aurora.coordinates.length % 3 === 0 && feed.aurora.pointCount === feed.aurora.coordinates.length / 3));
  }
}

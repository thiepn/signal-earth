import type { ProviderAdapter } from '../../core/data/ProviderAdapter';
import { SOURCE_REGISTRY } from '../../core/data/sourceRegistry';
import type { OrbitCatalog, SatelliteRecord } from '../../features/orbit/types';
import { asSatelliteId, ORBIT_CATEGORIES } from '../../features/orbit/types';
import type { OMMRecord, SatelliteCategory } from '../../shared/types/orbit';
import type { CelesTrakRawCatalog, CelesTrakRawGroup, CelesTrakRawRecord } from './types';

const BASE_URL = 'https://celestrak.org/NORAD/elements/gp.php';
const MAX_RAW_PER_GROUP = 2_500;
const MAX_NORMALIZED_SATELLITES = 1_200;

export const CELESTRAK_CACHE_POLICY = {
  // CelesTrak GP data is generally refreshed about every two hours. This is a
  // hard minimum fetch interval: application UI must not bypass it.
  ttlMs: 2 * 60 * 60_000,
  staleForMs: 24 * 60 * 60_000,
} as const;

export const CELESTRAK_GROUPS: ReadonlyArray<{
  group: string;
  category: SatelliteCategory;
}> = [
  { group: 'STATIONS', category: 'stations' },
  { group: 'WEATHER', category: 'weather' },
  { group: 'RESOURCE', category: 'earth-observation' },
  { group: 'GNSS', category: 'navigation' },
  { group: 'SCIENCE', category: 'science' },
];

const CATEGORY_PRIORITY: Record<SatelliteCategory, number> = {
  stations: 0,
  weather: 1,
  'earth-observation': 2,
  navigation: 3,
  science: 4,
  communications: 5,
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeOmm(raw: CelesTrakRawRecord): OMMRecord | null {
  const name = asString(raw.OBJECT_NAME);
  const norad = asFiniteNumber(raw.NORAD_CAT_ID) ?? asString(raw.NORAD_CAT_ID);
  const epoch = asString(raw.EPOCH);
  const meanMotion = asFiniteNumber(raw.MEAN_MOTION);
  const eccentricity = asFiniteNumber(raw.ECCENTRICITY);
  const inclination = asFiniteNumber(raw.INCLINATION);
  const raan = asFiniteNumber(raw.RA_OF_ASC_NODE);
  const argPericenter = asFiniteNumber(raw.ARG_OF_PERICENTER);
  const meanAnomaly = asFiniteNumber(raw.MEAN_ANOMALY);

  if (!name || norad === null || norad === undefined || !epoch) return null;
  if ([meanMotion, eccentricity, inclination, raan, argPericenter, meanAnomaly].some((value) => value === null)) return null;
  const epochMs = parseEpoch(epoch);
  if (!Number.isFinite(epochMs) || meanMotion! <= 0 || eccentricity! < 0 || eccentricity! >= 1) return null;
  if (inclination! < 0 || inclination! > 180) return null;

  const record: OMMRecord = {
    OBJECT_NAME: name,
    NORAD_CAT_ID: String(norad),
    EPOCH: epoch,
    MEAN_MOTION: meanMotion!,
    ECCENTRICITY: eccentricity!,
    INCLINATION: inclination!,
    RA_OF_ASC_NODE: raan!,
    ARG_OF_PERICENTER: argPericenter!,
    MEAN_ANOMALY: meanAnomaly!,
  };

  const optionalStrings: Array<keyof OMMRecord> = [
    'CCSDS_OMM_VERS', 'COMMENT', 'CREATION_DATE', 'ORIGINATOR', 'OBJECT_ID',
    'CENTER_NAME', 'REF_FRAME', 'TIME_SYSTEM', 'MEAN_ELEMENT_THEORY', 'CLASSIFICATION_TYPE',
  ];
  for (const key of optionalStrings) {
    const value = asString(raw[key]);
    if (value !== undefined) (record as unknown as Record<string, unknown>)[key] = value;
  }

  const optionalNumbers: Array<keyof OMMRecord> = [
    'EPHEMERIS_TYPE', 'ELEMENT_SET_NO', 'REV_AT_EPOCH', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT',
  ];
  for (const key of optionalNumbers) {
    const value = asFiniteNumber(raw[key]);
    if (value !== null) (record as unknown as Record<string, unknown>)[key] = value;
  }

  return record;
}

function parseEpoch(value: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return Date.parse(hasZone ? value : `${value}Z`);
}

function epochMs(record: OMMRecord): number {
  const parsed = parseEpoch(record.EPOCH);
  return Number.isFinite(parsed) ? parsed : 0;
}

function primaryCategory(categories: SatelliteCategory[]): SatelliteCategory {
  return [...categories].sort((a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b])[0] ?? 'science';
}

function emptyCounts(): Record<SatelliteCategory, number> {
  return {
    stations: 0,
    weather: 0,
    'earth-observation': 0,
    navigation: 0,
    science: 0,
    communications: 0,
  };
}

export class CelesTrakProvider implements ProviderAdapter<CelesTrakRawCatalog, OrbitCatalog> {
  readonly id = 'celestrak' as const;
  readonly source = SOURCE_REGISTRY.celestrak;
  readonly temporalType = 'propagated' as const;
  readonly cachePolicy = CELESTRAK_CACHE_POLICY;

  async fetchRaw(signal?: AbortSignal): Promise<CelesTrakRawCatalog> {
    const results = await Promise.allSettled(CELESTRAK_GROUPS.map(async ({ group, category }): Promise<CelesTrakRawGroup> => {
      const url = `${BASE_URL}?GROUP=${encodeURIComponent(group)}&FORMAT=JSON`;
      const response = await fetch(url, {
        ...(signal ? { signal } : {}),
        headers: { Accept: 'application/json' },
        // Do not cache-bust CelesTrak. Browser HTTP caching plus IndexedDB are
        // both desirable under the provider's one-download-per-update policy.
        cache: 'default',
      });
      if (!response.ok) throw new Error(`${group} request failed (${response.status})`);
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) throw new Error(`${group} returned a non-array payload`);
      return { group, category, records: payload.slice(0, MAX_RAW_PER_GROUP) as CelesTrakRawRecord[] };
    }));

    const groups: CelesTrakRawGroup[] = [];
    const errors: CelesTrakRawCatalog['errors'] = [];
    for (let index = 0; index < results.length; index += 1) {
      const descriptor = CELESTRAK_GROUPS[index]!;
      const result = results[index]!;
      if (result.status === 'fulfilled') groups.push(result.value);
      else errors.push({ group: descriptor.group, category: descriptor.category, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    }

    if (groups.length === 0) {
      throw new Error(errors[0]?.message ?? 'CelesTrak orbital catalog is unavailable.');
    }
    return { groups, errors };
  }

  normalize(raw: CelesTrakRawCatalog): OrbitCatalog {
    const byNorad = new Map<string, { record: OMMRecord; categories: Set<SatelliteCategory> }>();

    for (const group of raw.groups) {
      for (const rawRecord of group.records) {
        const record = normalizeOmm(rawRecord);
        if (!record) continue;
        const noradId = String(record.NORAD_CAT_ID);
        const existing = byNorad.get(noradId);
        if (existing) {
          existing.categories.add(group.category);
          // Prefer the newest element set when the same object occurs in more than one group.
          if (epochMs(record) > epochMs(existing.record)) existing.record = record;
        } else {
          byNorad.set(noradId, { record, categories: new Set([group.category]) });
        }
      }
    }

    const satellites: SatelliteRecord[] = [];
    for (const [noradId, entry] of byNorad) {
      const categories = [...entry.categories].sort((a, b) => CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b]);
      const epoch = epochMs(entry.record);
      if (!epoch) continue;
      satellites.push({
        id: asSatelliteId(noradId),
        noradId,
        name: entry.record.OBJECT_NAME,
        omm: entry.record,
        category: primaryCategory(categories),
        categories,
        epoch,
        source: 'celestrak',
      });
    }

    satellites.sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] || a.name.localeCompare(b.name));
    if (satellites.length > MAX_NORMALIZED_SATELLITES) satellites.length = MAX_NORMALIZED_SATELLITES;

    const counts = emptyCounts();
    let newestElementEpoch: number | null = null;
    let oldestElementEpoch: number | null = null;
    for (const satellite of satellites) {
      for (const category of satellite.categories) counts[category] += 1;
      newestElementEpoch = newestElementEpoch === null ? satellite.epoch : Math.max(newestElementEpoch, satellite.epoch);
      oldestElementEpoch = oldestElementEpoch === null ? satellite.epoch : Math.min(oldestElementEpoch, satellite.epoch);
    }

    return {
      satellites,
      categoryCounts: counts,
      newestElementEpoch,
      oldestElementEpoch,
      loadedGroups: raw.groups.map((group) => group.group),
      failedGroups: raw.errors,
      partial: raw.errors.length > 0,
    };
  }

  validate(normalized: OrbitCatalog): boolean {
    return Array.isArray(normalized.satellites)
      && normalized.satellites.length > 0
      && normalized.satellites.length <= MAX_NORMALIZED_SATELLITES
      && normalized.satellites.every((satellite) => ORBIT_CATEGORIES.includes(satellite.category));
  }
}

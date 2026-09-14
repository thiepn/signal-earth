import type { QualityLevel } from '../../core/engine/QualityManager';

export type GibsProduct = 'clouds' | 'precipitation';

export const GIBS_WMS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export const GIBS_LAYERS: Record<GibsProduct, string> = {
  clouds: 'VIIRS_SNPP_Cloud_Optical_Thickness',
  precipitation: 'IMERG_Precipitation_Rate_30min',
};

const HALF_HOUR = 30 * 60_000;
const DAY = 24 * 60 * 60_000;

export function floorHalfHour(timestamp: number): number {
  return Math.floor(timestamp / HALF_HOUR) * HALF_HOUR;
}

export function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function gibsTimeValue(product: GibsProduct, timestamp: number): string {
  if (product === 'clouds') return utcDay(timestamp);
  return new Date(floorHalfHour(timestamp)).toISOString().replace('.000Z', 'Z');
}

export function gibsRequestCandidates(product: GibsProduct, timestamp: number): number[] {
  if (product === 'clouds') {
    const day = Date.parse(`${utcDay(timestamp)}T12:00:00Z`);
    return [0, 1, 2, 3].map((offset) => day - offset * DAY);
  }
  const anchor = floorHalfHour(timestamp);
  return Array.from({ length: 13 }, (_, index) => anchor - index * HALF_HOUR);
}

export function qualityToGibsResolution(level: QualityLevel): { width: number; height: number } {
  if (level === 'high') return { width: 2048, height: 1024 };
  if (level === 'medium') return { width: 1536, height: 768 };
  return { width: 1024, height: 512 };
}

export function buildGibsWmsUrl(product: GibsProduct, timestamp: number, width: number, height: number): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: GIBS_LAYERS[product],
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: '-180,-90,180,90',
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    TIME: gibsTimeValue(product, timestamp),
  });
  return `${GIBS_WMS_BASE}?${params.toString()}`;
}

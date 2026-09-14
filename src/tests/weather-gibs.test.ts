import { describe, expect, it } from 'vitest';
import { buildGibsWmsUrl, floorHalfHour, gibsRequestCandidates, gibsTimeValue, qualityToGibsResolution } from '../features/weather/gibs';

describe('NASA GIBS weather helpers', () => {
  it('rounds precipitation requests down to the nearest half hour', () => {
    const value = Date.parse('2026-09-14T09:47:15Z');
    expect(new Date(floorHalfHour(value)).toISOString()).toBe('2026-09-14T09:30:00.000Z');
    expect(gibsTimeValue('precipitation', value)).toBe('2026-09-14T09:30:00Z');
  });

  it('uses a UTC day for daily VIIRS cloud imagery', () => {
    const value = Date.parse('2026-09-14T23:59:59Z');
    expect(gibsTimeValue('clouds', value)).toBe('2026-09-14');
  });

  it('builds a global transparent EPSG:4326 WMS request', () => {
    const url = new URL(buildGibsWmsUrl('precipitation', Date.parse('2026-09-14T09:47:15Z'), 1024, 512));
    expect(url.origin + url.pathname).toBe('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi');
    expect(url.searchParams.get('LAYERS')).toBe('IMERG_Precipitation_Rate_30min');
    expect(url.searchParams.get('SRS')).toBe('EPSG:4326');
    expect(url.searchParams.get('BBOX')).toBe('-180,-90,180,90');
    expect(url.searchParams.get('TRANSPARENT')).toBe('TRUE');
    expect(url.searchParams.get('WIDTH')).toBe('1024');
    expect(url.searchParams.get('HEIGHT')).toBe('512');
  });

  it('bounds fallback history and quality resolution', () => {
    const timestamp = Date.parse('2026-09-14T10:17:00Z');
    expect(gibsRequestCandidates('clouds', timestamp)).toHaveLength(4);
    expect(gibsRequestCandidates('precipitation', timestamp)).toHaveLength(13);
    expect(qualityToGibsResolution('low')).toEqual({ width: 1024, height: 512 });
    expect(qualityToGibsResolution('high')).toEqual({ width: 2048, height: 1024 });
  });
});

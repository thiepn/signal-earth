import { describe, expect, it } from 'vitest';
import { rankSearchDocuments } from '../features/search/ranking';
import type { SearchDocument } from '../features/search/types';

const docs: SearchDocument[] = [
  { id: 'city:tokyo', kind: 'city', title: 'Tokyo', subtitle: 'Japan', keywords: ['japan'], coordinates: { lat: 35.6762, lon: 139.6503 }, priority: 50 },
  { id: 'sat:iss', kind: 'satellite', title: 'ISS (ZARYA)', subtitle: 'NORAD 25544 · Stations', keywords: ['iss', '25544', 'stations'], priority: 120 },
  { id: 'cat:weather', kind: 'satellite-category', title: 'Weather satellites', subtitle: 'Orbit category', keywords: ['weather', 'meteorological'], satelliteCategory: 'weather', priority: 45 },
];

describe('search ranking', () => {
  it('prefers exact aliases and titles', () => {
    expect(rankSearchDocuments(docs, 'iss')[0]?.id).toBe('sat:iss');
    expect(rankSearchDocuments(docs, 'tokyo')[0]?.id).toBe('city:tokyo');
  });

  it('supports token queries', () => {
    expect(rankSearchDocuments(docs, 'weather satellites')[0]?.id).toBe('cat:weather');
  });

  it('tolerates a small typo', () => {
    expect(rankSearchDocuments(docs, 'tokoy')[0]?.id).toBe('city:tokyo');
  });
});

import { describe, expect, it } from 'vitest';
import { EonetProvider } from '../providers/eonet/EonetProvider';

const T1 = '2026-09-10T00:00:00Z';
const T2 = '2026-09-11T00:00:00Z';

function fixture() {
  return {
    fetchedAt: Date.parse(T2),
    partial: false,
    open: {
      events: [
        {
          id: 'EONET_STORM', title: 'Test Storm', description: 'storm', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_STORM', closed: null,
          categories: [{ id: 'severeStorms', title: 'Severe Storms' }], sources: [{ id: 'NOAA', url: 'https://example.com/storm' }],
          geometry: [
            { date: T1, type: 'Point', coordinates: [10, 20], magnitudeValue: 60, magnitudeUnit: 'kts' },
            { date: T2, type: 'Point', coordinates: [12, 22], magnitudeValue: 70, magnitudeUnit: 'kts' },
          ],
        },
        {
          id: 'EONET_FIRE', title: 'Test Fire', description: null, link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_FIRE', closed: null,
          categories: [{ id: 'wildfires', title: 'Wildfires' }], sources: [],
          geometry: [{ date: T1, type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }],
        },
      ],
    },
    recentClosed: { events: [] },
  };
}

describe('EonetProvider', () => {
  it('normalizes curated categories and timestamped geometry', () => {
    const feed = new EonetProvider().normalize(fixture());
    expect(feed.events).toHaveLength(2);
    expect(feed.categoryCounts['severe-storm']).toBe(1);
    expect(feed.categoryCounts.wildfire).toBe(1);
    const storm = feed.events.find((event) => event.category === 'severe-storm');
    expect(storm?.geometry).toHaveLength(2);
    expect(storm?.geometry[0]?.point).toEqual({ lat: 20, lon: 10 });
  });

  it('normalizes polygon rings and calculates an unbiased representative point', () => {
    const feed = new EonetProvider().normalize(fixture());
    const fire = feed.events.find((event) => event.category === 'wildfire');
    expect(fire?.geometry[0]?.rings?.[0]).toHaveLength(5);
    expect(fire?.geometry[0]?.point.lat).toBeCloseTo(1, 1);
    expect(fire?.geometry[0]?.point.lon).toBeCloseTo(1, 1);
  });
});

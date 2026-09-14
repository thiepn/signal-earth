import { describe, expect, it } from 'vitest';
import { filterEarthquakesAtSimulationTime, filterEarthquakesByMagnitude } from '../features/seismic/filter';
import { asEarthquakeId, type EarthquakeRecord } from '../features/seismic/types';

function quake(id: string, magnitude: number, time: number): EarthquakeRecord {
  return {
    id: asEarthquakeId(id),
    usgsId: id,
    place: id,
    magnitude,
    magnitudeType: 'mw',
    time,
    updated: time,
    coordinates: { lat: 0, lon: 0, depthKm: 10 },
    url: 'https://earthquake.usgs.gov/example',
    detailUrl: 'https://earthquake.usgs.gov/example.geojson',
    felt: null,
    cdi: null,
    mmi: null,
    alert: null,
    status: 'reviewed',
    tsunami: false,
    significance: 10,
    network: 'us',
    code: id,
  };
}

describe('seismic filters', () => {
  const records = [quake('a', 2.5, 1_000), quake('b', 4.2, 2_000), quake('c', 6.1, 3_000)];

  it('filters minimum magnitude independently from time', () => {
    expect(filterEarthquakesByMagnitude(records, 4).map((item) => item.usgsId)).toEqual(['b', 'c']);
  });

  it('hides observations that have not happened at simulation time', () => {
    expect(filterEarthquakesAtSimulationTime(records, 1_999).map((item) => item.usgsId)).toEqual(['a']);
    expect(filterEarthquakesAtSimulationTime(records, 2_000).map((item) => item.usgsId)).toEqual(['a', 'b']);
    expect(filterEarthquakesAtSimulationTime(records, 9_000)).toHaveLength(3);
  });
});

import { describe, expect, it } from 'vitest';
import { CelesTrakProvider } from '../providers/celestrak/CelesTrakProvider';

const base = {
  OBJECT_NAME: 'TEST SAT', NORAD_CAT_ID: 100123, EPOCH: '2026-09-11T12:00:00.000000',
  MEAN_MOTION: 15.1, ECCENTRICITY: 0.001, INCLINATION: 51.6, RA_OF_ASC_NODE: 10,
  ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30, BSTAR: 0.0001, MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0, EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', ELEMENT_SET_NO: 1,
  REV_AT_EPOCH: 42, CENTER_NAME: 'EARTH', REF_FRAME: 'TEME', TIME_SYSTEM: 'UTC', MEAN_ELEMENT_THEORY: 'SGP4',
};

describe('CelesTrakProvider', () => {
  it('normalizes OMM JSON and preserves six-digit catalog IDs', () => {
    const provider = new CelesTrakProvider();
    const data = provider.normalize({ groups: [{ group: 'STATIONS', category: 'stations', records: [base] }], errors: [] });
    expect(data.satellites).toHaveLength(1);
    expect(data.satellites[0]?.noradId).toBe('100123');
    expect(data.satellites[0]?.id).toBe('satellite:100123');
    expect(data.satellites[0]?.category).toBe('stations');
    expect(provider.validate(data)).toBe(true);
  });

  it('deduplicates the same NORAD object across groups', () => {
    const provider = new CelesTrakProvider();
    const data = provider.normalize({ groups: [
      { group: 'STATIONS', category: 'stations', records: [base] },
      { group: 'SCIENCE', category: 'science', records: [{ ...base, OBJECT_NAME: 'TEST SAT DUP' }] },
    ], errors: [] });
    expect(data.satellites).toHaveLength(1);
    expect(data.satellites[0]?.categories).toEqual(['stations', 'science']);
  });

  it('marks partial catalogs without failing usable groups', () => {
    const provider = new CelesTrakProvider();
    const data = provider.normalize({
      groups: [{ group: 'STATIONS', category: 'stations', records: [base] }],
      errors: [{ group: 'WEATHER', category: 'weather', message: '403' }],
    });
    expect(data.partial).toBe(true);
    expect(data.failedGroups).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { isAuroraModelApplicable, isCurrentSolarWindApplicable, kpSampleAt } from '../features/space-weather/timeline';
import type { AuroraModel, KpSample, SolarWindObservation } from '../features/space-weather/types';

const T0 = Date.parse('2026-09-11T18:00:00Z');
const HOUR = 60 * 60_000;

const kp: KpSample[] = [
  { timestamp: T0, kp: 2, kind: 'observed', noaaScale: null },
  { timestamp: T0 + 3 * HOUR, kp: 4, kind: 'estimated', noaaScale: null },
  { timestamp: T0 + 6 * HOUR, kp: 5, kind: 'predicted', noaaScale: 'G1' },
];

const aurora: AuroraModel = {
  observationTime: T0,
  forecastTime: T0 + 30 * 60_000,
  coordinates: new Float32Array([0, 70, 10]),
  pointCount: 1,
};

const wind: SolarWindObservation = { timestamp: T0, speedKmS: 400, btNt: 5, bzGsmNt: -3 };

describe('space-weather timeline semantics', () => {
  it('uses the 3-hour Kp bucket at the selected simulation time', () => {
    expect(kpSampleAt(kp, T0 + HOUR)?.kind).toBe('observed');
    expect(kpSampleAt(kp, T0 + 4 * HOUR)?.kind).toBe('estimated');
    expect(kpSampleAt(kp, T0 + 7 * HOUR)?.kind).toBe('predicted');
    expect(kpSampleAt(kp, T0 - 1)).toBeNull();
  });

  it('does not paint the latest aurora model onto unrelated replay/future times', () => {
    expect(isAuroraModelApplicable(aurora, T0)).toBe(true);
    expect(isAuroraModelApplicable(aurora, T0 + HOUR)).toBe(true);
    expect(isAuroraModelApplicable(aurora, T0 - 2 * HOUR)).toBe(false);
    expect(isAuroraModelApplicable(aurora, T0 + 3 * HOUR)).toBe(false);
  });

  it('treats summary solar wind as a current observation, not historical replay data', () => {
    expect(isCurrentSolarWindApplicable(wind, T0 + 10 * 60_000)).toBe(true);
    expect(isCurrentSolarWindApplicable(wind, T0 + HOUR)).toBe(false);
  });
});

import type { AuroraModel, KpSample, SolarWindObservation, SpaceWeatherScaleSnapshot } from './types';

const THREE_HOURS_MS = 3 * 60 * 60_000;
const AURORA_PRE_ROLL_MS = 10 * 60_000;
const AURORA_POST_ROLL_MS = 45 * 60_000;
const CURRENT_OBSERVATION_TOLERANCE_MS = 30 * 60_000;

export function kpSampleAt(samples: KpSample[], timestamp: number): KpSample | null {
  if (!Number.isFinite(timestamp) || samples.length === 0) return null;
  let candidate: KpSample | null = null;
  for (const sample of samples) {
    if (sample.timestamp <= timestamp) candidate = sample;
    else break;
  }
  if (!candidate) return null;
  return timestamp < candidate.timestamp + THREE_HOURS_MS ? candidate : null;
}

export function isAuroraModelApplicable(model: AuroraModel | null, timestamp: number): boolean {
  if (!model || !Number.isFinite(timestamp)) return false;
  const start = model.observationTime - AURORA_PRE_ROLL_MS;
  const end = model.forecastTime + AURORA_POST_ROLL_MS;
  return timestamp >= start && timestamp <= end;
}

export function isCurrentSolarWindApplicable(observation: SolarWindObservation | null, timestamp: number): boolean {
  return Boolean(observation && Number.isFinite(timestamp) && Math.abs(timestamp - observation.timestamp) <= CURRENT_OBSERVATION_TOLERANCE_MS);
}

export function isCurrentScaleApplicable(scales: SpaceWeatherScaleSnapshot | null, timestamp: number): boolean {
  return Boolean(scales && Number.isFinite(timestamp) && Math.abs(timestamp - scales.timestamp) <= CURRENT_OBSERVATION_TOLERANCE_MS);
}

export function describeKp(sample: KpSample | null): string {
  if (!sample) return 'No Kp value for selected time';
  if (sample.noaaScale) return `${sample.noaaScale} geomagnetic storm`;
  if (sample.kp >= 4) return 'Active geomagnetic conditions';
  if (sample.kp >= 3) return 'Unsettled geomagnetic conditions';
  return 'Quiet geomagnetic conditions';
}

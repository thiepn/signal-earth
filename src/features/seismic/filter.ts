import type { EarthquakeRecord } from './types';

export function filterEarthquakesByMagnitude(records: EarthquakeRecord[], minimumMagnitude: number): EarthquakeRecord[] {
  if (!Number.isFinite(minimumMagnitude)) return records;
  return records.filter((record) => record.magnitude >= minimumMagnitude);
}

/**
 * Observed earthquakes only exist once their event timestamp has been reached.
 * Future simulation therefore never invents events: known observations remain
 * visible, while replay hides records that had not occurred at that moment.
 */
export function filterEarthquakesAtSimulationTime(records: EarthquakeRecord[], simulationTime: number): EarthquakeRecord[] {
  if (!Number.isFinite(simulationTime)) return records;
  return records.filter((record) => record.time <= simulationTime);
}

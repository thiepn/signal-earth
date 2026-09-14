import { GLOBAL_FUTURE_WINDOW_MS, GLOBAL_PAST_WINDOW_MS, type SimulationClockSnapshot } from '../../core/time/temporal';
import type { EarthquakeTimeWindow } from '../seismic/types';

export type TimelineRange = 'day' | 'week' | 'month';

export interface TimelineRangeConfig {
  label: string;
  pastHours: number;
  futureHours: number;
  stepHours: number;
}

export const TIMELINE_FUTURE_HOURS = GLOBAL_FUTURE_WINDOW_MS / 3_600_000;
export const TIMELINE_MAX_PAST_HOURS = GLOBAL_PAST_WINDOW_MS / 3_600_000;

export const TIMELINE_RANGES: Record<TimelineRange, TimelineRangeConfig> = {
  day: { label: '24H', pastHours: 24, futureHours: TIMELINE_FUTURE_HOURS, stepHours: 0.05 },
  week: { label: '7D', pastHours: 7 * 24, futureHours: TIMELINE_FUTURE_HOURS, stepHours: 0.25 },
  month: { label: '30D', pastHours: 30 * 24, futureHours: TIMELINE_FUTURE_HOURS, stepHours: 1 },
};

export const TIMELINE_RANGE_ORDER: TimelineRange[] = ['day', 'week', 'month'];

export const TIMELINE_PRESETS: Record<TimelineRange, readonly number[]> = {
  day: [-24, -6, -1, 0, 6, 24],
  week: [-168, -72, -24, -6, 0, 24],
  month: [-720, -168, -24, -6, 0, 24],
};

const EARTHQUAKE_WINDOW_ORDER: EarthquakeTimeWindow[] = ['hour', 'day', 'week', 'month'];

export function timelineOffsetMs(clock: SimulationClockSnapshot | null): number {
  if (!clock) return 0;
  return Math.max(
    -GLOBAL_PAST_WINDOW_MS,
    Math.min(GLOBAL_FUTURE_WINDOW_MS, clock.simulationTime - clock.realTime),
  );
}

export function timelineOffsetHours(clock: SimulationClockSnapshot | null): number {
  return timelineOffsetMs(clock) / 3_600_000;
}

export function timelineModeLabel(clock: SimulationClockSnapshot | null): 'LIVE' | 'REPLAY' | 'FUTURE' | 'READY' {
  if (!clock) return 'READY';
  if (clock.mode === 'live') return 'LIVE';
  return clock.simulationTime < clock.realTime ? 'REPLAY' : 'FUTURE';
}

export function timelineProgress(clock: SimulationClockSnapshot | null, range: TimelineRange = 'day'): number {
  const config = TIMELINE_RANGES[range];
  const offset = Math.max(-config.pastHours, Math.min(config.futureHours, timelineOffsetHours(clock)));
  return ((offset + config.pastHours) / (config.pastHours + config.futureHours)) * 100;
}

export function timelineLivePosition(range: TimelineRange): number {
  const config = TIMELINE_RANGES[range];
  return (config.pastHours / (config.pastHours + config.futureHours)) * 100;
}

export function rangeForOffsetHours(hours: number): TimelineRange {
  if (hours >= -TIMELINE_RANGES.day.pastHours) return 'day';
  if (hours >= -TIMELINE_RANGES.week.pastHours) return 'week';
  return 'month';
}

export function earthquakeWindowForTimelineRange(range: TimelineRange): EarthquakeTimeWindow {
  if (range === 'month') return 'month';
  if (range === 'week') return 'week';
  return 'day';
}

export function widenEarthquakeWindow(current: EarthquakeTimeWindow, required: EarthquakeTimeWindow): EarthquakeTimeWindow {
  return EARTHQUAKE_WINDOW_ORDER.indexOf(current) >= EARTHQUAKE_WINDOW_ORDER.indexOf(required) ? current : required;
}

export function orbitTemporallyAvailable(clock: SimulationClockSnapshot | null, certifiedHours = 24): boolean {
  if (!clock) return true;
  return Math.abs(clock.simulationTime - clock.realTime) <= certifiedHours * 3_600_000 + 1_000;
}

import type { NaturalEventCategory, NaturalEventGeometryFrame, NaturalEventRecord } from './types';

export function isNaturalEventVisibleAt(event: NaturalEventRecord, timestamp: number): boolean {
  if (!Number.isFinite(timestamp) || event.startTime > timestamp) return false;
  return event.closedAt === null || timestamp <= event.closedAt;
}

export function geometryFrameAt(event: NaturalEventRecord, timestamp: number): NaturalEventGeometryFrame | null {
  if (!isNaturalEventVisibleAt(event, timestamp)) return null;
  let match: NaturalEventGeometryFrame | null = null;
  for (const frame of event.geometry) {
    if (frame.timestamp > timestamp) break;
    match = frame;
  }
  return match;
}

export function visibleGeometryCount(event: NaturalEventRecord, timestamp: number): number {
  if (!isNaturalEventVisibleAt(event, timestamp)) return 0;
  let count = 0;
  for (const frame of event.geometry) {
    if (frame.timestamp > timestamp) break;
    count += 1;
  }
  return count;
}

export function filterNaturalEventsAtTime(events: NaturalEventRecord[], timestamp: number): NaturalEventRecord[] {
  return events.filter((event) => geometryFrameAt(event, timestamp) !== null);
}

export function filterNaturalEventsByCategories(
  events: NaturalEventRecord[],
  active: Record<NaturalEventCategory, boolean>,
): NaturalEventRecord[] {
  return events.filter((event) => active[event.category]);
}

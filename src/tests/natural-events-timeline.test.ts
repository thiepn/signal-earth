import { describe, expect, it } from 'vitest';
import { asNaturalEventId, type NaturalEventRecord } from '../features/natural-events/types';
import { filterNaturalEventsAtTime, geometryFrameAt, visibleGeometryCount } from '../features/natural-events/timeline';

const START = Date.parse('2026-09-10T00:00:00Z');
const SECOND = START + 6 * 60 * 60_000;
const CLOSED = START + 12 * 60 * 60_000;

const event: NaturalEventRecord = {
  id: asNaturalEventId('TEST'),
  eonetId: 'TEST',
  title: 'Test storm',
  description: null,
  category: 'severe-storm',
  categoryTitle: 'Severe Storms',
  link: 'https://eonet.gsfc.nasa.gov/',
  sources: [],
  startTime: START,
  closedAt: CLOSED,
  updatedAt: SECOND,
  geometry: [
    { timestamp: START, type: 'point', point: { lat: 10, lon: 20 }, magnitudeValue: null, magnitudeUnit: null, magnitudeDescription: null },
    { timestamp: SECOND, type: 'point', point: { lat: 11, lon: 21 }, magnitudeValue: null, magnitudeUnit: null, magnitudeDescription: null },
  ],
};

describe('natural-event timeline semantics', () => {
  it('reveals only geometry observations that existed at the selected time', () => {
    expect(geometryFrameAt(event, START - 1)).toBeNull();
    expect(geometryFrameAt(event, START + 1)?.point.lon).toBe(20);
    expect(geometryFrameAt(event, SECOND + 1)?.point.lon).toBe(21);
    expect(visibleGeometryCount(event, START + 1)).toBe(1);
    expect(visibleGeometryCount(event, SECOND + 1)).toBe(2);
  });

  it('removes a closed event after its EONET close time', () => {
    expect(filterNaturalEventsAtTime([event], CLOSED)).toHaveLength(1);
    expect(filterNaturalEventsAtTime([event], CLOSED + 1)).toHaveLength(0);
  });
});

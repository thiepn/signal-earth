import { describe, expect, it, vi } from 'vitest';
import { asEntityId } from '../shared/types/entities';
import { OrbitWorkerClient } from '../features/orbit/OrbitWorkerClient';
import type { SatelliteRecord } from '../features/orbit/types';

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly messages: Array<{ type?: string; categories?: unknown[] }> = [];
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  terminated = false;

  constructor(..._args: unknown[]) { FakeWorker.instances.push(this); }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = typeof listener === 'function' ? listener as (event: unknown) => void : (event: unknown) => listener.handleEvent(event as Event);
    const set = this.listeners.get(type) ?? new Set<(event: unknown) => void>();
    set.add(callback);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, _listener: EventListenerOrEventListenerObject) {
    this.listeners.delete(type);
  }
  postMessage(message: { type?: string; categories?: unknown[] }) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emitError(message: string) { for (const listener of this.listeners.get('error') ?? []) listener({ message }); }
}

const satellite = {
  id: asEntityId('satellite:25544'),
  noradId: '25544',
  name: 'ISS (ZARYA)',
  category: 'stations',
  categories: ['stations'],
  epoch: Date.UTC(2026, 8, 16),
  source: 'celestrak',
  omm: {
    OBJECT_NAME: 'ISS (ZARYA)', NORAD_CAT_ID: '25544', EPOCH: '2026-09-16T00:00:00Z',
    MEAN_MOTION: 15.5, ECCENTRICITY: 0.0004, INCLINATION: 51.64,
    RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0,
  },
} as SatelliteRecord;

describe('OrbitWorkerClient recovery', () => {
  it('recreates a failed worker and preserves an explicitly empty category selection', () => {
    FakeWorker.instances = [];
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker as unknown as typeof Worker });
    const onError = vi.fn();
    const client = new OrbitWorkerClient({ onError });
    try {
      client.setActiveCategories([]);
      client.loadCatalog([satellite]);
      const first = FakeWorker.instances[0]!;
      expect(first.messages.map((message) => message.type)).toEqual(['SET_ACTIVE_CATEGORIES', 'LOAD_CATALOG']);
      expect(first.messages[0]).toMatchObject({ type: 'SET_ACTIVE_CATEGORIES', categories: [] });

      first.emitError('worker crashed');
      expect(first.terminated).toBe(true);
      expect(onError).toHaveBeenCalledWith('worker crashed');

      client.requestFrame(Date.now());
      const second = FakeWorker.instances[1]!;
      expect(second.messages.map((message) => message.type)).toEqual(['SET_ACTIVE_CATEGORIES', 'LOAD_CATALOG', 'PROPAGATE']);
      expect(second.messages[0]).toMatchObject({ type: 'SET_ACTIVE_CATEGORIES', categories: [] });
    } finally {
      client.dispose();
      if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor);
      else Reflect.deleteProperty(globalThis, 'Worker');
    }
  });
});

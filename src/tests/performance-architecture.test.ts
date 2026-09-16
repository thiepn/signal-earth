import { describe, expect, it } from 'vitest';
import { OrbitWorkerClient } from '../features/orbit/OrbitWorkerClient';

describe('Phase 25 performance architecture', () => {
  it('keeps the orbit worker dormant until real orbit work is requested', () => {
    const client = new OrbitWorkerClient({});
    expect(client.started).toBe(false);
    client.setActiveCategories(['stations', 'weather']);
    expect(client.started).toBe(false);
    client.clear();
    expect(client.started).toBe(false);
    client.dispose();
  });
});

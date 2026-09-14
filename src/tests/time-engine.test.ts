import { describe, expect, it } from 'vitest';
import { TimeEngine } from '../core/time/TimeEngine';

describe('TimeEngine', () => {
  it('tracks wall time while live', () => {
    let now = 1_000;
    const engine = new TimeEngine({ now: () => now });
    now = 4_000;
    expect(engine.currentTime).toBe(4_000);
    expect(engine.snapshot().mode).toBe('live');
  });

  it('detaches from live time when paused', () => {
    let now = 1_000;
    const engine = new TimeEngine({ now: () => now });
    now = 2_000;
    engine.pause();
    now = 8_000;

    const snapshot = engine.snapshot();
    expect(snapshot.mode).toBe('replay');
    expect(snapshot.isPlaying).toBe(false);
    expect(snapshot.simulationTime).toBe(2_000);
  });

  it('accelerates detached simulation time', () => {
    let now = 10_000;
    const engine = new TimeEngine({ now: () => now });
    engine.setSpeed(10);
    now += 2_000;
    expect(engine.currentTime).toBe(30_000);
  });

  it('re-enters wall time only through returnLive', () => {
    let now = 10_000;
    const engine = new TimeEngine({ now: () => now });
    engine.pause();
    now = 20_000;
    engine.setSpeed(1);
    now = 21_000;
    expect(engine.currentTime).toBe(11_000);
    expect(engine.snapshot().mode).toBe('replay');

    engine.returnLive();
    expect(engine.snapshot().mode).toBe('live');
    expect(engine.currentTime).toBe(21_000);
  });

  it('classifies manually selected past and future timestamps', () => {
    let now = 100_000;
    const engine = new TimeEngine({ now: () => now });
    engine.setTime(90_000);
    expect(engine.snapshot().mode).toBe('replay');
    engine.setTime(110_000);
    expect(engine.snapshot().mode).toBe('simulation');
  });
  it('clamps manual seeks to the supported global timeline window', () => {
    let now = 100_000_000;
    const hour = 3_600_000;
    const engine = new TimeEngine({ now: () => now });

    engine.seekOffset(-30 * hour);
    expect(engine.snapshot().simulationTime).toBe(now - 24 * hour);

    engine.seekOffset(30 * hour);
    expect(engine.snapshot().simulationTime).toBe(now + 24 * hour);
  });

  it('stops accelerated playback at the +24h boundary', () => {
    let now = 100_000_000;
    const hour = 3_600_000;
    const engine = new TimeEngine({ now: () => now });
    engine.seekOffset(23.9 * hour);
    engine.setSpeed(1000);
    now += 1_000;

    const snapshot = engine.snapshot();
    expect(snapshot.simulationTime).toBe(now + 24 * hour);
    expect(snapshot.isPlaying).toBe(false);
    expect(snapshot.speed).toBe(0);
  });

  it('reclassifies a paused timestamp as replay once wall time passes it', () => {
    let now = 10_000;
    const engine = new TimeEngine({ now: () => now });
    engine.pause();
    now = 11_000;
    expect(engine.snapshot().mode).toBe('replay');
  });

});

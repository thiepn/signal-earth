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

  it('re-enters wall time only through returnLive for free playback', () => {
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

  it('uses the Time 2.0 asymmetric 30-day replay / 24-hour future bounds', () => {
    let now = 4_000_000_000;
    const hour = 3_600_000;
    const engine = new TimeEngine({ now: () => now });

    engine.seekOffset(-40 * 24 * hour);
    expect(engine.snapshot().simulationTime).toBe(now - 30 * 24 * hour);

    engine.seekOffset(30 * hour);
    expect(engine.snapshot().simulationTime).toBe(now + 24 * hour);
  });

  it('retains the symmetric window override for explicit callers', () => {
    let now = 100_000_000;
    const hour = 3_600_000;
    const engine = new TimeEngine({ now: () => now, windowMs: 6 * hour });
    engine.seekOffset(-20 * hour);
    expect(engine.snapshot().simulationTime).toBe(now - 6 * hour);
    engine.seekOffset(20 * hour);
    expect(engine.snapshot().simulationTime).toBe(now + 6 * hour);
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

  it('can replay historical time directly back to LIVE without overshooting into future simulation', () => {
    let now = 4_000_000_000;
    const hour = 3_600_000;
    const engine = new TimeEngine({ now: () => now });
    engine.startReplayToLive(now - 24 * hour, 1000);
    expect(engine.replayToLiveActive).toBe(true);
    expect(engine.snapshot().mode).toBe('replay');

    now += 87_000;
    const snapshot = engine.snapshot();
    expect(snapshot.mode).toBe('live');
    expect(snapshot.simulationTime).toBe(now);
    expect(snapshot.speed).toBe(1);
    expect(snapshot.isPlaying).toBe(true);
    expect(engine.replayToLiveActive).toBe(false);
  });

  it('reclassifies a paused timestamp as replay once wall time passes it', () => {
    let now = 10_000;
    const engine = new TimeEngine({ now: () => now });
    engine.pause();
    now = 11_000;
    expect(engine.snapshot().mode).toBe('replay');
  });
});

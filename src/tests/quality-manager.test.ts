import { describe, expect, it } from 'vitest';
import { QualityManager } from '../core/engine/QualityManager';

describe('QualityManager', () => {
  it('degrades one level at a time', () => {
    const quality = new QualityManager('high');
    expect(quality.degrade()).toBe('medium');
    expect(quality.degrade()).toBe('low');
    expect(quality.degrade()).toBe('low');
  });

  it('requires sustained low FPS before auto-degrading', () => {
    const quality = new QualityManager('high');
    quality.observeFps(30);
    quality.observeFps(30);
    expect(quality.level).toBe('high');
    quality.observeFps(30);
    expect(quality.level).toBe('medium');
  });

  it('can recover quality after sustained healthy FPS without oscillating', () => {
    let now = 0;
    const quality = new QualityManager('low', () => now);
    for (let i = 0; i < 25; i += 1) quality.observeFps(60);
    expect(quality.level).toBe('medium');
    for (let i = 0; i < 25; i += 1) quality.observeFps(60);
    expect(quality.level).toBe('medium');
    now = 31_000;
    for (let i = 0; i < 25; i += 1) quality.observeFps(60);
    expect(quality.level).toBe('high');
  });

  it('does not auto-degrade a manually selected profile', () => {
    const quality = new QualityManager('high');
    quality.set('high', 'manual');
    for (let i = 0; i < 8; i += 1) quality.observeFps(10);
    expect(quality.level).toBe('high');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { recordCanvas, releaseFilename } from '../features/capture/capture';

describe('release capture filenames', () => {
  it('creates filesystem-safe timestamped snapshot names', () => {
    expect(releaseFilename('snapshot', Date.UTC(2026, 8, 12, 12, 0, 0), 'png')).toBe('signal-earth-snapshot-2026-09-12T12-00-00-000Z.png');
  });

  it('stops capture tracks when recording is unsupported', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: undefined });
    try {
      await expect(recordCanvas(stream, 10)).rejects.toThrow(/not supported/i);
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'MediaRecorder', descriptor);
      else Reflect.deleteProperty(globalThis, 'MediaRecorder');
    }
  });

});

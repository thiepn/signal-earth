import { describe, expect, it } from 'vitest';
import { releaseFilename } from '../features/capture/capture';

describe('release capture filenames', () => {
  it('creates filesystem-safe timestamped snapshot names', () => {
    expect(releaseFilename('snapshot', Date.UTC(2026, 8, 12, 12, 0, 0), 'png')).toBe('signal-earth-snapshot-2026-09-12T12-00-00-000Z.png');
  });
});

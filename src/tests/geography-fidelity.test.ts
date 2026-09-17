import { describe, expect, it } from 'vitest';
import {
  GEOGRAPHY_DETAIL_PATH,
  GEOGRAPHY_FALLBACK_PATH,
  LAND_CURVATURE_DEGREES,
} from '../core/engine/geographyFidelity';

describe('geography fidelity invariants', () => {
  it('uses regional vector geography as the primary visible land source', () => {
    expect(GEOGRAPHY_DETAIL_PATH).toContain('natural-earth-50m');
    expect(GEOGRAPHY_FALLBACK_PATH).toContain('lowres');
  });

  it('keeps regional polygon fill tessellation bounded without simplifying coastline vertices', () => {
    expect(LAND_CURVATURE_DEGREES).toBeLessThanOrEqual(5);
  });
});

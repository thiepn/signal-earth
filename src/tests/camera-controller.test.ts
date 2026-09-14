import { describe, expect, it } from 'vitest';
import { CameraController } from '../core/engine/CameraController';
import { asEntityId } from '../shared/types/entities';

describe('CameraController state contract', () => {
  it('manual input cancels follow mode', () => {
    const camera = new CameraController();
    camera.followEntity(asEntityId('sat:iss'));
    expect(camera.state.mode).toBe('following');
    camera.onManualCameraInput();
    expect(camera.state).toEqual({ mode: 'free', targetEntityId: null });
  });

  it('cuts camera transitions when reduced motion is active', () => {
    const camera = new CameraController();
    let duration = -1;
    camera.attachRuntime({
      pointOfView: (_target, value = 0) => { duration = value; },
      currentPointOfView: () => ({ lat: 0, lng: 0, altitude: 2 }),
    });
    camera.setReducedMotion(true);
    camera.frameEarth(1200);
    expect(duration).toBe(0);
    expect(camera.state.mode).toBe('free');
  });
});

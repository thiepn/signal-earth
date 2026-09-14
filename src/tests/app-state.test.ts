import { describe, expect, it } from 'vitest';
import { INITIAL_APP_STATE, reduceAppState } from '../core/state/store';
import { asEntityId } from '../shared/types/entities';

const id = asEntityId('location:test');

describe('app state reducer', () => {
  it('keeps a single primary selection and advances its interaction mode', () => {
    const selected = reduceAppState(INITIAL_APP_STATE, { type: 'SELECT_ENTITY', entityId: id });
    expect(selected.selection).toEqual({ selectedId: id, hoveredId: null, mode: 'inspect' });

    const focused = reduceAppState(selected, { type: 'FOCUS_ENTITY', entityId: id });
    expect(focused.selection.mode).toBe('focus');

    const cleared = reduceAppState(focused, { type: 'CLEAR_SELECTION' });
    expect(cleared.selection.selectedId).toBeNull();
    expect(cleared.selection.mode).toBe('none');
  });

  it('toggles primary layer state without mutating other layers', () => {
    const disabled = reduceAppState(INITIAL_APP_STATE, { type: 'DISABLE_LAYER', layer: 'orbit' });
    expect(disabled.layers.orbit).toBe(false);
    expect(disabled.layers.earthquakes).toBe(true);
  });


  it('switches the canonical Earth visual mode', () => {
    const night = reduceAppState(INITIAL_APP_STATE, { type: 'SET_VISUAL_MODE', mode: 'night' });
    expect(night.visualMode).toBe('night');
    expect(night.layers).toEqual(INITIAL_APP_STATE.layers);
  });


  it('tracks provider freshness independently from layer state', () => {
    const state = reduceAppState(INITIAL_APP_STATE, { type: 'SET_PROVIDER_STATUS', provider: 'usgs', status: 'fresh' });
    expect(state.providerStatus.usgs).toBe('fresh');
    expect(state.layers).toEqual(INITIAL_APP_STATE.layers);
  });

  it('synchronizes the canonical clock snapshot', () => {
    const clock = {
      mode: 'simulation' as const,
      realTime: 1_000,
      simulationTime: 2_000,
      speed: 10 as const,
      isPlaying: true,
    };
    const state = reduceAppState(INITIAL_APP_STATE, { type: 'SYNC_CLOCK', clock });
    expect(state.clock).toEqual(clock);
  });
});

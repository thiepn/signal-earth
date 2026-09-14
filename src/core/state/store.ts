import type { AppAction } from '../../app/actions';
import type { EntityId } from '../../shared/types/entities';
import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { Freshness } from '../data/freshness';
import type { ProviderId } from '../../shared/types/sources';
import type { SimulationClockSnapshot } from '../time/temporal';

export interface SelectionState {
  selectedId: EntityId | null;
  hoveredId: EntityId | null;
  mode: 'none' | 'inspect' | 'focus' | 'follow';
}

export interface AppState {
  selection: SelectionState;
  layers: Record<LayerId, boolean>;
  visualMode: VisualMode;
  providerStatus: Partial<Record<ProviderId, Freshness>>;
  clock: SimulationClockSnapshot | null;
}

export const INITIAL_APP_STATE: AppState = {
  selection: { selectedId: null, hoveredId: null, mode: 'none' },
  layers: { weather: true, earthquakes: true, events: false, orbit: false, aurora: false },
  visualMode: 'earth',
  providerStatus: {},
  clock: null,
};

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { selectedId: action.entityId, hoveredId: null, mode: 'inspect' } };
    case 'FOCUS_ENTITY':
      return { ...state, selection: { selectedId: action.entityId, hoveredId: null, mode: 'focus' } };
    case 'FOLLOW_ENTITY':
      return { ...state, selection: { selectedId: action.entityId, hoveredId: null, mode: 'follow' } };
    case 'CLEAR_SELECTION':
      return { ...state, selection: { selectedId: null, hoveredId: null, mode: 'none' } };
    case 'ENABLE_LAYER':
      return { ...state, layers: { ...state.layers, [action.layer]: true } };
    case 'DISABLE_LAYER':
      return { ...state, layers: { ...state.layers, [action.layer]: false } };
    case 'SET_VISUAL_MODE':
      return { ...state, visualMode: action.mode };
    case 'SET_PROVIDER_STATUS':
      return { ...state, providerStatus: { ...state.providerStatus, [action.provider]: action.status } };
    case 'SYNC_CLOCK':
      return { ...state, clock: action.clock };
    default:
      return state;
  }
}

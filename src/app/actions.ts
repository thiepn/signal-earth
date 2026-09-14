import type { EntityId } from '../shared/types/entities';
import type { LayerId, VisualMode } from '../shared/types/layers';
import type { SimulationClockSnapshot, SimulationSpeed } from '../core/time/temporal';
import type { Freshness } from '../core/data/freshness';
import type { ProviderId } from '../shared/types/sources';

export type AppAction =
  | { type: 'SELECT_ENTITY'; entityId: EntityId }
  | { type: 'FOCUS_ENTITY'; entityId: EntityId }
  | { type: 'FOLLOW_ENTITY'; entityId: EntityId }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_TIME'; timestamp: number }
  | { type: 'SET_TIME_SPEED'; speed: SimulationSpeed }
  | { type: 'START_REPLAY_TO_LIVE'; fromTimestamp: number; speed: Exclude<SimulationSpeed, 0> }
  | { type: 'RETURN_LIVE' }
  | { type: 'SYNC_CLOCK'; clock: SimulationClockSnapshot }
  | { type: 'ENABLE_LAYER'; layer: LayerId }
  | { type: 'DISABLE_LAYER'; layer: LayerId }
  | { type: 'SET_VISUAL_MODE'; mode: VisualMode }
  | { type: 'SET_PROVIDER_STATUS'; provider: ProviderId; status: Freshness }
  | { type: 'RESET_GLOBE' }
  | { type: 'START_BRIEFING'; briefingId: string };

import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { SimulationSpeed } from '../../core/time/temporal';
import type { NaturalEventCategory } from '../natural-events/types';
import type { EarthquakeTimeWindow } from '../seismic/types';
import type { SatelliteCategory } from '../../shared/types/orbit';

export type BriefingId = 'earth-now' | 'orbit-now' | 'planet-motion' | 'night-earth';

export type BriefingInstruction =
  | { type: 'frame-earth'; lat?: number; lng?: number; altitude?: number; durationMs?: number }
  | { type: 'set-visual-mode'; mode: VisualMode }
  | { type: 'set-layer'; layer: LayerId; enabled: boolean }
  | { type: 'set-orbit-categories'; categories: SatelliteCategory[] }
  | { type: 'set-natural-event-categories'; categories: NaturalEventCategory[] }
  | { type: 'set-earthquake-filter'; magnitude: number; window?: EarthquakeTimeWindow }
  | { type: 'clear-selection' }
  | { type: 'select-strongest-earthquake' }
  | { type: 'select-featured-natural-event' }
  | { type: 'select-satellite'; target: 'iss' | 'weather' | 'navigation' | 'earth-observation' | 'science' }
  | { type: 'focus-selection' }
  | { type: 'follow-selected-satellite' }
  | { type: 'frame-selected-orbit' }
  | { type: 'set-speed'; speed: SimulationSpeed }
  | { type: 'seek-hours'; hours: number }
  | { type: 'return-live' }
  | { type: 'stop-camera' };

export interface BriefingStep {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  holdMs: number;
  instructions: BriefingInstruction[];
}

export interface BriefingDefinition {
  id: BriefingId;
  eyebrow: string;
  title: string;
  description: string;
  estimatedSeconds: number;
  steps: BriefingStep[];
}

export type TourStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface TourState {
  status: TourStatus;
  briefingId: BriefingId | null;
  briefingTitle: string | null;
  stepIndex: number;
  stepCount: number;
  step: BriefingStep | null;
  progress: number;
  error: string | null;
}

export type TourOutcome = 'completed' | 'cancelled' | 'failed';

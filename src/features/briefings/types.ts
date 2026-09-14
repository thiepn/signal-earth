import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { SimulationSpeed } from '../../core/time/temporal';
import type { NaturalEventCategory } from '../natural-events/types';
import type { EarthquakeTimeWindow } from '../seismic/types';
import type { SatelliteCategory } from '../../shared/types/orbit';

export type BriefingId =
  | 'earth-now'
  | 'seismic-now'
  | 'storm-watch'
  | 'space-weather-now'
  | 'above-me'
  | 'orbit-now'
  | 'last-24h'
  | 'planet-motion'
  | 'night-earth';

export type BriefingDataState = 'live' | 'cached' | 'partial' | 'fallback' | 'unavailable' | 'static';

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
  /** Phase 23 metadata. Static Phase 13 tours omit this or set it to false. */
  dataDriven?: boolean;
  /** Describes the provider snapshot used to compose this definition. */
  dataState?: BriefingDataState;
  /** Short source-grounded line rendered in the launcher card. */
  dataSummary?: string;
  /** Wall-clock time at which the dynamic definition was composed. */
  generatedAt?: number;
  /** False when a briefing cannot be made meaningful without an explicit prerequisite. */
  available?: boolean;
  unavailableReason?: string;
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

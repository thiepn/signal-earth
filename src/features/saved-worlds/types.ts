import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { TimelineRange } from '../timeline/timeline';

export interface SavedWorldSummary {
  visualMode: VisualMode;
  timelineRange: TimelineRange;
  enabledLayers: LayerId[];
  target: string | null;
  timeMode: 'live' | 'replay' | 'simulation' | 'unknown';
}

export interface SavedWorld {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  summary: SavedWorldSummary;
}

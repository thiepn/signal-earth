import type { EntityId, GeoCoordinates, SignalKind } from '../../shared/types/entities';
import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { BriefingId } from '../briefings/types';

export type SearchResultKind =
  | SignalKind
  | 'city'
  | 'country'
  | 'layer'
  | 'satellite-category'
  | 'visual-mode'
  | 'command';

export interface SearchDocument {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  keywords: string[];
  coordinates?: GeoCoordinates;
  entityId?: EntityId;
  layer?: LayerId;
  satelliteCategory?: SatelliteCategory;
  visualMode?: VisualMode;
  commandText?: string;
  priority?: number;
  timestamp?: number;
  magnitude?: number;
}

export interface RankedSearchResult extends SearchDocument {
  score: number;
  matches: string[];
}

export type CommandIntent =
  | { type: 'help' }
  | { type: 'reset' }
  | { type: 'live' }
  | { type: 'pause' }
  | { type: 'play' }
  | { type: 'replay-day' }
  | { type: 'speed'; speed: 1 | 10 | 100 | 1000 }
  | { type: 'time-offset'; hours: number }
  | { type: 'visual-mode'; mode: VisualMode }
  | { type: 'layer'; operation: 'show' | 'hide' | 'only'; layer: LayerId }
  | { type: 'satellite-category'; operation: 'show' | 'hide' | 'only'; category: SatelliteCategory }
  | { type: 'navigate'; query: string }
  | { type: 'follow'; query: string }
  | { type: 'search'; query: string }
  | { type: 'here' }
  | { type: 'share' }
  | { type: 'capture' }
  | { type: 'record' }
  | { type: 'install' }
  | { type: 'briefings'; briefingId?: BriefingId };

export interface ParsedCommand {
  intent: CommandIntent;
  canonical: string;
  description: string;
}

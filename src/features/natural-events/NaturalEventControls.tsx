import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import {
  NATURAL_EVENT_CATEGORIES,
  NATURAL_EVENT_CATEGORY_GLYPHS,
  NATURAL_EVENT_CATEGORY_LABELS,
  type NaturalEventCategory,
} from './types';

interface NaturalEventControlsProps {
  enabled: boolean;
  activeCategories: Record<NaturalEventCategory, boolean>;
  categoryCounts: Record<NaturalEventCategory, number>;
  visibleCount: number;
  totalCount: number;
  freshness: Freshness | undefined;
  sourceUpdatedAt: number | undefined;
  loading: boolean;
  error: string | null;
  partial: boolean;
  timeMode: TimeMode;
  onToggleCategory(category: NaturalEventCategory, enabled: boolean): void;
  onRefresh(): void;
}

function freshnessLabel(value?: Freshness): string {
  if (!value) return 'IDLE';
  if (value === 'fresh') return 'LIVE';
  return value.toUpperCase();
}

function formatUpdated(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '—';
  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (ageMinutes < 1) return '<1m ago';
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  if (ageMinutes < 1_440) return `${Math.round(ageMinutes / 60)}h ago`;
  return `${Math.round(ageMinutes / 1_440)}d ago`;
}

export function NaturalEventControls(props: NaturalEventControlsProps) {
  if (!props.enabled) return null;
  return (
    <section className="event-controls" aria-label="NASA natural event controls">
      <div className="quake-control-header">
        <div>
          <span className="panel-eyebrow">NASA · EONET V3</span>
          <strong>{props.timeMode === 'live' ? `${props.visibleCount} visible` : `${props.visibleCount} at time`} · {props.totalCount} loaded</strong>
        </div>
        <span className={`freshness-chip freshness-chip--${props.freshness ?? 'unavailable'}`}>{props.loading ? 'LOADING' : freshnessLabel(props.freshness)}</span>
      </div>

      <div className="event-category-list">
        {NATURAL_EVENT_CATEGORIES.map((category) => (
          <button key={category} type="button" className={`event-category ${props.activeCategories[category] ? 'is-active' : ''}`} onClick={() => props.onToggleCategory(category, !props.activeCategories[category])} aria-pressed={props.activeCategories[category]}>
            <span className={`event-category__glyph event-category__glyph--${category}`}>{NATURAL_EVENT_CATEGORY_GLYPHS[category]}</span>
            <span>{NATURAL_EVENT_CATEGORY_LABELS[category]}</span>
            <small>{props.categoryCounts[category] ?? 0}</small>
          </button>
        ))}
      </div>

      <div className="event-controls__footer">
        <span>latest geometry · {formatUpdated(props.sourceUpdatedAt)}</span>
        <button type="button" onClick={props.onRefresh} disabled={props.loading}>{props.loading ? '…' : '↻ Refresh'}</button>
      </div>
      {props.partial && <p className="layer-inline-warning">One EONET query was unavailable. Showing the event data that loaded successfully.</p>}
      {props.error && <p className="layer-inline-warning">{props.error}</p>}
      <p className="event-visual-note">Storm lines show reported historical positions. Future timeline positions are never extrapolated; open events remain at their latest observed geometry.</p>
    </section>
  );
}

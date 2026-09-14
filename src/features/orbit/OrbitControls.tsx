import type { Freshness } from '../../core/data/freshness';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { OrbitScaleMode } from './interaction';
import { ORBIT_CATEGORIES, ORBIT_CATEGORY_LABELS } from './types';

interface OrbitControlsProps {
  enabled: boolean;
  temporalAvailable?: boolean;
  activeCategories: Record<SatelliteCategory, boolean>;
  categoryCounts: Record<SatelliteCategory, number>;
  totalCount: number;
  validCount: number;
  freshness: Freshness | undefined;
  sourceUpdatedAt: number | undefined;
  loading: boolean;
  error: string | null;
  partial: boolean;
  scaleMode: OrbitScaleMode;
  onScaleModeChange(mode: OrbitScaleMode): void;
  onToggleCategory(category: SatelliteCategory, enabled: boolean): void;
}

function freshnessLabel(value?: Freshness): string {
  if (!value) return 'IDLE';
  if (value === 'fresh') return 'LIVE';
  return value.toUpperCase();
}

export function OrbitControls(props: OrbitControlsProps) {
  if (!props.enabled) return null;
  const temporalAvailable = props.temporalAvailable ?? true;
  return (
    <section className="orbit-controls" aria-label="Orbit layer controls">
      <div className="quake-control-header">
        <div>
          <span className="panel-eyebrow">CELESTRAK · OMM</span>
          <strong>{temporalAvailable ? `${props.validCount.toLocaleString()} active · ${props.totalCount.toLocaleString()} catalog` : 'Outside certified replay window'}</strong>
        </div>
        <span className={`freshness-chip freshness-chip--${props.freshness ?? 'unavailable'}`}>{props.loading ? 'LOADING' : freshnessLabel(props.freshness)}</span>
      </div>

      <div className="orbit-category-list">
        {ORBIT_CATEGORIES.map((category) => (
          <button key={category} type="button" className={`orbit-category ${props.activeCategories[category] ? 'is-active' : ''}`} onClick={() => props.onToggleCategory(category, !props.activeCategories[category])} aria-pressed={props.activeCategories[category]}>
            <span>{ORBIT_CATEGORY_LABELS[category]}</span><small>{props.categoryCounts[category] ?? 0}</small>
          </button>
        ))}
      </div>

      <div className="orbit-scale-control">
        <span className="panel-eyebrow">ALTITUDE SCALE</span>
        <div className="orbit-scale-segments">
          <button type="button" className={props.scaleMode === 'true' ? 'is-active' : ''} onClick={() => props.onScaleModeChange('true')}>TRUE</button>
          <button type="button" className={props.scaleMode === 'visual' ? 'is-active' : ''} onClick={() => props.onScaleModeChange('visual')}>VISUAL</button>
        </div>
      </div>

      <div className="orbit2-guide" aria-label="Orbit 2.0 guide">
        <div className="orbit2-guide__head"><span className="panel-eyebrow">ORBIT 2.0</span><strong>Selected object mechanics</strong></div>
        <div className="orbit2-guide__classes" aria-label="Orbit classes">
          <span>LEO</span><span>MEO</span><span>GEO</span><span>HEO</span>
        </div>
        <div className="orbit2-guide__track">
          <span><b>ASC</b> solid ground track</span>
          <span><b>DESC</b> dashed ground track</span>
        </div>
        <p>Select a satellite for perigee/apogee, mean orbital phase, constellation context, current sunlight state, and ascending/descending motion. Marker caps use stratified catalog sampling so large catalogs are not biased toward the first loaded records.</p>
      </div>

      {!temporalAvailable && <p className="layer-inline-warning">Current OMM elements are not presented as certified historical orbit positions beyond ±24 hours. Return closer to LIVE to render satellites.</p>}
      {props.partial && <p className="layer-inline-warning">Some CelesTrak groups were unavailable. Showing the groups that loaded successfully.</p>}
      {props.error && <p className="layer-inline-warning">{props.error}</p>}
      {props.sourceUpdatedAt && <div className="orbit-source-age">Newest element epoch · {new Date(props.sourceUpdatedAt).toLocaleString()}</div>}
      <p className="orbit-scale-note">{props.scaleMode === 'true' ? 'Physical altitude scale is active.' : 'Visual scale exaggerates altitude for legibility. The selected object shows its exact factor.'}</p>
    </section>
  );
}
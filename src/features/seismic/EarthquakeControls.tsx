import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import type { EarthquakeTimeWindow } from './types';

export interface EarthquakeControlsProps {
  enabled: boolean;
  window: EarthquakeTimeWindow;
  magnitude: number;
  visibleCount: number;
  totalCount: number;
  freshness: Freshness | undefined;
  sourceUpdatedAt: number | undefined;
  loading: boolean;
  error: string | null;
  simulationTime: number;
  timeMode: TimeMode;
  onWindowChange(window: EarthquakeTimeWindow): void;
  onMagnitudeChange(magnitude: number): void;
  onRefresh(): void;
}

const WINDOWS: Array<{ id: EarthquakeTimeWindow; label: string }> = [
  { id: 'hour', label: '1H' },
  { id: 'day', label: '24H' },
  { id: 'week', label: '7D' },
  { id: 'month', label: '30D' },
];

const MAGNITUDES = [2.5, 3, 4, 5, 6];

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
  return `${Math.round(ageMinutes / 60)}h ago`;
}

export function EarthquakeControls(props: EarthquakeControlsProps) {
  if (!props.enabled) return null;

  return (
    <section className="quake-controls" aria-label="Earthquake filters">
      <div className="quake-controls__summary">
        <div>
          <span>USGS FEED</span>
          <strong>{props.loading ? 'LOADING' : freshnessLabel(props.freshness)}</strong>
        </div>
        <div>
          <span>{props.timeMode === 'live' ? 'VISIBLE' : 'AT TIME'}</span>
          <strong>{props.visibleCount.toLocaleString()} / {props.totalCount.toLocaleString()}</strong>
        </div>
      </div>

      <div className="quake-filter-group">
        <span>WINDOW</span>
        <div className="quake-segments quake-segments--four">
          {WINDOWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={props.window === item.id ? 'is-active' : ''}
              onClick={() => props.onWindowChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="quake-filter-group">
        <span>MIN MAGNITUDE</span>
        <div className="quake-segments quake-segments--five">
          {MAGNITUDES.map((value) => (
            <button
              key={value}
              type="button"
              className={props.magnitude === value ? 'is-active' : ''}
              onClick={() => props.onMagnitudeChange(value)}
            >
              M{value}+
            </button>
          ))}
        </div>
      </div>

      <div className="quake-legend" aria-label="Magnitude marker legend">
        <span><i className="quake-dot quake-dot--low" />M2.5</span>
        <span><i className="quake-dot quake-dot--mid" />M4</span>
        <span><i className="quake-dot quake-dot--high" />M5</span>
        <span><i className="quake-dot quake-dot--major" />M6+</span>
      </div>

      <div className="quake-controls__footer">
        <span>{props.error ? 'Using cached data if available' : props.timeMode === 'live' ? `source ${formatUpdated(props.sourceUpdatedAt)}` : `timeline ${new Date(props.simulationTime).toISOString().slice(11, 16)} UTC`}</span>
        <button type="button" onClick={props.onRefresh} disabled={props.loading}>{props.loading ? '…' : '↻ Refresh'}</button>
      </div>
      {props.error && <p className="quake-error">{props.error}</p>}
      <p className="quake-visual-note">Pulse rings mark recent/strong events; they are not measured seismic wavefronts.{props.timeMode !== 'live' ? ' Replay only uses observations present in the loaded USGS feed window.' : ''}</p>
    </section>
  );
}

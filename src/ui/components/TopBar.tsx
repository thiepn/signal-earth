import { APP_VERSION } from '../../app/version';
import type { GlobePointOfView } from '../../core/engine/globe.types';
import type { SimulationClockSnapshot } from '../../core/time/temporal';
import type { VisualMode } from '../../shared/types/layers';
import { StatusBadge } from './StatusBadge';

interface TopBarProps {
  ready: boolean;
  pointOfView: GlobePointOfView;
  clock: SimulationClockSnapshot | null;
  visualMode: VisualMode;
  onNow(): void;
  onSearch(): void;
  onBriefings(): void;
  onHere(): void;
  onSettings(): void;
  onReset(): void;
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;
}

function formatUtc(timestamp: number | undefined): string {
  if (!timestamp) return '--:-- UTC';
  return `${new Date(timestamp).toISOString().slice(11, 16)} UTC`;
}

export function TopBar({ ready, pointOfView, clock, visualMode, onNow, onSearch, onBriefings, onHere, onSettings, onReset }: TopBarProps) {
  const isLive = clock?.mode === 'live';
  const timeStatus = !clock ? 'STARTING' : isLive ? 'LIVE' : clock.simulationTime < clock.realTime ? 'REPLAY' : 'FUTURE';

  return (
    <header className="top-bar">
      <button className="brand" type="button" onClick={onReset} aria-label="Reset Signal Earth globe">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span className="brand-copy">
          <strong>Signal Earth</strong>
          <small>Earth observatory · v{APP_VERSION}</small>
        </span>
      </button>

      <div className="top-bar__center" aria-label="Current globe view">
        <span>{formatCoordinate(pointOfView.lat, 'N', 'S')}</span>
        <span>{formatCoordinate(pointOfView.lng, 'E', 'W')}</span>
        <span className="top-bar__alt">{pointOfView.altitude.toFixed(2)}R</span>
        <span className="top-bar__mode">{visualMode}</span>
      </div>

      <div className="top-bar__actions">
        <div className="top-runtime" aria-label={`Simulation ${timeStatus}`}>
          <StatusBadge tone={ready ? (isLive ? 'live' : 'warning') : 'muted'}>{ready ? timeStatus : 'STARTING'}</StatusBadge>
          <span className="utc-readout">{formatUtc(clock?.simulationTime)}</span>
        </div>

        <button className="top-action top-action--primary" type="button" onClick={onNow} aria-label="Open Signal Earth Now">
          <span className="top-action__live-dot" aria-hidden="true" /><span className="top-action__label">Now</span>
        </button>

        <button className="top-search-action" type="button" onClick={onSearch} aria-label="Search Signal Earth">
          <span className="top-search-action__icon" aria-hidden="true">⌕</span>
          <span className="top-search-action__copy">Search</span>
          <kbd>/</kbd>
        </button>

        <div className="top-secondary-actions" aria-label="Observatory tools">
          <button className="top-action top-action--secondary" type="button" onClick={onBriefings} aria-label="Open planetary briefings">
            <span aria-hidden="true">↗</span><span className="top-action__label">Briefings</span>
          </button>
          <button className="top-action top-action--secondary" type="button" onClick={onHere} aria-label="Open Above Me">
            <span aria-hidden="true">⌖</span><span className="top-action__label">Above me</span>
          </button>
        </div>

        <button className="icon-button top-settings-button" type="button" onClick={onSettings} aria-label="Open settings">···</button>
      </div>
    </header>
  );
}

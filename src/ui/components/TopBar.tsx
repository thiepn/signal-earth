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
          <strong>SIGNAL EARTH</strong>
          <small>{APP_VERSION}</small>
        </span>
      </button>

      <div className="top-bar__center" aria-label="Current globe view">
        <span>{formatCoordinate(pointOfView.lat, 'N', 'S')}</span>
        <span>{formatCoordinate(pointOfView.lng, 'E', 'W')}</span>
        <span className="top-bar__alt">ALT {pointOfView.altitude.toFixed(2)}R</span>
        <span className="top-bar__mode">{visualMode.toUpperCase()}</span>
      </div>

      <div className="top-bar__actions">
        <StatusBadge tone={ready ? (isLive ? 'live' : 'warning') : 'muted'}>
          {ready ? timeStatus : 'STARTING'}
        </StatusBadge>
        <span className="utc-readout">{formatUtc(clock?.simulationTime)}</span>
        <button className="top-action top-action--now" type="button" onClick={onNow} aria-label="Open Signal Earth Now">
          <span aria-hidden="true">●</span><span className="top-action__label">Now</span>
        </button>
        <button className="top-action" type="button" onClick={onSearch} aria-label="Open search">
          <span aria-hidden="true">⌕</span><span className="top-action__label">Search</span>
        </button>
        <button className="top-action top-action--briefing" type="button" onClick={onBriefings} aria-label="Open planetary briefings">
          <span aria-hidden="true">▶</span><span className="top-action__label">Brief</span>
        </button>
        <button className="top-action top-action--here" type="button" onClick={onHere} aria-label="Open Above Me">
          <span aria-hidden="true">⌖</span><span className="top-action__label">Here</span>
        </button>
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Open settings">⋯</button>
      </div>
    </header>
  );
}

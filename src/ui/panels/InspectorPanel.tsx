import type { Freshness } from '../../core/data/freshness';
import { visualAltitudeFactor, type OrbitCameraMode, type OrbitScaleMode } from '../../features/orbit/interaction';
import { trailLabel, type OrbitTrailMode } from '../../features/orbit/playback';
import type { SatelliteRecord, SatelliteTelemetry } from '../../features/orbit/types';
import type { EarthquakeRecord } from '../../features/seismic/types';
import type { NaturalEventRecord } from '../../features/natural-events/types';
import { NATURAL_EVENT_CATEGORY_GLYPHS, NATURAL_EVENT_CATEGORY_LABELS } from '../../features/natural-events/types';
import { geometryFrameAt } from '../../features/natural-events/timeline';
import type { SignalEntity } from '../../shared/types/entities';

interface InspectorPanelProps {
  entity: SignalEntity | null;
  earthquake: EarthquakeRecord | null;
  earthquakeFreshness: Freshness | undefined;
  naturalEvent: NaturalEventRecord | null;
  naturalEventFreshness: Freshness | undefined;
  simulationTime: number;
  satellite: SatelliteRecord | null;
  satelliteTelemetry: SatelliteTelemetry | null;
  orbitFreshness: Freshness | undefined;
  orbitScaleMode: OrbitScaleMode;
  orbitCameraMode: OrbitCameraMode;
  orbitTrailMode: OrbitTrailMode;
  showOrbitPath: boolean;
  showGroundTrack: boolean;
  onFocus(): void;
  onFollowSatellite(): void;
  onOrbitView(): void;
  onStopOrbitCamera(): void;
  onTrailModeChange(mode: OrbitTrailMode): void;
  onToggleOrbitPath(value: boolean): void;
  onToggleGroundTrack(value: boolean): void;
  onClear(): void;
  compact?: boolean;
}

function formatCoordinate(value: number, positive: string, negative: string): string { return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`; }
function formatMagnitude(value: number): string { return `M${value.toFixed(1)}`; }
function formatAge(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '<1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}
function freshnessLabel(value?: Freshness): string {
  if (!value) return 'UNKNOWN';
  if (value === 'fresh') return 'LIVE';
  return value.toUpperCase();
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { entity, earthquake, earthquakeFreshness, naturalEvent, naturalEventFreshness, simulationTime, satellite, satelliteTelemetry, orbitFreshness, compact = false } = props;
  if (!entity) {
    return (
      <div className={compact ? 'empty-inspector' : 'inspector-panel panel-surface'}>
        {!compact && <header className="panel-header"><div><div className="panel-eyebrow">INSPECTOR</div><h2>Nothing selected</h2></div></header>}
        <div className="empty-state"><span className="empty-state__target" aria-hidden="true">＋</span><strong>Select a signal</strong><p>Click an earthquake, natural event, satellite, or any point on Earth.</p></div>
      </div>
    );
  }

  const coordinates = entity.coordinates;
  const isEarthquake = entity.kind === 'earthquake' && earthquake;
  const isNaturalEvent = entity.kind === 'natural-event' && naturalEvent;
  const isSatellite = entity.kind === 'satellite' && satellite;
  const title = isEarthquake ? formatMagnitude(earthquake.magnitude) : entity.name;
  const naturalEventFrame = isNaturalEvent ? geometryFrameAt(naturalEvent, simulationTime) : null;
  const visualFactor = satelliteTelemetry ? visualAltitudeFactor(satelliteTelemetry.altitudeKm) : 1;

  return (
    <div className={compact ? 'inspector-content' : 'inspector-panel panel-surface'}>
      {!compact && <header className="panel-header"><div><div className="panel-eyebrow">SELECTED · {entity.kind.toUpperCase()}</div><h2>{title}</h2></div><button className="icon-button" type="button" onClick={props.onClear} aria-label="Clear selection">×</button></header>}
      {compact && <div className="panel-eyebrow">SELECTED · {entity.kind.toUpperCase()}</div>}
      {compact && <h3 className="mobile-selection-title">{isEarthquake ? `${formatMagnitude(earthquake.magnitude)} · ${earthquake.place}` : isNaturalEvent ? `${NATURAL_EVENT_CATEGORY_GLYPHS[naturalEvent.category]} ${naturalEvent.title}` : entity.name}</h3>}

      {isEarthquake && <>
        {!compact && <p className="quake-place">{earthquake.place}</p>}
        <dl className="detail-grid detail-grid--quake">
          <div><dt>Magnitude</dt><dd>{formatMagnitude(earthquake.magnitude)} {earthquake.magnitudeType ? `· ${earthquake.magnitudeType}` : ''}</dd></div>
          <div><dt>Depth</dt><dd>{earthquake.coordinates.depthKm.toFixed(1)} km</dd></div>
          <div><dt>Occurred</dt><dd>{formatAge(earthquake.time)}</dd></div>
          <div><dt>Status</dt><dd>{earthquake.status.toUpperCase()}</dd></div>
          <div><dt>Felt reports</dt><dd>{earthquake.felt?.toLocaleString() ?? '—'}</dd></div>
          <div><dt>Intensity</dt><dd>{earthquake.mmi === null ? '—' : `MMI ${earthquake.mmi.toFixed(1)}`}</dd></div>
          <div><dt>Tsunami flag</dt><dd>{earthquake.tsunami ? 'YES' : 'NO'}</dd></div>
          <div><dt>Alert</dt><dd>{earthquake.alert?.toUpperCase() ?? '—'}</dd></div>
        </dl>
        <div className="quake-meta-line"><span>{formatCoordinate(earthquake.coordinates.lat, 'N', 'S')}</span><span>{formatCoordinate(earthquake.coordinates.lon, 'E', 'W')}</span><span>SIG {earthquake.significance}</span></div>
      </>}

      {isNaturalEvent && <>
        <p className="quake-place">{NATURAL_EVENT_CATEGORY_GLYPHS[naturalEvent.category]} {NATURAL_EVENT_CATEGORY_LABELS[naturalEvent.category]} · {naturalEvent.closedAt === null ? 'OPEN' : 'CLOSED'}</p>
        {naturalEvent.description && <p className="event-description">{naturalEvent.description}</p>}
        <dl className="detail-grid detail-grid--quake">
          <div><dt>Started</dt><dd>{new Date(naturalEvent.startTime).toLocaleDateString()}</dd></div>
          <div><dt>Last geometry</dt><dd>{naturalEventFrame ? new Date(naturalEventFrame.timestamp).toLocaleString() : 'Not yet observed'}</dd></div>
          <div><dt>Status</dt><dd>{naturalEvent.closedAt === null ? 'OPEN' : 'CLOSED'}</dd></div>
          <div><dt>Geometry</dt><dd>{naturalEventFrame?.type.toUpperCase() ?? '—'}</dd></div>
          <div><dt>Magnitude</dt><dd>{naturalEventFrame?.magnitudeValue === null || naturalEventFrame?.magnitudeValue === undefined ? '—' : `${naturalEventFrame.magnitudeValue}${naturalEventFrame.magnitudeUnit ? ` ${naturalEventFrame.magnitudeUnit}` : ''}`}</dd></div>
          <div><dt>Reports</dt><dd>{naturalEvent.geometry.length}</dd></div>
        </dl>
        {naturalEventFrame && <div className="quake-meta-line"><span>{formatCoordinate(naturalEventFrame.point.lat, 'N', 'S')}</span><span>{formatCoordinate(naturalEventFrame.point.lon, 'E', 'W')}</span><span>OBSERVED</span></div>}
        {naturalEvent.sources.length > 0 && <div className="event-source-links">{naturalEvent.sources.slice(0, 3).map((source) => <a key={`${source.id}:${source.url}`} href={source.url} target="_blank" rel="noreferrer">{source.id}</a>)}</div>}
      </>}

      {isSatellite && <>
        <p className="quake-place">NORAD {satellite.noradId} · {satellite.category.replace('-', ' ').toUpperCase()}</p>
        <dl className="detail-grid detail-grid--quake">
          <div><dt>Altitude</dt><dd>{satelliteTelemetry ? `${satelliteTelemetry.altitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km` : 'Propagating…'}</dd></div>
          <div><dt>Velocity</dt><dd>{satelliteTelemetry ? `${satelliteTelemetry.speedKmS.toFixed(2)} km/s` : '—'}</dd></div>
          <div><dt>Latitude</dt><dd>{satelliteTelemetry ? formatCoordinate(satelliteTelemetry.lat, 'N', 'S') : '—'}</dd></div>
          <div><dt>Longitude</dt><dd>{satelliteTelemetry ? formatCoordinate(satelliteTelemetry.lon, 'E', 'W') : '—'}</dd></div>
          <div><dt>Element epoch</dt><dd>{new Date(satellite.epoch).toLocaleDateString()}</dd></div>
          <div><dt>Display scale</dt><dd>{props.orbitScaleMode === 'true' ? 'TRUE' : `VISUAL ×${visualFactor.toFixed(2)}`}</dd></div>
        </dl>
        <div className="quake-meta-line"><span>PROPAGATED</span><span>{satellite.categories.map((category) => category.replace('-', ' ')).join(' · ')}</span></div>

        <div className="orbit-inspector-actions">
          <button className={`primary-button ${props.orbitCameraMode === 'follow' ? 'is-active' : ''}`} type="button" onClick={props.onFollowSatellite}>{props.orbitCameraMode === 'follow' ? 'Stop follow' : 'Follow'}</button>
          <button className={`secondary-button ${props.orbitCameraMode === 'orbit' ? 'is-active' : ''}`} type="button" onClick={props.onOrbitView}>Orbit view</button>
        </div>
        <div className="orbit-context-actions">
          <button type="button" className={props.showOrbitPath ? 'is-active' : ''} onClick={() => props.onToggleOrbitPath(!props.showOrbitPath)}>Orbit path</button>
          <button type="button" className={props.showGroundTrack ? 'is-active' : ''} onClick={() => props.onToggleGroundTrack(!props.showGroundTrack)}>Ground track</button>
          <button type="button" onClick={props.onFocus}>Ground point</button>
        </div>
        <div className="orbit-trail-control">
          <span className="panel-eyebrow">TEMPORAL TRAIL</span>
          <div className="orbit-trail-segments">
            {(['off', 'past-10m', 'past-orbit', 'next-orbit'] as OrbitTrailMode[]).map((mode) => (
              <button key={mode} type="button" className={props.orbitTrailMode === mode ? 'is-active' : ''} onClick={() => props.onTrailModeChange(mode)}>{trailLabel(mode)}</button>
            ))}
          </div>
        </div>
        {props.orbitCameraMode !== 'none' && <button className="orbit-stop-camera" type="button" onClick={props.onStopOrbitCamera}>Return to free camera</button>}
      </>}

      {!isEarthquake && !isNaturalEvent && !isSatellite && coordinates && <dl className="detail-grid">
        <div><dt>Latitude</dt><dd>{formatCoordinate(coordinates.lat, 'N', 'S')}</dd></div>
        <div><dt>Longitude</dt><dd>{formatCoordinate(coordinates.lon, 'E', 'W')}</dd></div>
        <div><dt>Temporal</dt><dd>{entity.temporalType.toUpperCase()}</dd></div>
        <div><dt>Source</dt><dd>{entity.source.name}</dd></div>
      </dl>}

      {!isSatellite && <div className="inspector-actions">
        <button className="primary-button" type="button" onClick={props.onFocus}>Focus</button>
        {isEarthquake ? <a className="secondary-button inspector-link" href={earthquake.url} target="_blank" rel="noreferrer">USGS</a> : isNaturalEvent ? <a className="secondary-button inspector-link" href={naturalEvent.link} target="_blank" rel="noreferrer">NASA EONET</a> : <button className="secondary-button" type="button" onClick={props.onClear}>Clear</button>}
      </div>}

      {isSatellite && <div className="inspector-actions"><a className="secondary-button inspector-link" href="https://celestrak.org/" target="_blank" rel="noreferrer">CelesTrak source</a></div>}
      {(isEarthquake || isNaturalEvent || isSatellite) && compact && <button className="clear-selection-mobile" type="button" onClick={props.onClear}>Clear selection</button>}
      <div className="source-strip"><span>{isEarthquake ? 'USGS · OBSERVED' : isNaturalEvent ? 'NASA EONET · OBSERVED' : isSatellite ? 'CELESTRAK · PROPAGATED' : 'DATA STATE'}</span><strong>{isEarthquake ? freshnessLabel(earthquakeFreshness) : isNaturalEvent ? freshnessLabel(naturalEventFreshness) : isSatellite ? freshnessLabel(orbitFreshness) : 'LOCAL TARGET'}</strong></div>
    </div>
  );
}

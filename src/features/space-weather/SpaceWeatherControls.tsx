import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import { IntelligenceCard } from '../intelligence/IntelligenceCard';
import { buildSpaceWeatherIntelligence } from '../intelligence/derive';
import type { VisualMode } from '../../shared/types/layers';
import { describeKp, isAuroraModelApplicable, isCurrentScaleApplicable, isCurrentSolarWindApplicable, kpSampleAt } from './timeline';
import type { AuroraHemispheres, SpaceWeatherFeed } from './types';

function relativeAge(timestamp?: number): string {
  if (!timestamp) return '—';
  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function freshnessLabel(value?: Freshness): string {
  if (!value) return 'IDLE';
  return value.toUpperCase();
}

interface SpaceWeatherControlsProps {
  enabled: boolean;
  feed: SpaceWeatherFeed | null;
  freshness: Freshness | undefined;
  loading: boolean;
  error: string | null;
  simulationTime: number;
  timeMode: TimeMode;
  hemispheres: AuroraHemispheres;
  visualMode: VisualMode;
  onToggleHemisphere(hemisphere: keyof AuroraHemispheres, enabled: boolean): void;
  onRefresh(): void;
  onNightMode(): void;
}

export function SpaceWeatherControls(props: SpaceWeatherControlsProps) {
  if (!props.enabled) return null;
  const kp = props.feed ? kpSampleAt(props.feed.kp, props.simulationTime) : null;
  const auroraApplicable = props.feed?.aurora ? isAuroraModelApplicable(props.feed.aurora, props.simulationTime) : false;
  const solarWindApplicable = props.feed?.solarWind ? isCurrentSolarWindApplicable(props.feed.solarWind, props.simulationTime) : false;
  const scalesApplicable = props.feed?.scales ? isCurrentScaleApplicable(props.feed.scales, props.simulationTime) : false;
  const scales = props.feed?.scales;
  const wind = props.feed?.solarWind;
  const recentMessages = props.feed?.messages.filter((message) => message.kind !== 'cancel').slice(0, 2) ?? [];
  const intelligence = buildSpaceWeatherIntelligence({
    kp,
    scales: scales ?? null,
    solarWind: wind ?? null,
    scalesApplicable,
    solarWindApplicable,
    auroraApplicable,
  });

  return (
    <section className="space-weather-controls" aria-label="Space weather controls">
      <div className="space-weather-head">
        <div>
          <span className="control-eyebrow">NOAA SWPC</span>
          <strong>Space weather</strong>
        </div>
        <span className={`data-status data-status--${props.freshness ?? 'unavailable'}`}>{props.loading ? 'LOADING' : freshnessLabel(props.freshness)}</span>
      </div>

      <div className="space-weather-kp">
        <div className="space-weather-kp__value">{kp ? kp.kp.toFixed(1) : '—'}</div>
        <div>
          <span>Kp at simulation time</span>
          <strong>{describeKp(kp)}</strong>
          <small>{kp ? kp.kind.toUpperCase() : props.timeMode === 'live' ? 'NO VALUE' : 'OUTSIDE FEED RANGE'}</small>
        </div>
      </div>

      <div className="space-weather-scale-grid" aria-label="NOAA space-weather scales">
        {(['G', 'R', 'S'] as const).map((kind) => (
          <div key={kind} className={!scalesApplicable ? 'is-muted' : ''}>
            <span>{kind}</span>
            <strong>{scalesApplicable && scales ? scales[kind].scale : '—'}</strong>
            <small>{scalesApplicable && scales ? (scales[kind].text ?? 'none') : 'live only'}</small>
          </div>
        ))}
      </div>

      <div className="space-weather-wind">
        <div><span>Solar wind</span><strong>{solarWindApplicable && wind?.speedKmS !== null ? `${Math.round(wind?.speedKmS ?? 0)} km/s` : '—'}</strong></div>
        <div><span>IMF Bz</span><strong>{solarWindApplicable && wind?.bzGsmNt !== null ? `${(wind?.bzGsmNt ?? 0) >= 0 ? '+' : ''}${(wind?.bzGsmNt ?? 0).toFixed(1)} nT` : '—'}</strong></div>
        {!solarWindApplicable && wind && <small>Current solar-wind observations are not applied to replay/future time.</small>}
      </div>

      <IntelligenceCard intelligence={intelligence} compact />

      <div className="aurora-control-block">
        <div className="aurora-control-head">
          <span>Aurora model</span>
          <strong>{auroraApplicable ? 'VALID' : props.feed?.aurora ? 'OUT OF WINDOW' : 'UNAVAILABLE'}</strong>
        </div>
        <div className="aurora-hemi-grid">
          <button type="button" className={props.hemispheres.north ? 'is-active' : ''} onClick={() => props.onToggleHemisphere('north', !props.hemispheres.north)}>NORTH</button>
          <button type="button" className={props.hemispheres.south ? 'is-active' : ''} onClick={() => props.onToggleHemisphere('south', !props.hemispheres.south)}>SOUTH</button>
        </div>
        {props.visualMode !== 'night' && <button type="button" className="aurora-night-button" onClick={props.onNightMode}>VIEW IN NIGHT MODE</button>}
        <p>OVATION is a forecast/model field. It is hidden when the selected simulation time falls outside this model run's validity window.</p>
      </div>

      {recentMessages.length > 0 && (
        <div className="space-weather-messages">
          <span className="control-eyebrow">RECENT SWPC MESSAGES</span>
          {recentMessages.map((message) => <div key={`${message.productId}:${message.issuedAt}`}><strong>{message.title}</strong><small>{message.productId}</small></div>)}
        </div>
      )}

      {props.feed?.partial && <p className="space-weather-partial">Partial data · unavailable: {props.feed.unavailableSources.join(', ') || 'one or more NOAA products'}</p>}
      {props.error && <p className="quake-error">{props.error}</p>}

      <div className="space-weather-footer">
        <span>UPDATED {relativeAge(props.feed?.sourceUpdatedAt)} AGO</span>
        <button type="button" disabled={props.loading} onClick={props.onRefresh}>REFRESH</button>
      </div>
    </section>
  );
}

import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import type { EntityId } from '../../shared/types/entities';
import { HorizonSky } from './HorizonSky';
import type { ObserverAstronomy } from './astronomy';
import { auroraContextLabel } from './aurora';
import type { GeolocationState, LocalWeather, ObserverLocation, ObserverPassForecast, ObserverSkySnapshot } from './types';
import { cardinalWind, weatherCodeLabel } from './weather';

function coord(value: number, pos: string, neg: string): string { return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? pos : neg}`; }
function freshness(value?: Freshness): string { return (value ?? 'unavailable').toUpperCase(); }
function formatTime(timestamp: number | null, timezone?: string): string {
  if (!timestamp) return '—';
  try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(timestamp); }
  catch { return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
}
function formatDateTime(timestamp: number, timezone?: string): string {
  try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(timestamp); }
  catch { return new Date(timestamp).toLocaleString(); }
}

interface AboveMeControlsProps {
  location: ObserverLocation | null;
  geolocationState: GeolocationState;
  geolocationError: string | null;
  rememberLocation: boolean;
  weather: DataSnapshot<LocalWeather> | null;
  weatherLoading: boolean;
  weatherError: string | null;
  astronomy: ObserverAstronomy | null;
  sky: ObserverSkySnapshot | null;
  passForecast: ObserverPassForecast | null;
  orbitFreshness: Freshness | undefined;
  simulationTime: number;
  timeMode: TimeMode;
  auroraValue: number | null;
  auroraApplicable: boolean;
  onRequestLocation(): void;
  onForgetLocation(): void;
  onRememberLocation(value: boolean): void;
  onRefreshWeather(): void;
  onRefreshPasses(): void;
  onFocusLocation(): void;
  onSelectSatellite(id: EntityId): void;
}

export function AboveMeControls(props: AboveMeControlsProps) {
  if (!props.location) {
    return <div className="above-me-empty">
      <div className="above-me-empty__icon">⌖</div>
      <strong>Use your location to open the local observatory.</strong>
      <p>Your browser supplies coordinates only after you press the button. Signal Earth processes them locally and does not persist them unless you explicitly enable remembering.</p>
      <button className="primary-button" type="button" disabled={props.geolocationState === 'requesting'} onClick={props.onRequestLocation}>{props.geolocationState === 'requesting' ? 'Requesting location…' : 'Use my location'}</button>
      {props.geolocationError && <p className="above-me-error">{props.geolocationError}</p>}
      <small>Browser geolocation · explicit opt-in</small>
    </div>;
  }

  const timezone = props.weather?.data.timezone;
  const weatherApplicable = props.weather ? Math.abs(props.simulationTime - props.weather.data.timestamp) <= 45 * 60_000 : false;
  const weather = props.weather?.data;
  const nextPass = props.passForecast?.passes[0] ?? null;
  const visibleTop = props.sky?.satellites.slice(0, 5) ?? [];

  return <div className="above-me-controls">
    <section className="above-me-location">
      <div className="above-me-section-head"><div><span className="control-eyebrow">OBSERVER</span><strong>Your horizon</strong></div><span className="data-status data-status--fresh">LOCAL</span></div>
      <div className="above-me-coordinate"><span>{coord(props.location.lat, 'N', 'S')}</span><span>{coord(props.location.lon, 'E', 'W')}</span></div>
      <div className="above-me-meta"><span>{props.location.accuracyM ? `±${Math.round(props.location.accuracyM)} m` : 'saved coordinate'}</span><span>{props.timeMode.toUpperCase()} · {formatDateTime(props.simulationTime, timezone)}</span></div>
      <div className="above-me-actions"><button type="button" onClick={props.onFocusLocation}>Focus on globe</button><button type="button" onClick={props.onForgetLocation}>Forget</button></div>
      <label className="above-me-remember"><input type="checkbox" checked={props.rememberLocation} onChange={(event) => props.onRememberLocation(event.target.checked)} /> Remember this coordinate on this device</label>
    </section>

    {props.astronomy && <section className="above-me-astronomy">
      <div className="above-me-section-head"><div><span className="control-eyebrow">LOCAL SKY</span><strong>Sun & Moon</strong></div><span>{props.astronomy.sun.daylight.replace('-', ' ').toUpperCase()}</span></div>
      <div className="above-me-stat-grid">
        <div><span>Sun</span><strong>{props.astronomy.sun.elevationDeg.toFixed(1)}°</strong><small>AZ {props.astronomy.sun.azimuthDeg.toFixed(0)}°</small></div>
        <div><span>Moon</span><strong>{Math.round(props.astronomy.moon.illuminatedFraction * 100)}%</strong><small>{props.astronomy.moon.phaseName}</small></div>
        <div><span>Next sunrise</span><strong>{formatTime(props.astronomy.sun.nextSunrise, timezone)}</strong><small>solar −0.833°</small></div>
        <div><span>Next sunset</span><strong>{formatTime(props.astronomy.sun.nextSunset, timezone)}</strong><small>solar −0.833°</small></div>
      </div>
    </section>}

    {props.astronomy && <section className="above-me-horizon-block">
      <div className="above-me-section-head"><div><span className="control-eyebrow">MY HORIZON</span><strong>{props.sky ? `${props.sky.visibleCount} satellites above 0°` : 'Calculating satellites…'}</strong></div><span>{freshness(props.orbitFreshness)}</span></div>
      <HorizonSky astronomy={props.astronomy} sky={props.sky} onSelectSatellite={props.onSelectSatellite} />
      {visibleTop.length > 0 && <div className="above-me-sat-list">{visibleTop.map((sat) => <button type="button" key={sat.id} onClick={() => props.onSelectSatellite(sat.id)}><span>{sat.name}</span><strong>{sat.elevationDeg.toFixed(0)}°</strong><small>AZ {sat.azimuthDeg.toFixed(0)}°</small></button>)}</div>}
    </section>}

    <section className="above-me-pass-block">
      <div className="above-me-section-head"><div><span className="control-eyebrow">ISS PASS</span><strong>{nextPass ? formatDateTime(nextPass.startTime, timezone) : props.passForecast ? 'No pass in forecast window' : 'Calculating pass…'}</strong></div><button type="button" onClick={props.onRefreshPasses}>Refresh</button></div>
      {nextPass && <div className="above-me-pass-row"><div><span>Rise</span><strong>{formatTime(nextPass.startTime, timezone)}</strong></div><div><span>Max</span><strong>{nextPass.maxElevationDeg.toFixed(0)}°</strong></div><div><span>Set</span><strong>{formatTime(nextPass.endTime, timezone)}</strong></div></div>}
      <p>Passes use propagated CelesTrak orbital elements and a 5° minimum elevation. They describe geometry, not naked-eye visibility.</p>
    </section>

    <section className="above-me-weather">
      <div className="above-me-section-head"><div><span className="control-eyebrow">CURRENT WEATHER</span><strong>Open-Meteo</strong></div><span className={`data-status data-status--${props.weather?.freshness ?? 'unavailable'}`}>{props.weatherLoading ? 'LOADING' : freshness(props.weather?.freshness)}</span></div>
      {weather && weatherApplicable ? <>
        <div className="above-me-weather-main"><strong>{weather.temperatureC === null ? '—' : `${weather.temperatureC.toFixed(1)}°C`}</strong><span>{weatherCodeLabel(weather.weatherCode)}</span></div>
        <div className="above-me-weather-grid"><div><span>Cloud</span><strong>{weather.cloudCoverPct === null ? '—' : `${Math.round(weather.cloudCoverPct)}%`}</strong></div><div><span>Wind</span><strong>{weather.windSpeedKmh === null ? '—' : `${Math.round(weather.windSpeedKmh)} km/h ${cardinalWind(weather.windDirectionDeg)}`}</strong></div><div><span>Rain</span><strong>{weather.precipitationMm === null ? '—' : `${weather.precipitationMm.toFixed(1)} mm`}</strong></div><div><span>Humidity</span><strong>{weather.relativeHumidityPct === null ? '—' : `${Math.round(weather.relativeHumidityPct)}%`}</strong></div></div>
      </> : weather ? <p className="above-me-muted">Current weather is not applied to replay/future time. Astronomy and satellite geometry continue to follow the simulation clock.</p> : <p className="above-me-muted">{props.weatherLoading ? 'Loading current local conditions…' : 'Weather unavailable.'}</p>}
      {props.weatherError && <p className="above-me-error">{props.weatherError}</p>}
      <div className="above-me-source-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo.com</a><button type="button" onClick={props.onRefreshWeather}>Refresh</button></div>
    </section>

    <section className="above-me-aurora">
      <div className="above-me-section-head"><div><span className="control-eyebrow">AURORA AT OBSERVER</span><strong>{props.auroraApplicable ? auroraContextLabel(props.auroraValue) : 'Model out of window'}</strong></div><span>{props.auroraApplicable && props.auroraValue !== null ? `${props.auroraValue.toFixed(0)}` : '—'}</span></div>
      <p>Nearest NOAA OVATION model-cell value. This is model intensity/probability context, not a guarantee of visible aurora at ground level.</p>
    </section>
  </div>;
}

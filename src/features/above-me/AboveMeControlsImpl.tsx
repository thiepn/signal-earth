import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import type { EntityId } from '../../shared/types/entities';
import { HorizonSky } from './HorizonSky';
import type { ObserverAstronomy } from './astronomy';
import { auroraContextLabel } from './aurora';
import type { GeolocationState, LocalWeather, ObserverLocation, ObserverPassForecast, ObserverSkySnapshot } from './types';
import { cardinalWind, weatherCodeLabel } from './weather';
import { currentObservingConditions, illuminationState, rankObserverSky, rankPasses } from './visibility';

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
function direction(azimuthDeg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8]!;
}
function durationLabel(start: number, end: number): string {
  const seconds = Math.max(0, Math.round((end - start) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}
function skyStateLabel(elevationDeg: number): string {
  if (elevationDeg >= 0) return 'DAY';
  if (elevationDeg >= -6) return 'TWILIGHT';
  if (elevationDeg >= -12) return 'DUSK';
  return 'DARK';
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
  const weather = props.weather?.data ?? null;
  const sunElevation = props.astronomy?.sun.elevationDeg ?? Number.NaN;
  const observingConditions = currentObservingConditions(weather, weatherApplicable, sunElevation);
  const rankedSky = rankObserverSky(props.sky?.satellites ?? [], sunElevation, 5);
  const rankedPasses = rankPasses(props.passForecast, props.location.lat, props.location.lon, 4);
  const bestPass = rankedPasses[0] ?? null;
  const favorablePass = rankedPasses.find((entry) => entry.assessment.favorableGeometry) ?? null;
  const highSkyCount = props.sky?.satellites.filter((satellite) => satellite.elevationDeg >= 20).length ?? 0;

  return <div className="above-me-controls above-me-controls--v2">
    <section className="above-me-location">
      <div className="above-me-section-head"><div><span className="control-eyebrow">OBSERVER</span><strong>Your horizon</strong></div><span className="data-status data-status--fresh">LOCAL</span></div>
      <div className="above-me-coordinate"><span>{coord(props.location.lat, 'N', 'S')}</span><span>{coord(props.location.lon, 'E', 'W')}</span></div>
      <div className="above-me-meta"><span>{props.location.accuracyM ? `±${Math.round(props.location.accuracyM)} m` : 'saved coordinate'}</span><span>{props.timeMode.toUpperCase()} · {formatDateTime(props.simulationTime, timezone)}</span></div>
      <div className="above-me-actions"><button type="button" onClick={props.onFocusLocation}>Focus on globe</button><button type="button" onClick={props.onForgetLocation}>Forget</button></div>
      <label className="above-me-remember"><input type="checkbox" checked={props.rememberLocation} onChange={(event) => props.onRememberLocation(event.target.checked)} /> Remember this coordinate on this device</label>
    </section>

    {props.astronomy && <section className="above-me-observing-summary">
      <div className="above-me-section-head"><div><span className="control-eyebrow">WHAT CAN I SEE?</span><strong>{favorablePass ? `ISS · ${favorablePass.assessment.label}` : bestPass ? `ISS · ${bestPass.assessment.label}` : 'Local observing summary'}</strong></div><span className={`observer-quality observer-quality--${observingConditions.quality}`}>{skyStateLabel(props.astronomy.sun.elevationDeg)}</span></div>
      <p className="observer-summary-lead">{favorablePass
        ? `Best ISS geometry in the next 24 hours peaks ${formatDateTime(favorablePass.pass.maxTime, timezone)} at ${favorablePass.pass.maxElevationDeg.toFixed(0)}° elevation.`
        : bestPass
          ? `The strongest ISS geometry in the next 24 hours is ${bestPass.assessment.label.toLowerCase()} at ${formatDateTime(bestPass.pass.maxTime, timezone)}.`
          : 'No ISS pass is currently available in the 24-hour propagation window.'}</p>
      <div className="observer-summary-grid">
        <div><span>Sky</span><strong>{skyStateLabel(props.astronomy.sun.elevationDeg)}</strong><small>Sun {props.astronomy.sun.elevationDeg.toFixed(1)}°</small></div>
        <div><span>Current conditions</span><strong>{observingConditions.label}</strong><small>{weatherApplicable && weather?.cloudCoverPct !== null ? `${Math.round(weather?.cloudCoverPct ?? 0)}% cloud` : 'weather time-limited'}</small></div>
        <div><span>Above 20°</span><strong>{highSkyCount}</strong><small>propagated satellites</small></div>
        <div><span>Aurora</span><strong>{props.auroraApplicable ? auroraContextLabel(props.auroraValue) : 'Out of window'}</strong><small>{props.auroraApplicable && props.auroraValue !== null ? `OVATION ${props.auroraValue.toFixed(0)}` : 'model validity applies'}</small></div>
      </div>
      <p className="observer-summary-note">Pass quality combines observer darkness, maximum elevation and satellite sunlight at culmination. It does not model apparent brightness, local obstructions or future cloud cover.</p>
    </section>}

    {props.astronomy && <section className="above-me-astronomy">
      <div className="above-me-section-head"><div><span className="control-eyebrow">LOCAL SKY</span><strong>Sun & Moon</strong></div><span>{props.astronomy.sun.daylight.replace('-', ' ').toUpperCase()}</span></div>
      <div className="above-me-stat-grid">
        <div><span>Sun</span><strong>{props.astronomy.sun.elevationDeg.toFixed(1)}°</strong><small>AZ {props.astronomy.sun.azimuthDeg.toFixed(0)}° · {direction(props.astronomy.sun.azimuthDeg)}</small></div>
        <div><span>Moon</span><strong>{props.astronomy.moon.elevationDeg.toFixed(1)}°</strong><small>{Math.round(props.astronomy.moon.illuminatedFraction * 100)}% · {props.astronomy.moon.phaseName}</small></div>
        <div><span>Next sunrise</span><strong>{formatTime(props.astronomy.sun.nextSunrise, timezone)}</strong><small>solar −0.833°</small></div>
        <div><span>Next sunset</span><strong>{formatTime(props.astronomy.sun.nextSunset, timezone)}</strong><small>solar −0.833°</small></div>
      </div>
    </section>}

    {props.astronomy && <section className="above-me-horizon-block">
      <div className="above-me-section-head"><div><span className="control-eyebrow">MY HORIZON</span><strong>{props.sky ? `${props.sky.visibleCount} satellites above 0°` : 'Calculating satellites…'}</strong></div><span>{freshness(props.orbitFreshness)}</span></div>
      <HorizonSky astronomy={props.astronomy} sky={props.sky} onSelectSatellite={props.onSelectSatellite} />
      {rankedSky.length > 0 && <>
        <div className="above-me-list-caption"><span>Highest / best geometry now</span><small>illumination may be unavailable for live-list objects</small></div>
        <div className="above-me-sat-list above-me-sat-list--v2">{rankedSky.map(({ satellite, assessment }) => <button type="button" key={satellite.id} onClick={() => props.onSelectSatellite(satellite.id)}>
          <span><b>{satellite.name}</b><small>{assessment.illumination === 'unknown' ? satellite.category.replace('-', ' ') : assessment.illumination}</small></span>
          <strong>{satellite.elevationDeg.toFixed(0)}°</strong>
          <small>{direction(satellite.azimuthDeg)} · {Math.round(satellite.rangeKm)} km</small>
        </button>)}</div>
      </>}
    </section>}

    <section className="above-me-pass-block above-me-pass-block--v2">
      <div className="above-me-section-head"><div><span className="control-eyebrow">ISS · NEXT 24 HOURS</span><strong>{rankedPasses.length ? `${rankedPasses.length} ranked pass${rankedPasses.length === 1 ? '' : 'es'}` : props.passForecast ? 'No pass in forecast window' : 'Calculating passes…'}</strong></div><button type="button" onClick={props.onRefreshPasses}>Refresh</button></div>
      {rankedPasses.length > 0 && <div className="pass-opportunity-list">{rankedPasses.map(({ pass, assessment, observerSunElevationDeg }) => <article className={`pass-opportunity pass-opportunity--${assessment.quality}`} key={`${pass.startTime}:${pass.maxTime}`}>
        <div className="pass-opportunity__head"><div><span>{formatDateTime(pass.startTime, timezone)}</span><strong>{assessment.label}</strong></div><b>{pass.maxElevationDeg.toFixed(0)}°</b></div>
        <div className="pass-opportunity__timeline">
          <div><span>RISE</span><strong>{formatTime(pass.startTime, timezone)}</strong><small>{direction(pass.riseAzimuthDeg)}</small></div>
          <div><span>MAX</span><strong>{formatTime(pass.maxTime, timezone)}</strong><small>{direction(pass.maxAzimuthDeg)}</small></div>
          <div><span>SET</span><strong>{formatTime(pass.endTime, timezone)}</strong><small>{direction(pass.setAzimuthDeg)}</small></div>
        </div>
        <div className="pass-opportunity__meta"><span>{durationLabel(pass.startTime, pass.endTime)}</span><span>Sun {observerSunElevationDeg.toFixed(0)}°</span><span>{illuminationState(pass.maxShadowFraction).toUpperCase()}</span></div>
        <p>{assessment.reason}</p>
      </article>)}</div>}
      <p>ISS passes use propagated CelesTrak orbital elements and a 5° minimum elevation. Sunlight state is evaluated at maximum elevation with satellite.js. “Good” geometry is not a guarantee of naked-eye visibility.</p>
    </section>

    <section className="above-me-weather">
      <div className="above-me-section-head"><div><span className="control-eyebrow">CURRENT WEATHER</span><strong>Open-Meteo</strong></div><span className={`data-status data-status--${props.weather?.freshness ?? 'unavailable'}`}>{props.weatherLoading ? 'LOADING' : freshness(props.weather?.freshness)}</span></div>
      {props.astronomy && <div className={`observing-condition observing-condition--${observingConditions.quality}`}><span>OPTICAL CONDITIONS NOW</span><strong>{observingConditions.label}</strong><p>{observingConditions.detail}</p></div>}
      {weather && weatherApplicable ? <>
        <div className="above-me-weather-main"><strong>{weather.temperatureC === null ? '—' : `${weather.temperatureC.toFixed(1)}°C`}</strong><span>{weatherCodeLabel(weather.weatherCode)}</span></div>
        <div className="above-me-weather-grid"><div><span>Cloud</span><strong>{weather.cloudCoverPct === null ? '—' : `${Math.round(weather.cloudCoverPct)}%`}</strong></div><div><span>Wind</span><strong>{weather.windSpeedKmh === null ? '—' : `${Math.round(weather.windSpeedKmh)} km/h ${cardinalWind(weather.windDirectionDeg)}`}</strong></div><div><span>Rain</span><strong>{weather.precipitationMm === null ? '—' : `${weather.precipitationMm.toFixed(1)} mm`}</strong></div><div><span>Humidity</span><strong>{weather.relativeHumidityPct === null ? '—' : `${Math.round(weather.relativeHumidityPct)}%`}</strong></div></div>
      </> : weather ? <p className="above-me-muted">Current weather is not applied to replay/future time. Astronomy and satellite geometry continue to follow the simulation clock.</p> : <p className="above-me-muted">{props.weatherLoading ? 'Loading current local conditions…' : 'Weather unavailable.'}</p>}
      {props.weatherError && <p className="above-me-error">{props.weatherError}</p>}
      <div className="above-me-source-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo.com</a><button type="button" onClick={props.onRefreshWeather}>Refresh</button></div>
    </section>

    <section className="above-me-aurora">
      <div className="above-me-section-head"><div><span className="control-eyebrow">AURORA AT OBSERVER</span><strong>{props.auroraApplicable ? auroraContextLabel(props.auroraValue) : 'Model out of window'}</strong></div><span>{props.auroraApplicable && props.auroraValue !== null ? `${props.auroraValue.toFixed(0)}` : '—'}</span></div>
      <p>Nearest NOAA OVATION model-cell value. This is model intensity/probability context, not a guarantee of visible aurora at ground level. Local darkness and clouds still matter.</p>
    </section>
  </div>;
}

import type { TimeMode } from '../../core/time/temporal';
import type { AtmosphereProductStatus, AtmosphereStatus, WeatherLayerSettings } from './types';

function statusLabel(status: AtmosphereProductStatus): string {
  if (status.state === 'ready') return 'READY';
  if (status.state === 'loading') return 'LOADING';
  if (status.state === 'unavailable') return 'UNAVAILABLE';
  return 'IDLE';
}

function timestampLabel(timestamp: number | null): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

interface WeatherControlsProps {
  enabled: boolean;
  settings: WeatherLayerSettings;
  status: AtmosphereStatus;
  simulationTime: number;
  timeMode: TimeMode;
  onSettingsChange(settings: WeatherLayerSettings): void;
  onRefresh(): void;
}

export function WeatherControls(props: WeatherControlsProps) {
  if (!props.enabled) return null;

  const set = (patch: Partial<WeatherLayerSettings>) => props.onSettingsChange({ ...props.settings, ...patch });
  const future = props.simulationTime > Date.now() + 10 * 60_000;

  return <section className="weather-controls layer-controls" aria-label="Living Earth weather controls">
    <div className="layer-control-head">
      <div><span className="control-eyebrow">LIVING EARTH</span><strong>Atmosphere</strong></div>
      <button type="button" onClick={props.onRefresh}>Refresh</button>
    </div>

    <div className="weather-toggle-list">
      <label>
        <span><b>Cloud field</b><small>VIIRS cloud optical thickness</small></span>
        <input type="checkbox" checked={props.settings.clouds} onChange={(event) => set({ clouds: event.target.checked })} />
      </label>
      <label>
        <span><b>Precipitation</b><small>IMERG 30-minute rain/snow rate</small></span>
        <input type="checkbox" checked={props.settings.precipitation} onChange={(event) => set({ precipitation: event.target.checked })} />
      </label>
      <label>
        <span><b>Storm tracks</b><small>NASA EONET severe-storm observations</small></span>
        <input type="checkbox" checked={props.settings.stormTracks} onChange={(event) => set({ stormTracks: event.target.checked })} />
      </label>
    </div>

    <label className="weather-opacity">
      <span>Overlay strength <strong>{Math.round(props.settings.opacity * 100)}%</strong></span>
      <input
        type="range"
        min="0.25"
        max="1"
        step="0.05"
        value={props.settings.opacity}
        onChange={(event) => set({ opacity: Number(event.target.value) })}
      />
    </label>

    <div className="weather-status-grid">
      <div>
        <span>Clouds</span>
        <strong className={`weather-status weather-status--${props.status.clouds.state}`}>{statusLabel(props.status.clouds)}</strong>
        <small>{timestampLabel(props.status.clouds.loadedTime)}</small>
      </div>
      <div>
        <span>Precip.</span>
        <strong className={`weather-status weather-status--${props.status.precipitation.state}`}>{statusLabel(props.status.precipitation)}</strong>
        <small>{timestampLabel(props.status.precipitation.loadedTime)}</small>
      </div>
    </div>

    {future && <p className="weather-warning">Observed satellite/weather imagery is not projected into future simulation time. Storm geometry and other modeled layers may continue independently.</p>}
    {(props.status.clouds.error || props.status.precipitation.error) && <p className="weather-warning">{props.status.clouds.error ?? props.status.precipitation.error}</p>}

    <p className="weather-note">
      Near-real-time imagery can lag the simulation clock. Signal Earth shows the actual loaded observation time and falls back only to recent earlier imagery.
      {props.timeMode !== 'live' ? ' Replay requests imagery for the simulated timestamp.' : ''}
    </p>
    <a className="weather-attribution" href="https://worldview.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA EOSDIS Worldview / GIBS</a>
  </section>;
}

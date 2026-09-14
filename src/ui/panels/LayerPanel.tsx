import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import { EarthquakeControls } from '../../features/seismic/EarthquakeControls';
import type { EarthquakeTimeWindow } from '../../features/seismic/types';
import type { LayerId } from '../../shared/types/layers';
import type { SatelliteCategory } from '../../shared/types/orbit';
import { OrbitControls } from '../../features/orbit/OrbitControls';
import type { OrbitScaleMode } from '../../features/orbit/interaction';
import { NaturalEventControls } from '../../features/natural-events/NaturalEventControls';
import type { NaturalEventCategory } from '../../features/natural-events/types';
import { SpaceWeatherControls } from '../../features/space-weather/SpaceWeatherControls';
import type { AuroraHemispheres, SpaceWeatherFeed } from '../../features/space-weather/types';
import type { VisualMode } from '../../shared/types/layers';
import { WeatherControls } from '../../features/weather/WeatherControls';
import type { AtmosphereStatus, WeatherLayerSettings } from '../../features/weather/types';

const LAYERS: Array<{
  id: LayerId;
  label: string;
  description: string;
  glyph: string;
  phase: string;
}> = [
  { id: 'weather', label: 'Weather', description: 'NASA clouds, rain + storm tracks', glyph: '≋', phase: 'NRT' },
  { id: 'earthquakes', label: 'Earthquakes', description: 'USGS live seismic feed', glyph: '◎', phase: 'LIVE' },
  { id: 'events', label: 'Natural events', description: 'NASA EONET observed events', glyph: '△', phase: 'LIVE' },
  { id: 'orbit', label: 'Orbit', description: 'CelesTrak propagated satellites', glyph: '✦', phase: 'LIVE' },
  { id: 'aurora', label: 'Aurora', description: 'NOAA space weather + OVATION', glyph: '◌', phase: 'LIVE' },
];

interface LayerPanelProps {
  layers: Record<LayerId, boolean>;
  onToggle(layer: LayerId, enabled: boolean): void;
  compact?: boolean;
  weather: {
    settings: WeatherLayerSettings;
    status: AtmosphereStatus;
    simulationTime: number;
    timeMode: TimeMode;
    onSettingsChange(settings: WeatherLayerSettings): void;
    onRefresh(): void;
  };
  earthquake: {
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
  };
  naturalEvents: {
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
  };
  orbit: {
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
  };
  spaceWeather: {
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
  };

}

export function LayerPanel({ layers, onToggle, weather, earthquake, naturalEvents, orbit, spaceWeather, compact = false }: LayerPanelProps) {
  return (
    <div className={compact ? 'layer-list layer-list--compact' : 'layer-panel panel-surface'}>
      {!compact && (
        <header className="panel-header">
          <div>
            <div className="panel-eyebrow">SIGNALS</div>
            <h2>Layers</h2>
          </div>
          <span className="panel-count">{Object.values(layers).filter(Boolean).length}/5</span>
        </header>
      )}
      <div className="layer-list">
        {LAYERS.map((layer) => {
          const enabled = layers[layer.id];
          return (
            <button
              key={layer.id}
              type="button"
              className={`layer-row ${enabled ? 'is-enabled' : ''}`}
              onClick={() => onToggle(layer.id, !enabled)}
              aria-pressed={enabled}
            >
              <span className="layer-glyph" aria-hidden="true">{layer.glyph}</span>
              <span className="layer-copy">
                <strong>{layer.label}</strong>
                <small>{layer.description}</small>
              </span>
              <span className={`phase-chip ${layer.phase === 'LIVE' ? 'phase-chip--live' : ''}`} title="Implementation state">{layer.phase}</span>
              <span className="switch" aria-hidden="true"><span /></span>
            </button>
          );
        })}
      </div>

      <WeatherControls enabled={layers.weather} {...weather} />

      <EarthquakeControls
        enabled={layers.earthquakes}
        window={earthquake.window}
        magnitude={earthquake.magnitude}
        visibleCount={earthquake.visibleCount}
        totalCount={earthquake.totalCount}
        freshness={earthquake.freshness}
        sourceUpdatedAt={earthquake.sourceUpdatedAt}
        loading={earthquake.loading}
        error={earthquake.error}
        simulationTime={earthquake.simulationTime}
        timeMode={earthquake.timeMode}
        onWindowChange={earthquake.onWindowChange}
        onMagnitudeChange={earthquake.onMagnitudeChange}
        onRefresh={earthquake.onRefresh}
      />

      <NaturalEventControls enabled={layers.events} {...naturalEvents} />

      <OrbitControls enabled={layers.orbit} {...orbit} />

      <SpaceWeatherControls enabled={layers.aurora} {...spaceWeather} />

      {!compact && <p className="panel-note">NASA weather imagery and natural events are observed/near-real-time context. Earthquakes are observed data, orbit positions are propagated locally, and NOAA space-weather products preserve observed, estimated and forecast semantics separately.</p>}
    </div>
  );
}

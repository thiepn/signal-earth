import { useEffect, useMemo, useState } from 'react';
import type { Freshness } from '../../core/data/freshness';
import type { TimeMode } from '../../core/time/temporal';
import { EarthquakeControls } from '../../features/seismic/EarthquakeControls';
import type { EarthquakeTimeWindow } from '../../features/seismic/types';
import type { LayerId, VisualMode } from '../../shared/types/layers';
import type { SatelliteCategory } from '../../shared/types/orbit';
import { OrbitControls } from '../../features/orbit/OrbitControls';
import type { OrbitScaleMode } from '../../features/orbit/interaction';
import { NaturalEventControls } from '../../features/natural-events/NaturalEventControls';
import type { NaturalEventCategory } from '../../features/natural-events/types';
import { SpaceWeatherControls } from '../../features/space-weather/SpaceWeatherControls';
import type { AuroraHemispheres, SpaceWeatherFeed } from '../../features/space-weather/types';
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
  { id: 'earthquakes', label: 'Earthquakes', description: 'USGS observed seismic activity', glyph: '◎', phase: 'OBS' },
  { id: 'events', label: 'Natural events', description: 'NASA EONET event history', glyph: '△', phase: 'OBS' },
  { id: 'orbit', label: 'Orbit', description: 'CelesTrak propagated satellites', glyph: '✦', phase: 'PROP' },
  { id: 'aurora', label: 'Aurora', description: 'NOAA space weather + OVATION', glyph: '◌', phase: 'NRT' },
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
    temporalAvailable: boolean;
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
  const firstEnabled = useMemo(() => LAYERS.find((layer) => layers[layer.id])?.id ?? 'weather', [layers]);
  const [focusedLayer, setFocusedLayer] = useState<LayerId>(firstEnabled);

  useEffect(() => {
    if (!LAYERS.some((layer) => layer.id === focusedLayer)) setFocusedLayer(firstEnabled);
  }, [firstEnabled, focusedLayer]);

  const focused = LAYERS.find((layer) => layer.id === focusedLayer) ?? LAYERS[0]!;
  const focusedEnabled = layers[focusedLayer];

  return (
    <div className={compact ? 'layer-panel layer-panel--compact' : 'layer-panel panel-surface'}>
      {!compact && (
        <header className="panel-header layer-panel__header">
          <div>
            <div className="panel-eyebrow">SIGNALS</div>
            <h2>Explore layers</h2>
          </div>
          <span className="panel-count">{Object.values(layers).filter(Boolean).length}/5 ON</span>
        </header>
      )}

      <div className="layer-list layer-list--contextual" role="list" aria-label="Signal layers">
        {LAYERS.map((layer) => {
          const enabled = layers[layer.id];
          const focusedNow = focusedLayer === layer.id;
          return (
            <div key={layer.id} className={`layer-row ${enabled ? 'is-enabled' : ''}${focusedNow ? ' is-focused' : ''}`} role="listitem">
              <button
                type="button"
                className="layer-row__main"
                onClick={() => setFocusedLayer(layer.id)}
                aria-expanded={focusedNow}
                aria-controls={`layer-controls-${layer.id}`}
              >
                <span className="layer-glyph" aria-hidden="true">{layer.glyph}</span>
                <span className="layer-copy">
                  <strong>{layer.label}</strong>
                  <small>{layer.description}</small>
                </span>
                <span className={`phase-chip phase-chip--${layer.phase.toLowerCase()}`}>{layer.phase}</span>
              </button>
              <button
                type="button"
                className="layer-toggle"
                onClick={() => { setFocusedLayer(layer.id); onToggle(layer.id, !enabled); }}
                aria-label={`${enabled ? 'Hide' : 'Show'} ${layer.label}`}
                aria-pressed={enabled}
              >
                <span className="switch" aria-hidden="true"><span /></span>
              </button>
            </div>
          );
        })}
      </div>

      <div id={`layer-controls-${focusedLayer}`} className="layer-context-controls" aria-live="polite">
        <div className="layer-context-controls__head">
          <span className="panel-eyebrow">{focused.label.toUpperCase()}</span>
          <span>{focusedEnabled ? 'VISIBLE' : 'HIDDEN'}</span>
        </div>

        {!focusedEnabled && (
          <div className="layer-focus-empty">
            <span className="layer-focus-empty__glyph" aria-hidden="true">{focused.glyph}</span>
            <div><strong>{focused.label} is hidden</strong><p>Enable the layer to reveal its controls and signals on the globe.</p></div>
            <button className="secondary-button" type="button" onClick={() => onToggle(focused.id, true)}>Enable</button>
          </div>
        )}

        <WeatherControls enabled={focusedLayer === 'weather' && layers.weather} {...weather} />
        <EarthquakeControls enabled={focusedLayer === 'earthquakes' && layers.earthquakes} {...earthquake} />
        <NaturalEventControls enabled={focusedLayer === 'events' && layers.events} {...naturalEvents} />
        <OrbitControls enabled={focusedLayer === 'orbit' && layers.orbit} {...orbit} />
        <SpaceWeatherControls enabled={focusedLayer === 'aurora' && layers.aurora} {...spaceWeather} />
      </div>

      {!compact && <p className="panel-note">Select a layer for controls. Observed, near-real-time, propagated and forecast semantics remain distinct.</p>}
    </div>
  );
}

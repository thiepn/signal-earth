import type { VisualMode } from '../../shared/types/layers';
import { geoContextBand, selectGeoContextLabels, type GeoContextCountry, type GeoContextLabel } from '../../features/globe/geoContext';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';

interface GeoJsonFeature {
  properties?: { name?: unknown };
  geometry?: { type?: string; coordinates?: unknown };
}

export interface GeoContextRendererOptions {
  getVisualMode?: () => VisualMode;
  onNavigate?: (label: GeoContextLabel) => void;
}

function collectPoints(value: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    if (Number.isFinite(value[0]) && Number.isFinite(value[1])) out.push([value[0], value[1]]);
    return;
  }
  for (const item of value) collectPoints(item, out);
}

function representativePoint(feature: GeoJsonFeature): GeoContextCountry | null {
  const name = typeof feature.properties?.name === 'string' ? feature.properties.name.trim() : '';
  if (!name || !feature.geometry) return null;
  const points: Array<[number, number]> = [];
  collectPoints(feature.geometry.coordinates, points);
  if (!points.length) return null;

  let x = 0; let y = 0; let latSum = 0;
  for (const [lon, lat] of points) {
    const radians = lon * Math.PI / 180;
    x += Math.cos(radians);
    y += Math.sin(radians);
    latSum += lat;
  }
  return {
    name,
    lat: latSum / points.length,
    lon: Math.atan2(y / points.length, x / points.length) * 180 / Math.PI,
  };
}

function strokeForMode(mode: VisualMode, reduced: boolean): string {
  const alpha = reduced ? 0.08 : mode === 'wireframe' ? 0.34 : mode === 'signal' ? 0.22 : mode === 'night' ? 0.14 : 0.12;
  return `rgba(158,231,255,${alpha})`;
}

function labelColor(label: GeoContextLabel, mode: VisualMode): string {
  if (label.kind === 'city') return mode === 'night' ? 'rgba(205,236,255,.82)' : 'rgba(218,244,255,.78)';
  if (mode === 'wireframe') return 'rgba(158,231,255,.72)';
  if (mode === 'signal') return 'rgba(158,231,255,.62)';
  return 'rgba(184,205,219,.52)';
}

export class GeoContextRenderer implements SceneRenderer {
  readonly id = 'geo-context';

  readonly #getVisualMode: () => VisualMode;
  readonly #onNavigate: ((label: GeoContextLabel) => void) | undefined;
  #context: GlobeRenderContext | null = null;
  #features: GeoJsonFeature[] = [];
  #countries: GeoContextCountry[] = [];
  #abort: AbortController | null = null;
  #lastLabelKey = '';
  #lastUpdateAt = -Infinity;
  #reduced = false;

  constructor(options: GeoContextRendererOptions = {}) {
    this.#getVisualMode = options.getVisualMode ?? (() => 'earth');
    this.#onNavigate = options.onNavigate;
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    this.#reduced = context.getQuality().effects === 'reduced';
    const globe = context.globe;
    globe
      .labelLat((value) => (value as GeoContextLabel).lat)
      .labelLng((value) => (value as GeoContextLabel).lng)
      .labelText((value) => (value as GeoContextLabel).name)
      .labelSize((value) => (value as GeoContextLabel).size)
      .labelAltitude((value) => (value as GeoContextLabel).kind === 'city' ? 0.012 : 0.006)
      .labelIncludeDot((value) => (value as GeoContextLabel).kind === 'city')
      .labelDotRadius((value) => (value as GeoContextLabel).dotRadius)
      .labelDotOrientation('bottom')
      .labelColor((value) => labelColor(value as GeoContextLabel, this.#getVisualMode()))
      .labelLabel((value) => {
        const label = value as GeoContextLabel;
        return label.kind === 'city' ? `${label.name} · ${label.subtitle}` : label.name;
      })
      .labelResolution(this.#reduced ? 1 : 2)
      .labelsTransitionDuration(180)
      .onLabelClick((value, event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#onNavigate?.(value as GeoContextLabel);
      });
    this.#syncStyle();
    this.#loadCountries();
  }

  update(timestamp: number): void {
    if (!this.#context || timestamp - this.#lastUpdateAt < 300) return;
    this.#lastUpdateAt = timestamp;
    this.#syncLabels();
  }

  applyQuality(profile: QualityProfile): void {
    this.#reduced = profile.effects === 'reduced';
    if (!this.#context) return;
    this.#context.globe.labelResolution(this.#reduced ? 1 : 2);
    this.#syncStyle();
    this.#lastLabelKey = '';
    this.#syncLabels();
  }

  refreshVisualMode(): void {
    this.#syncStyle();
    if (this.#context) this.#context.globe.labelsData([...this.#context.globe.labelsData()]);
  }

  dispose(): void {
    this.#abort?.abort();
    this.#abort = null;
    if (this.#context) {
      this.#context.globe.labelsData([]).polygonsData([]);
    }
    this.#features = [];
    this.#countries = [];
    this.#context = null;
  }

  #loadCountries(): void {
    if (!this.#context) return;
    this.#abort?.abort();
    const controller = new AbortController();
    this.#abort = controller;
    const url = new URL('data/natural-earth-lowres.geojson', document.baseURI).toString();
    fetch(url, { cache: 'force-cache', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Natural Earth returned HTTP ${response.status}`);
        return response.json() as Promise<{ features?: GeoJsonFeature[] }>;
      })
      .then((payload) => {
        if (controller.signal.aborted || !this.#context) return;
        this.#features = Array.isArray(payload.features)
          ? payload.features.filter((feature) => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')
          : [];
        this.#countries = this.#features.map(representativePoint).filter((country): country is GeoContextCountry => country !== null);
        this.#context.globe.polygonsData(this.#features);
        this.#syncStyle();
        this.#lastLabelKey = '';
        this.#syncLabels();
      })
      .catch(() => {
        // Geographic context is presentation-only. Failure must never affect the observatory.
      });
  }

  #syncStyle(): void {
    if (!this.#context) return;
    const mode = this.#getVisualMode();
    this.#context.globe
      .polygonGeoJsonGeometry('geometry')
      .polygonAltitude(0.001)
      .polygonCapColor(() => 'rgba(0,0,0,0)')
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => strokeForMode(mode, this.#reduced))
      .polygonLabel(() => '')
      .polygonsTransitionDuration(0)
      .labelColor((value) => labelColor(value as GeoContextLabel, mode));
  }

  #syncLabels(): void {
    if (!this.#context || !this.#countries.length) return;
    const pointOfView = this.#context.globe.pointOfView();
    const band = geoContextBand(pointOfView.altitude);
    const key = `${band}:${Math.round(pointOfView.lat / 8)}:${Math.round(pointOfView.lng / 8)}:${this.#reduced ? 'r' : 'f'}`;
    if (key === this.#lastLabelKey) return;
    this.#lastLabelKey = key;
    let labels = selectGeoContextLabels(this.#countries, pointOfView);
    if (this.#reduced) labels = labels.filter((label) => label.kind === 'country').slice(0, 18);
    this.#context.globe.labelsData(labels);
  }
}

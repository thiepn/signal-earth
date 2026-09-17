import * as THREE from 'three';
import type { VisualMode } from '../../shared/types/layers';
import { geoContextBand, selectGeoContextLabels, type GeoContextCountry, type GeoContextLabel } from '../../features/globe/geoContext';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';
import { REGIONAL_GEOGRAPHY_MAX_ALTITUDE } from './geographyFidelity';

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

function collectRings(value: unknown, out: Array<Array<[number, number]>>): void {
  if (!Array.isArray(value) || value.length === 0) return;
  const first = value[0];
  if (Array.isArray(first) && first.length >= 2 && typeof first[0] === 'number' && typeof first[1] === 'number') {
    const ring: Array<[number, number]> = [];
    for (const point of value) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const lon = point[0];
      const lat = point[1];
      if (typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat)) ring.push([lon, lat]);
    }
    if (ring.length >= 2) out.push(ring);
    return;
  }
  for (const item of value) collectRings(item, out);
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

function strokeOpacity(mode: VisualMode, reduced: boolean): number {
  return reduced ? 0.08 : mode === 'wireframe' ? 0.34 : mode === 'signal' ? 0.22 : mode === 'night' ? 0.14 : 0.12;
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
  #countryLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  #countryLineGeometry: THREE.BufferGeometry | null = null;
  #countryLineMaterial: THREE.LineBasicMaterial | null = null;
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
      .labelsTransitionDuration(this.#reduced ? 0 : 180)
      .onLabelClick((value, event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#onNavigate?.(value as GeoContextLabel);
      })
      .polygonsData([]);
    this.#syncStyle();
    this.#loadCountries();
  }

  update(timestamp: number): void {
    if (!this.#context) return;
    // Detailed polygons own borders/coastlines at regional zoom. Keep the
    // lightweight low-res context mesh for overview only.
    if (this.#countryLines) {
      this.#countryLines.visible = this.#context.globe.pointOfView().altitude > REGIONAL_GEOGRAPHY_MAX_ALTITUDE;
    }
    if (timestamp - this.#lastUpdateAt < 500) return;
    this.#lastUpdateAt = timestamp;
    this.#syncLabels();
  }

  applyQuality(profile: QualityProfile): void {
    this.#reduced = profile.effects === 'reduced';
    if (!this.#context) return;
    this.#context.globe
      .labelResolution(this.#reduced ? 1 : 2)
      .labelsTransitionDuration(this.#reduced ? 0 : 180);
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
    if (this.#context) this.#context.globe.labelsData([]).polygonsData([]);
    this.#disposeCountryLines();
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
        this.#rebuildCountryLines();
        this.#syncStyle();
        this.#lastLabelKey = '';
        this.#syncLabels();
      })
      .catch(() => {
        // Geographic context is presentation-only. Failure must never affect the observatory.
      });
  }

  #rebuildCountryLines(): void {
    if (!this.#context) return;
    this.#disposeCountryLines();
    const positions: number[] = [];
    for (const feature of this.#features) {
      const rings: Array<Array<[number, number]>> = [];
      collectRings(feature.geometry?.coordinates, rings);
      for (const ring of rings) {
        for (let index = 1; index < ring.length; index += 1) {
          const [lonA, latA] = ring[index - 1]!;
          const [lonB, latB] = ring[index]!;
          const a = this.#context.globe.getCoords(latA, lonA, 0.0015);
          const b = this.#context.globe.getCoords(latB, lonB, 0.0015);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0x9ee7ff,
      transparent: true,
      opacity: strokeOpacity(this.#getVisualMode(), this.#reduced),
      depthWrite: false,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = 'signal-earth-country-boundaries';
    lines.renderOrder = 2;
    lines.visible = this.#context.globe.pointOfView().altitude > REGIONAL_GEOGRAPHY_MAX_ALTITUDE;
    this.#context.scene.add(lines);
    this.#countryLineGeometry = geometry;
    this.#countryLineMaterial = material;
    this.#countryLines = lines;
  }

  #disposeCountryLines(): void {
    if (this.#countryLines?.parent) this.#countryLines.parent.remove(this.#countryLines);
    this.#countryLineGeometry?.dispose();
    this.#countryLineMaterial?.dispose();
    this.#countryLines = null;
    this.#countryLineGeometry = null;
    this.#countryLineMaterial = null;
  }

  #syncStyle(): void {
    if (!this.#context) return;
    const mode = this.#getVisualMode();
    if (this.#countryLineMaterial) this.#countryLineMaterial.opacity = strokeOpacity(mode, this.#reduced);
    this.#context.globe.labelColor((value) => labelColor(value as GeoContextLabel, mode));
  }

  #syncLabels(): void {
    if (!this.#context || !this.#countries.length) return;
    const pointOfView = this.#context.globe.pointOfView();
    const band = geoContextBand(pointOfView.altitude);
    const key = `${band}:${Math.round(pointOfView.lat / 8)}:${Math.round(pointOfView.lng / 8)}:${this.#reduced ? 'r' : 'f'}`;
    if (key === this.#lastLabelKey) return;
    this.#lastLabelKey = key;
    let labels = selectGeoContextLabels(this.#countries, pointOfView);
    if (this.#reduced) labels = [];
    this.#context.globe.labelsData(labels);
  }
}

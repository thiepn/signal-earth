import * as THREE from 'three';
import type { VisualMode } from '../../shared/types/layers';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import { GEOGRAPHY_DETAIL_PATH, GEOGRAPHY_FALLBACK_PATH, LAND_CURVATURE_DEGREES } from './geographyFidelity';

interface GeographyFeature {
  type?: string;
  properties?: { name?: unknown };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

interface GeographyPayload {
  features?: GeographyFeature[];
}

interface IndexedFeature {
  feature: GeographyFeature;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  pointCount: number;
}

export interface GeographyRendererOptions {
  getVisualMode?: () => VisualMode;
}

interface GeographyStyle {
  ocean: number;
  land: number;
  landSide: number;
  emissive: number;
  specular: number;
  boundary: string;
}

const LOCAL_DETAIL_MAX_ALTITUDE = 0.9;
const LOD_UPDATE_MS = 220;

const STYLES: Record<VisualMode, GeographyStyle> = {
  earth: {
    ocean: 0x031a2d,
    land: 0x607f47,
    landSide: 0x4c6739,
    emissive: 0x000000,
    specular: 0x173044,
    boundary: 'rgba(176, 219, 228, 0.28)',
  },
  signal: {
    ocean: 0x02131c,
    land: 0x1d4247,
    landSide: 0x153239,
    emissive: 0x001015,
    specular: 0x1a5260,
    boundary: 'rgba(128, 234, 255, 0.34)',
  },
  night: {
    ocean: 0x000711,
    land: 0x0c1620,
    landSide: 0x071019,
    emissive: 0x01040b,
    specular: 0x101a30,
    boundary: 'rgba(132, 160, 207, 0.20)',
  },
  wireframe: {
    ocean: 0x020c11,
    land: 0x0d2930,
    landSide: 0x071b20,
    emissive: 0x001116,
    specular: 0x1d6877,
    boundary: 'rgba(128, 234, 255, 0.48)',
  },
};

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

function validPolygonFeatures(payload: GeographyPayload): GeographyFeature[] {
  if (!Array.isArray(payload.features)) return [];
  return payload.features.filter((feature) => {
    const type = feature.geometry?.type;
    return type === 'Polygon' || type === 'MultiPolygon';
  });
}

function visitCoordinates(value: unknown, visitor: (lon: number, lat: number) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    const lon = value[0];
    const lat = value[1];
    if (Number.isFinite(lon) && Number.isFinite(lat)) visitor(lon, lat);
    return;
  }
  for (const item of value) visitCoordinates(item, visitor);
}

function indexFeature(feature: GeographyFeature): IndexedFeature | null {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  let pointCount = 0;
  visitCoordinates(feature.geometry?.coordinates, (lon, lat) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    pointCount += 1;
  });
  if (!pointCount) return null;
  return { feature, minLat, maxLat, minLon, maxLon, pointCount };
}

function normalizeLongitude(value: number): number {
  let result = value;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

function longitudeIntersects(minLon: number, maxLon: number, centerLon: number, padding: number): boolean {
  if (maxLon - minLon >= 300 || padding >= 180) return true;
  const center = normalizeLongitude(centerLon);
  for (const shifted of [center - 360, center, center + 360]) {
    if (maxLon >= shifted - padding && minLon <= shifted + padding) return true;
  }
  return false;
}

function selectLocalFeatures(indexed: IndexedFeature[], lat: number, lon: number, altitude: number): GeographyFeature[] {
  // Wider windows near the LOD handoff keep the entire visible region covered;
  // close views intentionally triangulate only a small neighbourhood.
  const latPadding = Math.min(44, Math.max(16, 12 + altitude * 34));
  const latitudeScale = Math.max(0.35, Math.cos(lat * Math.PI / 180));
  const lonPadding = Math.min(95, (latPadding * 1.45) / latitudeScale);
  const minLat = Math.max(-90, lat - latPadding);
  const maxLat = Math.min(90, lat + latPadding);

  return indexed
    .filter((item) => item.maxLat >= minLat
      && item.minLat <= maxLat
      && longitudeIntersects(item.minLon, item.maxLon, lon, lonPadding))
    .map((item) => item.feature);
}

/**
 * Keeps overview rendering cheap while switching regional/local views to
 * bundled Natural Earth 1:50m vector geography. Performance tiers may reduce
 * framebuffer/effects cost, but they never simplify coastline source data.
 */
export class GeographyRenderer implements SceneRenderer {
  readonly id = 'geography-detail';

  readonly #getVisualMode: () => VisualMode;
  #context: GlobeRenderContext | null = null;
  #indexedFeatures: IndexedFeature[] = [];
  #visibleFeatures: GeographyFeature[] = [];
  #abort: AbortController | null = null;
  #currentMode: VisualMode | null = null;
  #oceanMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null = null;
  #oceanGeometry: THREE.SphereGeometry | null = null;
  #oceanMaterial: THREE.MeshPhongMaterial | null = null;
  #landMaterial: THREE.MeshPhongMaterial | null = null;
  #landSideMaterial: THREE.MeshPhongMaterial | null = null;
  #previousGlobeColorWrite: boolean | null = null;
  #detailActive = false;
  #visibleKey = '';
  #lastLodUpdateAt = -Infinity;

  constructor(options: GeographyRendererOptions = {}) {
    this.#getVisualMode = options.getVisualMode ?? (() => 'earth');
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    const globeMaterial = context.globe.globeMaterial();
    this.#previousGlobeColorWrite = globeMaterial.colorWrite;

    const style = STYLES[this.#getVisualMode()];
    const radius = context.globe.getGlobeRadius() * 1.00065;
    this.#oceanGeometry = new THREE.SphereGeometry(radius, 144, 92);
    this.#oceanMaterial = new THREE.MeshPhongMaterial({
      color: style.ocean,
      emissive: style.emissive,
      emissiveIntensity: 0.16,
      specular: style.specular,
      shininess: 5,
      depthWrite: true,
      depthTest: true,
      toneMapped: true,
    });
    this.#oceanMesh = new THREE.Mesh(this.#oceanGeometry, this.#oceanMaterial);
    this.#oceanMesh.name = 'signal-earth-vector-ocean';
    this.#oceanMesh.renderOrder = 0;
    this.#oceanMesh.visible = false;
    context.scene.add(this.#oceanMesh);

    this.#landMaterial = new THREE.MeshPhongMaterial({
      color: style.land,
      emissive: style.emissive,
      emissiveIntensity: 0.08,
      specular: style.specular,
      shininess: 3,
      depthWrite: true,
      depthTest: true,
      toneMapped: true,
    });
    this.#landSideMaterial = new THREE.MeshPhongMaterial({
      color: style.landSide,
      emissive: style.emissive,
      emissiveIntensity: 0.08,
      specular: 0x08141c,
      shininess: 2,
      depthWrite: true,
      depthTest: true,
      toneMapped: true,
    });

    context.globe
      .polygonGeoJsonGeometry('geometry')
      .polygonCapMaterial(this.#landMaterial)
      .polygonSideMaterial(this.#landSideMaterial)
      .polygonAltitude(0.00165)
      .polygonCapCurvatureResolution(LAND_CURVATURE_DEGREES)
      .polygonStrokeColor(() => style.boundary)
      .polygonLabel(() => '')
      .polygonsTransitionDuration(0)
      .polygonsData([]);

    context.renderer.domElement.dataset.geographyLod = 'overview';
    this.#syncStyle(true);
    void this.#loadGeography();
  }

  update(timestamp: number): void {
    this.#syncStyle();
    if (timestamp - this.#lastLodUpdateAt < LOD_UPDATE_MS) return;
    this.#lastLodUpdateAt = timestamp;
    this.#syncLod();
  }

  dispose(): void {
    this.#abort?.abort();
    this.#abort = null;

    if (this.#context) {
      this.#context.globe.polygonsData([]);
      const globeMaterial = this.#context.globe.globeMaterial();
      if (this.#previousGlobeColorWrite !== null) {
        globeMaterial.colorWrite = this.#previousGlobeColorWrite;
        globeMaterial.needsUpdate = true;
      }
      delete this.#context.renderer.domElement.dataset.geographyDetail;
      delete this.#context.renderer.domElement.dataset.geographyLod;
      delete this.#context.renderer.domElement.dataset.geographyPolygons;
    }

    if (this.#oceanMesh?.parent) this.#oceanMesh.parent.remove(this.#oceanMesh);
    this.#oceanGeometry?.dispose();
    this.#oceanMaterial?.dispose();
    this.#landMaterial?.dispose();
    this.#landSideMaterial?.dispose();

    this.#indexedFeatures = [];
    this.#visibleFeatures = [];
    this.#oceanMesh = null;
    this.#oceanGeometry = null;
    this.#oceanMaterial = null;
    this.#landMaterial = null;
    this.#landSideMaterial = null;
    this.#previousGlobeColorWrite = null;
    this.#context = null;
    this.#currentMode = null;
    this.#detailActive = false;
    this.#visibleKey = '';
  }

  async #loadGeography(): Promise<void> {
    if (!this.#context) return;
    this.#abort?.abort();
    const controller = new AbortController();
    this.#abort = controller;

    const sources = [
      { path: GEOGRAPHY_DETAIL_PATH, detail: '50m' },
      { path: GEOGRAPHY_FALLBACK_PATH, detail: 'fallback-lowres' },
    ] as const;

    for (const source of sources) {
      try {
        const response = await fetch(assetUrl(source.path), { cache: 'force-cache', signal: controller.signal });
        if (!response.ok) throw new Error(`Geography returned HTTP ${response.status}`);
        const payload = await response.json() as GeographyPayload;
        const indexed = validPolygonFeatures(payload)
          .map(indexFeature)
          .filter((item): item is IndexedFeature => item !== null);
        if (!indexed.length) throw new Error('Geography payload contains no polygon features.');
        if (controller.signal.aborted || !this.#context) return;
        this.#indexedFeatures = indexed;
        this.#context.renderer.domElement.dataset.geographyDetail = source.detail;
        this.#syncLod(true);
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (source === sources[sources.length - 1]) {
          console.warn('Signal Earth could not load vector geography.', error);
        }
      }
    }
  }

  #setDetailActive(active: boolean): void {
    if (!this.#context || !this.#oceanMesh || active === this.#detailActive) return;
    this.#detailActive = active;
    const globeMaterial = this.#context.globe.globeMaterial();
    globeMaterial.colorWrite = active ? false : (this.#previousGlobeColorWrite ?? true);
    globeMaterial.needsUpdate = true;
    this.#oceanMesh.visible = active;
    this.#context.renderer.domElement.dataset.geographyLod = active ? 'regional-50m' : 'overview';
    if (!active) {
      this.#visibleFeatures = [];
      this.#visibleKey = '';
      this.#context.globe.polygonsData([]);
      this.#context.renderer.domElement.dataset.geographyPolygons = '0';
    }
  }

  #syncLod(force = false): void {
    if (!this.#context || !this.#indexedFeatures.length) return;
    const pov = this.#context.globe.pointOfView();
    const shouldUseDetail = pov.altitude <= LOCAL_DETAIL_MAX_ALTITUDE;
    if (!shouldUseDetail) {
      this.#setDetailActive(false);
      return;
    }

    this.#setDetailActive(true);
    const visible = selectLocalFeatures(this.#indexedFeatures, pov.lat, pov.lng, pov.altitude);
    const key = visible
      .map((feature) => typeof feature.properties?.name === 'string' ? feature.properties.name : '')
      .join('|');
    if (!force && key === this.#visibleKey) return;
    this.#visibleKey = key;
    this.#visibleFeatures = visible;
    this.#context.globe.polygonsData(visible);
    this.#context.renderer.domElement.dataset.geographyPolygons = String(visible.length);
  }

  #syncStyle(force = false): void {
    if (!this.#context || !this.#oceanMaterial || !this.#landMaterial || !this.#landSideMaterial) return;
    const mode = this.#getVisualMode();
    if (!force && mode === this.#currentMode) return;
    this.#currentMode = mode;
    const style = STYLES[mode];

    this.#oceanMaterial.color.setHex(style.ocean);
    this.#oceanMaterial.emissive.setHex(style.emissive);
    this.#oceanMaterial.specular.setHex(style.specular);
    this.#oceanMaterial.needsUpdate = true;

    this.#landMaterial.color.setHex(style.land);
    this.#landMaterial.emissive.setHex(style.emissive);
    this.#landMaterial.specular.setHex(style.specular);
    this.#landMaterial.needsUpdate = true;

    this.#landSideMaterial.color.setHex(style.landSide);
    this.#landSideMaterial.emissive.setHex(style.emissive);
    this.#landSideMaterial.needsUpdate = true;

    this.#context.globe.polygonStrokeColor(() => style.boundary);
    if (this.#detailActive && this.#visibleFeatures.length) {
      this.#context.globe.polygonsData([...this.#visibleFeatures]);
    }
  }
}

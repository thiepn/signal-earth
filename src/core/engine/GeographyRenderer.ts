import * as THREE from 'three';
import type { VisualMode } from '../../shared/types/layers';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';

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

/**
 * Owns the visual land surface independently of framebuffer quality.
 *
 * Raster Earth textures are useful at whole-globe scale, but must never define
 * the coastline once the camera is close enough to expose individual texture
 * pixels. This renderer places an opaque, lit ocean shell over the legacy base
 * texture and uses bundled Natural Earth 1:50m vector polygons for land and
 * country/coast strokes. DPR/effects may still adapt for performance; geographic
 * shape does not.
 */
export class GeographyRenderer implements SceneRenderer {
  readonly id = 'geography-detail';

  readonly #getVisualMode: () => VisualMode;
  #context: GlobeRenderContext | null = null;
  #features: GeographyFeature[] = [];
  #abort: AbortController | null = null;
  #currentMode: VisualMode | null = null;
  #oceanMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null = null;
  #oceanGeometry: THREE.SphereGeometry | null = null;
  #oceanMaterial: THREE.MeshPhongMaterial | null = null;
  #landMaterial: THREE.MeshPhongMaterial | null = null;
  #landSideMaterial: THREE.MeshPhongMaterial | null = null;
  #previousGlobeColorWrite: boolean | null = null;

  constructor(options: GeographyRendererOptions = {}) {
    this.#getVisualMode = options.getVisualMode ?? (() => 'earth');
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;

    const globeMaterial = context.globe.globeMaterial();
    this.#previousGlobeColorWrite = globeMaterial.colorWrite;
    // Keep the base globe alive for depth/raycast/geographic interaction, but
    // stop its low-resolution baked coastline from reaching the framebuffer.
    globeMaterial.colorWrite = false;
    globeMaterial.needsUpdate = true;

    const style = STYLES[this.#getVisualMode()];
    const radius = context.globe.getGlobeRadius() * 1.00065;
    this.#oceanGeometry = new THREE.SphereGeometry(radius, 192, 120);
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
      .polygonCapCurvatureResolution(1)
      .polygonStrokeColor(() => style.boundary)
      .polygonLabel(() => '')
      .polygonsTransitionDuration(0)
      .polygonsData([]);

    this.#syncStyle(true);
    this.#loadGeography();
  }

  update(): void {
    this.#syncStyle();
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
    }

    if (this.#oceanMesh?.parent) this.#oceanMesh.parent.remove(this.#oceanMesh);
    this.#oceanGeometry?.dispose();
    this.#oceanMaterial?.dispose();
    this.#landMaterial?.dispose();
    this.#landSideMaterial?.dispose();

    this.#features = [];
    this.#oceanMesh = null;
    this.#oceanGeometry = null;
    this.#oceanMaterial = null;
    this.#landMaterial = null;
    this.#landSideMaterial = null;
    this.#previousGlobeColorWrite = null;
    this.#context = null;
    this.#currentMode = null;
  }

  async #loadGeography(): Promise<void> {
    if (!this.#context) return;
    this.#abort?.abort();
    const controller = new AbortController();
    this.#abort = controller;

    const sources = [
      { path: 'data/natural-earth-50m-countries.geojson', detail: '50m' },
      { path: 'data/natural-earth-lowres.geojson', detail: 'fallback-lowres' },
    ] as const;

    for (const source of sources) {
      try {
        const response = await fetch(assetUrl(source.path), { cache: 'force-cache', signal: controller.signal });
        if (!response.ok) throw new Error(`Geography returned HTTP ${response.status}`);
        const payload = await response.json() as GeographyPayload;
        const features = validPolygonFeatures(payload);
        if (!features.length) throw new Error('Geography payload contains no polygon features.');
        if (controller.signal.aborted || !this.#context) return;
        this.#features = features;
        this.#context.globe.polygonsData(features);
        this.#context.renderer.domElement.dataset.geographyDetail = source.detail;
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        if (source === sources[sources.length - 1]) {
          // Geographic detail is presentation-only; the observatory remains usable.
          console.warn('Signal Earth could not load vector geography.', error);
        }
      }
    }
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
    if (this.#features.length) this.#context.globe.polygonsData([...this.#features]);
  }
}

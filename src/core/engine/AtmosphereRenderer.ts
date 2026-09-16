import * as THREE from 'three';
import { solarCoordinates } from '../astronomy/solar';
import type { GlobeRenderContext } from './globe.types';
import type { QualityProfile, QualityLevel } from './QualityManager';
import type { SceneRenderer } from './GlobeEngine';
import type { NaturalEventRecord } from '../../features/natural-events/types';
import { buildGibsWmsUrl, gibsRequestCandidates, qualityToGibsResolution, type GibsProduct } from '../../features/weather/gibs';
import { DEFAULT_WEATHER_SETTINGS, EMPTY_ATMOSPHERE_STATUS, type AtmosphereProductStatus, type AtmosphereStatus, type WeatherLayerSettings } from '../../features/weather/types';

const FUTURE_TOLERANCE_MS = 10 * 60_000;

export interface AtmosphereRendererOptions {
  getSimulationTime?: () => number;
  onStatus?: (status: AtmosphereStatus) => void;
}

function cloneProduct(status: AtmosphereProductStatus): AtmosphereProductStatus {
  return { ...status };
}

export class AtmosphereRenderer implements SceneRenderer {
  readonly id = 'atmosphere';

  readonly #getSimulationTime: () => number;
  readonly #onStatus: ((status: AtmosphereStatus) => void) | undefined;

  #context: GlobeRenderContext | null = null;
  #enabled = false;
  #settings: WeatherLayerSettings = { ...DEFAULT_WEATHER_SETTINGS };
  #status: AtmosphereStatus = {
    clouds: cloneProduct(EMPTY_ATMOSPHERE_STATUS.clouds),
    precipitation: cloneProduct(EMPTY_ATMOSPHERE_STATUS.precipitation),
  };
  #stormEvents: NaturalEventRecord[] = [];
  #qualityLevel: QualityLevel = 'medium';

  #cloudMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  #cloudGeometry: THREE.SphereGeometry | null = null;
  #cloudMaterial: THREE.ShaderMaterial | null = null;
  #cloudTexture: THREE.Texture | null = null;

  #precipMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  #precipGeometry: THREE.SphereGeometry | null = null;
  #precipMaterial: THREE.MeshBasicMaterial | null = null;
  #precipTexture: THREE.Texture | null = null;

  #hazeMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  #hazeGeometry: THREE.SphereGeometry | null = null;
  #hazeMaterial: THREE.ShaderMaterial | null = null;

  #stormGroup = new THREE.Group();
  #stormLineMaterial = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.78, depthWrite: false });
  #stormHeadGeometry = new THREE.SphereGeometry(1, 10, 8);
  #stormHeadMaterial = new THREE.MeshBasicMaterial({ color: 0xffe2a4, transparent: true, opacity: 0.92, depthWrite: false });

  #lastCloudKey = '';
  #lastPrecipKey = '';
  #lastStormBucket = -1;
  #cloudRequest = 0;
  #precipRequest = 0;
  #lastUpdateAt = -Infinity;
  #lastSolarUpdateAt = -Infinity;

  constructor(options: AtmosphereRendererOptions = {}) {
    this.#getSimulationTime = options.getSimulationTime ?? Date.now;
    this.#onStatus = options.onStatus;
    this.#stormGroup.name = 'signal-earth-storm-tracks';
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    this.#qualityLevel = context.getQualityLevel();
    this.#createRasterMeshes(context.getQuality());
    this.#createHaze(context.getQuality());
    context.scene.add(this.#stormGroup);
    this.#emitStatus();
    this.#syncVisibility();
    this.#updateSolar(true);
    this.#refreshProducts(true);
    this.#updateStormTracks(true);
  }

  update(timestamp: number): void {
    if (!this.#context) return;
    if (timestamp - this.#lastSolarUpdateAt >= 1_000) this.#updateSolar();
    if (timestamp - this.#lastUpdateAt < 1_000) return;
    this.#lastUpdateAt = timestamp;
    this.#refreshProducts(false);
    this.#updateStormTracks(false);
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.#syncVisibility();
    if (enabled) {
      this.#refreshProducts(true);
      this.#updateStormTracks(true);
    }
  }

  setSettings(settings: WeatherLayerSettings): void {
    this.#settings = {
      clouds: Boolean(settings.clouds),
      precipitation: Boolean(settings.precipitation),
      stormTracks: Boolean(settings.stormTracks),
      opacity: Math.max(0.25, Math.min(1, Number.isFinite(settings.opacity) ? settings.opacity : DEFAULT_WEATHER_SETTINGS.opacity)),
    };
    if (this.#cloudMaterial) this.#cloudMaterial.uniforms['uOpacity']!.value = this.#settings.opacity;
    if (this.#precipMaterial) this.#precipMaterial.opacity = this.#settings.opacity * 0.9;
    this.#stormLineMaterial.opacity = 0.35 + this.#settings.opacity * 0.55;
    this.#stormHeadMaterial.opacity = 0.45 + this.#settings.opacity * 0.5;
    this.#syncVisibility();
    this.#refreshProducts(true);
    this.#updateStormTracks(true);
  }

  setStormEvents(events: NaturalEventRecord[]): void {
    this.#stormEvents = events.filter((event) => event.category === 'severe-storm');
    this.#lastStormBucket = -1;
    this.#updateStormTracks(true);
  }

  refresh(): void {
    this.#lastCloudKey = '';
    this.#lastPrecipKey = '';
    this.#lastStormBucket = -1;
    this.#refreshProducts(true);
    this.#updateStormTracks(true);
  }

  applyQuality(profile: QualityProfile): void {
    if (!this.#context) return;
    const nextLevel = this.#context.getQualityLevel();
    const resolutionChanged = nextLevel !== this.#qualityLevel;
    this.#qualityLevel = nextLevel;
    this.#createHaze(profile);
    if (resolutionChanged) {
      this.#lastCloudKey = '';
      this.#lastPrecipKey = '';
      this.#refreshProducts(true);
    }
  }

  dispose(): void {
    this.#cloudRequest += 1;
    this.#precipRequest += 1;
    if (this.#cloudMesh?.parent) this.#cloudMesh.parent.remove(this.#cloudMesh);
    if (this.#precipMesh?.parent) this.#precipMesh.parent.remove(this.#precipMesh);
    if (this.#hazeMesh?.parent) this.#hazeMesh.parent.remove(this.#hazeMesh);
    if (this.#stormGroup.parent) this.#stormGroup.parent.remove(this.#stormGroup);
    this.#clearStormGroup();
    this.#cloudGeometry?.dispose();
    this.#cloudMaterial?.dispose();
    this.#cloudTexture?.dispose();
    this.#precipGeometry?.dispose();
    this.#precipMaterial?.dispose();
    this.#precipTexture?.dispose();
    this.#hazeGeometry?.dispose();
    this.#hazeMaterial?.dispose();
    this.#stormLineMaterial.dispose();
    this.#stormHeadGeometry.dispose();
    this.#stormHeadMaterial.dispose();
    this.#context = null;
  }

  #createRasterMeshes(profile: QualityProfile): void {
    if (!this.#context) return;
    const radius = this.#context.globe.getGlobeRadius();
    const segments: [number, number] = profile.effects === 'enhanced' ? [128, 80] : profile.effects === 'normal' ? [80, 52] : [48, 32];

    const cloudGeometry = new THREE.SphereGeometry(radius * 1.006, segments[0], segments[1]);
    const cloudMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uMap: { value: null },
        uOpacity: { value: this.#settings.opacity },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform vec3 uSunDirection;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vec4 sampleColor = texture2D(uMap, vUv);
          float luminance = dot(sampleColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float coverage = sampleColor.a * smoothstep(0.015, 0.72, luminance + sampleColor.a * 0.08);
          if (coverage < 0.018) discard;
          float solar = dot(normalize(vWorldNormal), normalize(uSunDirection));
          float daylight = 0.30 + 0.70 * smoothstep(-0.22, 0.42, solar);
          vec3 cloud = mix(vec3(0.52, 0.66, 0.78), vec3(1.0, 1.0, 1.0), daylight);
          gl_FragColor = vec4(cloud, coverage * uOpacity * (0.48 + daylight * 0.52));
        }
      `,
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.name = 'signal-earth-cloud-field';
    cloudMesh.renderOrder = 4;

    const precipGeometry = new THREE.SphereGeometry(radius * 1.010, segments[0], segments[1]);
    const precipMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      opacity: this.#settings.opacity * 0.9,
      blending: THREE.NormalBlending,
    });
    const precipMesh = new THREE.Mesh(precipGeometry, precipMaterial);
    precipMesh.name = 'signal-earth-precipitation';
    precipMesh.renderOrder = 5;

    this.#context.scene.add(cloudMesh, precipMesh);
    this.#cloudGeometry = cloudGeometry;
    this.#cloudMaterial = cloudMaterial;
    this.#cloudMesh = cloudMesh;
    this.#precipGeometry = precipGeometry;
    this.#precipMaterial = precipMaterial;
    this.#precipMesh = precipMesh;
  }

  #createHaze(profile: QualityProfile): void {
    if (!this.#context) return;
    if (this.#hazeMesh?.parent) this.#hazeMesh.parent.remove(this.#hazeMesh);
    this.#hazeGeometry?.dispose();
    this.#hazeMaterial?.dispose();

    const radius = this.#context.globe.getGlobeRadius() * 1.028;
    const segments: [number, number] = profile.effects === 'enhanced' ? [96, 60] : profile.effects === 'normal' ? [64, 40] : [40, 28];
    const geometry = new THREE.SphereGeometry(radius, segments[0], segments[1]);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
        uStrength: { value: profile.effects === 'enhanced' ? 0.54 : profile.effects === 'normal' ? 0.42 : 0.28 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPosition = world.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        uniform float uStrength;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
          float solar = dot(normal, normalize(uSunDirection));
          float twilight = 0.45 + 0.55 * smoothstep(-0.35, 0.50, solar);
          vec3 dusk = vec3(0.20, 0.35, 0.82);
          vec3 day = vec3(0.22, 0.72, 1.0);
          vec3 color = mix(dusk, day, smoothstep(-0.05, 0.55, solar));
          float alpha = fresnel * twilight * uStrength;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'signal-earth-atmosphere-glow';
    mesh.renderOrder = 2;
    mesh.visible = profile.atmosphere !== 'basic';
    this.#context.scene.add(mesh);
    this.#hazeGeometry = geometry;
    this.#hazeMaterial = material;
    this.#hazeMesh = mesh;
  }

  #syncVisibility(): void {
    if (this.#cloudMesh) this.#cloudMesh.visible = this.#enabled && this.#settings.clouds && Boolean(this.#cloudTexture);
    if (this.#precipMesh) this.#precipMesh.visible = this.#enabled && this.#settings.precipitation && Boolean(this.#precipTexture);
    this.#stormGroup.visible = this.#enabled && this.#settings.stormTracks;
    if (this.#hazeMesh) this.#hazeMesh.visible = this.#qualityLevel !== 'low';
  }

  #updateSolar(force = false): void {
    if (!this.#context) return;
    const now = performance.now();
    if (!force && now - this.#lastSolarUpdateAt < 1_000) return;
    this.#lastSolarUpdateAt = now;
    const solar = solarCoordinates(this.#getSimulationTime());
    const point = this.#context.globe.getCoords(solar.lat, solar.lon, 12);
    const direction = new THREE.Vector3(point.x, point.y, point.z).normalize();
    if (this.#cloudMaterial) (this.#cloudMaterial.uniforms['uSunDirection']!.value as THREE.Vector3).copy(direction);
    if (this.#hazeMaterial) (this.#hazeMaterial.uniforms['uSunDirection']!.value as THREE.Vector3).copy(direction);
  }

  #refreshProducts(force: boolean): void {
    if (!this.#context || !this.#enabled) return;
    const time = this.#getSimulationTime();
    this.#requestProduct('clouds', time, force);
    this.#requestProduct('precipitation', time, force);
  }

  #requestProduct(product: GibsProduct, requestedTime: number, force: boolean): void {
    const wanted = product === 'clouds' ? this.#settings.clouds : this.#settings.precipitation;
    if (!wanted) return;

    const key = `${product}:${this.#qualityLevel}:${product === 'clouds' ? new Date(requestedTime).toISOString().slice(0, 10) : Math.floor(requestedTime / (30 * 60_000))}`;
    const lastKey = product === 'clouds' ? this.#lastCloudKey : this.#lastPrecipKey;
    if (!force && key === lastKey) return;
    if (product === 'clouds') this.#lastCloudKey = key;
    else this.#lastPrecipKey = key;

    if (requestedTime > Date.now() + FUTURE_TOLERANCE_MS) {
      this.#setProductStatus(product, {
        state: 'unavailable',
        requestedTime,
        loadedTime: null,
        error: 'Observed NASA imagery is unavailable for future simulation time.',
      });
      if (product === 'clouds' && this.#cloudMesh) this.#cloudMesh.visible = false;
      if (product === 'precipitation' && this.#precipMesh) this.#precipMesh.visible = false;
      return;
    }

    const requestId = product === 'clouds' ? ++this.#cloudRequest : ++this.#precipRequest;
    this.#setProductStatus(product, { state: 'loading', requestedTime, loadedTime: null, error: null });
    const resolution = qualityToGibsResolution(this.#qualityLevel);
    void this.#loadFirstAvailable(product, requestedTime, resolution.width, resolution.height, requestId);
  }

  async #loadFirstAvailable(product: GibsProduct, requestedTime: number, width: number, height: number, requestId: number): Promise<void> {
    let lastError = 'No recent NASA GIBS image was available.';
    for (const candidate of gibsRequestCandidates(product, requestedTime)) {
      try {
        const texture = await this.#loadTexture(buildGibsWmsUrl(product, candidate, width, height));
        const activeRequest = product === 'clouds' ? this.#cloudRequest : this.#precipRequest;
        if (requestId !== activeRequest || !this.#context) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.#context.renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        this.#applyTexture(product, texture);
        this.#setProductStatus(product, { state: 'ready', requestedTime, loadedTime: candidate, error: null });
        this.#syncVisibility();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const activeRequest = product === 'clouds' ? this.#cloudRequest : this.#precipRequest;
    if (requestId !== activeRequest) return;
    this.#setProductStatus(product, {
      state: 'unavailable',
      requestedTime,
      loadedTime: null,
      error: `NASA GIBS ${product === 'clouds' ? 'cloud' : 'precipitation'} imagery unavailable. ${lastError}`,
    });
  }

  #loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(url, resolve, undefined, () => reject(new Error('Image request failed or returned no raster data.')));
    });
  }

  #applyTexture(product: GibsProduct, texture: THREE.Texture): void {
    if (product === 'clouds') {
      this.#cloudTexture?.dispose();
      this.#cloudTexture = texture;
      if (this.#cloudMaterial) {
        this.#cloudMaterial.uniforms['uMap']!.value = texture;
        this.#cloudMaterial.needsUpdate = true;
      }
      return;
    }
    this.#precipTexture?.dispose();
    this.#precipTexture = texture;
    if (this.#precipMaterial) {
      this.#precipMaterial.map = texture;
      this.#precipMaterial.needsUpdate = true;
    }
  }

  #setProductStatus(product: GibsProduct, status: AtmosphereProductStatus): void {
    this.#status = product === 'clouds'
      ? { ...this.#status, clouds: status }
      : { ...this.#status, precipitation: status };
    this.#emitStatus();
  }

  #emitStatus(): void {
    this.#onStatus?.({
      clouds: cloneProduct(this.#status.clouds),
      precipitation: cloneProduct(this.#status.precipitation),
    });
  }

  #updateStormTracks(force: boolean): void {
    if (!this.#context || !this.#enabled || !this.#settings.stormTracks) return;
    const simulationTime = this.#getSimulationTime();
    const bucket = Math.floor(simulationTime / (10 * 60_000));
    if (!force && bucket === this.#lastStormBucket) return;
    this.#lastStormBucket = bucket;
    this.#clearStormGroup();

    const radius = this.#context.globe.getGlobeRadius();
    for (const event of this.#stormEvents) {
      if (event.startTime > simulationTime || (event.closedAt !== null && event.closedAt < simulationTime)) continue;
      const frames = event.geometry.filter((frame) => frame.timestamp <= simulationTime).slice(-32);
      if (frames.length === 0) continue;
      const points = frames.map((frame) => {
        const coords = this.#context!.globe.getCoords(frame.point.lat, frame.point.lon, 0.014);
        return new THREE.Vector3(coords.x, coords.y, coords.z);
      });

      if (points.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, this.#stormLineMaterial);
        line.renderOrder = 7;
        line.userData['signalEarthDisposableGeometry'] = true;
        this.#stormGroup.add(line);
      }

      const head = new THREE.Mesh(this.#stormHeadGeometry, this.#stormHeadMaterial);
      head.position.copy(points[points.length - 1]!);
      head.scale.setScalar(radius * 0.017);
      head.renderOrder = 8;
      this.#stormGroup.add(head);
    }
  }

  #clearStormGroup(): void {
    for (const child of [...this.#stormGroup.children]) {
      this.#stormGroup.remove(child);
      if (child.userData['signalEarthDisposableGeometry'] && 'geometry' in child) {
        const geometry = (child as THREE.Line).geometry;
        geometry.dispose();
      }
    }
  }
}

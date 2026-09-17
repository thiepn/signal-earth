import * as THREE from 'three';
import { greenwichMeanSiderealTimeRadians, solarCoordinates, type SolarCoordinates } from '../astronomy/solar';
import type { VisualMode } from '../../shared/types/layers';
import type { QualityProfile } from './QualityManager';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Globe.gl owns the default globe material and may replace/reconfigure its
 * texture-backed color fields while an image update is settling. WebKit can
 * expose that transient state as a null Color during a same-frame visual-mode
 * switch. Treat those fields as runtime-nullable even though Three's typings do
 * not, and restore a Color rather than letting a presentation change crash the
 * render loop.
 */
function setMaterialColor(
  material: THREE.MeshPhongMaterial,
  field: 'color' | 'emissive' | 'specular',
  value: THREE.ColorRepresentation,
): void {
  const current = material[field] as THREE.Color | null | undefined;
  if (current?.isColor) {
    current.set(value);
    return;
  }
  material[field] = new THREE.Color(value);
}

export interface EarthRendererOptions {
  getSimulationTime?: () => number;
  getVisualMode?: () => VisualMode;
}

interface EarthModeProfile {
  texture: 'day' | 'signal';
  ambient: number;
  sunlight: number;
  cityLights: number;
  atmosphereColor: string;
  background: string;
  graticules: boolean;
  wireframe: boolean;
  starOpacity: number;
  starColor: number;
}

const MODE_PROFILES: Record<VisualMode, EarthModeProfile> = {
  earth: {
    texture: 'day',
    ambient: 0.18,
    sunlight: 2.75,
    cityLights: 1.3,
    atmosphereColor: '#74bfff',
    background: '#01040a',
    graticules: false,
    wireframe: false,
    starOpacity: 0.68,
    starColor: 0xddefff,
  },
  signal: {
    texture: 'signal',
    ambient: 0.28,
    sunlight: 2.25,
    cityLights: 0.72,
    atmosphereColor: '#80eaff',
    background: '#01070c',
    graticules: true,
    wireframe: false,
    starOpacity: 0.62,
    starColor: 0xb8f3ff,
  },
  night: {
    texture: 'signal',
    ambient: 0.035,
    sunlight: 0.7,
    cityLights: 2.25,
    atmosphereColor: '#596dff',
    background: '#000106',
    graticules: false,
    wireframe: false,
    starOpacity: 0.9,
    starColor: 0xe8efff,
  },
  wireframe: {
    texture: 'signal',
    ambient: 0.08,
    sunlight: 1.0,
    cityLights: 0,
    atmosphereColor: '#5fe8ff',
    background: '#010609',
    graticules: true,
    wireframe: true,
    starOpacity: 0.46,
    starColor: 0x9eeeff,
  },
};

export class EarthRenderer implements SceneRenderer {
  readonly id = 'earth';

  readonly #getSimulationTime: () => number;
  readonly #getVisualMode: () => VisualMode;

  #context: GlobeRenderContext | null = null;
  #starfield: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  #starGeometry: THREE.BufferGeometry | null = null;
  #starMaterial: THREE.PointsMaterial | null = null;
  #currentTexture: QualityProfile['earthTexture'] | null = null;
  #currentStarCount = 0;
  #currentMode: VisualMode | null = null;
  #currentNightEffects: QualityProfile['effects'] | null = null;
  #ambientLight: THREE.AmbientLight | null = null;
  #sunLight: THREE.DirectionalLight | null = null;
  #nightMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  #nightGeometry: THREE.SphereGeometry | null = null;
  #nightMaterial: THREE.ShaderMaterial | null = null;
  #nightTexture: THREE.Texture | null = null;
  #nightTextureRequest = 0;
  #lastAstronomyUpdate = -Infinity;
  #astronomyIntervalMs = 80;
  #lastSolar: SolarCoordinates | null = null;

  constructor(options: EarthRendererOptions = {}) {
    this.#getSimulationTime = options.getSimulationTime ?? Date.now;
    this.#getVisualMode = options.getVisualMode ?? (() => 'earth');
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    const { globe } = context;

    globe
      .showGlobe(true)
      .showGraticules(false)
      .showAtmosphere(true)
      .atmosphereColor('#74bfff')
      .backgroundColor('#01040a');

    const ambient = new THREE.AmbientLight(0xa7c3d6, 0.18);
    const sun = new THREE.DirectionalLight(0xfff6dd, 2.75);
    this.#ambientLight = ambient;
    this.#sunLight = sun;
    globe.lights([ambient, sun]);

    const material = globe.globeMaterial();
    if (material instanceof THREE.MeshPhongMaterial) {
      material.shininess = 4;
      setMaterialColor(material, 'specular', 0x122d40);
      setMaterialColor(material, 'emissive', 0x000000);
    }

    this.#createNightOverlay(context.getQuality());
    this.applyQuality(context.getQuality());
    this.#applyMode(this.#getVisualMode(), true);
    this.#updateAstronomy(0, true);
  }

  update(timestamp: number): void {
    const mode = this.#getVisualMode();
    if (mode !== this.#currentMode) this.#applyMode(mode);
    this.#updateAstronomy(timestamp);
  }

  applyQuality(profile: QualityProfile): void {
    if (!this.#context) return;

    const textureChanged = this.#currentTexture !== profile.earthTexture;
    this.#currentTexture = profile.earthTexture;
    this.#astronomyIntervalMs = profile.effects === 'reduced' ? 1_000 : profile.effects === 'normal' ? 250 : 80;
    const curvature = profile.effects === 'reduced' ? 10 : profile.effects === 'normal' ? 6 : 4;
    this.#context.globe
      .globeCurvatureResolution(curvature)
      .showAtmosphere(profile.atmosphere !== 'basic');
    if (textureChanged || this.#currentMode === null) this.#applyBaseTexture();

    const atmosphereAltitude = profile.atmosphere === 'basic'
      ? 0.075
      : profile.atmosphere === 'normal'
        ? 0.11
        : 0.14;
    this.#context.globe.atmosphereAltitude(atmosphereAltitude);

    if (this.#currentStarCount !== profile.starCount) {
      this.#createStarfield(profile.starCount, profile.effects);
    }

    if (this.#currentNightEffects !== profile.effects) this.#createNightOverlay(profile);
    this.#syncNightVisibility();
    this.#loadNightTexture(profile.earthTexture);
  }

  dispose(): void {
    if (this.#context) this.#context.globe.lights([]);
    if (this.#starfield?.parent) this.#starfield.parent.remove(this.#starfield);
    if (this.#nightMesh?.parent) this.#nightMesh.parent.remove(this.#nightMesh);
    this.#starGeometry?.dispose();
    this.#starMaterial?.dispose();
    this.#nightGeometry?.dispose();
    this.#nightMaterial?.dispose();
    this.#nightTexture?.dispose();
    this.#starfield = null;
    this.#starGeometry = null;
    this.#starMaterial = null;
    this.#nightMesh = null;
    this.#nightGeometry = null;
    this.#nightMaterial = null;
    this.#nightTexture = null;
    this.#ambientLight = null;
    this.#sunLight = null;
    this.#currentTexture = null;
    this.#currentStarCount = 0;
    this.#currentMode = null;
    this.#currentNightEffects = null;
    this.#context = null;
  }

  #updateAstronomy(renderTimestamp: number, force = false): void {
    if (!this.#context || !this.#sunLight) return;
    if (!force && renderTimestamp - this.#lastAstronomyUpdate < this.#astronomyIntervalMs) return;
    this.#lastAstronomyUpdate = renderTimestamp;

    const simulationTime = this.#getSimulationTime();
    const solar = solarCoordinates(simulationTime);
    this.#lastSolar = solar;

    // Globe.gl remains Earth-fixed. We move the Sun over geographic longitude
    // instead of rotating the globe mesh, preserving all lat/lon data layers.
    const sunPoint = this.#context.globe.getCoords(solar.lat, solar.lon, 12);
    const sunDirection = new THREE.Vector3(sunPoint.x, sunPoint.y, sunPoint.z).normalize();
    const radius = this.#context.globe.getGlobeRadius();
    this.#sunLight.position.copy(sunDirection).multiplyScalar(radius * 14);
    this.#sunLight.target.position.set(0, 0, 0);

    if (this.#nightMaterial) {
      const uniform = this.#nightMaterial.uniforms['uSunDirection']!;
      (uniform.value as THREE.Vector3).copy(sunDirection);
    }

    // The starfield is an inertial-ish reference frame. Rotating it by GMST
    // makes high-speed simulation visibly communicate Earth's axial rotation.
    if (this.#starfield) {
      this.#starfield.rotation.y = -greenwichMeanSiderealTimeRadians(simulationTime);
    }
  }

  #applyMode(mode: VisualMode, force = false): void {
    if (!this.#context || (!force && mode === this.#currentMode)) return;
    this.#currentMode = mode;
    const profile = MODE_PROFILES[mode];
    const globe = this.#context.globe;

    globe
      .backgroundColor(profile.background)
      .atmosphereColor(profile.atmosphereColor)
      .showGraticules(profile.graticules)
      .showAtmosphere(this.#context.getQualityLevel() !== 'low');

    if (this.#ambientLight) this.#ambientLight.intensity = profile.ambient;
    if (this.#sunLight) this.#sunLight.intensity = profile.sunlight;
    if (this.#nightMaterial) this.#nightMaterial.uniforms['uIntensity']!.value = profile.cityLights;
    this.#syncNightVisibility();

    const material = globe.globeMaterial();
    if (material instanceof THREE.MeshPhongMaterial) {
      material.wireframe = profile.wireframe;
      setMaterialColor(material, 'color', mode === 'wireframe' ? 0x7feaff : 0xffffff);
      setMaterialColor(material, 'emissive', mode === 'night' ? 0x020713 : mode === 'wireframe' ? 0x00151b : 0x000000);
      material.emissiveIntensity = mode === 'night' ? 0.3 : mode === 'wireframe' ? 0.2 : 0;
      material.needsUpdate = true;
    }

    if (this.#starMaterial) {
      this.#starMaterial.opacity = profile.starOpacity;
      this.#starMaterial.color.setHex(profile.starColor);
      this.#starMaterial.needsUpdate = true;
    }

    this.#applyBaseTexture();
  }

  #applyBaseTexture(): void {
    if (!this.#context || !this.#currentTexture) return;
    const mode = this.#currentMode ?? this.#getVisualMode();
    const profile = MODE_PROFILES[mode];
    const resolution = this.#currentTexture;
    const filename = profile.texture === 'day'
      ? `earth/earth-day-${resolution}.webp`
      : `earth/earth-signal-${resolution}.webp`;
    this.#context.globe.globeImageUrl(assetUrl(filename));
  }

  #createNightOverlay(profile: QualityProfile): void {
    if (!this.#context) return;
    if (this.#nightMesh?.parent) this.#nightMesh.parent.remove(this.#nightMesh);
    this.#nightGeometry?.dispose();
    this.#nightMaterial?.dispose();

    const segments: [number, number] = profile.effects === 'enhanced' ? [128, 80] : profile.effects === 'normal' ? [80, 52] : [48, 32];
    const radius = this.#context.globe.getGlobeRadius() * 1.0025;
    const geometry = new THREE.SphereGeometry(radius, segments[0], segments[1]);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uLights: { value: this.#nightTexture },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
        uIntensity: { value: MODE_PROFILES[this.#currentMode ?? 'earth'].cityLights },
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
        uniform sampler2D uLights;
        uniform vec3 uSunDirection;
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float solar = dot(normalize(vWorldNormal), normalize(uSunDirection));
          float night = 1.0 - smoothstep(-0.14, 0.08, solar);
          vec4 lights = texture2D(uLights, vUv);
          float alpha = lights.a * night;
          if (alpha < 0.003 || uIntensity <= 0.0) discard;
          gl_FragColor = vec4(lights.rgb * uIntensity * night, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'signal-earth-night-lights';
    mesh.renderOrder = 3;
    this.#context.scene.add(mesh);
    this.#nightMesh = mesh;
    this.#nightGeometry = geometry;
    this.#nightMaterial = material;
    this.#currentNightEffects = profile.effects;
    this.#syncNightVisibility();
    this.#loadNightTexture(profile.earthTexture);
  }

  #syncNightVisibility(): void {
    if (!this.#nightMesh) return;
    const mode = this.#currentMode ?? this.#getVisualMode();
    const cityLights = MODE_PROFILES[mode].cityLights;
    this.#nightMesh.visible = cityLights > 0 && (this.#currentNightEffects !== 'reduced' || mode === 'night');
  }

  #loadNightTexture(resolution: QualityProfile['earthTexture']): void {
    if (!this.#nightMaterial) return;
    const request = ++this.#nightTextureRequest;
    const loader = new THREE.TextureLoader();
    loader.load(
      assetUrl(`earth/earth-city-lights-${resolution}.webp`),
      (texture) => {
        if (request !== this.#nightTextureRequest || !this.#nightMaterial) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.#context?.renderer.capabilities.getMaxAnisotropy() ?? 1);
        this.#nightTexture?.dispose();
        this.#nightTexture = texture;
        this.#nightMaterial.uniforms['uLights']!.value = texture;
        this.#nightMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // A missing decorative night-light texture must never break the globe.
      },
    );
  }

  #createStarfield(count: number, effects: QualityProfile['effects']): void {
    if (!this.#context) return;

    if (this.#starfield?.parent) this.#starfield.parent.remove(this.#starfield);
    this.#starGeometry?.dispose();
    this.#starMaterial?.dispose();

    const random = seededRandom(0x51a7e);
    const radius = this.#context.globe.getGlobeRadius() * 22;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const u = random();
      const v = random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const jitter = 0.82 + random() * 0.34;
      const r = radius * jitter;
      const offset = i * 3;
      positions[offset] = r * Math.sin(phi) * Math.cos(theta);
      positions[offset + 1] = r * Math.cos(phi);
      positions[offset + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    const mode = MODE_PROFILES[this.#currentMode ?? this.#getVisualMode()];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: mode.starColor,
      size: effects === 'enhanced' ? 1.15 : effects === 'normal' ? 0.95 : 0.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: mode.starOpacity,
      depthWrite: false,
      fog: false,
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'signal-earth-starfield';
    points.frustumCulled = false;
    points.renderOrder = -10;

    this.#context.scene.add(points);
    this.#starfield = points;
    this.#starGeometry = geometry;
    this.#starMaterial = material;
    this.#currentStarCount = count;
  }
}

import * as THREE from 'three';
import type { AuroraHemispheres, AuroraModel } from '../../features/space-weather/types';
import { isAuroraModelApplicable } from '../../features/space-weather/timeline';
import type { VisualMode } from '../../shared/types/layers';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';

export interface AuroraRendererOptions {
  getSimulationTime?: () => number;
  getVisualMode?: () => VisualMode;
}

interface AuroraField {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  hemisphere: 'north' | 'south';
}

const AURORA_ALTITUDE = 0.018;

function pointCap(profile: QualityProfile): number {
  if (profile.effects === 'reduced') return 3_500;
  if (profile.effects === 'normal') return 7_000;
  return 12_000;
}

function opacityForMode(mode: VisualMode): number {
  if (mode === 'night') return 0.98;
  if (mode === 'signal') return 0.82;
  if (mode === 'wireframe') return 0.76;
  return 0.58;
}

function sizeForQuality(profile: QualityProfile): number {
  if (profile.effects === 'reduced') return 1.35;
  if (profile.effects === 'normal') return 1.65;
  return 1.95;
}

export class AuroraRenderer implements SceneRenderer {
  readonly id = 'aurora';

  readonly #getSimulationTime: () => number;
  readonly #getVisualMode: () => VisualMode;
  #context: GlobeRenderContext | null = null;
  #model: AuroraModel | null = null;
  #quality: QualityProfile | null = null;
  #enabled = false;
  #simulationTime = Date.now();
  #visualMode: VisualMode = 'earth';
  #hemispheres: AuroraHemispheres = { north: true, south: true };
  #fields: AuroraField[] = [];

  constructor(options: AuroraRendererOptions = {}) {
    this.#getSimulationTime = options.getSimulationTime ?? Date.now;
    this.#getVisualMode = options.getVisualMode ?? (() => 'earth');
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    this.#quality = context.getQuality();
    this.#simulationTime = this.#getSimulationTime();
    this.#visualMode = this.#getVisualMode();
    this.#rebuild();
  }

  update(): void {
    const time = this.#getSimulationTime();
    if (Math.abs(time - this.#simulationTime) > 1_000) {
      this.#simulationTime = time;
      this.#syncVisibility();
    }
  }

  applyQuality(profile: QualityProfile): void { this.#quality = profile; this.#rebuild(); }
  setModel(model: AuroraModel | null): void { this.#model = model; this.#rebuild(); }
  setEnabled(enabled: boolean): void { this.#enabled = enabled; this.#syncVisibility(); }
  setSimulationTime(timestamp: number): void { if (Number.isFinite(timestamp)) { this.#simulationTime = timestamp; this.#syncVisibility(); } }
  setHemispheres(hemispheres: AuroraHemispheres): void { this.#hemispheres = { ...hemispheres }; this.#syncVisibility(); }
  setVisualMode(mode: VisualMode): void {
    this.#visualMode = mode;
    for (const field of this.#fields) field.points.material.opacity = opacityForMode(mode);
  }

  dispose(): void {
    this.#disposeFields();
    this.#context = null;
    this.#model = null;
  }

  #rebuild(): void {
    this.#disposeFields();
    if (!this.#context || !this.#quality || !this.#model) return;
    const cap = pointCap(this.#quality);
    const north: Array<{ lon: number; lat: number; value: number }> = [];
    const south: Array<{ lon: number; lat: number; value: number }> = [];
    const data = this.#model.coordinates;
    for (let i = 0; i + 2 < data.length; i += 3) {
      const lon = data[i]!; const lat = data[i + 1]!; const value = data[i + 2]!;
      if (Math.abs(lat) < 45 || value < 1) continue;
      (lat >= 0 ? north : south).push({ lon, lat, value });
    }
    this.#buildField('north', north, cap);
    this.#buildField('south', south, cap);
    this.#syncVisibility();
  }

  #buildField(hemisphere: 'north' | 'south', rows: Array<{ lon: number; lat: number; value: number }>, cap: number): void {
    if (!this.#context || !this.#quality || rows.length === 0) return;
    const stride = Math.max(1, Math.ceil(rows.length / cap));
    const selected = rows.filter((_row, index) => index % stride === 0).slice(0, cap);
    const positions = new Float32Array(selected.length * 3);
    const colors = new Float32Array(selected.length * 3);
    const low = new THREE.Color('#2edc91');
    const mid = new THREE.Color('#65ffbd');
    const high = new THREE.Color('#d8fff3');
    const color = new THREE.Color();
    selected.forEach((row, index) => {
      const coords = this.#context!.globe.getCoords(row.lat, row.lon, AURORA_ALTITUDE + Math.min(0.01, row.value / 10_000));
      positions[index * 3] = coords.x; positions[index * 3 + 1] = coords.y; positions[index * 3 + 2] = coords.z;
      const t = THREE.MathUtils.clamp(row.value / 35, 0, 1);
      if (t < 0.6) color.lerpColors(low, mid, t / 0.6); else color.lerpColors(mid, high, (t - 0.6) / 0.4);
      colors[index * 3] = color.r; colors[index * 3 + 1] = color.g; colors[index * 3 + 2] = color.b;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: sizeForQuality(this.#quality), sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: opacityForMode(this.#visualMode), depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `signal-earth-aurora-${hemisphere}`;
    points.frustumCulled = false;
    points.renderOrder = 5;
    this.#context.scene.add(points);
    this.#fields.push({ points, hemisphere });
  }

  #syncVisibility(): void {
    const valid = this.#enabled && isAuroraModelApplicable(this.#model, this.#simulationTime);
    for (const field of this.#fields) field.points.visible = valid && this.#hemispheres[field.hemisphere];
  }

  #disposeFields(): void {
    for (const field of this.#fields) {
      if (field.points.parent) field.points.parent.remove(field.points);
      field.points.geometry.dispose(); field.points.material.dispose();
    }
    this.#fields = [];
  }
}

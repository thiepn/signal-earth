import * as THREE from 'three';
import type { EarthquakeRecord } from '../../features/seismic/types';
import type { EntityId } from '../../shared/types/entities';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';

export interface SeismicRendererOptions {
  onSelect?: (earthquake: EarthquakeRecord) => void;
  onHover?: (earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => void;
  getSimulationTime?: () => number;
}

interface PulseObject {
  earthquake: EarthquakeRecord;
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  offset: number;
}

const SURFACE_ALTITUDE = 0.006;
const MAX_PULSES = 14;
const UP = new THREE.Vector3(0, 0, 1);

function magnitudeColor(magnitude: number): THREE.Color {
  if (magnitude >= 6) return new THREE.Color('#ff3d6e');
  if (magnitude >= 5) return new THREE.Color('#ff7048');
  if (magnitude >= 4) return new THREE.Color('#ffad45');
  if (magnitude >= 3) return new THREE.Color('#f6d66f');
  return new THREE.Color('#72d8ff');
}

function markerScale(magnitude: number): number {
  return THREE.MathUtils.clamp(0.5 + Math.max(0, magnitude - 1.5) * 0.24, 0.42, 1.9);
}

function renderCap(profile: QualityProfile): number {
  if (profile.effects === 'reduced') return 1_800;
  if (profile.effects === 'normal') return 4_000;
  return 7_500;
}

function eventPriority(event: EarthquakeRecord): number {
  return event.magnitude * 1_000_000 + event.significance * 100 + Math.floor(event.time / 60_000);
}

export class SeismicRenderer implements SceneRenderer {
  readonly id = 'seismic';

  readonly #onSelect: ((earthquake: EarthquakeRecord) => void) | undefined;
  readonly #onHover: SeismicRendererOptions['onHover'] | undefined;
  readonly #getSimulationTime: () => number;
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #dummy = new THREE.Object3D();
  readonly #normal = new THREE.Vector3();

  #context: GlobeRenderContext | null = null;
  #earthquakes: EarthquakeRecord[] = [];
  #rendered: EarthquakeRecord[] = [];
  #mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  #geometry: THREE.SphereGeometry | null = null;
  #material: THREE.MeshBasicMaterial | null = null;
  #pulses: PulseObject[] = [];
  #enabled = true;
  #selectedId: EntityId | null = null;
  #quality: QualityProfile | null = null;
  #hoveredInstance: number | null = null;
  #simulationTime = Date.now();
  #pulseKey = '';
  #reducedMotion = false;

  constructor(options: SeismicRendererOptions = {}) {
    this.#onSelect = options.onSelect;
    this.#onHover = options.onHover;
    this.#getSimulationTime = options.getSimulationTime ?? Date.now;
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    this.#quality = context.getQuality();
    this.#simulationTime = this.#getSimulationTime();
    context.renderer.domElement.addEventListener('click', this.#onClick, true);
    context.renderer.domElement.addEventListener('pointermove', this.#onPointerMove, { passive: true });
    this.#rebuild();
  }

  update(timestamp: number): void {
    if (!this.#enabled || this.#reducedMotion) return;
    for (const pulse of this.#pulses) {
      const phase = ((timestamp / 1_800) + pulse.offset) % 1;
      const base = 1.0 + Math.max(0, pulse.earthquake.magnitude - 3.5) * 0.16;
      pulse.mesh.scale.setScalar(base * (0.75 + phase * 3.2));
      pulse.mesh.material.opacity = (1 - phase) * 0.42;
    }
  }

  applyQuality(profile: QualityProfile): void {
    this.#quality = profile;
    this.#rebuild();
  }

  setReducedMotion(value: boolean): void {
    if (this.#reducedMotion === value) return;
    this.#reducedMotion = value;
    this.#syncPulses(true);
    if (value) {
      for (const pulse of this.#pulses) {
        const base = 1.0 + Math.max(0, pulse.earthquake.magnitude - 3.5) * 0.16;
        pulse.mesh.scale.setScalar(base * 1.2);
        pulse.mesh.material.opacity = 0.22;
      }
    }
  }

  setEarthquakes(earthquakes: EarthquakeRecord[]): void {
    this.#earthquakes = earthquakes;
    this.#rebuild();
  }

  setSimulationTime(timestamp: number): void {
    if (!Number.isFinite(timestamp)) return;
    this.#simulationTime = timestamp;
    this.#updateInstanceMatrices();
    this.#syncPulses();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#mesh) this.#mesh.visible = enabled;
    for (const pulse of this.#pulses) pulse.mesh.visible = enabled;
    if (!enabled) {
      this.#hoveredInstance = null;
      this.#onHover?.(null);
      if (this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';
    }
  }

  setSelected(id: EntityId | null): void {
    if (this.#selectedId === id) return;
    this.#selectedId = id;
    this.#updateInstanceMatrices();
  }

  dispose(): void {
    if (this.#context) {
      this.#context.renderer.domElement.removeEventListener('click', this.#onClick, true);
      this.#context.renderer.domElement.removeEventListener('pointermove', this.#onPointerMove);
      if (this.#context.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';
    }
    this.#onHover?.(null);
    this.#disposeMesh();
    this.#disposePulses();
    this.#context = null;
    this.#quality = null;
    this.#earthquakes = [];
    this.#rendered = [];
  }

  #rebuild(): void {
    if (!this.#context || !this.#quality) return;
    this.#disposeMesh();
    this.#disposePulses();

    const cap = renderCap(this.#quality);
    this.#rendered = this.#earthquakes.length <= cap
      ? [...this.#earthquakes]
      : [...this.#earthquakes].sort((a, b) => eventPriority(b) - eventPriority(a)).slice(0, cap);

    if (this.#rendered.length === 0) return;

    const geometry = new THREE.SphereGeometry(1, this.#quality.effects === 'reduced' ? 6 : 8, 6);
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, this.#rendered.length);
    mesh.name = 'signal-earth-seismic-markers';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    mesh.visible = this.#enabled;

    this.#context.scene.add(mesh);
    this.#geometry = geometry;
    this.#material = material;
    this.#mesh = mesh;
    this.#simulationTime = this.#getSimulationTime();
    this.#updateInstanceMatrices();
    this.#syncPulses(true);
  }

  #updateInstanceMatrices(): void {
    if (!this.#mesh || !this.#context) return;
    const globe = this.#context.globe;

    for (let index = 0; index < this.#rendered.length; index += 1) {
      const earthquake = this.#rendered[index]!;
      const point = globe.getCoords(earthquake.coordinates.lat, earthquake.coordinates.lon, SURFACE_ALTITUDE);
      const selected = earthquake.id === this.#selectedId;
      const occurred = earthquake.time <= this.#simulationTime;
      const scale = occurred ? markerScale(earthquake.magnitude) * (selected ? 1.65 : 1) : 0.000001;

      this.#dummy.position.set(point.x, point.y, point.z);
      this.#dummy.scale.setScalar(scale);
      this.#dummy.rotation.set(0, 0, 0);
      this.#dummy.updateMatrix();
      this.#mesh.setMatrixAt(index, this.#dummy.matrix);
      this.#mesh.setColorAt(index, selected ? new THREE.Color('#ffffff') : magnitudeColor(earthquake.magnitude));
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    if (this.#mesh.instanceColor) this.#mesh.instanceColor.needsUpdate = true;
  }

  #pulseCandidates(): EarthquakeRecord[] {
    const now = this.#simulationTime;
    return this.#rendered
      .filter((quake) => {
        const age = now - quake.time;
        return age >= 0 && (quake.magnitude >= 4.5 || age < 60 * 60_000);
      })
      .sort((a, b) => b.magnitude - a.magnitude || b.time - a.time)
      .slice(0, MAX_PULSES);
  }

  #syncPulses(force = false): void {
    if (!this.#context || !this.#quality || this.#quality.effects === 'reduced' || this.#reducedMotion) {
      if (this.#pulses.length) this.#disposePulses();
      this.#pulseKey = '';
      return;
    }

    const candidates = this.#pulseCandidates();
    const key = candidates.map((earthquake) => earthquake.id).join('|');
    if (!force && key === this.#pulseKey) return;

    this.#disposePulses();
    this.#pulseKey = key;
    this.#createPulses(candidates);
  }

  #createPulses(candidates: EarthquakeRecord[]): void {
    if (!this.#context || !this.#quality || this.#quality.effects === 'reduced' || this.#reducedMotion) return;

    for (let index = 0; index < candidates.length; index += 1) {
      const earthquake = candidates[index]!;
      const geometry = new THREE.RingGeometry(0.62, 0.78, 36);
      const material = new THREE.MeshBasicMaterial({
        color: magnitudeColor(earthquake.magnitude),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const point = this.#context.globe.getCoords(earthquake.coordinates.lat, earthquake.coordinates.lon, SURFACE_ALTITUDE + 0.001);
      mesh.position.set(point.x, point.y, point.z);
      this.#normal.copy(mesh.position).normalize();
      mesh.quaternion.setFromUnitVectors(UP, this.#normal);
      mesh.renderOrder = 4;
      mesh.visible = this.#enabled;
      this.#context.scene.add(mesh);
      this.#pulses.push({ earthquake, mesh, offset: (index * 0.173) % 1 });
    }
  }

  #disposeMesh(): void {
    if (this.#mesh?.parent) this.#mesh.parent.remove(this.#mesh);
    this.#geometry?.dispose();
    this.#material?.dispose();
    this.#mesh = null;
    this.#geometry = null;
    this.#material = null;
  }

  #disposePulses(): void {
    for (const pulse of this.#pulses) {
      if (pulse.mesh.parent) pulse.mesh.parent.remove(pulse.mesh);
      pulse.mesh.geometry.dispose();
      pulse.mesh.material.dispose();
    }
    this.#pulses = [];
    this.#pulseKey = '';
  }

  #raycast(event: MouseEvent | PointerEvent): number | null {
    if (!this.#enabled || !this.#mesh || !this.#context?.perspectiveCamera) return null;
    const rect = this.#context.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.#pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.#pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.#raycaster.setFromCamera(this.#pointer, this.#context.perspectiveCamera);
    const hit = this.#raycaster.intersectObject(this.#mesh, false)[0];
    return hit?.instanceId ?? null;
  }

  #onClick = (event: MouseEvent): void => {
    const instanceId = this.#raycast(event);
    if (instanceId === null) return;
    const earthquake = this.#rendered[instanceId];
    if (!earthquake) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.#onHover?.(null);
    this.#onSelect?.(earthquake);
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (!this.#context) return;
    const instanceId = this.#raycast(event);
    if (instanceId === this.#hoveredInstance) return;
    this.#hoveredInstance = instanceId;
    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';
    const earthquake = instanceId === null ? null : this.#rendered[instanceId] ?? null;
    if (earthquake) this.#onHover?.(earthquake, { x: event.clientX, y: event.clientY });
    else this.#onHover?.(null);
  };
}

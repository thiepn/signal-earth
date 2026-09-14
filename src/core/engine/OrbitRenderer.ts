import * as THREE from 'three';
import type { OrbitFrame, OrbitPredictionWindow } from '../../features/orbit/OrbitWorkerClient';
import { displayAltitudeKm, type OrbitScaleMode, type OrbitTrack } from '../../features/orbit/interaction';
import type { SatelliteRecord, SatelliteTelemetry } from '../../features/orbit/types';
import { altitudeKmToGlobeRadiusUnits, normalizeLongitude } from '../../shared/coordinates/geo';
import type { EntityId } from '../../shared/types/entities';
import type { SatelliteCategory } from '../../shared/types/orbit';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';

export interface OrbitRendererOptions {
  onSelect?: (satellite: SatelliteRecord, telemetry: SatelliteTelemetry) => void;
  onHover?: (satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => void;
  onSelectedTelemetry?: (telemetry: SatelliteTelemetry | null) => void;
  getSimulationTime?: () => number;
}

const CATEGORY_COLORS: Record<SatelliteCategory, string> = {
  stations: '#ffffff',
  weather: '#59d8ff',
  'earth-observation': '#62f0b2',
  navigation: '#ffd66d',
  science: '#c59cff',
  communications: '#ff9d73',
};
const CATEGORY_COLOR_OBJECTS = Object.fromEntries(Object.entries(CATEGORY_COLORS).map(([category, color]) => [category, new THREE.Color(color)])) as Record<SatelliteCategory, THREE.Color>;
const SELECTED_COLOR = new THREE.Color('#ffffff');
const GROUND_TRACK_ALTITUDE = 0.0022;

function sameIndices(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function markerScale(altitudeKm: number, selected: boolean): number {
  const altitudeFactor = THREE.MathUtils.clamp(Math.log10(Math.max(10, altitudeKm)) * 0.16, 0.28, 0.78);
  return (0.72 + altitudeFactor) * (selected ? 1.85 : 1);
}

function shortestLongitudeLerp(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return normalizeLongitude(a + delta * t);
}

function stratifiedIndices(candidates: number[], cap: number): number[] {
  if (candidates.length <= cap) return candidates;
  const result: number[] = [];
  const stride = candidates.length / cap;
  for (let slot = 0; slot < cap; slot += 1) {
    const index = Math.min(candidates.length - 1, Math.floor(slot * stride));
    result.push(candidates[index]!);
  }
  return result;
}

type OrbitalState = [lat: number, lon: number, altitudeKm: number, speedKmS: number];

export class OrbitRenderer implements SceneRenderer {
  readonly id = 'orbit';

  readonly #onSelect: OrbitRendererOptions['onSelect'] | undefined;
  readonly #onHover: OrbitRendererOptions['onHover'] | undefined;
  readonly #onSelectedTelemetry: OrbitRendererOptions['onSelectedTelemetry'] | undefined;
  readonly #getSimulationTime: () => number;
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #dummy = new THREE.Object3D();
  readonly #selectedWorld = new THREE.Vector3();

  #context: GlobeRenderContext | null = null;
  #catalog: SatelliteRecord[] = [];
  #activeCategories = new Set<SatelliteCategory>();
  #frame: OrbitFrame | null = null;
  #window: OrbitPredictionWindow | null = null;
  #track: OrbitTrack | null = null;
  #trail: OrbitTrack | null = null;
  #mesh: THREE.InstancedMesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial> | null = null;
  #geometry: THREE.OctahedronGeometry | null = null;
  #material: THREE.MeshBasicMaterial | null = null;
  #halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  #haloGeometry: THREE.RingGeometry | null = null;
  #haloMaterial: THREE.MeshBasicMaterial | null = null;
  #orbitLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  #groundAscendingLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  #groundDescendingLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineDashedMaterial> | null = null;
  #trailLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  #renderedIndices: number[] = [];
  #slotByCatalogIndex = new Map<number, number>();
  #enabled = false;
  #selectedId: EntityId | null = null;
  #quality: QualityProfile | null = null;
  #hoveredInstance: number | null = null;
  #selectedWorldValid = false;
  #scaleMode: OrbitScaleMode = 'true';
  #showOrbitPath = true;
  #showGroundTrack = true;
  #suspendedForSeek = false;

  constructor(options: OrbitRendererOptions = {}) {
    this.#onSelect = options.onSelect;
    this.#onHover = options.onHover;
    this.#onSelectedTelemetry = options.onSelectedTelemetry;
    this.#getSimulationTime = options.getSimulationTime ?? Date.now;
  }

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    this.#quality = context.getQuality();
    context.renderer.domElement.addEventListener('click', this.#onClick, true);
    context.renderer.domElement.addEventListener('pointermove', this.#onPointerMove, { passive: true });
    this.#createHalo();
    this.#rebuildFromData();
  }

  update(): void {
    if (!this.#enabled || !this.#mesh || !this.#context || this.#suspendedForSeek) {
      if (this.#halo) this.#halo.visible = false;
      this.#selectedWorldValid = false;
      if (this.#mesh && this.#suspendedForSeek) this.#hideAllInstances();
      return;
    }

    const simulationTime = this.#getSimulationTime();
    this.#selectedWorldValid = false;
    for (let instance = 0; instance < this.#renderedIndices.length; instance += 1) {
      const catalogIndex = this.#renderedIndices[instance]!;
      const satellite = this.#catalog[catalogIndex];
      if (!satellite) continue;
      const state = this.#stateForCatalogIndex(catalogIndex, simulationTime);
      if (!state) {
        this.#dummy.position.set(0, 0, 0);
        this.#dummy.scale.setScalar(0.000001);
      } else {
        const [lat, lon, altitudeKm] = state;
        const renderedAltitudeKm = displayAltitudeKm(altitudeKm, this.#scaleMode);
        const point = this.#context.globe.getCoords(lat, lon, altitudeKmToGlobeRadiusUnits(renderedAltitudeKm));
        this.#dummy.position.set(point.x, point.y, point.z);
        this.#dummy.scale.setScalar(markerScale(altitudeKm, satellite.id === this.#selectedId));
        if (satellite.id === this.#selectedId) {
          this.#selectedWorld.set(point.x, point.y, point.z);
          this.#selectedWorldValid = true;
        }
      }
      this.#dummy.rotation.set(0, 0, 0);
      this.#dummy.updateMatrix();
      this.#mesh.setMatrixAt(instance, this.#dummy.matrix);
      this.#mesh.setColorAt(instance, satellite.id === this.#selectedId ? SELECTED_COLOR : CATEGORY_COLOR_OBJECTS[satellite.category]);
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    if (this.#mesh.instanceColor) this.#mesh.instanceColor.needsUpdate = true;
    this.#updateHalo();
  }

  applyQuality(profile: QualityProfile): void {
    this.#quality = profile;
    this.#rebuildFromData();
  }

  setCatalog(catalog: SatelliteRecord[]): void {
    this.#catalog = catalog;
    this.#rebuildFromData();
  }

  setActiveCategories(categories: SatelliteCategory[]): void {
    this.#activeCategories = new Set(categories);
    this.#rebuildFromData();
  }

  /** Compatibility fallback. Phase 8 normally uses prediction windows. */
  setFrame(frame: OrbitFrame): void {
    this.#frame = frame;
    this.#window = null;
    this.#slotByCatalogIndex = new Map(Array.from(frame.indices, (catalogIndex, slot) => [catalogIndex, slot] as const));
    this.#suspendedForSeek = false;
    this.#rebuildFromData(false);
    this.#emitSelectedTelemetry();
  }

  setPredictionWindow(window: OrbitPredictionWindow): void {
    this.#window = window;
    this.#frame = null;
    this.#slotByCatalogIndex = new Map(Array.from(window.indices, (catalogIndex, slot) => [catalogIndex, slot] as const));
    this.#suspendedForSeek = false;
    this.#rebuildFromData(false);
    this.#emitSelectedTelemetry();
  }

  markTemporalDiscontinuity(): void {
    this.#suspendedForSeek = true;
    this.#window = null;
    this.#frame = null;
    this.#slotByCatalogIndex.clear();
    this.#selectedWorldValid = false;
    this.#hoveredInstance = null;
    this.#onHover?.(null, null);
    this.#onSelectedTelemetry?.(null);
  }

  setTrack(track: OrbitTrack | null): void {
    this.#track = track;
    this.#rebuildTrackLines();
  }

  setTrail(track: OrbitTrack | null): void {
    this.#trail = track;
    this.#rebuildTrailLine();
  }

  setScaleMode(mode: OrbitScaleMode): void {
    if (mode === this.#scaleMode) return;
    this.#scaleMode = mode;
    this.#rebuildTrackLines();
    this.#rebuildTrailLine();
  }

  setTrackVisibility(options: { orbitPath: boolean; groundTrack: boolean }): void {
    this.#showOrbitPath = options.orbitPath;
    this.#showGroundTrack = options.groundTrack;
    this.#updateTrackVisibility();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#mesh) this.#mesh.visible = enabled;
    this.#updateTrackVisibility();
    if (this.#trailLine) this.#trailLine.visible = enabled && this.#trail?.satelliteId === this.#selectedId;
    if (this.#halo) this.#halo.visible = enabled && this.#selectedWorldValid && this.#selectedId !== null;
    if (!enabled) {
      this.#hoveredInstance = null;
      this.#onHover?.(null, null);
      if (this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';
    }
  }

  setSelected(id: EntityId | null): void {
    if (id !== this.#selectedId) {
      if (this.#track?.satelliteId !== id) this.#track = null;
      if (this.#trail?.satelliteId !== id) this.#trail = null;
      this.#disposeTrackLines();
      this.#disposeTrailLine();
    }
    this.#selectedId = id;
    this.#emitSelectedTelemetry();
    this.#updateTrackVisibility();
  }

  getSelectedWorldPosition(): THREE.Vector3 | null {
    return this.#selectedWorldValid ? this.#selectedWorld.clone() : null;
  }

  getOrbitPathRadius(): number | null {
    if (!this.#track || !this.#context || this.#track.satelliteId !== this.#selectedId) return null;
    let maxRadius = 0;
    for (let index = 0; index < this.#track.sampleCount; index += 1) {
      const offset = index * 3;
      const lat = this.#track.positions[offset];
      const lon = this.#track.positions[offset + 1];
      const altitudeKm = this.#track.positions[offset + 2];
      if (![lat, lon, altitudeKm].every(Number.isFinite)) continue;
      const point = this.#context.globe.getCoords(lat!, lon!, altitudeKmToGlobeRadiusUnits(displayAltitudeKm(altitudeKm!, this.#scaleMode)));
      maxRadius = Math.max(maxRadius, Math.hypot(point.x, point.y, point.z));
    }
    return maxRadius > 0 ? maxRadius : null;
  }

  getOrbitPlaneNormal(): THREE.Vector3 | null {
    if (!this.#track || !this.#context || this.#track.satelliteId !== this.#selectedId) return null;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < this.#track.sampleCount; i += Math.max(1, Math.floor(this.#track.sampleCount / 12))) {
      const offset = i * 3;
      const lat = this.#track.positions[offset];
      const lon = this.#track.positions[offset + 1];
      const altitudeKm = this.#track.positions[offset + 2];
      if (![lat, lon, altitudeKm].every(Number.isFinite)) continue;
      const point = this.#context.globe.getCoords(lat!, lon!, altitudeKmToGlobeRadiusUnits(displayAltitudeKm(altitudeKm!, this.#scaleMode)));
      points.push(new THREE.Vector3(point.x, point.y, point.z).normalize());
    }
    if (points.length < 3) return null;
    let best = new THREE.Vector3();
    for (let i = 1; i < points.length; i += 1) {
      const candidate = new THREE.Vector3().crossVectors(points[0]!, points[i]!);
      if (candidate.lengthSq() > best.lengthSq()) best = candidate;
    }
    return best.lengthSq() > 1e-6 ? best.normalize() : null;
  }

  dispose(): void {
    if (this.#context) {
      this.#context.renderer.domElement.removeEventListener('click', this.#onClick, true);
      this.#context.renderer.domElement.removeEventListener('pointermove', this.#onPointerMove);
      if (this.#context.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';
    }
    this.#onHover?.(null, null);
    this.#disposeMesh();
    this.#disposeHalo();
    this.#disposeTrackLines();
    this.#disposeTrailLine();
    this.#context = null;
    this.#catalog = [];
    this.#frame = null;
    this.#window = null;
    this.#track = null;
    this.#trail = null;
    this.#renderedIndices = [];
    this.#slotByCatalogIndex.clear();
    this.#selectedWorldValid = false;
  }

  #dataIndices(): Uint32Array | null {
    return this.#window?.indices ?? this.#frame?.indices ?? null;
  }

  #candidateIndices(): number[] {
    const indices = this.#dataIndices();
    if (!indices || !this.#quality) return [];
    const cap = this.#quality.satelliteCap;
    const candidates = Array.from(indices).filter((catalogIndex) => {
      const satellite = this.#catalog[catalogIndex];
      return satellite && satellite.categories.some((category) => this.#activeCategories.has(category));
    });
    if (candidates.length <= cap) return candidates;
    const selectedCatalogIndex = this.#selectedId === null ? -1 : this.#catalog.findIndex((satellite) => satellite.id === this.#selectedId);
    const result = stratifiedIndices(candidates, cap);
    if (selectedCatalogIndex >= 0 && candidates.includes(selectedCatalogIndex) && !result.includes(selectedCatalogIndex)) result[result.length - 1] = selectedCatalogIndex;
    return result;
  }

  #rebuildFromData(forceMesh = true): void {
    if (!this.#context || !this.#quality) return;
    const nextIndices = this.#candidateIndices();
    const needsMesh = forceMesh || !this.#mesh || !sameIndices(nextIndices, this.#renderedIndices);
    if (!needsMesh) return;
    this.#disposeMesh();
    this.#renderedIndices = nextIndices;
    if (nextIndices.length === 0) return;
    const geometry = new THREE.OctahedronGeometry(1, 0);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, nextIndices.length);
    mesh.name = 'signal-earth-orbit-satellites';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.visible = this.#enabled;
    this.#context.scene.add(mesh);
    this.#geometry = geometry;
    this.#material = material;
    this.#mesh = mesh;
  }

  #hideAllInstances(): void {
    if (!this.#mesh) return;
    for (let i = 0; i < this.#renderedIndices.length; i += 1) {
      this.#dummy.position.set(0, 0, 0);
      this.#dummy.scale.setScalar(0.000001);
      this.#dummy.updateMatrix();
      this.#mesh.setMatrixAt(i, this.#dummy.matrix);
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  #stateForCatalogIndex(catalogIndex: number, simulationTime: number): OrbitalState | null {
    const slot = this.#slotByCatalogIndex.get(catalogIndex);
    if (slot === undefined) return null;
    if (this.#window) {
      const window = this.#window;
      if (window.objectCount <= 0 || window.sampleCount <= 0) return null;
      const span = Math.max(1, window.endTimestamp - window.startTimestamp);
      const scaled = THREE.MathUtils.clamp((simulationTime - window.startTimestamp) / span, 0, 1) * (window.sampleCount - 1);
      const a = Math.floor(scaled);
      const b = Math.min(window.sampleCount - 1, a + 1);
      const t = scaled - a;
      const stride = window.objectCount * 4;
      const offsetA = a * stride + slot * 4;
      const offsetB = b * stride + slot * 4;
      const latA = window.positions[offsetA]; const lonA = window.positions[offsetA + 1]; const altA = window.positions[offsetA + 2]; const speedA = window.positions[offsetA + 3];
      const latB = window.positions[offsetB]; const lonB = window.positions[offsetB + 1]; const altB = window.positions[offsetB + 2]; const speedB = window.positions[offsetB + 3];
      if (![latA, lonA, altA, speedA].every(Number.isFinite)) return null;
      if (![latB, lonB, altB, speedB].every(Number.isFinite) || a === b) return [latA!, lonA!, altA!, speedA!];
      return [
        THREE.MathUtils.lerp(latA!, latB!, t),
        shortestLongitudeLerp(lonA!, lonB!, t),
        THREE.MathUtils.lerp(altA!, altB!, t),
        THREE.MathUtils.lerp(speedA!, speedB!, t),
      ];
    }
    if (this.#frame) {
      const offset = slot * 4;
      const lat = this.#frame.positions[offset]; const lon = this.#frame.positions[offset + 1]; const alt = this.#frame.positions[offset + 2]; const speed = this.#frame.positions[offset + 3];
      if (![lat, lon, alt, speed].every(Number.isFinite)) return null;
      return [lat!, lon!, alt!, speed!];
    }
    return null;
  }

  #telemetryForCatalogIndex(catalogIndex: number): SatelliteTelemetry | null {
    const state = this.#stateForCatalogIndex(catalogIndex, this.#getSimulationTime());
    const satellite = this.#catalog[catalogIndex];
    if (!state || !satellite) return null;
    return { id: satellite.id, timestamp: this.#getSimulationTime(), lat: state[0], lon: state[1], altitudeKm: state[2], speedKmS: state[3] };
  }

  #emitSelectedTelemetry(): void {
    if (!this.#onSelectedTelemetry) return;
    if (!this.#selectedId) { this.#onSelectedTelemetry(null); return; }
    const catalogIndex = this.#catalog.findIndex((satellite) => satellite.id === this.#selectedId);
    this.#onSelectedTelemetry(catalogIndex < 0 ? null : this.#telemetryForCatalogIndex(catalogIndex));
  }

  #createHalo(): void {
    if (!this.#context || this.#halo) return;
    this.#haloGeometry = new THREE.RingGeometry(1.25, 1.68, 40);
    this.#haloMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false });
    this.#halo = new THREE.Mesh(this.#haloGeometry, this.#haloMaterial);
    this.#halo.name = 'signal-earth-selected-satellite-halo';
    this.#halo.renderOrder = 12;
    this.#halo.visible = false;
    this.#context.scene.add(this.#halo);
  }

  #updateHalo(): void {
    if (!this.#halo || !this.#context) return;
    const satellite = this.#selectedId ? this.#catalog.find((item) => item.id === this.#selectedId) : null;
    this.#halo.visible = this.#enabled && this.#selectedWorldValid && !!satellite;
    if (!this.#halo.visible || !satellite) return;
    this.#halo.position.copy(this.#selectedWorld);
    this.#halo.quaternion.copy(this.#context.camera.quaternion);
    this.#halo.scale.setScalar(2.15);
    this.#haloMaterial?.color.copy(CATEGORY_COLOR_OBJECTS[satellite.category]);
  }

  #trackPoints(track: OrbitTrack, ground = false): THREE.Vector3[] {
    if (!this.#context) return [];
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < track.sampleCount; index += 1) {
      const offset = index * 3;
      const lat = track.positions[offset]; const lon = track.positions[offset + 1]; const altitudeKm = track.positions[offset + 2];
      if (![lat, lon, altitudeKm].every(Number.isFinite)) continue;
      const altitude = ground ? GROUND_TRACK_ALTITUDE : altitudeKmToGlobeRadiusUnits(displayAltitudeKm(altitudeKm!, this.#scaleMode));
      const point = this.#context.globe.getCoords(lat!, lon!, altitude);
      points.push(new THREE.Vector3(point.x, point.y, point.z));
    }
    return points;
  }

  #groundTrackSegments(track: OrbitTrack): { ascending: THREE.Vector3[]; descending: THREE.Vector3[] } {
    if (!this.#context) return { ascending: [], descending: [] };
    const ascending: THREE.Vector3[] = [];
    const descending: THREE.Vector3[] = [];
    let previous: { lat: number; point: THREE.Vector3 } | null = null;
    for (let index = 0; index < track.sampleCount; index += 1) {
      const offset = index * 3;
      const lat = track.positions[offset];
      const lon = track.positions[offset + 1];
      if (![lat, lon].every(Number.isFinite)) { previous = null; continue; }
      const raw = this.#context.globe.getCoords(lat!, lon!, GROUND_TRACK_ALTITUDE);
      const point = new THREE.Vector3(raw.x, raw.y, raw.z);
      if (previous) {
        const target = lat! >= previous.lat ? ascending : descending;
        target.push(previous.point, point);
      }
      previous = { lat: lat!, point };
    }
    return { ascending, descending };
  }

  #rebuildTrackLines(): void {
    this.#disposeTrackLines();
    if (!this.#context || !this.#track || this.#track.satelliteId !== this.#selectedId) return;
    const orbitPoints = this.#trackPoints(this.#track);
    if (orbitPoints.length < 2) return;
    const satellite = this.#catalog.find((item) => item.id === this.#selectedId);
    const color = satellite ? CATEGORY_COLORS[satellite.category] : '#9ee7ff';
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false });
    this.#orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    this.#orbitLine.name = 'signal-earth-selected-orbit-path';
    this.#orbitLine.renderOrder = 4;
    this.#context.scene.add(this.#orbitLine);

    const ground = this.#groundTrackSegments(this.#track);
    if (ground.ascending.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(ground.ascending);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false });
      this.#groundAscendingLine = new THREE.LineSegments(geometry, material);
      this.#groundAscendingLine.name = 'signal-earth-ground-track-ascending';
      this.#groundAscendingLine.renderOrder = 5;
      this.#context.scene.add(this.#groundAscendingLine);
    }
    if (ground.descending.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(ground.descending);
      const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.34, dashSize: 1.15, gapSize: 0.78, depthWrite: false, toneMapped: false });
      this.#groundDescendingLine = new THREE.LineSegments(geometry, material);
      this.#groundDescendingLine.name = 'signal-earth-ground-track-descending';
      this.#groundDescendingLine.computeLineDistances();
      this.#groundDescendingLine.renderOrder = 5;
      this.#context.scene.add(this.#groundDescendingLine);
    }
    this.#updateTrackVisibility();
  }

  #rebuildTrailLine(): void {
    this.#disposeTrailLine();
    if (!this.#context || !this.#trail || this.#trail.satelliteId !== this.#selectedId || this.#trail.kind === 'off') return;
    const points = this.#trackPoints(this.#trail);
    if (points.length < 2) return;
    const satellite = this.#catalog.find((item) => item.id === this.#selectedId);
    const color = satellite ? CATEGORY_COLORS[satellite.category] : '#ffffff';
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    this.#trailLine = new THREE.Line(geometry, material);
    this.#trailLine.name = `signal-earth-selected-${this.#trail.kind}-trail`;
    this.#trailLine.renderOrder = 8;
    this.#context.scene.add(this.#trailLine);
    this.#trailLine.visible = this.#enabled;
  }

  #updateTrackVisibility(): void {
    const matches = !!this.#track && this.#track.satelliteId === this.#selectedId;
    if (this.#orbitLine) this.#orbitLine.visible = this.#enabled && matches && this.#showOrbitPath;
    if (this.#groundAscendingLine) this.#groundAscendingLine.visible = this.#enabled && matches && this.#showGroundTrack;
    if (this.#groundDescendingLine) this.#groundDescendingLine.visible = this.#enabled && matches && this.#showGroundTrack;
  }

  #disposeMesh(): void {
    if (this.#mesh?.parent) this.#mesh.parent.remove(this.#mesh);
    this.#geometry?.dispose(); this.#material?.dispose();
    this.#mesh = null; this.#geometry = null; this.#material = null;
  }

  #disposeHalo(): void {
    if (this.#halo?.parent) this.#halo.parent.remove(this.#halo);
    this.#haloGeometry?.dispose(); this.#haloMaterial?.dispose();
    this.#halo = null; this.#haloGeometry = null; this.#haloMaterial = null;
  }

  #disposeTrackLines(): void {
    if (this.#orbitLine) { this.#orbitLine.parent?.remove(this.#orbitLine); this.#orbitLine.geometry.dispose(); this.#orbitLine.material.dispose(); this.#orbitLine = null; }
    if (this.#groundAscendingLine) { this.#groundAscendingLine.parent?.remove(this.#groundAscendingLine); this.#groundAscendingLine.geometry.dispose(); this.#groundAscendingLine.material.dispose(); this.#groundAscendingLine = null; }
    if (this.#groundDescendingLine) { this.#groundDescendingLine.parent?.remove(this.#groundDescendingLine); this.#groundDescendingLine.geometry.dispose(); this.#groundDescendingLine.material.dispose(); this.#groundDescendingLine = null; }
  }

  #disposeTrailLine(): void {
    if (!this.#trailLine) return;
    this.#trailLine.parent?.remove(this.#trailLine);
    this.#trailLine.geometry.dispose();
    this.#trailLine.material.dispose();
    this.#trailLine = null;
  }

  #raycast(event: MouseEvent | PointerEvent): number | null {
    if (!this.#enabled || !this.#mesh || !this.#context?.perspectiveCamera || this.#suspendedForSeek) return null;
    const rect = this.#context.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.#pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.#pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.#raycaster.setFromCamera(this.#pointer, this.#context.perspectiveCamera);
    return this.#raycaster.intersectObject(this.#mesh, false)[0]?.instanceId ?? null;
  }

  #onClick = (event: MouseEvent): void => {
    const instanceId = this.#raycast(event);
    if (instanceId === null) return;
    const catalogIndex = this.#renderedIndices[instanceId];
    if (catalogIndex === undefined) return;
    const satellite = this.#catalog[catalogIndex];
    const telemetry = this.#telemetryForCatalogIndex(catalogIndex);
    if (!satellite || !telemetry) return;
    event.preventDefault(); event.stopImmediatePropagation();
    this.#onHover?.(null, null);
    this.#onSelect?.(satellite, telemetry);
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (!this.#context) return;
    const instanceId = this.#raycast(event);
    if (instanceId === this.#hoveredInstance) return;
    this.#hoveredInstance = instanceId;
    this.#context.renderer.domElement.style.cursor = instanceId === null ? '' : 'pointer';
    if (instanceId === null) { this.#onHover?.(null, null); return; }
    const catalogIndex = this.#renderedIndices[instanceId];
    const satellite = catalogIndex === undefined ? null : this.#catalog[catalogIndex] ?? null;
    const telemetry = catalogIndex === undefined ? null : this.#telemetryForCatalogIndex(catalogIndex);
    if (satellite && telemetry) this.#onHover?.(satellite, telemetry, { x: event.clientX, y: event.clientY });
    else this.#onHover?.(null, null);
  };
}

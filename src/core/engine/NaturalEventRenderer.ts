import * as THREE from 'three';
import type { NaturalEventCategory, NaturalEventGeometryFrame, NaturalEventRecord } from '../../features/natural-events/types';
import { geometryFrameAt, isNaturalEventVisibleAt } from '../../features/natural-events/timeline';
import type { EntityId } from '../../shared/types/entities';
import type { GlobeRenderContext } from './globe.types';
import type { SceneRenderer } from './GlobeEngine';
import type { QualityProfile } from './QualityManager';

export interface NaturalEventRendererOptions {
  onSelect?: (event: NaturalEventRecord) => void;
  onHover?: (event: NaturalEventRecord | null, position?: { x: number; y: number }) => void;
  getSimulationTime?: () => number;
}

interface CategoryVisual {
  category: NaturalEventCategory;
  events: NaturalEventRecord[];
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.InstancedMesh;
}

interface StormTrackVisual {
  event: NaturalEventRecord;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  timestamps: number[];
}

const SURFACE_ALTITUDE = 0.011;
const TRACK_ALTITUDE = 0.008;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function categoryColor(category: NaturalEventCategory): THREE.Color {
  if (category === 'wildfire') return new THREE.Color('#ff7548');
  if (category === 'volcano') return new THREE.Color('#ffb24a');
  return new THREE.Color('#62d9ff');
}

function renderCap(profile: QualityProfile): number {
  if (profile.effects === 'reduced') return 220;
  if (profile.effects === 'normal') return 420;
  return 700;
}

function eventPriority(event: NaturalEventRecord): number {
  const openBoost = event.closedAt === null ? 1_000_000_000_000 : 0;
  return openBoost + event.updatedAt;
}

function makeGeometry(category: NaturalEventCategory, profile: QualityProfile): THREE.BufferGeometry {
  const detail = profile.effects === 'reduced' ? 5 : 8;
  if (category === 'severe-storm') return new THREE.TorusGeometry(0.72, 0.15, 5, detail * 2);
  const geometry = new THREE.ConeGeometry(category === 'wildfire' ? 0.58 : 0.72, category === 'wildfire' ? 1.45 : 1.28, category === 'wildfire' ? 3 : 5);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, category === 'wildfire' ? 0.72 : 0.64);
  return geometry;
}

function markerScale(event: NaturalEventRecord, frame: NaturalEventGeometryFrame): number {
  const magnitude = frame.magnitudeValue;
  if (magnitude === null) return event.category === 'severe-storm' ? 1.1 : 0.95;
  if (event.category === 'severe-storm') return THREE.MathUtils.clamp(0.85 + magnitude / 120, 0.9, 1.65);
  return THREE.MathUtils.clamp(0.9 + Math.log10(Math.max(1, Math.abs(magnitude))) * 0.12, 0.9, 1.45);
}

export class NaturalEventRenderer implements SceneRenderer {
  readonly id = 'natural-events';

  readonly #onSelect: ((event: NaturalEventRecord) => void) | undefined;
  readonly #onHover: NaturalEventRendererOptions['onHover'] | undefined;
  readonly #getSimulationTime: () => number;
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #dummy = new THREE.Object3D();
  readonly #normal = new THREE.Vector3();

  #context: GlobeRenderContext | null = null;
  #events: NaturalEventRecord[] = [];
  #rendered: NaturalEventRecord[] = [];
  #activeCategories: Record<NaturalEventCategory, boolean> = { 'severe-storm': true, wildfire: true, volcano: true };
  #visuals: CategoryVisual[] = [];
  #tracks: StormTrackVisual[] = [];
  #selectionOutlines: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  #enabled = false;
  #selectedId: EntityId | null = null;
  #quality: QualityProfile | null = null;
  #simulationTime = Date.now();
  #hoveredKey = '';
  #lastSelectionFrameKey = '';

  constructor(options: NaturalEventRendererOptions = {}) {
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

  update(): void {}

  applyQuality(profile: QualityProfile): void {
    this.#quality = profile;
    this.#rebuild();
  }

  setEvents(events: NaturalEventRecord[]): void {
    this.#events = events;
    this.#rebuild();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    for (const visual of this.#visuals) visual.mesh.visible = enabled;
    for (const track of this.#tracks) track.line.visible = enabled && track.line.geometry.drawRange.count >= 2;
    for (const line of this.#selectionOutlines) line.visible = enabled;
    if (!enabled) { this.#clearCursor(); this.#onHover?.(null); }
  }

  setActiveCategories(active: Record<NaturalEventCategory, boolean>): void {
    this.#activeCategories = { ...active };
    this.#updateMatrices();
    this.#updateStormTracks();
    this.#syncSelectionOutline(true);
  }

  setSimulationTime(timestamp: number): void {
    if (!Number.isFinite(timestamp)) return;
    this.#simulationTime = timestamp;
    this.#updateMatrices();
    this.#updateStormTracks();
    this.#syncSelectionOutline();
  }

  setSelected(id: EntityId | null): void {
    if (this.#selectedId === id) return;
    this.#selectedId = id;
    this.#updateMatrices();
    this.#updateStormTracks();
    this.#syncSelectionOutline(true);
  }

  dispose(): void {
    if (this.#context) {
      this.#context.renderer.domElement.removeEventListener('click', this.#onClick, true);
      this.#context.renderer.domElement.removeEventListener('pointermove', this.#onPointerMove);
    }
    this.#clearCursor();
    this.#onHover?.(null);
    this.#disposeVisuals();
    this.#disposeTracks();
    this.#disposeSelectionOutlines();
    this.#context = null;
    this.#events = [];
    this.#rendered = [];
  }

  #rebuild(): void {
    if (!this.#context || !this.#quality) return;
    this.#disposeVisuals();
    this.#disposeTracks();
    this.#disposeSelectionOutlines();

    const cap = renderCap(this.#quality);
    this.#rendered = this.#events.length <= cap
      ? [...this.#events]
      : [...this.#events].sort((a, b) => eventPriority(b) - eventPriority(a)).slice(0, cap);

    const categories: NaturalEventCategory[] = ['severe-storm', 'wildfire', 'volcano'];
    for (const category of categories) {
      const events = this.#rendered.filter((event) => event.category === category);
      if (!events.length) continue;
      const geometry = makeGeometry(category, this.#quality);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, events.length);
      mesh.name = `signal-earth-event-${category}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      mesh.visible = this.#enabled;
      this.#context.scene.add(mesh);
      this.#visuals.push({ category, events, geometry, material, mesh });
    }

    this.#buildStormTracks();
    this.#simulationTime = this.#getSimulationTime();
    this.#updateMatrices();
    this.#updateStormTracks();
    this.#syncSelectionOutline(true);
  }

  #updateMatrices(): void {
    if (!this.#context) return;
    for (const visual of this.#visuals) {
      for (let index = 0; index < visual.events.length; index += 1) {
        const event = visual.events[index]!;
        const frame = this.#activeCategories[event.category] ? geometryFrameAt(event, this.#simulationTime) : null;
        const selected = event.id === this.#selectedId;
        if (!frame) {
          this.#dummy.position.set(0, 0, 0);
          this.#dummy.scale.setScalar(0.000001);
          this.#dummy.quaternion.identity();
        } else {
          const point = this.#context.globe.getCoords(frame.point.lat, frame.point.lon, SURFACE_ALTITUDE);
          this.#dummy.position.set(point.x, point.y, point.z);
          this.#normal.copy(this.#dummy.position).normalize();
          this.#dummy.quaternion.setFromUnitVectors(Z_AXIS, this.#normal);
          this.#dummy.scale.setScalar(markerScale(event, frame) * (selected ? 1.55 : 1));
        }
        this.#dummy.updateMatrix();
        visual.mesh.setMatrixAt(index, this.#dummy.matrix);
        visual.mesh.setColorAt(index, selected ? new THREE.Color('#ffffff') : categoryColor(event.category));
      }
      visual.mesh.instanceMatrix.needsUpdate = true;
      if (visual.mesh.instanceColor) visual.mesh.instanceColor.needsUpdate = true;
    }
  }

  #buildStormTracks(): void {
    if (!this.#context) return;
    for (const event of this.#rendered) {
      if (event.category !== 'severe-storm') continue;
      const pointFrames = event.geometry.filter((frame) => frame.type === 'point');
      if (pointFrames.length < 2) continue;
      const points: THREE.Vector3[] = [];
      const timestamps: number[] = [];
      for (let index = 0; index < pointFrames.length - 1; index += 1) {
        const current = pointFrames[index]!;
        const next = pointFrames[index + 1]!;
        const aRaw = this.#context.globe.getCoords(current.point.lat, current.point.lon, TRACK_ALTITUDE);
        const bRaw = this.#context.globe.getCoords(next.point.lat, next.point.lon, TRACK_ALTITUDE);
        const a = new THREE.Vector3(aRaw.x, aRaw.y, aRaw.z);
        const b = new THREE.Vector3(bRaw.x, bRaw.y, bRaw.z);
        const radius = (a.length() + b.length()) / 2;
        const subdivisions = 6;
        for (let step = 0; step < subdivisions; step += 1) {
          if (index > 0 && step === 0) continue;
          const t = step / subdivisions;
          points.push(a.clone().lerp(b, t).normalize().multiplyScalar(radius));
          timestamps.push(current.timestamp + (next.timestamp - current.timestamp) * t);
        }
      }
      const last = pointFrames[pointFrames.length - 1]!;
      const lastRaw = this.#context.globe.getCoords(last.point.lat, last.point.lon, TRACK_ALTITUDE);
      points.push(new THREE.Vector3(lastRaw.x, lastRaw.y, lastRaw.z));
      timestamps.push(last.timestamp);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.setDrawRange(0, 0);
      const material = new THREE.LineBasicMaterial({ color: '#62d9ff', transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 4;
      line.frustumCulled = false;
      line.visible = false;
      this.#context.scene.add(line);
      this.#tracks.push({ event, line, timestamps });
    }
  }

  #updateStormTracks(): void {
    for (const track of this.#tracks) {
      const categoryEnabled = this.#activeCategories[track.event.category];
      let visibleCount = 0;
      if (categoryEnabled && isNaturalEventVisibleAt(track.event, this.#simulationTime)) {
        for (const timestamp of track.timestamps) {
          if (timestamp > this.#simulationTime) break;
          visibleCount += 1;
        }
      }
      track.line.geometry.setDrawRange(0, visibleCount);
      track.line.visible = this.#enabled && visibleCount >= 2;
      track.line.material.opacity = track.event.id === this.#selectedId ? 0.9 : 0.34;
      track.line.material.color.set(track.event.id === this.#selectedId ? '#dff8ff' : '#62d9ff');
    }
  }

  #syncSelectionOutline(force = false): void {
    const selected = this.#rendered.find((event) => event.id === this.#selectedId) ?? null;
    const frame = selected && this.#activeCategories[selected.category] ? geometryFrameAt(selected, this.#simulationTime) : null;
    const key = frame ? `${selected?.id}:${frame.timestamp}:${frame.type}` : '';
    if (!force && key === this.#lastSelectionFrameKey) return;
    this.#disposeSelectionOutlines();
    this.#lastSelectionFrameKey = key;
    if (!this.#context || !selected || !frame?.rings?.length) return;
    for (const ring of frame.rings.slice(0, 6)) {
      const points = ring.map((point) => {
        const coords = this.#context!.globe.getCoords(point.lat, point.lon, TRACK_ALTITUDE + 0.002);
        return new THREE.Vector3(coords.x, coords.y, coords.z);
      });
      if (points.length < 3) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false });
      const line = new THREE.LineLoop(geometry, material);
      line.renderOrder = 7;
      line.visible = this.#enabled;
      this.#context.scene.add(line);
      this.#selectionOutlines.push(line);
    }
  }

  #disposeVisuals(): void {
    for (const visual of this.#visuals) {
      if (visual.mesh.parent) visual.mesh.parent.remove(visual.mesh);
      visual.geometry.dispose();
      visual.material.dispose();
    }
    this.#visuals = [];
  }

  #disposeTracks(): void {
    for (const track of this.#tracks) {
      if (track.line.parent) track.line.parent.remove(track.line);
      track.line.geometry.dispose();
      track.line.material.dispose();
    }
    this.#tracks = [];
  }

  #disposeSelectionOutlines(): void {
    for (const line of this.#selectionOutlines) {
      if (line.parent) line.parent.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.#selectionOutlines = [];
    this.#lastSelectionFrameKey = '';
  }

  #raycast(event: MouseEvent | PointerEvent): { event: NaturalEventRecord; key: string } | null {
    if (!this.#enabled || !this.#context?.perspectiveCamera) return null;
    const rect = this.#context.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.#pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.#pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.#raycaster.setFromCamera(this.#pointer, this.#context.perspectiveCamera);
    let closest: { event: NaturalEventRecord; key: string; distance: number } | null = null;
    for (const visual of this.#visuals) {
      const hit = this.#raycaster.intersectObject(visual.mesh, false)[0];
      const instanceId = hit?.instanceId;
      if (!hit || instanceId === undefined || instanceId === null) continue;
      const selected = visual.events[instanceId];
      if (!selected || !geometryFrameAt(selected, this.#simulationTime) || !this.#activeCategories[selected.category]) continue;
      if (!closest || hit.distance < closest.distance) closest = { event: selected, key: `${visual.category}:${instanceId}`, distance: hit.distance };
    }
    return closest ? { event: closest.event, key: closest.key } : null;
  }

  #clearCursor(): void {
    if (this.#context?.renderer.domElement.style.cursor === 'pointer') this.#context.renderer.domElement.style.cursor = '';
    this.#hoveredKey = '';
  }

  #onClick = (event: MouseEvent): void => {
    const hit = this.#raycast(event);
    if (!hit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.#onHover?.(null);
    this.#onSelect?.(hit.event);
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (!this.#context) return;
    const hit = this.#raycast(event);
    const key = hit?.key ?? '';
    if (key === this.#hoveredKey) return;
    this.#hoveredKey = key;
    this.#context.renderer.domElement.style.cursor = hit ? 'pointer' : '';
    if (hit) this.#onHover?.(hit.event, { x: event.clientX, y: event.clientY });
    else this.#onHover?.(null);
  };
}

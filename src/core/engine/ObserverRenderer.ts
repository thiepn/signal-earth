import * as THREE from 'three';
import type { SceneRenderer } from './GlobeEngine';
import type { GlobeRenderContext } from './globe.types';
import type { QualityProfile } from './QualityManager';
import type { ObserverLocation } from '../../features/above-me/types';

const SURFACE_ALTITUDE = 0.006;

export class ObserverRenderer implements SceneRenderer {
  readonly id = 'observer';
  #context: GlobeRenderContext | null = null;
  #location: ObserverLocation | null = null;
  #group: THREE.Group | null = null;
  #marker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  #ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  #markerGeometry: THREE.SphereGeometry | null = null;
  #markerMaterial: THREE.MeshBasicMaterial | null = null;
  #ringGeometry: THREE.RingGeometry | null = null;
  #ringMaterial: THREE.MeshBasicMaterial | null = null;
  #reducedMotion = false;

  mount(context: GlobeRenderContext): void {
    this.#context = context;
    const group = new THREE.Group();
    group.name = 'signal-earth-observer';
    const markerGeometry = new THREE.SphereGeometry(0.85, 14, 10);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, depthWrite: false });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.renderOrder = 12;
    const ringGeometry = new THREE.RingGeometry(1.7, 2.15, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#9ee7ff', transparent: true, opacity: 0.76, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.renderOrder = 11;
    group.add(marker, ring);
    context.scene.add(group);
    this.#group = group;
    this.#marker = marker;
    this.#ring = ring;
    this.#markerGeometry = markerGeometry;
    this.#markerMaterial = markerMaterial;
    this.#ringGeometry = ringGeometry;
    this.#ringMaterial = ringMaterial;
    this.#syncLocation();
  }

  setReducedMotion(value: boolean): void {
    this.#reducedMotion = value;
    if (value && this.#ring && this.#ringMaterial) {
      this.#ring.scale.setScalar(1);
      this.#ringMaterial.opacity = 0.62;
    }
  }

  setLocation(location: ObserverLocation | null): void {
    this.#location = location;
    this.#syncLocation();
  }

  update(timestamp: number): void {
    if (!this.#ring || !this.#group?.visible || this.#reducedMotion) return;
    const pulse = 1 + 0.15 * (0.5 + 0.5 * Math.sin(timestamp / 550));
    this.#ring.scale.setScalar(pulse);
    if (this.#ringMaterial) this.#ringMaterial.opacity = 0.48 + 0.28 * (0.5 + 0.5 * Math.sin(timestamp / 650));
  }

  applyQuality(profile: QualityProfile): void {
    if (!this.#marker || !this.#ring) return;
    const scale = profile.effects === 'reduced' ? 0.82 : profile.effects === 'enhanced' ? 1.08 : 1;
    this.#marker.scale.setScalar(scale);
  }

  dispose(): void {
    if (this.#group?.parent) this.#group.parent.remove(this.#group);
    this.#markerGeometry?.dispose();
    this.#markerMaterial?.dispose();
    this.#ringGeometry?.dispose();
    this.#ringMaterial?.dispose();
    this.#context = null;
    this.#group = null;
    this.#marker = null;
    this.#ring = null;
    this.#markerGeometry = null;
    this.#markerMaterial = null;
    this.#ringGeometry = null;
    this.#ringMaterial = null;
  }

  #syncLocation(): void {
    if (!this.#group || !this.#context) return;
    if (!this.#location) {
      this.#group.visible = false;
      return;
    }
    const point = this.#context.globe.getCoords(this.#location.lat, this.#location.lon, SURFACE_ALTITUDE);
    const position = new THREE.Vector3(point.x, point.y, point.z);
    this.#group.position.copy(position);
    const radial = position.clone().normalize();
    this.#group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radial);
    this.#group.visible = true;
  }
}

import type { Camera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GlobeInstance } from 'globe.gl';
import type { QualityLevel, QualityProfile } from './QualityManager';

export interface GlobePointOfView {
  lat: number;
  lng: number;
  altitude: number;
}

export interface GlobeRenderContext {
  globe: GlobeInstance;
  scene: Scene;
  camera: Camera;
  perspectiveCamera: PerspectiveCamera | null;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  getQuality(): QualityProfile;
  getQualityLevel(): QualityLevel;
}

export interface GlobeEngineMetrics {
  fps: number;
  frameMs: number;
  p95FrameMs: number;
  longFrameRate: number;
  width: number;
  height: number;
  pixelRatio: number;
  quality: QualityLevel;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

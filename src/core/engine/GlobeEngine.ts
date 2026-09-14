import Globe, { type GlobeInstance } from 'globe.gl';
import * as THREE from 'three';
import type { EntityId, GeoCoordinates } from '../../shared/types/entities';
import { altitudeKmToGlobeRadiusUnits, globeRadiusUnitsToAltitudeKm } from '../../shared/coordinates/geo';
import { CameraController } from './CameraController';
import type { CameraState } from './camera.types';
import { FramePerformanceMonitor } from './FramePerformanceMonitor';
import { QualityManager, type QualityProfile } from './QualityManager';
import type { GlobeEngineMetrics, GlobePointOfView, GlobeRenderContext } from './globe.types';

export interface SceneRenderer {
  readonly id: string;
  mount(context: GlobeRenderContext): void;
  update(timestamp: number): void;
  applyQuality?(profile: QualityProfile): void;
  dispose(): void;
}

export interface GlobeEngineOptions {
  cameraController?: CameraController;
  qualityManager?: QualityManager;
  initialPointOfView?: GlobePointOfView;
}

type MetricsListener = (metrics: GlobeEngineMetrics) => void;
type PointOfViewListener = (pointOfView: GlobePointOfView) => void;
type GlobeClickListener = (coordinates: { lat: number; lon: number }) => void;
type CameraStateListener = (state: Readonly<CameraState>) => void;
type WorldTargetProvider = () => THREE.Vector3 | null;

const DEFAULT_POINT_OF_VIEW: GlobePointOfView = { lat: 18, lng: 8, altitude: 2.35 };

export class GlobeEngine {
  readonly #container: HTMLElement;
  readonly #renderers = new Map<string, SceneRenderer>();
  readonly #metricsListeners = new Set<MetricsListener>();
  readonly #pointOfViewListeners = new Set<PointOfViewListener>();
  readonly #globeClickListeners = new Set<GlobeClickListener>();
  readonly #cameraStateListeners = new Set<CameraStateListener>();
  readonly #manualCameraListeners = new Set<() => void>();
  readonly #quality: QualityManager;
  readonly #cameraController: CameraController;
  readonly #initialPointOfView: GlobePointOfView;
  readonly #performance = new FramePerformanceMonitor();

  #globe: GlobeInstance | null = null;
  #context: GlobeRenderContext | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #animationFrame: number | null = null;
  #lastMetrics: GlobeEngineMetrics | null = null;
  #mounted = false;
  #startedAt = 0;
  #unsubscribeQuality: (() => void) | null = null;
  #detachCameraRuntime: (() => void) | null = null;
  #usingWindowResize = false;
  #unsubscribeCameraState: (() => void) | null = null;
  #followTargetProvider: WorldTargetProvider | null = null;
  #cameraFlight: { start: THREE.Vector3; end: THREE.Vector3; startedAt: number; durationMs: number } | null = null;

  constructor(container: HTMLElement, options: GlobeEngineOptions = {}) {
    this.#container = container;
    this.#quality = options.qualityManager ?? new QualityManager();
    this.#cameraController = options.cameraController ?? new CameraController();
    this.#initialPointOfView = options.initialPointOfView ?? DEFAULT_POINT_OF_VIEW;
  }

  get globe(): GlobeInstance | null { return this.#globe; }
  get qualityManager(): QualityManager { return this.#quality; }
  get cameraController(): CameraController { return this.#cameraController; }
  get metrics(): GlobeEngineMetrics | null { return this.#lastMetrics; }
  get mounted(): boolean { return this.#mounted; }

  setReducedMotion(value: boolean): void {
    this.#cameraController.setReducedMotion(value);
    if (this.#context) {
      this.#context.controls.enableDamping = !value;
      this.#context.controls.dampingFactor = value ? 0 : 0.075;
      this.#context.controls.update();
    }
  }

  mount(): void {
    if (this.#mounted) return;

    const rect = this.#container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || window.innerWidth));
    const height = Math.max(1, Math.round(rect.height || window.innerHeight));

    try {
      const globe = new Globe(this.#container, {
        rendererConfig: {
          antialias: this.#quality.level !== 'low',
          alpha: false,
          powerPreference: 'high-performance',
        },
        waitForGlobeReady: false,
        animateIn: false,
      });

      this.#globe = globe;

      globe
        .width(width)
        .height(height)
        .backgroundColor('#02050a')
        .pointOfView(this.#initialPointOfView, 0)
        .onZoom((pov: { lat: number; lng: number; altitude: number }) => {
          const normalized = { lat: pov.lat, lng: pov.lng, altitude: pov.altitude };
          for (const listener of this.#pointOfViewListeners) listener(normalized);
        })
        .onGlobeClick((coords: { lat: number; lng: number }) => {
          for (const listener of this.#globeClickListeners) listener({ lat: coords.lat, lon: coords.lng });
        });

      const renderer = globe.renderer();
      renderer.domElement.addEventListener('webglcontextlost', this.#onContextLost, false);
      renderer.domElement.addEventListener('webglcontextrestored', this.#onContextRestored, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const camera = globe.camera();
      const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;
      if (perspectiveCamera) {
        perspectiveCamera.near = 0.1;
        perspectiveCamera.far = globe.getGlobeRadius() * 50;
        perspectiveCamera.updateProjectionMatrix();
      }

      const controls = globe.controls();
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.rotateSpeed = 0.48;
      controls.zoomSpeed = 0.82;
      controls.enablePan = false;
      controls.minDistance = globe.getGlobeRadius() * 1.08;
      controls.maxDistance = globe.getGlobeRadius() * 15;
      controls.addEventListener('start', this.#onManualControlStart);

      this.#context = {
        globe,
        scene: globe.scene(),
        camera,
        perspectiveCamera,
        renderer,
        controls,
        getQuality: () => this.#quality.profile,
        getQualityLevel: () => this.#quality.level,
      };

      this.#detachCameraRuntime = this.#cameraController.attachRuntime({
        pointOfView: (target, durationMs = 0) => globe.pointOfView(target, durationMs),
        currentPointOfView: () => globe.pointOfView(),
      });

      this.#unsubscribeQuality = this.#quality.subscribe((_level, profile) => {
        this.#applyQuality(profile);
      });
      this.#unsubscribeCameraState = this.#cameraController.subscribe((state) => {
        for (const listener of this.#cameraStateListeners) listener(state);
      });

      this.#applyQuality(this.#quality.profile);
      this.#setupResizeObserver();
      document.addEventListener('visibilitychange', this.#onVisibilityChange);

      this.#mounted = true;
      this.#startedAt = performance.now();
      for (const rendererPlugin of this.#renderers.values()) rendererPlugin.mount(this.#context);
      this.#startUpdates();
    } catch (error) {
      this.dispose();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Signal Earth could not initialize WebGL: ${message}`);
    }
  }

  registerRenderer(renderer: SceneRenderer): void {
    if (this.#renderers.has(renderer.id)) {
      throw new Error(`Renderer already registered: ${renderer.id}`);
    }
    this.#renderers.set(renderer.id, renderer);
    if (this.#context) renderer.mount(this.#context);
  }

  unregisterRenderer(id: string): void {
    const renderer = this.#renderers.get(id);
    if (!renderer) return;
    renderer.dispose();
    this.#renderers.delete(id);
  }

  resize(): void {
    if (!this.#globe) return;
    const rect = this.#container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.#globe.width(width).height(height);
    this.#updateMetricsSize(width, height);
  }

  pause(): void {
    if (!this.#globe) return;
    this.#globe.pauseAnimation();
    if (this.#animationFrame !== null) {
      cancelAnimationFrame(this.#animationFrame);
      this.#animationFrame = null;
    }
    this.#performance.reset();
  }

  resume(): void {
    if (!this.#globe || this.#animationFrame !== null) return;
    this.#globe.resumeAnimation();
    this.#startUpdates();
  }

  frameEarth(): void {
    this.stopWorldTracking(true);
    this.#cameraController.frameEarth();
  }

  flyToPointOfView(pointOfView: GlobePointOfView, durationMs = 1_100): void {
    this.stopWorldTracking(true);
    this.#cameraController.cinematicPointOfView(pointOfView, durationMs);
  }

  focusCoordinates(coordinates: GeoCoordinates, altitude = 0.82): void {
    this.stopWorldTracking(true);
    this.#cameraController.focusCoordinates(coordinates, { altitude });
  }

  followWorldTarget(entityId: EntityId, provider: WorldTargetProvider): void {
    if (!this.#context?.perspectiveCamera) return;
    const radius = this.#context.globe.getGlobeRadius();
    this.#context.controls.minDistance = radius * 0.04;
    this.#context.controls.maxDistance = radius * 2.5;
    this.#cameraFlight = null;
    this.#followTargetProvider = provider;
    this.#cameraController.followEntity(entityId);
  }

  frameOrbitPlane(entityId: EntityId, normal: THREE.Vector3, orbitRadius?: number, durationMs = 1_000): void {
    if (!this.#context?.perspectiveCamera || normal.lengthSq() < 1e-8) return;
    this.#followTargetProvider = null;
    const radius = this.#context.globe.getGlobeRadius();
    const cameraDistance = Math.max(radius * 3.25, (orbitRadius ?? radius) * 1.75);
    const end = normal.clone().normalize().multiplyScalar(cameraDistance);
    const camera = this.#context.perspectiveCamera;
    if (cameraDistance > camera.far * 0.8) {
      camera.far = cameraDistance * 2.2;
      camera.updateProjectionMatrix();
    }
    const start = camera.position.clone();
    this.#context.controls.target.set(0, 0, 0);
    this.#context.controls.minDistance = radius * 1.08;
    this.#context.controls.maxDistance = Math.max(radius * 15, cameraDistance * 1.2);
    const effectiveDuration = this.#cameraController.transitionDuration(durationMs);
    if (effectiveDuration <= 0) {
      camera.position.copy(end);
      this.#context.controls.target.set(0, 0, 0);
      this.#context.controls.update();
      this.#cameraFlight = null;
      this.#cameraController.frameOrbit(entityId);
      this.#cameraController.markFocused(entityId);
      return;
    }
    this.#cameraFlight = { start, end, startedAt: performance.now(), durationMs: effectiveDuration };
    this.#cameraController.frameOrbit(entityId);
  }

  stopWorldTracking(resetTarget = true): void {
    this.#followTargetProvider = null;
    this.#cameraFlight = null;
    if (resetTarget && this.#context) {
      const radius = this.#context.globe.getGlobeRadius();
      this.#context.controls.target.set(0, 0, 0);
      this.#context.controls.minDistance = radius * 1.08;
      this.#context.controls.maxDistance = radius * 15;
      this.#context.controls.update();
    }
    this.#cameraController.onManualCameraInput();
  }

  pointOfView(): GlobePointOfView | null {
    return this.#globe?.pointOfView() ?? null;
  }

  async captureImage(type = 'image/png', quality?: number): Promise<Blob> {
    const context = this.#context;
    if (!context) throw new Error('Globe renderer is not ready.');
    // Render immediately before encoding so capture works even though the
    // production renderer does not use preserveDrawingBuffer.
    context.renderer.render(context.scene, context.camera);
    return new Promise<Blob>((resolve, reject) => {
      context.renderer.domElement.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the globe canvas.'));
      }, type, quality);
    });
  }

  captureStream(fps = 30): MediaStream | null {
    const canvas = this.#context?.renderer.domElement;
    if (!canvas || typeof canvas.captureStream !== 'function') return null;
    return canvas.captureStream(Math.max(1, Math.min(60, Math.round(fps))));
  }

  geoToWorld(coordinates: GeoCoordinates): THREE.Vector3 | null {
    if (!this.#globe) return null;
    const point = this.#globe.getCoords(
      coordinates.lat,
      coordinates.lon,
      altitudeKmToGlobeRadiusUnits(coordinates.altitudeKm ?? 0),
    );
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  worldToGeo(position: THREE.Vector3): GeoCoordinates | null {
    if (!this.#globe) return null;
    const geo = this.#globe.toGeoCoords(position);
    return {
      lat: geo.lat,
      lon: geo.lng,
      altitudeKm: globeRadiusUnitsToAltitudeKm(geo.altitude),
    };
  }

  subscribeMetrics(listener: MetricsListener): () => void {
    this.#metricsListeners.add(listener);
    if (this.#lastMetrics) listener(this.#lastMetrics);
    return () => this.#metricsListeners.delete(listener);
  }

  subscribePointOfView(listener: PointOfViewListener): () => void {
    this.#pointOfViewListeners.add(listener);
    const current = this.pointOfView();
    if (current) listener(current);
    return () => this.#pointOfViewListeners.delete(listener);
  }

  subscribeGlobeClick(listener: GlobeClickListener): () => void {
    this.#globeClickListeners.add(listener);
    return () => this.#globeClickListeners.delete(listener);
  }

  subscribeCameraState(listener: CameraStateListener): () => void {
    this.#cameraStateListeners.add(listener);
    listener(this.#cameraController.state);
    return () => this.#cameraStateListeners.delete(listener);
  }

  subscribeManualCameraInput(listener: () => void): () => void {
    this.#manualCameraListeners.add(listener);
    return () => this.#manualCameraListeners.delete(listener);
  }

  dispose(): void {
    this.pause();
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    if (this.#usingWindowResize) {
      window.removeEventListener('resize', this.#onWindowResize);
      this.#usingWindowResize = false;
    }
    this.#unsubscribeQuality?.();
    this.#unsubscribeQuality = null;
    this.#unsubscribeCameraState?.();
    this.#unsubscribeCameraState = null;
    this.#detachCameraRuntime?.();
    this.#detachCameraRuntime = null;

    const controls = this.#globe?.controls();
    controls?.removeEventListener('start', this.#onManualControlStart);

    for (const rendererPlugin of this.#renderers.values()) rendererPlugin.dispose();

    if (this.#globe) {
      this.#globe.pauseAnimation();
      const renderer = this.#globe.renderer();
      renderer.domElement.removeEventListener('webglcontextlost', this.#onContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', this.#onContextRestored, false);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    this.#container.replaceChildren();
    this.#globe = null;
    this.#context = null;
    this.#mounted = false;
    this.#metricsListeners.clear();
    this.#pointOfViewListeners.clear();
    this.#globeClickListeners.clear();
    this.#cameraStateListeners.clear();
    this.#manualCameraListeners.clear();
    this.#followTargetProvider = null;
    this.#cameraFlight = null;
    this.#performance.reset();
  }

  #applyQuality(profile: QualityProfile): void {
    if (!this.#globe) return;
    const renderer = this.#globe.renderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatio));
    this.resize();
    for (const rendererPlugin of this.#renderers.values()) rendererPlugin.applyQuality?.(profile);
  }

  #setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      this.#usingWindowResize = true;
      window.addEventListener('resize', this.#onWindowResize, { passive: true });
      return;
    }
    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(this.#container);
  }

  #startUpdates(): void {
    if (this.#animationFrame !== null) return;
    const tick = (timestamp: number) => {
      if (!this.#globe || !this.#context) {
        this.#animationFrame = null;
        return;
      }

      for (const rendererPlugin of this.#renderers.values()) rendererPlugin.update(timestamp);
      this.#updateCameraTracking(timestamp);

      const sample = this.#performance.push(timestamp);
      if (sample) {
        const rect = this.#container.getBoundingClientRect();
        const info = this.#context.renderer.info;
        const metrics: GlobeEngineMetrics = {
          fps: sample.fps,
          frameMs: sample.frameMs,
          p95FrameMs: sample.p95FrameMs,
          longFrameRate: sample.longFrameRate,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          pixelRatio: this.#context.renderer.getPixelRatio(),
          quality: this.#quality.level,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
        };
        this.#lastMetrics = metrics;
        for (const listener of this.#metricsListeners) listener(metrics);

        // Ignore startup compilation/texture decode when evaluating quality.
        if (timestamp - this.#startedAt > 5_000) this.#quality.observeFps(sample.fps);
      }

      this.#animationFrame = requestAnimationFrame(tick);
    };
    this.#animationFrame = requestAnimationFrame(tick);
  }

  #updateMetricsSize(width: number, height: number): void {
    if (!this.#lastMetrics) return;
    this.#lastMetrics = { ...this.#lastMetrics, width, height };
  }

  #onWindowResize = (): void => {
    this.resize();
  };

  #onManualControlStart = (): void => {
    const wasAutomated = this.#followTargetProvider !== null || this.#cameraFlight !== null || this.#cameraController.state.mode !== 'free';
    this.#followTargetProvider = null;
    this.#cameraFlight = null;
    if (wasAutomated && this.#context) {
      const radius = this.#context.globe.getGlobeRadius();
      this.#context.controls.target.set(0, 0, 0);
      this.#context.controls.minDistance = radius * 1.08;
      this.#context.controls.maxDistance = radius * 15;
    }
    this.#cameraController.onManualCameraInput();
    for (const listener of this.#manualCameraListeners) listener();
  };

  #updateCameraTracking(timestamp: number): void {
    const context = this.#context;
    const camera = context?.perspectiveCamera;
    if (!context || !camera) return;

    if (this.#followTargetProvider && this.#cameraController.state.mode === 'following') {
      const target = this.#followTargetProvider();
      if (target) {
        const radial = target.clone().normalize();
        const globeRadius = context.globe.getGlobeRadius();
        const distance = THREE.MathUtils.clamp(target.length() * 0.16, globeRadius * 0.14, globeRadius * 0.42);
        const desired = target.clone().addScaledVector(radial, distance);
        if (desired.length() > camera.far * 0.8) {
          camera.far = desired.length() * 2.2;
          camera.updateProjectionMatrix();
        }
        if (this.#cameraController.reducedMotion) {
          context.controls.target.copy(target);
          camera.position.copy(desired);
        } else {
          context.controls.target.lerp(target, 0.16);
          camera.position.lerp(desired, 0.09);
        }
        context.controls.update();
      }
    }

    const flight = this.#cameraFlight;
    if (flight) {
      const progress = THREE.MathUtils.clamp((timestamp - flight.startedAt) / Math.max(1, flight.durationMs), 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(flight.start, flight.end, eased);
      context.controls.target.set(0, 0, 0);
      context.controls.update();
      if (progress >= 1) {
        this.#cameraFlight = null;
        this.#cameraController.markFocused(this.#cameraController.state.targetEntityId);
      }
    }
  }

  #onContextLost = (event: Event): void => {
    event.preventDefault();
    this.pause();
  };

  #onContextRestored = (): void => {
    if (!document.hidden) this.resume();
  };

  #onVisibilityChange = (): void => {
    if (document.hidden) this.pause();
    else this.resume();
  };
}

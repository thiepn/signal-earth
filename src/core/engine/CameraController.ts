import type { EntityId, GeoCoordinates } from '../../shared/types/entities';
import type { CameraPointOfView, CameraRuntime, CameraState, CameraTarget } from './camera.types';

const DEFAULT_VIEW = { lat: 18, lng: 8, altitude: 2.35 } as const;
const DEFAULT_TRANSITION_MS = 900;
type CameraStateListener = (state: Readonly<CameraState>) => void;

export class CameraController {
  #state: CameraState = { mode: 'free', targetEntityId: null };
  #runtime: CameraRuntime | null = null;
  #transitionTimer: ReturnType<typeof setTimeout> | null = null;
  #reducedMotion = false;
  readonly #listeners = new Set<CameraStateListener>();

  get state(): Readonly<CameraState> { return this.#state; }
  get reducedMotion(): boolean { return this.#reducedMotion; }

  setReducedMotion(value: boolean): void {
    this.#reducedMotion = value;
  }

  transitionDuration(durationMs: number): number {
    return this.#reducedMotion ? 0 : Math.max(0, durationMs);
  }

  subscribe(listener: CameraStateListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  attachRuntime(runtime: CameraRuntime): () => void {
    this.#runtime = runtime;
    return () => { if (this.#runtime === runtime) this.#runtime = null; };
  }

  reset(durationMs = DEFAULT_TRANSITION_MS): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'focusing', targetEntityId: null });
    const effectiveDuration = this.transitionDuration(durationMs);
    this.#runtime?.pointOfView(DEFAULT_VIEW, effectiveDuration);
    this.#completeAfter(effectiveDuration, 'free', null);
  }

  focusCoordinates(coordinates: GeoCoordinates, target: Omit<CameraTarget, 'coordinates'> = {}): void {
    const durationMs = this.transitionDuration(target.durationMs ?? DEFAULT_TRANSITION_MS);
    this.#clearTransitionTimer();
    this.#setState({ mode: 'focusing', targetEntityId: null });
    this.#runtime?.pointOfView({ lat: coordinates.lat, lng: coordinates.lon, altitude: target.altitude ?? 0.82 }, durationMs);
    this.#completeAfter(durationMs, 'focused', null);
  }

  focusEntity(entityId: EntityId): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'focusing', targetEntityId: entityId });
  }

  markFocused(entityId: EntityId | null = this.#state.targetEntityId): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'focused', targetEntityId: entityId });
  }

  followEntity(entityId: EntityId): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'following', targetEntityId: entityId });
  }

  orbitEntity(entityId: EntityId): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'cinematic', targetEntityId: entityId });
  }

  frameEarth(durationMs = 1_100): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'cinematic', targetEntityId: null });
    const effectiveDuration = this.transitionDuration(durationMs);
    this.#runtime?.pointOfView(DEFAULT_VIEW, effectiveDuration);
    this.#completeAfter(effectiveDuration, 'free', null);
  }

  cinematicPointOfView(target: CameraPointOfView, durationMs = 1_100): void {
    const effectiveDuration = this.transitionDuration(durationMs);
    this.#clearTransitionTimer();
    this.#setState({ mode: 'cinematic', targetEntityId: null });
    this.#runtime?.pointOfView(target, effectiveDuration);
    this.#completeAfter(effectiveDuration, 'free', null);
  }

  frameOrbit(entityId: EntityId): void {
    this.#clearTransitionTimer();
    this.#setState({ mode: 'cinematic', targetEntityId: entityId });
  }

  stopFollowing(): void {
    if (this.#state.mode === 'following') this.#setFree();
  }

  onManualCameraInput(): void {
    if (this.#state.mode !== 'free') this.#setFree();
  }

  currentPointOfView(): { lat: number; lng: number; altitude: number } | null {
    return this.#runtime?.currentPointOfView() ?? null;
  }

  dispose(): void {
    this.#clearTransitionTimer();
    this.#runtime = null;
    this.#listeners.clear();
  }

  #setFree(): void { this.#clearTransitionTimer(); this.#setState({ mode: 'free', targetEntityId: null }); }

  #setState(state: CameraState): void {
    if (state.mode === this.#state.mode && state.targetEntityId === this.#state.targetEntityId) return;
    this.#state = state;
    for (const listener of this.#listeners) listener(this.#state);
  }

  #completeAfter(durationMs: number, mode: CameraState['mode'], targetEntityId: EntityId | null): void {
    if (durationMs <= 0) { this.#setState({ mode, targetEntityId }); return; }
    this.#transitionTimer = setTimeout(() => {
      this.#transitionTimer = null;
      if (this.#state.mode === 'focusing' || this.#state.mode === 'cinematic') this.#setState({ mode, targetEntityId });
    }, durationMs + 40);
  }

  #clearTransitionTimer(): void {
    if (this.#transitionTimer !== null) { clearTimeout(this.#transitionTimer); this.#transitionTimer = null; }
  }
}

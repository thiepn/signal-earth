import type { BriefingDefinition, BriefingStep, TourOutcome, TourState } from './types';

type TourListener = (state: Readonly<TourState>) => void;
type StepExecutor = (step: BriefingStep, signal: AbortSignal) => void | Promise<void>;

const IDLE_STATE: TourState = {
  status: 'idle',
  briefingId: null,
  briefingTitle: null,
  stepIndex: -1,
  stepCount: 0,
  step: null,
  progress: 0,
  error: null,
};

/**
 * Small cancellable sequencing engine for Signal Earth cinematic briefings.
 * It deliberately knows nothing about React, Globe.gl, providers or app state.
 */
export class TourEngine {
  #state: TourState = { ...IDLE_STATE };
  #controller: AbortController | null = null;
  #listeners = new Set<TourListener>();
  #skipCurrent: (() => void) | null = null;
  #runToken = 0;

  get state(): Readonly<TourState> { return this.#state; }
  get active(): boolean { return this.#state.status === 'running'; }

  subscribe(listener: TourListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async start(definition: BriefingDefinition, executeStep: StepExecutor): Promise<TourOutcome> {
    this.cancel();
    const token = ++this.#runToken;
    const controller = new AbortController();
    this.#controller = controller;
    this.#setState({
      status: 'running',
      briefingId: definition.id,
      briefingTitle: definition.title,
      stepIndex: -1,
      stepCount: definition.steps.length,
      step: null,
      progress: 0,
      error: null,
    });

    try {
      for (let index = 0; index < definition.steps.length; index += 1) {
        this.#assertActive(token, controller.signal);
        const step = definition.steps[index]!;
        this.#setState({
          ...this.#state,
          status: 'running',
          stepIndex: index,
          step,
          progress: definition.steps.length === 0 ? 1 : index / definition.steps.length,
          error: null,
        });
        await executeStep(step, controller.signal);
        this.#assertActive(token, controller.signal);
        await this.#wait(step.holdMs, controller.signal);
      }

      this.#assertActive(token, controller.signal);
      this.#setState({ ...this.#state, status: 'completed', step: null, progress: 1 });
      this.#controller = null;
      this.#skipCurrent = null;
      return 'completed';
    } catch (error) {
      this.#skipCurrent = null;
      if (controller.signal.aborted || token !== this.#runToken) {
        if (token === this.#runToken) this.#setState({ ...this.#state, status: 'cancelled', step: null });
        return 'cancelled';
      }
      const message = error instanceof Error ? error.message : String(error);
      this.#setState({ ...this.#state, status: 'failed', step: null, error: message });
      this.#controller = null;
      return 'failed';
    }
  }

  skip(): void {
    this.#skipCurrent?.();
  }

  cancel(): void {
    this.#runToken += 1;
    this.#controller?.abort();
    this.#controller = null;
    this.#skipCurrent?.();
    this.#skipCurrent = null;
    if (this.#state.status === 'running') this.#setState({ ...this.#state, status: 'cancelled', step: null });
  }

  reset(): void {
    this.cancel();
    this.#setState({ ...IDLE_STATE });
  }

  #wait(durationMs: number, signal: AbortSignal): Promise<void> {
    if (durationMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        if (this.#skipCurrent === skip) this.#skipCurrent = null;
        fn();
      };
      const onAbort = () => settle(() => reject(new DOMException('Tour cancelled', 'AbortError')));
      const skip = () => settle(resolve);
      const timer = globalThis.setTimeout(() => settle(resolve), durationMs);
      this.#skipCurrent = skip;
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  #assertActive(token: number, signal: AbortSignal): void {
    if (signal.aborted || token !== this.#runToken) throw new DOMException('Tour cancelled', 'AbortError');
  }

  #setState(state: TourState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(this.#state);
  }
}

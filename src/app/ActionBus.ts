import type { AppAction } from './actions';

export type AppActionListener = (action: AppAction) => void;

/**
 * One deterministic action channel for buttons, shortcuts, search commands,
 * briefings, and future external controls. It deliberately contains no
 * feature-specific business logic.
 */
export class ActionBus {
  readonly #listeners = new Set<AppActionListener>();

  dispatch(action: AppAction): void {
    for (const listener of this.#listeners) listener(action);
  }

  subscribe(listener: AppActionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

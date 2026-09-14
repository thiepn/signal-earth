import type { AppState } from './store';

export const selectPrimarySelection = (state: AppState) => state.selection.selectedId;
export const selectVisualMode = (state: AppState) => state.visualMode;
export const selectLayerState = (state: AppState) => state.layers;

export type AtmosphereProductState = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface AtmosphereProductStatus {
  state: AtmosphereProductState;
  requestedTime: number | null;
  loadedTime: number | null;
  error: string | null;
}

export interface AtmosphereStatus {
  clouds: AtmosphereProductStatus;
  precipitation: AtmosphereProductStatus;
}

export interface WeatherLayerSettings {
  clouds: boolean;
  precipitation: boolean;
  stormTracks: boolean;
  opacity: number;
}

export const DEFAULT_WEATHER_SETTINGS: WeatherLayerSettings = {
  clouds: true,
  precipitation: false,
  stormTracks: true,
  opacity: 0.72,
};

export const EMPTY_ATMOSPHERE_STATUS: AtmosphereStatus = {
  clouds: { state: 'idle', requestedTime: null, loadedTime: null, error: null },
  precipitation: { state: 'idle', requestedTime: null, loadedTime: null, error: null },
};

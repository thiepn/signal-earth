export type KpObservationKind = 'observed' | 'estimated' | 'predicted';
export type SpaceWeatherScaleKind = 'G' | 'R' | 'S';

export interface KpSample {
  timestamp: number;
  kp: number;
  kind: KpObservationKind;
  noaaScale: string | null;
}

export interface SolarWindObservation {
  timestamp: number;
  speedKmS: number | null;
  btNt: number | null;
  bzGsmNt: number | null;
}

export interface SpaceWeatherScaleValue {
  scale: number;
  text: string | null;
}

export interface SpaceWeatherScaleSnapshot {
  timestamp: number;
  G: SpaceWeatherScaleValue;
  R: SpaceWeatherScaleValue;
  S: SpaceWeatherScaleValue;
}

export type SwpcMessageKind = 'alert' | 'warning' | 'watch' | 'cancel' | 'message';

export interface SwpcOperationalMessage {
  productId: string;
  issuedAt: number;
  kind: SwpcMessageKind;
  title: string;
  message: string;
}

export interface AuroraModel {
  observationTime: number;
  forecastTime: number;
  /** Packed [longitude degrees, latitude degrees, model value] triples. */
  coordinates: Float32Array;
  pointCount: number;
}

export interface SpaceWeatherFeed {
  fetchedAt: number;
  sourceUpdatedAt: number;
  kp: KpSample[];
  scales: SpaceWeatherScaleSnapshot | null;
  solarWind: SolarWindObservation | null;
  messages: SwpcOperationalMessage[];
  aurora: AuroraModel | null;
  partial: boolean;
  unavailableSources: string[];
}

export interface AuroraHemispheres {
  north: boolean;
  south: boolean;
}

export interface SwpcCombinedRaw {
  kpForecast: unknown | null;
  scales: unknown | null;
  solarWindSpeed: unknown | null;
  solarWindMag: unknown | null;
  alerts: unknown | null;
  aurora: unknown | null;
  fetchedAt: number;
  partial: boolean;
  unavailableSources: string[];
}

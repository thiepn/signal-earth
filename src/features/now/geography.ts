import { greatCircleDistanceKm } from '../../shared/coordinates/geo';
import { SEARCH_CITIES } from '../search/cities';

export interface NearbyCityContext {
  city: string;
  country: string;
  distanceKm: number;
  label: string;
}

export function nearestCityContext(lat: number, lon: number, maxDistanceKm = 900): NearbyCityContext | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best: NearbyCityContext | null = null;
  for (const city of SEARCH_CITIES) {
    const distanceKm = greatCircleDistanceKm({ lat, lon }, city.coordinates);
    if (distanceKm > maxDistanceKm || (best && distanceKm >= best.distanceKm)) continue;
    best = {
      city: city.name,
      country: city.country,
      distanceKm,
      label: `${Math.round(distanceKm).toLocaleString()} km from ${city.name}, ${city.country}`,
    };
  }
  return best;
}

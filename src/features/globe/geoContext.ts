import type { GlobePointOfView } from '../../core/engine/globe.types';
import { SEARCH_CITIES } from '../search/cities';

export interface GeoContextCountry {
  name: string;
  lat: number;
  lon: number;
}

export type GeoContextKind = 'country' | 'city';

export interface GeoContextLabel {
  id: string;
  kind: GeoContextKind;
  name: string;
  lat: number;
  lng: number;
  subtitle: string;
  distanceDeg: number;
  size: number;
  dotRadius: number;
}

const GLOBAL_COUNTRIES = new Set([
  'United States of America', 'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina',
  'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Türkiye', 'Turkey', 'Russia',
  'Egypt', 'Nigeria', 'South Africa', 'Saudi Arabia', 'Iran', 'India', 'China', 'Japan',
  'South Korea', 'Indonesia', 'Australia', 'New Zealand',
]);

const MAJOR_CITIES = new Set([
  'Berlin', 'Paris', 'London', 'Madrid', 'Rome', 'Istanbul', 'Moscow', 'New York', 'Washington',
  'Los Angeles', 'Mexico City', 'Sao Paulo', 'Buenos Aires', 'Cairo', 'Lagos', 'Cape Town', 'Dubai',
  'Riyadh', 'Tehran', 'Delhi', 'Mumbai', 'Beijing', 'Shanghai', 'Tokyo', 'Seoul', 'Bangkok',
  'Singapore', 'Jakarta', 'Sydney', 'Melbourne',
]);

function radians(value: number): number { return value * Math.PI / 180; }

export function angularDistanceDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const lat1 = radians(aLat);
  const lat2 = radians(bLat);
  const deltaLon = radians(((bLon - aLon + 540) % 360) - 180);
  const cos = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

export function geoContextBand(altitude: number): 'global' | 'regional' | 'local' {
  if (altitude >= 2.7) return 'global';
  if (altitude >= 1.15) return 'regional';
  return 'local';
}

export function selectGeoContextLabels(countries: GeoContextCountry[], pointOfView: GlobePointOfView): GeoContextLabel[] {
  const band = geoContextBand(pointOfView.altitude);
  const countryRadius = band === 'global' ? 180 : band === 'regional' ? 80 : 48;
  const countryLimit = band === 'global' ? 26 : band === 'regional' ? 24 : 14;
  const cityRadius = band === 'regional' ? 48 : band === 'local' ? 28 : 0;
  const cityLimit = band === 'regional' ? 12 : band === 'local' ? 24 : 0;

  const countryLabels = countries
    .map((country) => ({ country, distance: angularDistanceDeg(pointOfView.lat, pointOfView.lng, country.lat, country.lon) }))
    .filter(({ country, distance }) => distance <= countryRadius && (band !== 'global' || GLOBAL_COUNTRIES.has(country.name)))
    .sort((a, b) => a.distance - b.distance || a.country.name.localeCompare(b.country.name))
    .slice(0, countryLimit)
    .map(({ country, distance }): GeoContextLabel => ({
      id: `country:${country.name}`,
      kind: 'country',
      name: country.name,
      lat: country.lat,
      lng: country.lon,
      subtitle: 'Country',
      distanceDeg: distance,
      size: band === 'global' ? 0.62 : band === 'regional' ? 0.48 : 0.38,
      dotRadius: 0,
    }));

  if (cityLimit === 0) return countryLabels;

  const cityLabels = SEARCH_CITIES
    .map((city) => ({ city, distance: angularDistanceDeg(pointOfView.lat, pointOfView.lng, city.coordinates.lat, city.coordinates.lon) }))
    .filter(({ city, distance }) => distance <= cityRadius && (band !== 'regional' || MAJOR_CITIES.has(city.name)))
    .sort((a, b) => a.distance - b.distance || a.city.name.localeCompare(b.city.name))
    .slice(0, cityLimit)
    .map(({ city, distance }): GeoContextLabel => ({
      id: `city:${city.name}:${city.country}`,
      kind: 'city',
      name: city.name,
      lat: city.coordinates.lat,
      lng: city.coordinates.lon,
      subtitle: city.country,
      distanceDeg: distance,
      size: band === 'local' ? 0.34 : 0.29,
      dotRadius: band === 'local' ? 0.055 : 0.045,
    }));

  return [...countryLabels, ...cityLabels];
}

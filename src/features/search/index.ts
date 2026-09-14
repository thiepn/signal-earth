import type { EarthquakeRecord } from '../seismic/types';
import type { NaturalEventRecord } from '../natural-events/types';
import type { SatelliteRecord } from '../orbit/types';
import { ORBIT_CATEGORY_LABELS } from '../orbit/types';
import type { SearchCountry } from './countries';
import { SEARCH_CITIES } from './cities';
import { rankSearchDocuments } from './ranking';
import type { RankedSearchResult, SearchDocument } from './types';

const SYSTEM_DOCUMENTS: SearchDocument[] = [
  { id: 'layer:earthquakes', kind: 'layer', title: 'Earthquakes', subtitle: 'USGS seismic layer', keywords: ['quake', 'quakes', 'seismic', 'usgs'], layer: 'earthquakes', priority: 80 },
  { id: 'layer:events', kind: 'layer', title: 'Natural events', subtitle: 'NASA EONET storms, wildfires and volcanoes', keywords: ['events', 'storm', 'storms', 'wildfire', 'wildfires', 'volcano', 'volcanoes', 'eonet'], layer: 'events', priority: 70 },
  { id: 'layer:orbit', kind: 'layer', title: 'Orbit', subtitle: 'CelesTrak satellite layer', keywords: ['satellite', 'satellites', 'space', 'celestrak'], layer: 'orbit', priority: 85 },
  { id: 'layer:aurora', kind: 'layer', title: 'Aurora', subtitle: 'NOAA space-weather layer', keywords: ['aurora', 'space weather', 'kp', 'noaa'], layer: 'aurora', priority: 70 },
  { id: 'mode:earth', kind: 'visual-mode', title: 'Earth mode', subtitle: 'Natural Earth presentation', keywords: ['normal', 'earth mode'], visualMode: 'earth', priority: 30 },
  { id: 'mode:signal', kind: 'visual-mode', title: 'Signal mode', subtitle: 'Technical signal presentation', keywords: ['signal', 'technical'], visualMode: 'signal', priority: 30 },
  { id: 'mode:night', kind: 'visual-mode', title: 'Night mode', subtitle: 'Night Earth and stronger aurora presentation', keywords: ['night', 'dark', 'city lights'], visualMode: 'night', priority: 35 },
  { id: 'mode:wireframe', kind: 'visual-mode', title: 'Wireframe mode', subtitle: 'Minimal technical globe', keywords: ['wire', 'wireframe'], visualMode: 'wireframe', priority: 25 },
  ...Object.entries(ORBIT_CATEGORY_LABELS).filter(([category]) => category !== 'communications').map(([category, label]) => ({
    id: `satcat:${category}`, kind: 'satellite-category' as const, title: `${label} satellites`, subtitle: 'Orbit category', keywords: [category, label.toLowerCase(), category === 'navigation' ? 'gps gnss galileo glonass' : '', category === 'earth-observation' ? 'sentinel landsat earth resources' : ''], satelliteCategory: category as keyof typeof ORBIT_CATEGORY_LABELS, priority: 45,
  })),
];

export interface SearchDataInput {
  earthquakes: EarthquakeRecord[];
  naturalEvents: NaturalEventRecord[];
  satellites: SatelliteRecord[];
  countries: SearchCountry[];
}

export function buildSearchDocuments(input: SearchDataInput): SearchDocument[] {
  const documents: SearchDocument[] = [...SYSTEM_DOCUMENTS];

  for (const city of SEARCH_CITIES) documents.push({
    id: `city:${city.name}:${city.country}`,
    kind: 'city',
    title: city.name,
    subtitle: city.country,
    keywords: [city.country, ...(city.aliases ?? [])],
    coordinates: city.coordinates,
    priority: 55,
  });

  for (const country of input.countries) documents.push({
    id: `country:${country.name}`,
    kind: 'country',
    title: country.name,
    subtitle: 'Country',
    keywords: ['country', 'nation'],
    coordinates: country.coordinates,
    priority: 35,
  });

  for (const earthquake of input.earthquakes) documents.push({
    id: String(earthquake.id), kind: 'earthquake', title: `M${earthquake.magnitude.toFixed(1)} · ${earthquake.place}`, subtitle: `USGS earthquake · ${new Date(earthquake.time).toISOString().slice(0, 16).replace('T', ' ')} UTC`, keywords: [earthquake.place, 'earthquake', 'quake', `m${Math.floor(earthquake.magnitude)}+`, earthquake.network], entityId: earthquake.id, coordinates: { lat: earthquake.coordinates.lat, lon: earthquake.coordinates.lon }, priority: 65 + earthquake.magnitude * 4, timestamp: earthquake.time, magnitude: earthquake.magnitude,
  });

  for (const event of input.naturalEvents) {
    const latest = event.geometry[event.geometry.length - 1];
    documents.push({ id: String(event.id), kind: 'natural-event', title: event.title, subtitle: `NASA EONET · ${event.categoryTitle}`, keywords: [event.category, event.categoryTitle, event.description ?? '', ...event.sources.map((source) => source.id)], entityId: event.id, ...(latest ? { coordinates: { lat: latest.point.lat, lon: latest.point.lon } } : {}), priority: 62, timestamp: event.startTime });
  }

  for (const satellite of input.satellites) documents.push({
    id: String(satellite.id), kind: 'satellite', title: satellite.name, subtitle: `NORAD ${satellite.noradId} · ${satellite.categories.map((category) => ORBIT_CATEGORY_LABELS[category]).join(' · ')}`, keywords: [satellite.noradId, satellite.omm.OBJECT_ID ?? '', ...satellite.categories, ...satellite.categories.map((category) => ORBIT_CATEGORY_LABELS[category])], entityId: satellite.id, satelliteCategory: satellite.category, priority: satellite.noradId === '25544' ? 120 : satellite.categories.includes('stations') ? 75 : 50,
  });

  return documents;
}

export function searchDocuments(documents: SearchDocument[], query: string, limit = 12): RankedSearchResult[] {
  const magnitudeMatch = query.trim().match(/^m\s*(\d(?:\.\d)?)\s*\+$/i);
  if (magnitudeMatch) {
    const min = Number(magnitudeMatch[1]);
    return documents
      .filter((document) => document.kind === 'earthquake' && (document.magnitude ?? -Infinity) >= min)
      .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0) || (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, limit)
      .map((document) => ({ ...document, score: 1000 + (document.magnitude ?? 0) * 10, matches: ['magnitude'] }));
  }
  return rankSearchDocuments(documents, query, limit);
}

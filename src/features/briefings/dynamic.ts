import type { DataSnapshot } from '../../core/data/ProviderAdapter';
import type { Freshness } from '../../core/data/freshness';
import { observerAstronomy, type ObserverAstronomy } from '../above-me/astronomy';
import { auroraModelValueAt } from '../above-me/aurora';
import { loadSavedObserverLocation } from '../above-me/geolocation';
import type { LocalWeather, ObserverLocation } from '../above-me/types';
import { constellationForSatellite } from '../orbit/mechanics';
import type { OrbitCatalog, SatelliteRecord } from '../orbit/types';
import type { NaturalEventFeed, NaturalEventRecord } from '../natural-events/types';
import { filterNaturalEventsAtTime, geometryFrameAt } from '../natural-events/timeline';
import type { EarthquakeFeed, EarthquakeRecord } from '../seismic/types';
import { isAuroraModelApplicable } from '../space-weather/timeline';
import type { KpSample, SpaceWeatherFeed } from '../space-weather/types';
import { EarthquakeService } from '../../providers/usgs';
import { NaturalEventService } from '../../providers/eonet';
import { CelesTrakService } from '../../providers/celestrak';
import { SpaceWeatherService } from '../../providers/swpc';
import { LocalWeatherService } from '../../providers/openmeteo';
import type { BriefingDataState, BriefingDefinition, BriefingId, BriefingStep } from './types';

const earthquakeService = new EarthquakeService();
const naturalEventService = new NaturalEventService();
const orbitService = new CelesTrakService();
const spaceWeatherService = new SpaceWeatherService();
const localWeatherService = new LocalWeatherService();

const HOUR_MS = 60 * 60_000;

export interface ObserverBriefingSnapshot {
  location: ObserverLocation;
  weather: DataSnapshot<LocalWeather> | null;
  astronomy: ObserverAstronomy;
  auroraValue: number | null;
  auroraApplicable: boolean;
}

export interface DynamicBriefingSnapshot {
  generatedAt: number;
  earthquakes: DataSnapshot<EarthquakeFeed> | null;
  naturalEvents: DataSnapshot<NaturalEventFeed> | null;
  orbit: DataSnapshot<OrbitCatalog> | null;
  spaceWeather: DataSnapshot<SpaceWeatherFeed> | null;
  observer: ObserverBriefingSnapshot | null;
  errors: Partial<Record<'usgs' | 'eonet' | 'celestrak' | 'swpc' | 'openmeteo', string>>;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function resultValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function snapshotState(snapshot: DataSnapshot<unknown> | null): BriefingDataState {
  if (!snapshot || snapshot.freshness === 'unavailable') return 'unavailable';
  if (snapshot.freshness === 'stale' || snapshot.freshness === 'aging') return 'partial';
  if (snapshot.freshness === 'cached') return 'cached';
  return 'live';
}

function combinedState(snapshots: Array<DataSnapshot<unknown> | null>): BriefingDataState {
  const states = snapshots.map(snapshotState);
  if (states.every((state) => state === 'unavailable')) return 'unavailable';
  if (states.some((state) => state === 'unavailable' || state === 'partial')) return 'partial';
  if (states.every((state) => state === 'cached')) return 'cached';
  return 'live';
}

function estimateSeconds(steps: BriefingStep[]): number {
  return Math.max(1, Math.round(steps.reduce((total, step) => total + step.holdMs, 0) / 1_000));
}

function compactPlace(value: string): string {
  return value.replace(/^\d+\s*km\s+[NSEW]{1,2}\s+of\s+/i, '').trim();
}

function strongestEarthquake(snapshot: DynamicBriefingSnapshot): EarthquakeRecord | null {
  return (snapshot.earthquakes?.data.earthquakes ?? [])
    .filter((record) => record.magnitude >= 2.5 && record.time <= snapshot.generatedAt)
    .reduce<EarthquakeRecord | null>((best, record) => !best || record.magnitude > best.magnitude ? record : best, null);
}

function featuredNaturalEvent(snapshot: DynamicBriefingSnapshot, category?: NaturalEventRecord['category']): NaturalEventRecord | null {
  const categoryWeight: Record<NaturalEventRecord['category'], number> = { 'severe-storm': 3, volcano: 2, wildfire: 1 };
  const applicable = filterNaturalEventsAtTime(snapshot.naturalEvents?.data.events ?? [], snapshot.generatedAt)
    .filter((event) => !category || event.category === category);
  return [...applicable].sort((a, b) => {
    const aScore = categoryWeight[a.category] * 1_000_000 + a.geometry.length * 10_000 + a.updatedAt / 1e9;
    const bScore = categoryWeight[b.category] * 1_000_000 + b.geometry.length * 10_000 + b.updatedAt / 1e9;
    return bScore - aScore;
  })[0] ?? null;
}

function latestKp(feed: SpaceWeatherFeed | null, now: number): KpSample | null {
  if (!feed) return null;
  return [...feed.kp].filter((sample) => sample.timestamp <= now).sort((a, b) => b.timestamp - a.timestamp)[0] ?? feed.kp.at(-1) ?? null;
}

function scaleLine(feed: SpaceWeatherFeed | null): string {
  if (!feed?.scales) return 'G/R/S operational scales unavailable';
  return `G${feed.scales.G.scale} · R${feed.scales.R.scale} · S${feed.scales.S.scale}`;
}

function hasIss(catalog: OrbitCatalog | null): boolean {
  return Boolean(catalog?.satellites.some((satellite) => satellite.noradId === '25544' || /ISS \(ZARYA\)|INTERNATIONAL SPACE STATION/i.test(satellite.name)));
}

function constellationLeaders(catalog: OrbitCatalog | null): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const satellite of catalog?.satellites ?? []) {
    const constellation = constellationForSatellite(satellite.name);
    if (constellation) counts.set(constellation, (counts.get(constellation) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function availableTarget(catalog: OrbitCatalog | null, target: 'weather' | 'navigation' | 'earth-observation' | 'science'): SatelliteRecord | null {
  return catalog?.satellites.find((satellite) => satellite.categories.includes(target)) ?? null;
}

function dynamicDefinition(base: Omit<BriefingDefinition, 'estimatedSeconds'> & { steps: BriefingStep[] }): BriefingDefinition {
  return { ...base, estimatedSeconds: estimateSeconds(base.steps) };
}

function earthNow(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const quakes = snapshot.earthquakes?.data.earthquakes.filter((record) => record.time <= snapshot.generatedAt) ?? [];
  const events = filterNaturalEventsAtTime(snapshot.naturalEvents?.data.events ?? [], snapshot.generatedAt);
  const strongest = strongestEarthquake(snapshot);
  const featured = featuredNaturalEvent(snapshot);
  const kp = latestKp(snapshot.spaceWeather?.data ?? null, snapshot.generatedAt);
  const satellites = snapshot.orbit?.data.satellites.length ?? 0;
  const steps: BriefingStep[] = [{
    id: 'earth-overview', eyebrow: 'EARTH RIGHT NOW', title: 'The current planetary picture',
    body: `${quakes.length.toLocaleString()} USGS earthquakes are present in the loaded day feed, ${events.length.toLocaleString()} NASA EONET events are applicable now, and ${satellites.toLocaleString()} curated CelesTrak objects are available${kp ? `; NOAA Kp is ${kp.kp.toFixed(1)} (${kp.kind})` : ''}.`,
    holdMs: 5_000,
    instructions: [{ type: 'return-live' }, { type: 'set-speed', speed: 1 }, { type: 'set-visual-mode', mode: 'earth' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 18, lng: 8, altitude: 2.25, durationMs: 1_200 }],
  }];
  if (strongest) steps.push({ id: 'earth-quake', eyebrow: 'SEISMIC HIGHLIGHT', title: `M${strongest.magnitude.toFixed(1)} · ${compactPlace(strongest.place)}`, body: `This is the strongest ≥M2.5 earthquake in the loaded USGS day feed. Depth ${strongest.coordinates.depthKm.toFixed(0)} km${strongest.tsunami ? ' · USGS tsunami flag present' : ''}.`, holdMs: 6_500, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] });
  if (featured) steps.push({ id: 'earth-event', eyebrow: featured.categoryTitle.toUpperCase(), title: featured.title, body: `NASA EONET currently supplies ${featured.geometry.length} source geometry report${featured.geometry.length === 1 ? '' : 's'} for this ${featured.categoryTitle.toLowerCase()} record. Signal Earth does not extrapolate the source track.`, holdMs: 6_500, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] });
  if (snapshot.spaceWeather) steps.push({ id: 'earth-space', eyebrow: 'SPACE WEATHER', title: kp ? `Kp ${kp.kp.toFixed(1)} · ${scaleLine(snapshot.spaceWeather.data)}` : scaleLine(snapshot.spaceWeather.data), body: `NOAA SWPC context is ${snapshot.spaceWeather.freshness}. ${snapshot.spaceWeather.data.aurora ? 'An OVATION aurora model is loaded and will only render inside its validity window.' : 'No OVATION aurora model is currently available.'}`, holdMs: 5_500, instructions: [{ type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'set-visual-mode', mode: 'night' }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 63, lng: 5, altitude: 2.0, durationMs: 1_200 }] });
  if (hasIss(snapshot.orbit?.data ?? null)) steps.push({ id: 'earth-orbit', eyebrow: 'LOW EARTH ORBIT', title: 'International Space Station', body: 'The closing orbital handoff uses the current cached CelesTrak element set and local propagation rather than a measured live spacecraft position.', holdMs: 6_500, instructions: [{ type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }] });
  steps.push({ id: 'earth-return', eyebrow: 'GLOBAL OVERVIEW', title: 'Observed, propagated and modeled', body: 'The tour returns to a global view while keeping each provider’s temporal semantics distinct.', holdMs: 3_500, instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', durationMs: 1_000 }] });
  return dynamicDefinition({ id: 'earth-now', eyebrow: 'LIVE DATA BRIEFING', title: 'Earth Right Now', description: strongest ? `Current Earth signals led by M${strongest.magnitude.toFixed(1)} near ${compactPlace(strongest.place)}.` : 'A current provider-driven tour of Earth and near-Earth signals.', steps, dataDriven: true, dataState: combinedState([snapshot.earthquakes, snapshot.naturalEvents, snapshot.spaceWeather, snapshot.orbit]), dataSummary: `${quakes.length} quakes · ${events.length} EONET events · ${satellites.toLocaleString()} orbit objects`, generatedAt: snapshot.generatedAt, available: true });
}

function seismicNow(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const records = snapshot.earthquakes?.data.earthquakes.filter((record) => record.time <= snapshot.generatedAt) ?? [];
  const strongest = strongestEarthquake(snapshot);
  const m5 = records.filter((record) => record.magnitude >= 5).length;
  const m4 = records.filter((record) => record.magnitude >= 4).length;
  const steps: BriefingStep[] = [{ id: 'seismic-stage', eyebrow: 'SEISMIC ACTIVITY', title: `${records.length.toLocaleString()} earthquakes in the loaded day feed`, body: `${m5} are M5.0+ and ${m4} are M4.0+. Counts are taken directly from the current USGS day snapshot.`, holdMs: 5_000, instructions: [{ type: 'return-live' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.1 }] }];
  if (strongest) steps.push({ id: 'seismic-strongest', eyebrow: 'STRONGEST EVENT', title: `M${strongest.magnitude.toFixed(1)} · ${compactPlace(strongest.place)}`, body: `USGS reports a depth of ${strongest.coordinates.depthKm.toFixed(1)} km${strongest.felt ? ` and ${strongest.felt.toLocaleString()} felt report${strongest.felt === 1 ? '' : 's'}` : ''}.`, holdMs: 7_000, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] });
  steps.push({ id: 'seismic-return', eyebrow: 'GLOBAL FIELD', title: 'The last day in context', body: 'Return to the global earthquake field; magnitude and impact are not inferred beyond USGS fields.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.15 }] });
  return dynamicDefinition({ id: 'seismic-now', eyebrow: 'LIVE SEISMIC BRIEFING', title: 'Seismic Activity', description: strongest ? `Largest loaded event: M${strongest.magnitude.toFixed(1)} near ${compactPlace(strongest.place)}.` : 'Current USGS day-scale earthquake activity.', steps, dataDriven: true, dataState: snapshotState(snapshot.earthquakes), dataSummary: `${records.length} day-feed events · ${m5} M5+`, generatedAt: snapshot.generatedAt, available: Boolean(snapshot.earthquakes) });
}

function stormWatch(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const storms = filterNaturalEventsAtTime(snapshot.naturalEvents?.data.events ?? [], snapshot.generatedAt).filter((event) => event.category === 'severe-storm');
  const featured = featuredNaturalEvent(snapshot, 'severe-storm');
  const latestFrame = featured ? geometryFrameAt(featured, snapshot.generatedAt) : null;
  const steps: BriefingStep[] = [{ id: 'storm-stage', eyebrow: 'ACTIVE STORMS', title: `${storms.length} source-observed severe-storm record${storms.length === 1 ? '' : 's'}`, body: 'The tour filters NASA EONET to severe storms only. EONET geometry is historical source reporting, not an extrapolated forecast track.', holdMs: 5_000, instructions: [{ type: 'return-live' }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'set-natural-event-categories', categories: ['severe-storm'] }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.15 }] }];
  if (featured) steps.push({ id: 'storm-featured', eyebrow: 'FEATURED STORM', title: featured.title, body: `${featured.geometry.length} source geometry report${featured.geometry.length === 1 ? '' : 's'} are loaded${latestFrame ? `; the latest applicable report is from ${new Date(latestFrame.timestamp).toLocaleString()}` : ''}.`, holdMs: 7_000, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] });
  steps.push({ id: 'storm-return', eyebrow: 'STORM FIELD', title: 'Observed tracks, no invented motion', body: 'The global view retains only source-observed storm geometry at the selected time.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.2 }] });
  return dynamicDefinition({ id: 'storm-watch', eyebrow: 'LIVE EVENT BRIEFING', title: 'Active Storms', description: featured ? `Current EONET storm highlight: ${featured.title}.` : 'Current NASA EONET severe-storm observations.', steps, dataDriven: true, dataState: snapshotState(snapshot.naturalEvents), dataSummary: `${storms.length} applicable severe-storm records`, generatedAt: snapshot.generatedAt, available: Boolean(snapshot.naturalEvents) });
}

function spaceWeatherNow(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const feed = snapshot.spaceWeather?.data ?? null;
  const kp = latestKp(feed, snapshot.generatedAt);
  const messages = feed?.messages.filter((message) => snapshot.generatedAt - message.issuedAt <= 24 * HOUR_MS) ?? [];
  const title = kp ? `Kp ${kp.kp.toFixed(1)} · ${scaleLine(feed)}` : scaleLine(feed);
  const steps: BriefingStep[] = [
    { id: 'space-stage', eyebrow: 'SPACE WEATHER NOW', title, body: kp ? `The latest applicable Kp value is ${kp.kp.toFixed(1)} and is marked ${kp.kind}. ${feed?.solarWind?.speedKmS ? `Solar wind is ${Math.round(feed.solarWind.speedKmS)} km/s.` : ''}` : 'No applicable Kp sample is available in the loaded NOAA snapshot.', holdMs: 6_000, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: 'night' }, { type: 'set-layer', layer: 'aurora', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 67, lng: 15, altitude: 1.75 }] },
    { id: 'space-aurora', eyebrow: 'OVATION', title: feed?.aurora ? 'Aurora model loaded' : 'Aurora model unavailable', body: feed?.aurora ? `NOAA OVATION forecast time: ${new Date(feed.aurora.forecastTime).toLocaleString()}. Rendering remains validity-window constrained.` : 'The current NOAA snapshot does not include usable OVATION coordinates.', holdMs: 6_000, instructions: [{ type: 'frame-earth', lat: 70, lng: 10, altitude: 1.6 }] },
    { id: 'space-return', eyebrow: 'OPERATIONAL CONTEXT', title: `${messages.length} NOAA operational message${messages.length === 1 ? '' : 's'} in the last 24h`, body: 'G/R/S scales, Kp, solar wind and aurora products have different semantics and remain separately sourced.', holdMs: 4_000, instructions: [{ type: 'frame-earth', lat: 35, lng: -10, altitude: 2.25 }] },
  ];
  return dynamicDefinition({ id: 'space-weather-now', eyebrow: 'LIVE SPACE-WEATHER BRIEFING', title: 'Space Weather', description: kp ? `NOAA Kp ${kp.kp.toFixed(1)} with ${scaleLine(feed)}.` : 'Current NOAA SWPC operational context.', steps, dataDriven: true, dataState: snapshotState(snapshot.spaceWeather), dataSummary: kp ? `Kp ${kp.kp.toFixed(1)} ${kp.kind} · ${scaleLine(feed)}` : scaleLine(feed), generatedAt: snapshot.generatedAt, available: Boolean(snapshot.spaceWeather) });
}

function aboveMe(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const observer = snapshot.observer;
  if (!observer) return {
    id: 'above-me', eyebrow: 'OBSERVER BRIEFING', title: 'Above Me', description: 'Local sky context requires a remembered observer coordinate.', estimatedSeconds: 0, steps: [], dataDriven: true, dataState: 'unavailable', dataSummary: 'No remembered observer coordinate', generatedAt: snapshot.generatedAt, available: false, unavailableReason: 'Signal Earth will not request location merely to build a briefing. Open Above Me and explicitly enable “Remember this coordinate” first.',
  };
  const sun = observer.astronomy.sun;
  const moon = observer.astronomy.moon;
  const weather = observer.weather?.data ?? null;
  const cloud = weather?.cloudCoverPct;
  const night = sun.elevationDeg < -6;
  const aurora = observer.auroraApplicable && observer.auroraValue !== null ? `${observer.auroraValue.toFixed(0)} model value` : 'outside current model context';
  const steps: BriefingStep[] = [
    { id: 'observer-stage', eyebrow: 'ABOVE ME', title: night ? 'Your local night sky' : 'Your local daylight sky', body: `Sun elevation ${sun.elevationDeg.toFixed(1)}° · Moon ${Math.round(moon.illuminatedFraction * 100)}% illuminated (${moon.phaseName}).`, holdMs: 5_500, instructions: [{ type: 'return-live' }, { type: 'set-visual-mode', mode: night ? 'night' : 'earth' }, { type: 'clear-selection' }, { type: 'frame-earth', lat: observer.location.lat, lng: observer.location.lon, altitude: 0.68, durationMs: 1_200 }] },
    { id: 'observer-weather', eyebrow: 'CURRENT CONDITIONS', title: cloud === null || cloud === undefined ? 'Cloud cover unavailable' : `${Math.round(cloud)}% cloud cover`, body: weather ? `Open-Meteo current conditions: ${weather.temperatureC === null ? 'temperature unavailable' : `${weather.temperatureC.toFixed(1)}°C`}${weather.windSpeedKmh === null ? '' : ` · wind ${Math.round(weather.windSpeedKmh)} km/h`}. Current weather is not projected into future observing conditions.` : 'Current local weather could not be loaded; astronomical geometry remains available.', holdMs: 5_000, instructions: [{ type: 'set-layer', layer: 'weather', enabled: true }] },
    { id: 'observer-aurora', eyebrow: 'AURORA AT OBSERVER', title: aurora, body: observer.auroraApplicable ? 'Nearest NOAA OVATION cell is shown as model context only; it is not a guarantee of ground-level aurora visibility.' : 'The loaded NOAA OVATION model is not applicable to the current observer time.', holdMs: 5_000, instructions: [{ type: 'set-layer', layer: 'aurora', enabled: true }] },
  ];
  return dynamicDefinition({ id: 'above-me', eyebrow: 'OBSERVER BRIEFING', title: 'Above Me', description: `${night ? 'Night' : 'Daylight'} at the remembered observer coordinate · Moon ${Math.round(moon.illuminatedFraction * 100)}%.`, steps, dataDriven: true, dataState: combinedState([observer.weather, snapshot.spaceWeather]), dataSummary: `${night ? 'Night' : 'Day'} · ${cloud === null || cloud === undefined ? 'cloud n/a' : `${Math.round(cloud)}% cloud`} · aurora ${aurora}`, generatedAt: snapshot.generatedAt, available: true });
}

function orbitNow(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const catalog = snapshot.orbit?.data ?? null;
  const total = catalog?.satellites.length ?? 0;
  const leaders = constellationLeaders(catalog);
  const lead = leaders[0] ?? null;
  const steps: BriefingStep[] = [{ id: 'orbit-stage', eyebrow: 'ORBIT HIGHLIGHTS', title: `${total.toLocaleString()} curated orbital objects`, body: lead ? `${lead.name} is the largest locally recognized program in this loaded catalog with ${lead.count.toLocaleString()} objects. Positions are propagated from CelesTrak OMM elements.` : 'The current curated catalog is staged across stations, weather, navigation, Earth-observation and science groups.', holdMs: 5_000, instructions: [{ type: 'return-live' }, { type: 'set-speed', speed: 1 }, { type: 'set-visual-mode', mode: 'signal' }, { type: 'set-layer', layer: 'orbit', enabled: true }, { type: 'set-orbit-categories', categories: ['stations', 'weather', 'earth-observation', 'navigation', 'science'] }, { type: 'clear-selection' }, { type: 'frame-earth', lat: 15, lng: 0, altitude: 2.55 }] }];
  if (hasIss(catalog)) steps.push({ id: 'orbit-iss', eyebrow: 'STATIONS', title: 'International Space Station', body: 'The ISS provides a low-Earth-orbit reference for the rest of the catalog.', holdMs: 7_000, instructions: [{ type: 'select-satellite', target: 'iss' }, { type: 'follow-selected-satellite' }] });
  if (availableTarget(catalog, 'weather')) steps.push({ id: 'orbit-weather', eyebrow: 'WEATHER', title: 'Meteorological orbit', body: `${catalog!.categoryCounts.weather.toLocaleString()} loaded objects are tagged for weather context. A representative mission is framed by its orbital plane.`, holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'weather' }, { type: 'frame-selected-orbit' }] });
  if (availableTarget(catalog, 'navigation')) steps.push({ id: 'orbit-navigation', eyebrow: 'NAVIGATION', title: 'Navigation constellation scale', body: `${catalog!.categoryCounts.navigation.toLocaleString()} loaded objects carry navigation context; their MEO scale contrasts strongly with the ISS.` , holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'navigation' }, { type: 'frame-selected-orbit' }] });
  if (availableTarget(catalog, 'earth-observation')) steps.push({ id: 'orbit-earth', eyebrow: 'EARTH OBSERVATION', title: 'Watching the planet', body: `${catalog!.categoryCounts['earth-observation'].toLocaleString()} loaded objects are tagged for Earth observation.`, holdMs: 7_000, instructions: [{ type: 'stop-camera' }, { type: 'select-satellite', target: 'earth-observation' }, { type: 'frame-selected-orbit' }] });
  steps.push({ id: 'orbit-return', eyebrow: 'ORBITAL CONTEXT', title: 'One catalog, multiple regimes', body: 'Orbit 2.0 keeps true altitude, derived mechanics and propagated position distinct from any visual exaggeration.', holdMs: 3_500, instructions: [{ type: 'stop-camera' }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.65 }] });
  return dynamicDefinition({ id: 'orbit-now', eyebrow: 'LIVE ORBIT BRIEFING', title: 'Orbit Highlights', description: lead ? `${total.toLocaleString()} objects · ${lead.name} leads recognized programs.` : `${total.toLocaleString()} curated CelesTrak objects.`, steps, dataDriven: true, dataState: snapshotState(snapshot.orbit), dataSummary: lead ? `${total.toLocaleString()} objects · ${lead.name} ${lead.count.toLocaleString()}` : `${total.toLocaleString()} catalog objects`, generatedAt: snapshot.generatedAt, available: Boolean(snapshot.orbit) });
}

function last24Hours(snapshot: DynamicBriefingSnapshot): BriefingDefinition {
  const quakes = snapshot.earthquakes?.data.earthquakes.filter((record) => snapshot.generatedAt - record.time <= 24 * HOUR_MS && record.time <= snapshot.generatedAt) ?? [];
  const strongest = strongestEarthquake(snapshot);
  const events = filterNaturalEventsAtTime(snapshot.naturalEvents?.data.events ?? [], snapshot.generatedAt).filter((event) => snapshot.generatedAt - event.updatedAt <= 24 * HOUR_MS || snapshot.generatedAt - event.startTime <= 24 * HOUR_MS);
  const featured = featuredNaturalEvent(snapshot);
  const steps: BriefingStep[] = [{ id: 'day-stage', eyebrow: 'LAST 24 HOURS', title: `${quakes.length} earthquakes · ${events.length} recently active EONET records`, body: 'This recap is composed from the current USGS day feed and NASA EONET source timestamps. It is a summary, not a fabricated continuous replay.', holdMs: 5_500, instructions: [{ type: 'return-live' }, { type: 'set-earthquake-filter', magnitude: 2.5, window: 'day' }, { type: 'set-layer', layer: 'earthquakes', enabled: true }, { type: 'set-layer', layer: 'events', enabled: true }, { type: 'clear-selection' }, { type: 'frame-earth', altitude: 2.25 }] }];
  if (strongest) steps.push({ id: 'day-quake', eyebrow: 'SEISMIC HIGHLIGHT', title: `M${strongest.magnitude.toFixed(1)} · ${compactPlace(strongest.place)}`, body: `Largest ≥M2.5 event in the loaded 24-hour USGS snapshot; depth ${strongest.coordinates.depthKm.toFixed(0)} km.`, holdMs: 7_000, instructions: [{ type: 'select-strongest-earthquake' }, { type: 'focus-selection' }] });
  if (featured) steps.push({ id: 'day-event', eyebrow: 'NATURAL-EVENT HIGHLIGHT', title: featured.title, body: `${featured.categoryTitle} · ${featured.geometry.length} source geometry report${featured.geometry.length === 1 ? '' : 's'} currently loaded.`, holdMs: 7_000, instructions: [{ type: 'select-featured-natural-event' }, { type: 'focus-selection' }] });
  steps.push({ id: 'day-return', eyebrow: '24-HOUR RECAP', title: 'Back to live time', body: 'The recap ends at the current wall-clock view and restores the user’s pre-briefing state afterward.', holdMs: 4_000, instructions: [{ type: 'clear-selection' }, { type: 'return-live' }, { type: 'frame-earth' }] });
  return dynamicDefinition({ id: 'last-24h', eyebrow: 'DATA RECAP', title: 'Last 24 Hours', description: strongest ? `${quakes.length} USGS events; largest M${strongest.magnitude.toFixed(1)} near ${compactPlace(strongest.place)}.` : `${quakes.length} USGS events and ${events.length} recently active EONET records.`, steps, dataDriven: true, dataState: combinedState([snapshot.earthquakes, snapshot.naturalEvents]), dataSummary: `${quakes.length} quakes · ${events.length} recently active events`, generatedAt: snapshot.generatedAt, available: Boolean(snapshot.earthquakes || snapshot.naturalEvents) });
}

export function buildDynamicBriefings(snapshot: DynamicBriefingSnapshot): Partial<Record<BriefingId, BriefingDefinition>> {
  return {
    'earth-now': earthNow(snapshot),
    'seismic-now': seismicNow(snapshot),
    'storm-watch': stormWatch(snapshot),
    'space-weather-now': spaceWeatherNow(snapshot),
    'above-me': aboveMe(snapshot),
    'orbit-now': orbitNow(snapshot),
    'last-24h': last24Hours(snapshot),
  };
}

export async function loadDynamicBriefingSnapshot(signal?: AbortSignal): Promise<DynamicBriefingSnapshot> {
  const generatedAt = Date.now();
  const [earthquakesResult, naturalEventsResult, orbitResult, spaceWeatherResult] = await Promise.allSettled([
    earthquakeService.load('day', { ...(signal ? { signal } : {}) }),
    naturalEventService.load({ ...(signal ? { signal } : {}) }),
    orbitService.load({ ...(signal ? { signal } : {}) }),
    spaceWeatherService.load({ ...(signal ? { signal } : {}) }),
  ]);
  if (signal?.aborted) throw new DOMException('Briefing refresh cancelled', 'AbortError');

  const earthquakes = resultValue(earthquakesResult);
  const naturalEvents = resultValue(naturalEventsResult);
  const orbit = resultValue(orbitResult);
  const spaceWeather = resultValue(spaceWeatherResult);
  const errors: DynamicBriefingSnapshot['errors'] = {};
  if (earthquakesResult.status === 'rejected') errors.usgs = errorMessage(earthquakesResult.reason);
  if (naturalEventsResult.status === 'rejected') errors.eonet = errorMessage(naturalEventsResult.reason);
  if (orbitResult.status === 'rejected') errors.celestrak = errorMessage(orbitResult.reason);
  if (spaceWeatherResult.status === 'rejected') errors.swpc = errorMessage(spaceWeatherResult.reason);

  let observer: ObserverBriefingSnapshot | null = null;
  const location = loadSavedObserverLocation();
  if (location) {
    let weather: DataSnapshot<LocalWeather> | null = null;
    try {
      weather = await localWeatherService.load(location.lat, location.lon, { ...(signal ? { signal } : {}) });
    } catch (error) {
      if (signal?.aborted) throw error;
      errors.openmeteo = errorMessage(error);
    }
    const astronomy = observerAstronomy(location.lat, location.lon, generatedAt);
    const auroraApplicable = Boolean(spaceWeather?.data.aurora && isAuroraModelApplicable(spaceWeather.data.aurora, generatedAt));
    const auroraValue = auroraApplicable ? auroraModelValueAt(spaceWeather?.data.aurora ?? null, location.lat, location.lon) : null;
    observer = { location, weather, astronomy, auroraValue, auroraApplicable };
  }

  return { generatedAt, earthquakes, naturalEvents, orbit, spaceWeather, observer, errors };
}

export async function composeDynamicBriefings(signal?: AbortSignal): Promise<{ snapshot: DynamicBriefingSnapshot; definitions: Partial<Record<BriefingId, BriefingDefinition>> }> {
  const snapshot = await loadDynamicBriefingSnapshot(signal);
  return { snapshot, definitions: buildDynamicBriefings(snapshot) };
}

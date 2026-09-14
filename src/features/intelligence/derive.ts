import type { NaturalEventGeometryFrame, NaturalEventRecord } from '../natural-events/types';
import type { SatelliteRecord, SatelliteTelemetry } from '../orbit/types';
import type { EarthquakeRecord } from '../seismic/types';
import type { KpSample, SolarWindObservation, SpaceWeatherScaleSnapshot } from '../space-weather/types';
import type { IntelligenceFact, IntelligenceTone, SignalIntelligence } from './types';

const EARTH_RADIUS_KM = 6_371;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRadians = Math.PI / 180;
  const lat1 = a.lat * toRadians;
  const lat2 = b.lat * toRadians;
  const dLat = (b.lat - a.lat) * toRadians;
  const dLon = (b.lon - a.lon) * toRadians;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function compactDuration(milliseconds: number): string {
  const value = Math.max(0, milliseconds);
  if (value < HOUR_MS) return `${Math.max(1, Math.round(value / 60_000))} min`;
  if (value < DAY_MS) return `${Math.round(value / HOUR_MS)} h`;
  const days = value / DAY_MS;
  return days < 10 ? `${days.toFixed(1)} d` : `${Math.round(days)} d`;
}

function formatDistance(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function earthquakeDepthLabel(depthKm: number): string {
  if (depthKm < 70) return 'Shallow';
  if (depthKm < 300) return 'Intermediate-depth';
  return 'Deep';
}

function earthquakeMagnitudeLabel(magnitude: number): string {
  if (magnitude >= 8) return 'Very large';
  if (magnitude >= 7) return 'Major';
  if (magnitude >= 6) return 'Strong';
  if (magnitude >= 5) return 'Moderate';
  if (magnitude >= 4) return 'Light';
  return 'Lower-magnitude';
}

function earthquakeTone(record: EarthquakeRecord): IntelligenceTone {
  if (record.alert === 'red' || (record.tsunami && record.magnitude >= 7.5)) return 'critical';
  if (record.alert === 'orange' || record.magnitude >= 7 || (record.mmi ?? 0) >= 7) return 'high';
  if (record.alert === 'yellow' || record.magnitude >= 5 || record.tsunami || (record.mmi ?? 0) >= 5) return 'watch';
  return 'neutral';
}

export function buildEarthquakeIntelligence(record: EarthquakeRecord): SignalIntelligence {
  const magnitude = earthquakeMagnitudeLabel(record.magnitude);
  const depth = earthquakeDepthLabel(record.coordinates.depthKm);
  const cues: string[] = [];
  if (record.alert && record.alert !== 'green') cues.push(`${record.alert.toUpperCase()} USGS alert`);
  if (record.tsunami) cues.push('tsunami flag present');
  if ((record.mmi ?? 0) >= 5) cues.push(`MMI ${record.mmi!.toFixed(1)} instrumental intensity`);
  if ((record.felt ?? 0) > 0) cues.push(`${record.felt!.toLocaleString()} felt report${record.felt === 1 ? '' : 's'}`);
  if (!cues.length) cues.push(`USGS significance score ${record.significance}`);

  const facts: IntelligenceFact[] = [
    { label: 'Depth regime', value: `${depth} · ${record.coordinates.depthKm.toFixed(1)} km` },
    { label: 'USGS significance', value: record.significance.toLocaleString(), note: 'Provider-supplied event significance score' },
    { label: 'Instrumental intensity', value: record.mmi === null ? 'Not reported' : `MMI ${record.mmi.toFixed(1)}` },
    { label: 'Public reports', value: record.felt === null ? 'Not reported' : record.felt.toLocaleString() },
  ];

  return {
    eyebrow: 'SIGNAL INTELLIGENCE · EARTHQUAKE',
    title: `${magnitude} ${depth.toLowerCase()} earthquake`,
    summary: `${cues.join(' · ')}. The tsunami field is a provider flag, not a claim that a tsunami occurred.`,
    tone: earthquakeTone(record),
    facts,
    methodology: 'Derived only from USGS magnitude, depth, MMI, felt-report, alert, tsunami-flag and significance fields.',
  };
}

function framesAt(event: NaturalEventRecord, simulationTime: number): NaturalEventGeometryFrame[] {
  return event.geometry.filter((frame) => frame.timestamp <= simulationTime);
}

function cumulativeTrackDistance(frames: NaturalEventGeometryFrame[]): number {
  let distance = 0;
  for (let index = 1; index < frames.length; index += 1) {
    distance += haversineKm(frames[index - 1]!.point, frames[index]!.point);
  }
  return distance;
}

function eventCategoryLabel(event: NaturalEventRecord): string {
  if (event.category === 'severe-storm') return 'Severe storm';
  if (event.category === 'wildfire') return 'Wildfire';
  return 'Volcanic event';
}

export function buildNaturalEventIntelligence(event: NaturalEventRecord, simulationTime: number): SignalIntelligence {
  const applicable = framesAt(event, simulationTime);
  const first = applicable[0] ?? null;
  const latest = applicable[applicable.length - 1] ?? null;
  const previous = applicable.length > 1 ? applicable[applicable.length - 2]! : null;
  const effectiveEnd = Math.min(simulationTime, event.closedAt ?? simulationTime);
  const duration = Math.max(0, effectiveEnd - event.startTime);
  const displacement = first && latest ? haversineKm(first.point, latest.point) : 0;
  const trackDistance = cumulativeTrackDistance(applicable);
  const latestShift = previous && latest ? haversineKm(previous.point, latest.point) : 0;
  const category = eventCategoryLabel(event);
  const status = event.closedAt !== null && event.closedAt <= simulationTime ? 'Closed' : 'Open';

  const facts: IntelligenceFact[] = [
    { label: 'Observed duration', value: compactDuration(duration) },
    { label: 'Geometry reports', value: applicable.length.toLocaleString(), note: 'Reports available at the selected simulation time' },
    { label: 'First → latest', value: first && latest ? formatDistance(displacement) : 'Not available', note: 'Representative-point displacement, not footprint size' },
    { label: 'Reported track', value: applicable.length > 1 ? formatDistance(trackDistance) : 'Not available', note: 'Cumulative representative-point path' },
  ];

  let summary = `${status} ${category.toLowerCase()} record with ${applicable.length} source geometry report${applicable.length === 1 ? '' : 's'} available at the selected time.`;
  if (event.category === 'severe-storm' && previous && latest) {
    const intervalHours = Math.max(0, (latest.timestamp - previous.timestamp) / HOUR_MS);
    const average = intervalHours > 0 ? latestShift / intervalHours : 0;
    summary += ` The latest reported center shifted ${formatDistance(latestShift)} since the previous observation${average > 0 ? ` (~${Math.round(average)} km/h between those reports)` : ''}.`;
  } else if (first && latest && applicable.length > 1) {
    summary += ` The representative location is ${formatDistance(displacement)} from the first available report.`;
  }
  if (latest?.magnitudeValue !== null && latest?.magnitudeValue !== undefined) {
    summary += ` Latest source magnitude: ${latest.magnitudeValue}${latest.magnitudeUnit ? ` ${latest.magnitudeUnit}` : ''}.`;
  }

  return {
    eyebrow: `SIGNAL INTELLIGENCE · ${event.category.replace('-', ' ').toUpperCase()}`,
    title: `${status} ${category.toLowerCase()} · ${compactDuration(duration)}`,
    summary,
    tone: status === 'Open' ? 'watch' : 'neutral',
    facts,
    methodology: 'Derived from NASA EONET status and time-indexed source geometry. Distances use representative geometry points and do not estimate impact area.',
  };
}

function orbitBand(altitudeKm: number): string {
  if (altitudeKm < 2_000) return 'Low Earth orbit';
  if (altitudeKm < 30_000) return 'Medium Earth orbit';
  if (altitudeKm < 40_000) return 'Geosynchronous-altitude orbit';
  return 'High Earth orbit';
}

function eccentricityLabel(eccentricity: number): string {
  if (eccentricity < 0.01) return 'Near-circular';
  if (eccentricity < 0.1) return 'Low-eccentricity';
  return 'Elliptical';
}

function periodLabel(minutes: number): string {
  if (minutes >= 180) return `${(minutes / 60).toFixed(minutes >= 1_000 ? 1 : 2)} h`;
  return `${minutes.toFixed(1)} min`;
}

export function buildSatelliteIntelligence(satellite: SatelliteRecord, telemetry: SatelliteTelemetry): SignalIntelligence {
  const meanMotion = satellite.omm.MEAN_MOTION;
  const periodMinutes = meanMotion > 0 ? 1_440 / meanMotion : Number.NaN;
  const inclination = satellite.omm.INCLINATION;
  const eccentricity = satellite.omm.ECCENTRICITY;
  const epochOffsetHours = (telemetry.timestamp - satellite.epoch) / HOUR_MS;
  const band = orbitBand(telemetry.altitudeKm);
  const eccentricityClass = eccentricityLabel(eccentricity);
  const period = Number.isFinite(periodMinutes) ? periodLabel(periodMinutes) : 'Unavailable';
  const epochOffset = `${Math.abs(epochOffsetHours).toFixed(Math.abs(epochOffsetHours) >= 10 ? 0 : 1)} h ${epochOffsetHours >= 0 ? 'after' : 'before'} element epoch`;

  return {
    eyebrow: 'SIGNAL INTELLIGENCE · ORBIT',
    title: `${band} · ${period} period`,
    summary: `${eccentricityClass} orbit at ${inclination.toFixed(1)}° inclination. The displayed position is propagated locally from the loaded CelesTrak OMM element set, not a measured live position.`,
    tone: Math.abs(epochOffsetHours) > 24 ? 'watch' : 'neutral',
    facts: [
      { label: 'Orbital period', value: period, note: 'Derived from OMM mean motion' },
      { label: 'Inclination', value: `${inclination.toFixed(2)}°` },
      { label: 'Eccentricity', value: eccentricity.toFixed(5), note: eccentricityClass },
      { label: 'Element timing', value: epochOffset },
    ],
    methodology: 'Derived from CelesTrak OMM mean motion, inclination, eccentricity and element epoch plus the locally propagated telemetry frame.',
  };
}

export interface SpaceWeatherIntelligenceInput {
  kp: KpSample | null;
  scales: SpaceWeatherScaleSnapshot | null;
  solarWind: SolarWindObservation | null;
  scalesApplicable: boolean;
  solarWindApplicable: boolean;
  auroraApplicable: boolean;
}

function scaleFacts(scales: SpaceWeatherScaleSnapshot | null, applicable: boolean): IntelligenceFact[] {
  return (['G', 'R', 'S'] as const).map((kind) => ({
    label: `${kind} scale`,
    value: applicable && scales ? `${kind}${scales[kind].scale}` : 'Not applicable',
    ...(applicable && scales?.[kind].text ? { note: scales[kind].text! } : {}),
  }));
}

export function buildSpaceWeatherIntelligence(input: SpaceWeatherIntelligenceInput): SignalIntelligence {
  const scaleValues = input.scalesApplicable && input.scales
    ? (['G', 'R', 'S'] as const).map((kind) => ({ kind, value: input.scales![kind].scale }))
    : [];
  const strongest = scaleValues.sort((a, b) => b.value - a.value)[0] ?? null;
  const kpValue = input.kp?.kp ?? null;
  const kpStorm = kpValue !== null && kpValue >= 5;
  const activeScale = strongest && strongest.value > 0 ? `${strongest.kind}${strongest.value}` : null;

  let tone: IntelligenceTone = 'neutral';
  if ((strongest?.value ?? 0) >= 4) tone = 'critical';
  else if ((strongest?.value ?? 0) >= 2 || (kpValue ?? 0) >= 7) tone = 'high';
  else if ((strongest?.value ?? 0) >= 1 || kpStorm || (kpValue ?? 0) >= 4) tone = 'watch';

  const title = activeScale
    ? `NOAA ${activeScale} conditions lead the current scales`
    : kpStorm
      ? `Geomagnetic storm-level Kp ${kpValue!.toFixed(1)}`
      : kpValue !== null
        ? `Kp ${kpValue.toFixed(1)} · ${kpValue >= 4 ? 'active' : kpValue >= 3 ? 'unsettled' : 'quiet'} geomagnetic state`
        : 'No applicable activity value for selected time';

  const summaryParts: string[] = [];
  if (input.kp) summaryParts.push(`Kp is ${input.kp.kind} data for the selected time`);
  if (input.scalesApplicable && input.scales) summaryParts.push(`NOAA scales are G${input.scales.G.scale} / R${input.scales.R.scale} / S${input.scales.S.scale}`);
  if (input.solarWindApplicable && input.solarWind?.speedKmS !== null) summaryParts.push(`solar wind is ${Math.round(input.solarWind!.speedKmS!)} km/s`);
  if (input.solarWindApplicable && input.solarWind?.bzGsmNt !== null) {
    summaryParts.push(`IMF Bz is ${input.solarWind!.bzGsmNt! < 0 ? 'southward' : 'northward'} at ${input.solarWind!.bzGsmNt!.toFixed(1)} nT`);
  }
  if (input.auroraApplicable) summaryParts.push('the current OVATION aurora model is inside its validity window');
  if (!summaryParts.length) summaryParts.push('The loaded NOAA products do not provide an applicable value for the selected simulation time');

  const facts: IntelligenceFact[] = [
    { label: 'Kp', value: input.kp ? input.kp.kp.toFixed(1) : 'Not available', ...(input.kp ? { note: input.kp.kind.toUpperCase() } : {}) },
    ...scaleFacts(input.scales, input.scalesApplicable),
  ];
  if (input.solarWindApplicable && input.solarWind) {
    facts.push({ label: 'Solar wind', value: input.solarWind.speedKmS === null ? 'Not available' : `${Math.round(input.solarWind.speedKmS)} km/s` });
    facts.push({ label: 'IMF Bz', value: input.solarWind.bzGsmNt === null ? 'Not available' : `${input.solarWind.bzGsmNt >= 0 ? '+' : ''}${input.solarWind.bzGsmNt.toFixed(1)} nT` });
  }

  return {
    eyebrow: 'SIGNAL INTELLIGENCE · SPACE WEATHER',
    title,
    summary: `${summaryParts.join(' · ')}.`,
    tone,
    facts: facts.slice(0, 6),
    methodology: 'Derived from NOAA SWPC Kp, G/R/S scales, solar-wind observations and OVATION validity. Current-only products are never backfilled into unrelated replay time.',
  };
}

export function boundedIntensityScore(value: number, lower: number, upper: number): number {
  if (!Number.isFinite(value) || upper <= lower) return 0;
  return clamp((value - lower) / (upper - lower), 0, 1);
}

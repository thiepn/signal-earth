import type { LocalWeather, ObserverPassForecast, ObserverSkySatellite, SatellitePass } from './types';
import { sunObserverState } from './astronomy';

export type ViewingQuality = 'excellent' | 'good' | 'limited' | 'daylight' | 'eclipsed' | 'unknown';

export interface SatelliteViewingAssessment {
  score: number;
  quality: ViewingQuality;
  label: string;
  reason: string;
  favorableGeometry: boolean;
  illumination: 'sunlit' | 'penumbra' | 'shadow' | 'unknown';
}

export interface RankedSkySatellite {
  satellite: ObserverSkySatellite;
  assessment: SatelliteViewingAssessment;
}

export interface RankedPass {
  pass: SatellitePass;
  assessment: SatelliteViewingAssessment;
  observerSunElevationDeg: number;
}

export interface CurrentObservingConditions {
  quality: 'good' | 'mixed' | 'poor' | 'unknown';
  label: string;
  detail: string;
}

export function illuminationState(shadowFraction: number | null | undefined): SatelliteViewingAssessment['illumination'] {
  if (shadowFraction === null || shadowFraction === undefined || !Number.isFinite(shadowFraction)) return 'unknown';
  if (shadowFraction >= 0.95) return 'shadow';
  if (shadowFraction > 0.05) return 'penumbra';
  return 'sunlit';
}

export function assessSatelliteGeometry(elevationDeg: number, shadowFraction: number | null | undefined, observerSunElevationDeg: number): SatelliteViewingAssessment {
  const illumination = illuminationState(shadowFraction);
  if (![elevationDeg, observerSunElevationDeg].every(Number.isFinite)) {
    return { score: 0, quality: 'unknown', label: 'Unknown', reason: 'Insufficient geometry for a viewing assessment.', favorableGeometry: false, illumination };
  }

  if (observerSunElevationDeg > -4) {
    return { score: Math.max(0, elevationDeg), quality: 'daylight', label: 'Daylight', reason: 'Observer sky is too bright for a favorable satellite-viewing geometry assessment.', favorableGeometry: false, illumination };
  }
  if (illumination === 'shadow') {
    return { score: Math.max(0, elevationDeg * 0.25), quality: 'eclipsed', label: 'Earth shadow', reason: 'Satellite is in Earth’s shadow at this time.', favorableGeometry: false, illumination };
  }

  const darkness = observerSunElevationDeg <= -12 ? 36 : observerSunElevationDeg <= -6 ? 28 : 16;
  const illuminationScore = illumination === 'sunlit' ? 36 : illumination === 'penumbra' ? 18 : 6;
  const elevationScore = Math.max(0, Math.min(90, elevationDeg)) * 0.55;
  const score = Math.round(darkness + illuminationScore + elevationScore);

  if (illumination === 'sunlit' && elevationDeg >= 45 && observerSunElevationDeg <= -6) {
    return { score, quality: 'excellent', label: 'Excellent geometry', reason: 'High elevation, dark observer sky and direct sunlight on the satellite.', favorableGeometry: true, illumination };
  }
  if ((illumination === 'sunlit' || illumination === 'penumbra') && elevationDeg >= 20 && observerSunElevationDeg <= -6) {
    return { score, quality: 'good', label: 'Good geometry', reason: 'Satellite is illuminated and reasonably high in a dark sky.', favorableGeometry: true, illumination };
  }
  return { score, quality: 'limited', label: 'Limited geometry', reason: 'The geometry is less favorable because of low elevation, twilight, or partial illumination.', favorableGeometry: false, illumination };
}

export function rankObserverSky(satellites: ObserverSkySatellite[], observerSunElevationDeg: number, limit = 6): RankedSkySatellite[] {
  return satellites
    .map((satellite) => ({ satellite, assessment: assessSatelliteGeometry(satellite.elevationDeg, satellite.shadowFraction, observerSunElevationDeg) }))
    .sort((a, b) => b.assessment.score - a.assessment.score || b.satellite.elevationDeg - a.satellite.elevationDeg)
    .slice(0, Math.max(1, limit));
}

export function rankPasses(forecast: ObserverPassForecast | null, lat: number, lon: number, limit = 4): RankedPass[] {
  if (!forecast) return [];
  return forecast.passes
    .map((pass) => {
      const observerSunElevationDeg = sunObserverState(lat, lon, pass.maxTime).elevationDeg;
      return { pass, observerSunElevationDeg, assessment: assessSatelliteGeometry(pass.maxElevationDeg, pass.maxShadowFraction, observerSunElevationDeg) };
    })
    .sort((a, b) => b.assessment.score - a.assessment.score || a.pass.startTime - b.pass.startTime)
    .slice(0, Math.max(1, limit));
}

export function currentObservingConditions(weather: LocalWeather | null, weatherApplicable: boolean, observerSunElevationDeg: number): CurrentObservingConditions {
  if (!Number.isFinite(observerSunElevationDeg)) return { quality: 'unknown', label: 'Unknown', detail: 'Local sky state is unavailable.' };
  if (observerSunElevationDeg > -4) return { quality: 'poor', label: 'Daylight', detail: 'Satellite viewing is generally unfavorable while the observer sky is bright.' };
  if (!weather || !weatherApplicable || weather.cloudCoverPct === null) {
    return { quality: 'unknown', label: observerSunElevationDeg <= -12 ? 'Dark sky' : 'Twilight', detail: 'Current cloud conditions are unavailable for this simulation time.' };
  }
  const cloud = Math.round(weather.cloudCoverPct);
  if (cloud <= 30) return { quality: 'good', label: 'Good current sky', detail: `${cloud}% cloud cover with a dark observer sky.` };
  if (cloud <= 70) return { quality: 'mixed', label: 'Mixed current sky', detail: `${cloud}% cloud cover may interrupt viewing.` };
  return { quality: 'poor', label: 'Cloud-limited', detail: `${cloud}% cloud cover is unfavorable for optical observing.` };
}

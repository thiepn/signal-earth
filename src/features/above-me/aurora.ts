import type { AuroraModel } from '../space-weather/types';

export function auroraModelValueAt(model: AuroraModel | null, lat: number, lon: number): number | null {
  if (!model || model.pointCount <= 0) return null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestValue: number | null = null;
  const cosLat = Math.max(0.15, Math.cos(lat * Math.PI / 180));
  for (let index = 0; index < model.coordinates.length; index += 3) {
    const pointLon = model.coordinates[index]!;
    const pointLat = model.coordinates[index + 1]!;
    const value = model.coordinates[index + 2]!;
    let dLon = Math.abs(pointLon - lon);
    if (dLon > 180) dLon = 360 - dLon;
    const dLat = pointLat - lat;
    const distance = dLat * dLat + (dLon * cosLat) * (dLon * cosLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestValue = value;
    }
  }
  return bestValue;
}

export function auroraContextLabel(value: number | null): string {
  if (value === null) return 'No model value';
  if (value >= 60) return 'High model intensity';
  if (value >= 30) return 'Elevated model intensity';
  if (value >= 10) return 'Low model intensity';
  return 'Very low model intensity';
}

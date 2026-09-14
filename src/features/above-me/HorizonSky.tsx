import type { ObserverAstronomy } from './astronomy';
import type { ObserverSkySnapshot } from './types';
import type { EntityId } from '../../shared/types/entities';

const CX = 150;
const CY = 150;
const RADIUS = 112;

function polar(azimuthDeg: number, elevationDeg: number): { x: number; y: number } {
  const az = azimuthDeg * Math.PI / 180;
  const r = Math.max(0, Math.min(RADIUS, (90 - elevationDeg) / 90 * RADIUS));
  return { x: CX + Math.sin(az) * r, y: CY - Math.cos(az) * r };
}

interface HorizonSkyProps {
  astronomy: ObserverAstronomy;
  sky: ObserverSkySnapshot | null;
  onSelectSatellite?(id: EntityId): void;
}

export function HorizonSky({ astronomy, sky, onSelectSatellite }: HorizonSkyProps) {
  const sun = polar(astronomy.sun.azimuthDeg, astronomy.sun.elevationDeg);
  const moon = polar(astronomy.moon.azimuthDeg, astronomy.moon.elevationDeg);
  const satellites = (sky?.satellites ?? []).filter((sat) => sat.elevationDeg >= 0).slice(0, 36);
  return (
    <svg className="horizon-sky" viewBox="0 0 300 300" role="group" aria-label="Polar sky view above the observer. Satellite markers are keyboard selectable.">
      <circle className="horizon-sky__field" cx={CX} cy={CY} r={RADIUS} />
      <circle className="horizon-sky__grid" cx={CX} cy={CY} r={RADIUS * 2 / 3} />
      <circle className="horizon-sky__grid" cx={CX} cy={CY} r={RADIUS / 3} />
      <line className="horizon-sky__axis" x1={CX} y1={CY - RADIUS} x2={CX} y2={CY + RADIUS} />
      <line className="horizon-sky__axis" x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} />
      <text x={CX} y={22} textAnchor="middle">N</text>
      <text x={278} y={CY + 4} textAnchor="middle">E</text>
      <text x={CX} y={286} textAnchor="middle">S</text>
      <text x={22} y={CY + 4} textAnchor="middle">W</text>
      <text className="horizon-sky__elevation" x={CX + 6} y={CY - RADIUS / 3 + 4}>60°</text>
      <text className="horizon-sky__elevation" x={CX + 6} y={CY - RADIUS * 2 / 3 + 4}>30°</text>

      {astronomy.sun.elevationDeg >= -8 && <g className="horizon-object horizon-object--sun" transform={`translate(${sun.x} ${sun.y})`}><circle r="5.5"/><circle r="9.5" className="horizon-object__halo"/><text x="9" y="-7">SUN</text></g>}
      {astronomy.moon.elevationDeg >= 0 && <g className="horizon-object horizon-object--moon" transform={`translate(${moon.x} ${moon.y})`}><circle r="4.5"/><text x="8" y="-6">MOON</text></g>}

      {satellites.map((satellite) => {
        const point = polar(satellite.azimuthDeg, satellite.elevationDeg);
        const iss = String(satellite.id) === 'satellite:25544';
        return (
          <g
            key={satellite.id}
            className={`horizon-object horizon-object--satellite ${iss ? 'is-iss' : ''}`}
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${satellite.name}, elevation ${satellite.elevationDeg.toFixed(0)} degrees, azimuth ${satellite.azimuthDeg.toFixed(0)} degrees`}
            onClick={() => onSelectSatellite?.(satellite.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectSatellite?.(satellite.id);
              }
            }}
          >
            <circle r={iss ? 4 : 2.4} />
            {iss && <text x="7" y="-5">ISS</text>}
          </g>
        );
      })}
      <circle className="horizon-sky__zenith" cx={CX} cy={CY} r="2" />
    </svg>
  );
}

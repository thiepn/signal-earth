import { forwardRef, lazy, Suspense, useCallback, useRef, type ComponentPropsWithoutRef, type ForwardedRef } from 'react';
import type { EarthquakeRecord } from '../seismic/types';
import type { NaturalEventRecord } from '../natural-events/types';
import type { SatelliteRecord, SatelliteTelemetry } from '../orbit/types';
import { hideSignalHoverPreview, showSignalHoverPreview } from '../../ui/hoverPreviewDom';
import type { GlobeViewportHandle, GlobeViewportQuality } from './GlobeViewportBase';
import type { GeoContextLabel } from './geoContext';

export type { GlobeViewportHandle, GlobeViewportQuality };

type BaseGlobeViewportType = (typeof import('./GlobeViewportBase'))['GlobeViewport'];
type GlobeViewportProps = ComponentPropsWithoutRef<BaseGlobeViewportType>;

const LazyBaseGlobeViewport = lazy(async () => ({ default: (await import('./GlobeViewportBase')).GlobeViewport }));
let orbitMechanicsPromise: Promise<typeof import('../orbit/mechanics')> | null = null;

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const GlobeViewport = forwardRef<GlobeViewportHandle, GlobeViewportProps>(function GlobeViewport(props, ref) {
  const innerRef = useRef<GlobeViewportHandle | null>(null);
  const satelliteHoverTokenRef = useRef(0);
  const setRef = useCallback((value: GlobeViewportHandle | null) => {
    innerRef.current = value;
    assignRef(ref, value);
  }, [ref]);

  const onEarthquakeHover = useCallback((earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => {
    props.onEarthquakeHover?.(earthquake, position);
    showSignalHoverPreview(earthquake && position ? {
      kind: 'EARTHQUAKE', title: earthquake.place, metric: `M${earthquake.magnitude.toFixed(1)}`,
      detail: `${earthquake.coordinates.depthKm.toFixed(0)} km deep · observed event`, source: 'USGS', x: position.x, y: position.y,
    } : null);
  }, [props.onEarthquakeHover]);

  const onNaturalEventHover = useCallback((event: NaturalEventRecord | null, position?: { x: number; y: number }) => {
    props.onNaturalEventHover?.(event, position);
    showSignalHoverPreview(event && position ? {
      kind: event.categoryTitle.toUpperCase(), title: event.title, metric: event.closedAt === null ? 'ACTIVE' : 'HISTORY',
      detail: `${event.categoryTitle} · ${event.geometry.length} observation${event.geometry.length === 1 ? '' : 's'}`,
      source: 'NASA EONET', x: position.x, y: position.y,
    } : null);
  }, [props.onNaturalEventHover]);

  const onSatelliteHover = useCallback((satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => {
    props.onSatelliteHover?.(satellite, telemetry, position);
    const token = ++satelliteHoverTokenRef.current;
    if (!satellite || !telemetry || !position) {
      showSignalHoverPreview(null);
      return;
    }
    showSignalHoverPreview({
      kind: 'ORBIT', title: satellite.name, metric: `${telemetry.altitudeKm.toFixed(0)} km`,
      detail: `${telemetry.speedKmS.toFixed(2)} km/s · propagated position`, source: `CELESTRAK · NORAD ${satellite.noradId}`,
      x: position.x, y: position.y,
    });
    orbitMechanicsPromise ??= import('../orbit/mechanics');
    void orbitMechanicsPromise.then((mechanicsModule) => {
      if (satelliteHoverTokenRef.current !== token) return;
      const mechanics = mechanicsModule.deriveOrbitMechanics(satellite, telemetry.timestamp);
      const orbitClass = mechanics.orbitClass.toUpperCase();
      const direction = mechanics.direction === 'ascending' ? 'ASC' : mechanics.direction === 'descending' ? 'DESC' : 'TURN';
      showSignalHoverPreview({
        kind: `${orbitClass} · ${direction}`, title: satellite.name, metric: `${telemetry.altitudeKm.toFixed(0)} km`,
        detail: `${mechanicsModule.formatIllumination(mechanics.illumination)} · ${telemetry.speedKmS.toFixed(2)} km/s${mechanics.constellation ? ` · ${mechanics.constellation}` : ''}`,
        source: `CELESTRAK · NORAD ${satellite.noradId}`, x: position.x, y: position.y,
      });
    }).catch(() => { /* basic hover remains available */ });
  }, [props.onSatelliteHover]);

  const onGeoContextNavigate = useCallback((label: GeoContextLabel) => {
    hideSignalHoverPreview();
    if (props.onGeoContextNavigate) props.onGeoContextNavigate(label);
    else innerRef.current?.focusCoordinates({ lat: label.lat, lon: label.lng }, label.kind === 'city' ? 0.72 : 1.05);
  }, [props.onGeoContextNavigate]);

  return (
    <Suspense fallback={<div className="globe-canvas globe-canvas--boot" role="status" aria-label="Loading interactive Earth" />}>
      <LazyBaseGlobeViewport
        {...props}
        ref={setRef}
        onGlobeClick={(coordinates) => { hideSignalHoverPreview(); props.onGlobeClick?.(coordinates); }}
        onEarthquakeClick={(earthquake) => { hideSignalHoverPreview(); props.onEarthquakeClick?.(earthquake); }}
        onNaturalEventClick={(event) => { hideSignalHoverPreview(); props.onNaturalEventClick?.(event); }}
        onSatelliteClick={(satellite, telemetry) => { hideSignalHoverPreview(); props.onSatelliteClick?.(satellite, telemetry); }}
        onEarthquakeHover={onEarthquakeHover}
        onNaturalEventHover={onNaturalEventHover}
        onSatelliteHover={onSatelliteHover}
        onGeoContextNavigate={onGeoContextNavigate}
      />
    </Suspense>
  );
});

import { forwardRef, useCallback, useRef, type ComponentPropsWithoutRef, type ForwardedRef } from 'react';
import type { EarthquakeRecord } from '../seismic/types';
import type { NaturalEventRecord } from '../natural-events/types';
import type { SatelliteRecord, SatelliteTelemetry } from '../orbit/types';
import { hideSignalHoverPreview, showSignalHoverPreview } from '../../ui/hoverPreviewDom';
import { GlobeViewport as BaseGlobeViewport, type GlobeViewportHandle, type GlobeViewportQuality } from './GlobeViewportBase';
import type { GeoContextLabel } from './geoContext';

export type { GlobeViewportHandle, GlobeViewportQuality };

type GlobeViewportProps = ComponentPropsWithoutRef<typeof BaseGlobeViewport>;

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const GlobeViewport = forwardRef<GlobeViewportHandle, GlobeViewportProps>(function GlobeViewport(props, ref) {
  const innerRef = useRef<GlobeViewportHandle | null>(null);
  const setRef = useCallback((value: GlobeViewportHandle | null) => {
    innerRef.current = value;
    assignRef(ref, value);
  }, [ref]);

  const onEarthquakeHover = useCallback((earthquake: EarthquakeRecord | null, position?: { x: number; y: number }) => {
    props.onEarthquakeHover?.(earthquake, position);
    showSignalHoverPreview(earthquake && position ? {
      kind: 'EARTHQUAKE',
      title: earthquake.place,
      metric: `M${earthquake.magnitude.toFixed(1)}`,
      detail: `${earthquake.coordinates.depthKm.toFixed(0)} km deep · observed event`,
      source: 'USGS',
      x: position.x,
      y: position.y,
    } : null);
  }, [props.onEarthquakeHover]);

  const onNaturalEventHover = useCallback((event: NaturalEventRecord | null, position?: { x: number; y: number }) => {
    props.onNaturalEventHover?.(event, position);
    showSignalHoverPreview(event && position ? {
      kind: event.categoryTitle.toUpperCase(),
      title: event.title,
      metric: event.closedAt === null ? 'ACTIVE' : 'HISTORY',
      detail: `${event.categoryTitle} · ${event.geometry.length} observation${event.geometry.length === 1 ? '' : 's'}`,
      source: 'NASA EONET',
      x: position.x,
      y: position.y,
    } : null);
  }, [props.onNaturalEventHover]);

  const onSatelliteHover = useCallback((satellite: SatelliteRecord | null, telemetry: SatelliteTelemetry | null, position?: { x: number; y: number }) => {
    props.onSatelliteHover?.(satellite, telemetry, position);
    showSignalHoverPreview(satellite && telemetry && position ? {
      kind: satellite.category.replace('-', ' ').toUpperCase(),
      title: satellite.name,
      metric: `${telemetry.altitudeKm.toFixed(0)} km`,
      detail: `${telemetry.speedKmS.toFixed(2)} km/s · NORAD ${satellite.noradId}`,
      source: 'CELESTRAK · PROPAGATED',
      x: position.x,
      y: position.y,
    } : null);
  }, [props.onSatelliteHover]);

  const onGeoContextNavigate = useCallback((label: GeoContextLabel) => {
    hideSignalHoverPreview();
    if (props.onGeoContextNavigate) props.onGeoContextNavigate(label);
    else innerRef.current?.focusCoordinates({ lat: label.lat, lon: label.lng }, label.kind === 'city' ? 0.72 : 1.05);
  }, [props.onGeoContextNavigate]);

  return (
    <BaseGlobeViewport
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
  );
});

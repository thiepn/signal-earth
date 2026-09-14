# Phase 4 Acceptance — Earthquakes

Status: **implemented**

## Scope

Phase 4 introduces Signal Earth's first real external signal system using the U.S. Geological Survey earthquake GeoJSON feeds.

## Provider architecture

- all USGS access is isolated behind `UsgsEarthquakeProvider`
- summary feeds are selected by hour/day/week/month window
- external payloads are normalized before reaching application state
- malformed rows are discarded independently
- non-earthquake catalog rows such as quarry blasts are rejected
- provider failure is distinct from a valid feed with zero earthquakes
- the layer automatically re-evaluates feeds at a window-sensitive cadence while enabled (1m for hour/day, 5m for week, 10m for month)
- manual refresh is available

## Cache and freshness

- in-memory snapshots are checked first
- IndexedDB snapshots persist across reloads
- feed TTL is window-sensitive: 1m hour/day, 5m week, 10m month
- stale cached data may be served for up to six hours during a provider outage
- cached/stale state is exposed visibly in the UI
- a failed request never becomes “0 earthquakes”

## Filters

Time windows:

- 1 hour
- 24 hours
- 7 days
- 30 days

Magnitude thresholds:

- M2.5+
- M3+
- M4+
- M5+
- M6+

Filtering occurs on normalized records, not raw USGS payload objects.

## Rendering

`SeismicRenderer` owns all earthquake Three.js resources.

- normal markers use one `THREE.InstancedMesh`
- marker radius scales with magnitude
- visual severity is encoded through marker color
- selected earthquakes receive a larger white marker
- only recent/strong earthquakes receive animated pulse rings
- low/medium/high quality profiles cap maximum rendered events conservatively
- renderer resources are disposed explicitly

The pulse ring is a presentation cue. It is not represented as measured seismic-wave propagation.

## Interaction

- earthquake markers are directly clickable
- marker clicks suppress the underlying generic globe click
- selection uses the canonical Signal Earth entity-selection model
- Focus uses the existing CameraController pathway
- desktop and mobile inspectors use the same selected entity
- the inspector includes magnitude, depth, age, review status, felt reports, MMI where available, tsunami flag, alert level, coordinates, significance and USGS source link

## Data semantics

Earthquake records are `observed` entities.

The source snapshot retains both:

- `fetchedAt`: when Signal Earth retrieved the snapshot
- `sourceUpdatedAt`: when USGS generated the feed

This preserves the distinction between data age and earthquake age.

## Deliberate Phase 4 boundary

The existing global timeline does not yet claim complete historical replay semantics for the earthquake layer. Phase 5 will define how earthquake visibility changes when the simulation clock moves through time.

## Acceptance checks

- [x] USGS GeoJSON normalizer has typed fixture coverage
- [x] quarry/non-earthquake events are rejected
- [x] magnitude filtering has unit coverage
- [x] provider status is part of canonical app state
- [x] core USGS provider contracts pass strict TypeScript checking
- [x] cache/service contracts pass strict checking with the external IDB boundary stubbed
- [x] all TS/TSX sources pass a syntax/transpile check
- [x] no backend, API secret, map service or database server was introduced

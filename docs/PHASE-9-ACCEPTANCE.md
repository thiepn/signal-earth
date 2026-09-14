# Phase 9 — NASA Natural Events Acceptance

Status: **implemented**

## Scope

Phase 9 adds the first non-seismic observed Earth-event family through NASA EONET v3 while preserving the browser-only GitHub Pages architecture.

## Provider acceptance

- [x] stable EONET v3 Events API
- [x] curated categories only: severe storms, wildfires, volcanoes
- [x] open + recent closed-event retrieval
- [x] event-ID deduplication
- [x] bounded raw-event and geometry intake
- [x] Point and Polygon validation
- [x] source URL sanitization to HTTP/HTTPS
- [x] 15-minute client cache TTL
- [x] 24-hour stale-cache fallback
- [x] provider errors are not represented as zero events

## Temporal semantics

- [x] geometry frames keep source timestamps
- [x] event is hidden before its first observation
- [x] closed events disappear after their EONET close timestamp
- [x] latest geometry at/before simulation time drives the marker
- [x] storm history reveals as simulation time advances
- [x] future simulation does not create new event positions
- [x] selected event is cleared if timeline/category/layer state makes it unavailable

## Rendering

- [x] dedicated `NaturalEventRenderer`
- [x] quality-capped event catalog
- [x] instanced marker rendering by category
- [x] severe-storm cyan ring marker
- [x] wildfire orange triangular marker
- [x] volcano amber cone marker
- [x] storm track lines use reported positions with visual interpolation between reports
- [x] selected marker emphasis
- [x] selected Polygon outline
- [x] raycast selection suppresses generic Earth click
- [x] renderer resources dispose independently

## UI

- [x] Natural events layer is marked LIVE
- [x] per-category toggles and counts
- [x] visible-at-time count
- [x] freshness/status presentation
- [x] manual refresh
- [x] stale/provider warning
- [x] event inspector with category, open/closed state, geometry time/type, magnitude metadata and coordinates
- [x] source links and NASA EONET attribution
- [x] desktop/mobile shared interaction path

## Explicit non-goals

Phase 9 does not add:

- NASA imagery layers/WMS/WMTS
- global raster fire products
- predictive hurricane tracks
- arbitrary EONET categories
- weather forecasts
- aurora/space weather

These would either duplicate later phases or violate the product's curated-layer constraint.

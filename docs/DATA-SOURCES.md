# Signal Earth — Data Sources

All external schemas are isolated behind provider adapters. URLs here document the intended V1 source families; concrete endpoint selection belongs to the feature phase that implements each adapter.

| Provider | Use | Temporal semantics | V1 cache intent |
| --- | --- | --- | --- |
| USGS | Earthquakes | Observed / historical | short-lived, feed dependent |
| NASA EONET v3 | Natural events | Observed / recent historical | minutes |
| CelesTrak | OMM/GP orbital elements | Source data used for propagated state | **minimum 2 h TTL** |
| NOAA SWPC | Kp, alerts, aurora/space weather | Observed + forecast | product dependent |
| Open-Meteo | Observer-local weather | Observed + forecast | location dependent |

## USGS

Homepage: https://earthquake.usgs.gov/

Use summary GeoJSON feeds for list-level event data and fetch detailed event data only when needed. Provider failure is distinct from a valid feed containing zero events.

## NASA EONET

API: https://eonet.gsfc.nasa.gov/docs/v3

Natural-event categories and geometries are normalized into Signal Earth entities. The UI should prioritize meaningful global events rather than rendering every available row indiscriminately.

## CelesTrak

Homepage: https://celestrak.org/

Canonical format: GP JSON / OMM.

Rules:

- maintain a minimum two-hour client cache TTL for catalog refreshes
- never add cache-busting query parameters
- fetch only curated groups required by the product
- reuse cached data across reloads
- expose element age separately from propagated object time

Initial categories: stations, weather, Earth observation, navigation, science; communications may be enabled once performance is verified.

## NOAA SWPC

Products: https://services.swpc.noaa.gov/products/

Phase 10 uses the planetary Kp forecast/history product, NOAA scales, solar-wind speed/magnetic summaries, operational alerts/messages, and the latest OVATION aurora JSON product. Each product retains its own valid/issue time rather than inheriting a generic “live” label.

## Open-Meteo

Docs: https://open-meteo.com/en/docs

Restricted to observer-relative/local weather in V1. Phase 11 requests only current conditions for the explicit observer coordinate: temperature, apparent temperature, relative humidity, precipitation, WMO weather code, cloud cover, 10 m wind speed and direction.

Runtime policy:

- direct browser request; no API key or backend proxy
- client TTL: 15 minutes
- stale-cache fallback: 2 hours
- location cache key rounds coordinates to two decimals so small GPS jitter does not create unbounded cache entries
- current weather is considered applicable only near its own timestamp and is not presented as historical/future weather when the simulation clock moves away from it
- required attribution remains visible in the Above Me weather block

It must not turn Signal Earth into a general weather dashboard.

## Provider failure state

The UI distinguishes at least:

- loading
- live/fresh
- cached
- aging
- stale
- unavailable/error

A provider request error must never be converted into “0 events.”

## Attribution

Every normalized entity retains a `SourceRef`. The permanent Data Sources surface and entity inspectors must provide source attribution. Attribution must be designed into the feature, not added during release cleanup.

## Natural Earth — local visual assets

Natural Earth public-domain low-resolution vector geometry is bundled/used to generate the Phase 1 project-local Earth textures and geographic context assets.

Runtime behavior:

- no map tile requests
- no runtime Natural Earth network request
- 2K texture is the low/medium default
- 4K texture is lazy-selected by the high quality profile
- decorative surface variation in the generated texture is not scientific data

Courtesy attribution: **Made with Natural Earth — naturalearthdata.com**.


## Phase 3 local Earth-system assets

Phase 3 adds no live provider. Solar position and sidereal angle are calculated locally from UTC simulation time using standard J2000-era astronomical formulae.

`earth-day-*` textures are generated locally from the Phase 1 Natural Earth-derived Signal texture. `earth-city-lights-*` is a **stylised, non-observational** major-city glow layer generated specifically for presentation. It is not a population, energy-use, or satellite night-lights dataset.

The astronomical day/night boundary is therefore independent of the decorative city-light texture.

## Phase 4 USGS implementation

Implemented summary endpoints:

- `all_hour.geojson`
- `all_day.geojson`
- `all_week.geojson`
- `all_month.geojson`

Signal Earth currently consumes the application-oriented GeoJSON summary payload and normalizes only records whose USGS `type` is exactly `earthquake`. The feed's `detail` URL is retained on each normalized event for later on-demand detail expansion, but Phase 4 does not automatically issue one detail request per marker.

Refresh/caching policy:

- provider TTL: 60 seconds for hour/day, 5 minutes for week, 10 minutes for month
- automatic re-check while the layer is enabled follows the same window-sensitive cadence
- stale-cache fallback window: 6 hours
- cached records always retain a visible freshness state

The renderer may cap extremely large filtered result sets according to current quality level. This is a rendering cap only; the normalized feed remains available to the application layer.

## Phase 6 CelesTrak implementation

Signal Earth uses the CelesTrak GP query endpoint in `FORMAT=JSON`, which maps to OMM keywords and is not constrained by the legacy five-digit TLE catalog-number field.

Curated groups fetched when the Orbit layer is first enabled:

- `GROUP=STATIONS`
- `GROUP=WEATHER`
- `GROUP=RESOURCE`
- `GROUP=GNSS`
- `GROUP=SCIENCE`

The app deliberately does **not** fetch `ACTIVE`, Starlink, or every available group. Each browser keeps the merged curated catalog in IndexedDB for at least two hours, and the service has no force-refresh API capable of bypassing that minimum interval. A cached catalog may be used for up to 24 hours during provider/network failure, with `STALE` shown explicitly.

Provider JSON is normalized into plain OMM records before it crosses the worker boundary. Duplicate NORAD catalog IDs that occur in multiple curated groups are merged into one satellite with multiple categories, preferring the newest element epoch.

The OMM element epoch is not the same thing as a live observed satellite position. The UI therefore labels rendered satellite state as **PROPAGATED**, and the browser computes the displayed position locally using SGP4 through satellite.js.


## Phase 9 NASA EONET implementation

Signal Earth uses the stable NASA EONET v3 Events API directly from the browser. The implementation deliberately requests only three curated categories: `severeStorms`, `wildfires`, and `volcanoes`. Open events are combined with recently closed events from the last 30 days and deduplicated by EONET event ID.

Runtime policy:

- client TTL: 15 minutes
- stale-cache fallback: 24 hours
- maximum normalized raw event intake is bounded
- provider failure is reported independently from a valid zero-event response
- source links are restricted to HTTP/HTTPS before becoming clickable

EONET geometry is treated as **observed event history**. Each Point or Polygon is paired with its source date. During replay Signal Earth reveals only geometry that existed by the selected simulation time. Severe-storm tracks connect reported positions for visual continuity; the connecting line is presentation, not an independently measured continuous trajectory. For future simulation time the app does not forecast or extrapolate EONET geometry.

Selected Polygon events can display their current observed outline. The normal global layer remains marker/track based so arbitrary large polygons do not dominate rendering cost.


## Phase 10 NOAA SWPC implementation

Signal Earth retrieves these public JSON products directly from `services.swpc.noaa.gov`:

- `/products/noaa-planetary-k-index-forecast.json`
- `/products/noaa-scales.json`
- `/products/summary/solar-wind-speed.json`
- `/products/summary/solar-wind-mag-field.json`
- `/products/alerts.json`
- `/json/ovation_aurora_latest.json`

Runtime policy:

- client TTL: 5 minutes
- stale-cache fallback: 2 hours
- each endpoint fails independently; a missing aurora product does not discard Kp or solar-wind data
- browser fetches are fixed to the NOAA SWPC allowlist; there is no arbitrary URL/proxy surface
- the OVATION grid is packed into a `Float32Array` before caching/rendering

Temporal semantics are intentionally product-specific:

- Kp rows retain NOAA's `observed`, `estimated`, and `predicted` labels and are resolved by 3-hour simulation-time buckets
- NOAA G/R/S scale and solar-wind summary products are current observations and are not presented as historical values when the timeline is moved away from their timestamp
- OVATION is treated as a model/forecast field tied to its own `Observation Time` and `Forecast Time`; Signal Earth hides it outside a narrow validity window instead of reusing the latest model in unrelated replay/future periods
- SWPC operational messages are presented as recent source messages; current G/R/S scale state is the authoritative compact condition summary

Aurora rendering is presentation of the NOAA model grid, not optical observation. The renderer keeps only polar cells with non-zero model values, quality-bounds the rendered point count, supports north/south visibility independently, and increases presentation opacity in Night mode without changing the underlying NOAA values.

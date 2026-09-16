# Phase 27 — Data Reliability 2.0 — Acceptance

## Goal

Make Signal Earth’s existing external data stack materially harder to break without adding a new provider, backend, account system, telemetry service or primary globe layer. Phase 27 standardizes provider loading, cache validation, retry/fallback semantics and operator-visible health across USGS, NASA EONET, CelesTrak, NOAA SWPC and Open-Meteo while preserving each provider’s scientific meaning and existing trust boundaries.

## Implemented

### Shared reliability contract

- Replaced five duplicated service-level cache/network/fallback implementations with one shared reliable loading path.
- Every external provider service now follows the same order:
  1. validated in-memory snapshot
  2. validated IndexedDB snapshot
  3. coalesced network refresh
  4. deterministic valid stale fallback when the refresh fails
  5. explicit provider failure when no valid fallback exists
- Existing provider-specific TTL and stale windows remain authoritative.
- Existing normalized cache schemas, provider versions and cache keys are preserved where the data model did not change, preventing an unnecessary offline-cache wipe during the v1.11 → v1.12 upgrade.

### Request coordination and cancellation

- Added keyed single-flight request coordination.
- Concurrent consumers of the same provider/cache key share one underlying request.
- One caller aborting does not cancel a request still needed by another caller.
- The shared request is cancelled when its final active consumer leaves.
- USGS time windows and Open-Meteo observer coordinates remain distinct request/cache keys.

### Retry, rate limiting and offline behavior

- Added bounded deterministic retry/backoff; no unbounded loops or randomized retry timing are introduced.
- Transient HTTP classes include 408, 425, 429, 500, 502, 503 and 504.
- Network, malformed-payload and normalized-validation failures are retryable inside strict attempt bounds.
- HTTP 429 is classified separately as rate limiting.
- `Retry-After` seconds or dates are honored where response metadata is available and bounded to a one-minute maximum delay.
- Provider requests short-circuit when `navigator.onLine` reports the browser is offline.
- Abort signals interrupt both network requests and backoff delays.

### Cache-corruption recovery

- Cache entries are audited before reuse for:
  - provider identity
  - cache schema version
  - provider version
  - finite/credible fetch timestamp
  - expiry ordering
  - source timestamp validity
  - normalized provider validation
- Invalid cache entries are removed before a network replacement or fallback decision.
- Provider validators are treated as untrusted at the cache boundary: a validator exception marks the entry invalid instead of escaping through the service and leaving corrupt data reachable.
- IndexedDB read/write failures remain non-fatal when valid network or memory data is available.

### Timestamp and scientific validity protection

- Source timestamps are audited against wall-clock time before newly fetched data is cached.
- A general ten-minute future-skew allowance handles ordinary clock/publication differences.
- CelesTrak receives a deliberately wider six-hour source-publication allowance while retaining the existing strict two-hour catalog fetch policy and ±24-hour orbit propagation trust boundary.
- Phase 27 changes reliability semantics only; it does not reinterpret USGS observations, EONET geometry, NOAA operational/model products, CelesTrak OMM propagation, NASA GIBS observation imagery or Open-Meteo current conditions.

### Partial-provider preservation

- Existing deterministic partial-data behavior for multi-product providers remains intact.
- EONET, CelesTrak and SWPC may expose usable sibling data when one upstream sub-request fails rather than discarding the entire provider snapshot.
- Provider health reports `PARTIAL` separately from `LIVE`, `CACHED` and `STALE`.

### Provider health surface

Display now exposes a Data Reliability section for all five external providers showing:

- LIVE / CACHED / STALE / PARTIAL / OFFLINE / ERROR / IDLE state
- source timestamp age
- local fetch age
- most recent successful network latency
- consecutive fallback count
- corrupt-cache recovery indicator
- overall NOMINAL / DEGRADED / OFFLINE / WAITING state

These labels describe transport/cache state only. They do not convert derived or cached information into measured-live data.

### Continuous QA

- The Phase 26 cross-browser workflow is no longer limited to `phase26-*` branches.
- The same seven-project production-build matrix now runs on `main` and all `phase*` development branches.

## Reliability regression coverage

Added dedicated tests for:

- `Retry-After` parsing and upper bounds
- transient HTTP retry then success
- 429 rate-limit classification
- offline network short-circuiting
- coalesced concurrent loads with independent caller cancellation
- provider health state transitions
- corrupt/incompatible cache deletion and replacement
- deterministic stale fallback after exhausted refresh attempts
- rejection of implausible future source timestamps

## Automated release certification

Implementation head: `7148159c4467c105ed8cf3aeffcef5bac912f465`

Verify V1 run **35124321002** completed successfully on 2026-09-16.

- [x] TypeScript passes.
- [x] **40/40** unit-test files pass.
- [x] **151/151** unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes.
- [x] Performance verification passes.
- [x] Production package: approximately **14.01 MB**.
- [x] Startup service-worker precache: **26** shell assets.
- [x] HTML-linked JavaScript: approximately **442.5 kB raw / 141.8 kB gzip**.
- [x] Startup JavaScript remains below the Phase 25 limits of **480 kB raw / 145 kB gzip**.
- [x] **10** deferred JavaScript chunks remain outside the startup graph, approximately **2,015.7 kB raw** combined.
- [x] Globe WebGL core remains approximately **1,966.37 kB raw / 556.41 kB gzip** and is not hidden by changing the warning threshold.

## Cross-browser acceptance

Cross-browser QA run **35124321001** against the same implementation head completed successfully on 2026-09-16.

| Project | Result |
|---|---|
| Chromium desktop | PASS |
| Firefox desktop | PASS |
| WebKit desktop | PASS |
| Chromium ultrawide | PASS |
| Android Chromium emulation | PASS |
| iPhone WebKit emulation | PASS |
| iPad WebKit emulation | PASS |

Browser phone/tablet projects remain device emulations on GitHub-hosted runners; physical-device visual/touch smoke testing is still a separate manual acceptance step.

## Scope and trust constraints

1. No new scientific provider or primary visual layer is introduced.
2. No backend, cloud account system, analytics/telemetry service or generative interpretation layer is introduced.
3. Provider-specific freshness/stale policies remain authoritative.
4. Valid existing IndexedDB data is preserved across the v1.12 reliability refactor.
5. A stale fallback is explicitly labeled stale; cached data is not presented as a successful new network observation.
6. Partial data remains distinguishable from a complete provider load.
7. CelesTrak positions remain locally propagated context rather than measured live positions.
8. Orbit remains bounded to the existing ±24-hour scientific trust window.
9. Observer-location persistence rules remain unchanged.
10. Phase 28 visual/motion work is outside Phase 27 scope.

## Acceptance

Phase 27 is accepted because the runtime implementation head has a green release gate, dedicated reliability regression coverage, a green seven-project browser/device-emulation matrix, preserved provider trust semantics and this formal acceptance record. Documentation-only closure commits after the certified implementation head do not change executable behavior.

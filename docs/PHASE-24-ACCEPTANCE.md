# Phase 24 — Saved Worlds — Acceptance

## Goal

Make Signal Earth remember how the observatory is used without adding accounts, a backend, or a second state format. A Saved World should be a named, local-first preset that can restore the same public camera/layer/time/filter/selection state already supported by canonical share links while keeping private observer/accessibility settings outside the saved object.

## Implemented

- New **Saved Worlds** manager in Display / Settings on desktop and mobile.
- Save the current observatory state under a user-supplied name.
- Saved state uses Signal Earth’s existing canonical `ShareViewState` URL format rather than duplicating serialization logic.
- Saved Worlds preserve the public state represented by share links, including:
  - globe camera / point of view
  - Earth visual mode
  - enabled Weather / Earthquakes / Natural Events / Orbit / Aurora layers
  - Weather sublayers and opacity
  - timeline range and LIVE / replay / future simulation timestamp
  - selected public entity identifier when present
  - USGS time window and magnitude threshold
  - Orbit categories, scale, trail and path/ground-track visibility
  - NASA EONET category filters
  - aurora hemisphere toggles
- Each card surfaces a compact summary of mode, enabled layers, timeline range, time mode and selected target.
- A saved view can be **loaded**, **updated from the current state**, **copied as a normal share URL**, or **deleted**.
- Loading a world goes through the existing share-view parser/restoration path instead of mutating application state through a second implementation.
- Stored URLs are localized back onto the current Signal Earth origin/path before navigation so a poisoned localStorage record cannot become an external redirect.
- Saved Worlds are validated on read; malformed records and non-Signal-Earth share-state records are dropped.
- Names are whitespace-normalized and capped at 48 characters.
- Storage is capped at **24 worlds**, retaining the most recently updated entries.
- localStorage failure, privacy-mode blocking, malformed JSON and quota errors fail open without breaking Signal Earth.
- Saving captures the canonical current-view URL through the existing Copy View serialization path; the canonical link is also copied to the clipboard when browser access permits.
- App version advances to **1.9.0**.

## Privacy / persistence semantics

1. Saved Worlds are browser-local. There is no account, cloud sync or runtime backend.
2. Observer coordinates are **not embedded** in Saved Worlds. The existing Above Me “Remember this coordinate” control remains the only persistence path for observer location.
3. Accessibility preferences are not embedded in Saved Worlds and remain separately stored.
4. A copied Saved World URL contains the same public state as any normal Signal Earth share link; private local preferences do not become share parameters.
5. A Saved World stores identifiers and display state, not provider payloads. Loading it causes the normal application/provider path to resolve current public records.
6. Historical/future time semantics remain subject to the same Time 2.0 and Orbit ±24-hour trust boundaries as ordinary shared links.
7. Deleting a Saved World removes only that local preset; it does not delete provider caches or observer preferences.

## Verification

- [x] TypeScript passes on the functional Phase 24 branch.
- [x] **8/8** dedicated Saved Worlds tests pass.
- [x] Existing share-state tests continue to pass.
- [x] **36/36** unit-test files pass.
- [x] **139/139** total unit tests pass.
- [x] Production Vite build passes.
- [x] Release verification passes with **15** safe service-worker precache entries.
- [x] Functional Phase 24 production package: approximately **13.95 MB**.
- [ ] Exact v1.9.0 branch-head certification passes.
- [ ] GitHub Pages production deployment succeeds.
- [ ] Real-device visual smoke test remains a separate manual acceptance step.

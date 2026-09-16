# Phase 29 — Release Hardening — Acceptance

## Goal

Turn the fully built Phase 28 product into a reproducible, auditable Signal Earth 2.0 release candidate without adding product features or changing scientific semantics.

Phase 29 is the final technical hardening stage before Phase 30 production promotion. It audits dependency resolution, build packaging, PWA/service-worker upgrades, workflow supply-chain inputs, artifact identity, release verification, browser/device coverage and deployment reproducibility.

## Release candidate

Candidate version: **2.0.0-rc.1**

Certified implementation head: `0950e31ea963a0f3e5b798dbc3eff2bc6e7fe31b`

The final `2.0.0` version is deliberately reserved for Phase 30 after the release candidate has been promoted and production closure has been verified.

## Audit findings and defect closure

### Reproducible dependency resolution

Before Phase 29, the repository had no `package-lock.json` and CI used `npm install --legacy-peer-deps`. A source commit could therefore resolve a different transitive graph later.

Phase 29 now:

- commits an npm lockfile v3;
- pins Node to **22.23.2** through `.nvmrc`;
- declares `npm@10.9.8` as the package manager;
- constrains the supported Node/npm engine range;
- uses `npm ci --legacy-peer-deps --no-audit --no-fund` in verification, QA and deployment workflows.

### Immutable GitHub Actions inputs

Release workflows previously referenced movable action major tags. Phase 29 pins release/QA/deployment actions to full commit SHAs so an existing Signal Earth commit cannot silently execute different action code later.

Pinned workflow inputs include checkout, setup-node, artifact upload, Pages configuration, Pages artifact upload and Pages deployment.

### Service-worker release lifecycle

The production service worker still carried the cache namespace `signal-earth-v1.0.0`, even after the application reached v1.13.0. That meant release cache identity was no longer tied to application identity and obsolete release caches could accumulate.

Phase 29 now:

- injects `signal-earth-${version}` at build time;
- separates static and runtime caches by release namespace;
- verifies that the packaged cache namespace matches the package/UI release version;
- deletes obsolete Signal Earth caches only when a new worker actually activates;
- no longer calls `skipWaiting()` automatically during install, avoiding a new worker taking control of an already-open old application build before that page has reloaded;
- retains explicit `SKIP_WAITING` message support for a future user-directed update flow;
- awaits runtime `cache.put(...)` operations rather than launching untracked cache writes.

External scientific/provider data remains governed by the existing application IndexedDB freshness/reliability contract rather than by service-worker HTTP caching.

### Production source-map removal

Phase 28 still published full production source maps. Signal Earth has no production error-ingestion service that consumes those maps, so they increased the public deployment size without a production requirement.

Phase 29 disables production source maps and the release verifier now rejects any `.map` files in `dist`.

This reduced the packaged production site from approximately **14.02 MB** in Phase 28 to approximately **3.68 MB** in the release candidate without changing application behavior or startup JavaScript architecture.

### Deterministic release identity

Every production build now emits `release.json` containing:

- product name;
- release version;
- full Git commit SHA in CI builds.

The build rejects package/UI version disagreement, and verification rejects release metadata whose commit does not match `GITHUB_SHA`.

The packaged service-worker cache namespace, `release.json`, package version and the version displayed in Signal Earth's Release tools are now cross-checked by automated verification and production E2E coverage.

### Stronger package verification

`release:verify` now audits the final `dist` rather than checking only a few expected files. It verifies:

- required shell/PWA/data assets;
- no source maps or stray `.DS_Store` files;
- no development or localhost references in production HTML;
- manifest/theme/apple-touch metadata;
- deterministic release metadata;
- fully injected service-worker placeholders;
- release-versioned service-worker cache identity;
- valid startup precache entries whose files actually exist;
- no worker/lazy feature leakage into startup precache;
- startup-shell entry budget;
- orbit-worker output existence;
- PWA identity, relative GitHub-Pages-safe scope/start URLs and icon completeness;
- an **8 MB** packaged-site ceiling.

### Release-candidate integrity gate

A dedicated `candidate:verify` gate was added to `npm run release`. It verifies the release version contract, package manager/runtime pins, lockfile consistency, source-map policy, service-worker lifecycle invariants, immutable action references, deterministic `npm ci` workflow use and removal of obsolete V1 workflow naming.

### Certified artifact retention

The verification workflow now uploads the exact certified production `dist` artifact for 14 days instead of certifying an ephemeral runner directory and discarding it.

For implementation head `0950e31ea963a0f3e5b798dbc3eff2bc6e7fe31b`:

- artifact ID: **10463687239**
- artifact name: `signal-earth-0950e31ea963a0f3e5b798dbc3eff2bc6e7fe31b`
- archive size: **1,671,297 bytes**
- artifact digest: `sha256:8c94c1380f2ac7bac774c62878482ff8bab55a8e3251deb8d2b610dd53007e7a`
- retention expiry: **2026-09-30**

## Release certification

Verify Release Candidate run **35137455166** completed successfully against the certified implementation head.

- [x] deterministic `npm ci` installation passes;
- [x] TypeScript passes;
- [x] **40/40** unit-test files pass;
- [x] **151/151** unit tests pass;
- [x] production build passes;
- [x] release artifact verification passes;
- [x] performance verification passes;
- [x] release-candidate integrity verification passes;
- [x] certified artifact upload passes.

Measured release-candidate package characteristics:

- production site: approximately **3.68 MB**;
- startup service-worker shell: **27** entries;
- HTML-linked/startup JavaScript: approximately **441.6 kB raw / 141.1 kB gzip**;
- Phase 25 startup limits: **480 kB raw / 145 kB gzip**;
- deferred JavaScript: **10 chunks**, approximately **2,015.3 kB raw** combined;
- Globe/Three.js core: approximately **1,966.45 kB raw / 556.42 kB gzip**;
- compiled CSS: approximately **101.62 kB raw / 19.07 kB gzip**;
- orbit worker: approximately **28.49 kB**.

The existing large WebGL-core warning remains visible rather than being suppressed. It is a known primary-surface bundle, while nonessential feature systems remain outside the startup JavaScript graph.

## Cross-browser release-candidate acceptance

Cross-browser QA run **35137455044** completed successfully against the same implementation head.

| Project | Result |
|---|---|
| Chromium desktop | PASS |
| Firefox desktop | PASS |
| WebKit desktop | PASS |
| Chromium ultrawide | PASS |
| Android Chromium emulation | PASS |
| iPhone WebKit emulation | PASS |
| iPad WebKit emulation | PASS |

The standard Chromium project additionally validates that packaged `release.json`, the generated service-worker cache version and the release version displayed in the application all agree.

The existing production interaction suite continues to cover viewport containment, Search/keyboard navigation, primary panels, Time controls, Saved Worlds, reduced-motion behavior, provider failure isolation, offline reopening, phone orientation changes and lazy-module failure containment.

## Scope and trust constraints

1. No new product feature is introduced.
2. No scientific provider, normalization rule, inference rule or trust window is changed.
3. No IndexedDB schema or Saved Worlds/public-state schema is changed.
4. No observer privacy behavior is changed.
5. No runtime backend, account system, telemetry system or cloud persistence is introduced.
6. Startup JavaScript architecture remains within the existing Phase 25 performance contract.
7. Phone/tablet CI targets remain browser-device emulations; physical-device visual/touch smoke testing remains a separate manual acceptance item.
8. Phase 29 certifies a **release candidate**. Final `2.0.0` promotion and production release closure belong to Phase 30.

## Acceptance

Phase 29 is accepted because the same implementation head passes the complete reproducible release gate and seven-project production interaction matrix, produces a retained digest-addressable release artifact, closes the identified packaging/service-worker/dependency/CI hardening defects, and does so without changing Signal Earth's product or scientific behavior.

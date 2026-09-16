# Signal Earth 2.0.1

Signal Earth 2.0.1 is a post-release stabilization update. It adds no new scientific provider, primary layer, persistence schema, observer privacy behavior, or product workflow.

## Fixed

- Prevented global keyboard shortcuts from firing while buttons, links, selects, sliders and other interactive controls have focus.
- Removed a duplicate country-search initialization effect.
- Added bounded provider request deadlines so stalled network calls can retry or fall back to valid cached data instead of loading forever.
- Prevented share/query navigations from accumulating redundant HTML app-shell copies in the service-worker runtime cache.
- Hardened accessibility preference startup when browser storage access itself throws.
- Ensured capture streams and ImageBitmap resources are released on unsupported or failed recording/capture setup paths.
- Added automatic Orbit worker recovery with catalog/category rehydration after fatal worker errors.
- Clamped remembered observer altitude to the supported terrestrial observer range and sanitized persisted acquisition timestamps.
- Kept Search's active descendant valid when live provider results change while Search is open.
- Hardened dialog focus filtering/restoration for hidden, inert or detached controls.

## Release infrastructure

- Versioned maintenance branches now run the permanent seven-target browser/device-emulation matrix.
- Verification/QA artifact upload moved from deprecated Node-20-based `actions/upload-artifact` v5 to immutable v7.0.1.
- Stable release integrity now checks maintenance-branch QA coverage, the current artifact action pin, and service-worker navigation-cache hygiene.
- A dependency security audit is executed during this stabilization pass before the patch is committed.

## Certification

The 2.0.1 release remains gated by deterministic install, TypeScript, the complete unit suite, production build/package/PWA verification, startup-performance verification, stable-release integrity verification, seven-target Playwright QA, GitHub Pages deployment, and retained-artifact publication with SHA-256 checksum.

Physical-device visual/touch smoke testing remains a separate manual check; Android/iPhone/iPad entries in CI are browser/device emulation.

# Phase 30 — Signal Earth 2.0 — Acceptance

## Goal

Promote the certified Phase 29 release candidate to the final **Signal Earth 2.0.0** production release, prove the exact final commit through the permanent release gates, publish a canonical `v2.0.0` GitHub Release from the already-certified build artifact, and close the 0–30 roadmap without reopening product scope.

Phase 30 is release closure only. It introduces no new scientific capability, provider, persistence model, primary interaction, visual redesign or backend service.

## Final version contract

Final version: **2.0.0**

Release implementation head before documentation closure: `91265b26b43e48b588b5b35646b8255c539a0a01`

The final release contract requires all of the following to agree:

- `package.json` version;
- `package-lock.json` top-level and root package versions;
- `src/app/version.ts`;
- generated `release.json`;
- generated service-worker cache namespace;
- version displayed by Signal Earth under Display → Release tools;
- final Git tag `v2.0.0`.

A prerelease suffix is rejected by the stable release integrity gate.

## RC → stable promotion

Phase 30 promotes `2.0.0-rc.1` to `2.0.0` without changing the application dependency graph or product behavior.

- package and in-app versions move to `2.0.0`;
- the npm lockfile is synchronized to the same stable identity;
- the Phase 29 `candidate:verify` command is retired;
- `release:integrity` replaces it and requires stable semantic versioning with no prerelease suffix;
- the verification workflow is renamed from **Verify Release Candidate** to **Verify Release**;
- the normal `npm run release` path remains the single local/CI certification entrypoint.

## Exact-commit certification

Phase 29 allowed documentation-only pushes to skip cross-browser QA. That optimization is removed in Phase 30.

Because production builds now embed the exact Git commit in `release.json`, every candidate final commit—including documentation closure commits—must be eligible for the same seven-project browser matrix. This ensures the SHA that is eventually tagged is the SHA whose generated package identity was actually exercised.

## Canonical release publication

Phase 30 adds `.github/workflows/publish-release.yml` as the final publication gate.

The publisher is triggered only after **Verify Release** completes successfully on `main`. It then:

1. resolves a stable semantic version from the exact verified commit;
2. requires matching release notes at `docs/RELEASE-<version>.md`;
3. waits for **Cross-browser QA** on the same SHA to complete successfully;
4. waits for **Deploy Signal Earth** on the same SHA to complete successfully;
5. downloads the retained `signal-earth-<sha>` artifact from the triggering Verify run;
6. verifies the artifact's `release.json` version and commit against the exact production SHA;
7. packages that retained artifact without rebuilding it;
8. emits a SHA-256 checksum;
9. creates the `v<version>` tag/release at that exact SHA;
10. attaches the certified production ZIP and checksum to the GitHub Release.

The publisher must not call Vite, `npm run build`, or `npm run release`. The release asset is derived from the build that was already certified, not from a second potentially different build.

If the tag already exists at a different commit, publication fails rather than moving the release tag.

## Release notes

`docs/RELEASE-2.0.0.md` is the canonical human-readable release note document. It summarizes the completed 2.0 product, release integrity model, scientific/trust boundaries and device-emulation coverage.

## Stable release verification

Stable verification run **35141398796** completed successfully on implementation head `91265b26b43e48b588b5b35646b8255c539a0a01` after the final exact-commit QA policy was introduced.

The same stable release command had already passed on `c03b103784d16161eeae5363751528ee8f9a78df` in run **35141291092** while the final QA policy correction was being isolated.

The final documentation-closure head must pass the same Verify Release gate again before promotion to `main`.

## Final production acceptance contract

Phase 30 is complete only when the exact final `main` SHA satisfies every item below:

- [ ] `main` points to the Phase 30 closure head;
- [ ] **Verify Release** succeeds on that SHA;
- [ ] all **7/7 Cross-browser QA** projects succeed on that SHA;
- [ ] **Deploy Signal Earth** succeeds on that SHA;
- [ ] the release publisher succeeds for that SHA;
- [ ] tag **`v2.0.0`** resolves to that SHA;
- [ ] GitHub Release **Signal Earth 2.0.0** exists and is not a prerelease;
- [ ] the release contains the certified production ZIP and `SHA256SUMS.txt`;
- [ ] the live GitHub Pages deployment serves Signal Earth **2.0.0**;
- [ ] live `release.json` identifies the same final SHA;
- [ ] the repository roadmap is closed through Phase 30.

These production facts are intentionally verified from GitHub/Pages after promotion rather than hard-coded into this document before the release exists.

## Scope and trust constraints

1. No new product feature is introduced.
2. No provider, normalization rule, scientific inference rule or trust window is changed.
3. No IndexedDB, Saved Worlds or share-state schema is changed.
4. No observer-location privacy behavior is changed.
5. No runtime backend, account system, telemetry service or cloud persistence is introduced.
6. Phase 25 startup-JavaScript budgets remain authoritative.
7. Phase 29 reproducible dependency/runtime/action pinning remains authoritative.
8. Automated Android/iPhone/iPad targets remain browser-device emulations; physical-device visual/touch smoke remains a separate manual check.
9. `v2.0.0` is immutable: the publication workflow refuses to repoint an existing release tag.

## Acceptance

Phase 30 acceptance is defined by exact-commit production evidence, not by a version-number change alone. Once the final closure head has passed Verify, 7/7 QA and Pages deployment and the gated publisher has created `v2.0.0` from the retained certified artifact, the Signal Earth 0–30 development roadmap is formally complete.

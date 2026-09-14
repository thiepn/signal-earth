# Signal Earth — Product Contract

## Definition

**Signal Earth is an interactive real-time observatory that lets users explore what is happening on Earth, what is moving above it, and what is happening above their own location.**

Signal Earth is a time-aware visual simulation of Earth and near-Earth space driven by real public data. Its product promise is **“Watch the planet move.”**

## Product pillars

| Pillar | Purpose |
| --- | --- |
| Earth | Earthquakes and major natural events |
| Orbit | Real satellites and orbital structures |
| Space | Geomagnetic activity and aurora |
| Here | Observer-relative conditions and objects above the user |
| Time | Replay and accelerate planetary systems |
| Cinematics | Turn scientific data into an explorable experience |

Time is architectural, not an optional feature.

## Exploration scales

### Planet
Earthquakes, natural events, day/night, aurora, sunlight, planetary context.

### Orbit
Satellites, orbital planes, ground tracks, following, categories, pass predictions.

### Here
User location, sunrise/sunset, Moon, local weather, satellites above horizon, ISS passes, auroral context.

Every major feature must belong clearly to one of these scales.

## V1 feature contract

V1 includes:

- 3D Earth
- day/night
- earthquakes
- NASA natural events
- satellite tracking and following
- orbital paths
- space weather
- aurora visualization
- Above Me
- unified time engine
- local-first search
- command palette
- cinematic briefings
- shareable views
- screenshot capture
- PWA/offline shell

## Explicit V1 non-goals

The following are excluded: aircraft, military tracking, AIS/vessels, CCTV, traffic, radio, live news, social media, AI chat, voice AI, Google Maps, street maps, photorealistic cities, accounts, user database, multiplayer, cloud sync, Supabase, runtime Node services, SSR, and server secrets.

Adding an excluded capability before V1 requires removing something of equal or greater complexity and revisiting the architectural decision record.

## Primary user loops

### Explore
Open Earth → rotate/zoom → see signal → select → inspect → focus/track → move time → share/continue.

### Orbit
Open Orbit → choose group → select satellite → view orbit → follow → accelerate time.

### Local
Above Me → allow location → local observatory → satellites above → next pass → horizon view.

### Discovery
Start briefing → automated planetary tour → discover event → exit into free exploration.

## Product UX invariants

1. The globe is always the primary interface.
2. There is only one primary selection.
3. Manual camera input cancels automated following unless intentionally locked.
4. Every live-data layer exposes source and freshness.
5. Simulation time comes from one `TimeEngine`.
6. High-frequency simulation data never enters React state.
7. No V1 feature may require a runtime server.
8. A new layer is not accepted merely because the data exists.
9. Mobile is a first-class interface.
10. Visual effects never masquerade as measured scientific data.

## Feature quality gate

A major feature must satisfy all of the following:

1. Fits Earth / Orbit / Space / Here.
2. Has a reliable and attributable source.
3. Works browser-first.
4. Has clear temporal semantics.
5. Has a distinct, useful visualization.
6. Does not substantially degrade performance.

Fail one: reject or defer.

## V1 success criteria

| Test | Requirement |
| --- | --- |
| First interaction | Globe manipulation is understandable immediately |
| Event discovery | Earthquake inspectable in ≤2 actions |
| ISS discovery | ISS follow mode reachable in ≤3 actions |
| Timeline | Understandable without tutorial |
| Data trust | Source/freshness visible |
| Performance | Smooth with normal satellite catalog |
| Mobile | Core experience fully usable |
| Failure | Provider outage does not break the app |
| Deployment | Fresh clone builds via GitHub Actions |
| Infrastructure | Zero runtime backend |
| Identity | Clearly distinct from God's Eye View |

## Fundamental engineering rule

> Remote services provide data. Signal Earth provides the experience.

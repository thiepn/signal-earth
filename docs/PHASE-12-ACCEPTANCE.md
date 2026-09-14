# Phase 12 — Search & Commands Acceptance

**Version:** `0.12.0-phase12`  
**Scope:** local-first ranked search, deterministic commands, keyboard workflow, entity/layer/category resolution and navigation.

## Product acceptance

Phase 12 is complete when `/` acts as a single command palette for finding Signal Earth objects and operating the application without adding AI, remote geocoding or a parallel state system.

### Search coverage

The local search index includes:

- earthquakes valid at the selected simulation time
- NASA EONET natural events valid at the selected simulation time
- satellites from the currently loaded CelesTrak catalog
- a small bundled global city catalog
- country navigation derived from the existing Natural Earth GeoJSON
- four primary layers
- five V1 satellite categories
- four visual modes

Search remains useful before remote provider data has loaded because city/country/system documents are local.

### Ranking

- Exact title/alias matches outrank prefixes.
- Prefixes outrank generic substring matches.
- Multi-token queries require all tokens to resolve against the document.
- Small single-word typos are tolerated through bounded edit-distance matching.
- `M6+`-style queries are treated as explicit earthquake-magnitude filters rather than fuzzy text.
- Important objects such as the ISS receive a modest deterministic priority boost, not a hardcoded always-first override.

Expected examples:

```text
Tokyo
Köln
NYC
ISS
25544
GPS
weather satellites
earthquakes Japan
M6+
volcanoes
night
```

### Command system

Commands are parsed deterministically and compile to existing Signal Earth actions/state changes.

Supported command families include:

```text
goto tokyo
focus cologne
follow iss

show earthquakes
hide aurora
only orbit
only weather

mode night
signal
wireframe

speed 1x
speed 10x
speed 100x
speed 1000x
pause
play
live
rewind 6h
forward 3h

here
reset
help
```

There is no language model, remote intent service or free-form action execution.

### Resolution behavior

- City/country matches become canonical `location` entities before focus.
- Earthquake matches enable the earthquake layer and use the canonical selection/focus action path.
- Natural-event matches enable EONET, enable the event's category and focus the geometry applicable at the current simulation time.
- Satellite matches enable Orbit and a compatible category before canonical selection.
- `follow <satellite>` queues a follow request until propagated telemetry is available.
- If Orbit is not yet loaded, a satellite follow/navigation command enables Orbit and resolves automatically when the cached/fetched CelesTrak catalog becomes ready.
- Layer/category/mode results change the same state used by their ordinary UI controls.

### Timeline correctness

Search does not surface an observed event before it exists at the current simulation timestamp.

```text
loaded USGS/EONET data
       ↓
current TimeEngine timestamp
       ↓
visible entities
       ↓
search index
```

Satellite search remains based on the loaded orbital catalog because satellite existence/propagation is handled independently by the orbit engine.

### Keyboard UX

- `/` opens search from anywhere outside text inputs.
- `↑` / `↓` move through command + result rows.
- `Enter` executes the active row.
- `Esc` closes the palette.
- A syntactically valid command appears as a dedicated **RUN** row above ordinary search results.
- Clicking and keyboard execution use identical handlers.

### Mobile

- The same palette is used on mobile; there is no separate mobile search implementation.
- The result list is height-bounded and scrollable.
- Search-result selection continues into existing mobile Inspector behavior where applicable.

## Architecture acceptance

```text
loaded provider data       local navigation data
        │                         │
        └─────────┬───────────────┘
                  ↓
            SearchDocument[]
                  ↓
          deterministic ranking
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
   Search result       parsed command
        │                   │
        └─────────┬─────────┘
                  ↓
           existing app actions
         / canonical callbacks
                  ↓
 layer / selection / camera / TimeEngine
```

Search code does not own provider fetching, WebGL objects, orbit propagation or a second application store.

## Explicit non-goals

Phase 12 does not add:

- AI/NLP intent interpretation
- remote geocoding
- arbitrary web search
- fuzzy global address lookup
- user search history syncing
- server-side search index
- voice input
- natural-language multi-step planning

## Validation completed

- strict TypeScript checking of the pure Phase 12 search/ranking/command modules
- all project TS/TSX files pass syntax/transpile validation
- runtime checks confirm:
  - `goto Tokyo` → navigate intent
  - `follow ISS` → follow intent
  - `only GPS` → navigation-category intent
  - `rewind 6h` → −6 hour seek intent
  - `ISS` ranks the ISS object first
  - `weather satellites` ranks the weather category first
  - small typo `tokoy` resolves to Tokyo
- no stale Phase 2 search placeholder remains
- npm dependency installation was attempted but registry access timed out in the execution environment; a full Vite dependency build is not claimed as locally verified

## Definition of done

A user can press `/`, find a currently relevant Earth event, satellite, city, country, layer or category, navigate/select it with keyboard or pointer, or issue deterministic commands that manipulate the same application state as normal controls—all locally and without AI or a new backend/provider.

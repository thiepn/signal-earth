# Signal Earth 2.1.2

Signal Earth 2.1.2 is a visual-quality correction for the 2.1.1 runtime-performance hotfix. It keeps the performance architecture and restores a substantially sharper default presentation on capable hardware.

## Visual-quality correction

- Auto quality no longer selects Low solely because a fine-pointer desktop has a large high-DPI framebuffer. CPU/memory constraints remain part of the initial decision, while measured frame health controls later adaptation.
- Preferred Low now renders at **0.75 DPR** instead of the 2.1.1 emergency-style 0.5 DPR, restores normal built-in atmosphere, increases the Low star budget to **360**, and uses a smoother reduced globe silhouette.
- Low NASA GIBS imagery increases from **512×256** to **768×384** while Medium and High remain **1024×512** and **1536×768**.
- Medium remains **1.0 DPR** and High remains **1.4 DPR**. The structural 2.1.1 optimizations remain intact: no live backdrop blur over WebGL, one-draw country borders, reduced Low cloud shader, throttled orbit/astronomy work, stable Search indexing, and reduced top-level clock synchronization.

## Adaptive emergency fallback

- A separate hidden emergency profile is used only while Auto is already at Low and measured frame health is severe.
- Emergency mode activates when average FPS falls below **30**, p95 frame time exceeds **55 ms**, or long-frame rate exceeds **18%**.
- Emergency detection begins after three seconds so constrained hardware can settle before sustained-cadence measurement, while normal Auto tier changes still ignore the first five seconds of startup shader/texture work.
- The emergency-only framebuffer floor is **0.45 DPR**, with a **120-satellite** and **180-star** cap. This aggressive fallback is not the normal Low presentation and is never used merely because a display is high resolution.
- Recovery requires sustained healthy measurements before returning to preferred Low, avoiding quality oscillation.

## Regression protection

- Chromium desktop QA verifies that a capable 8-core/8-GB profile does **not** boot into emergency-resolution rendering and keeps a canvas resolution ratio of at least 0.9 relative to CSS pixels.
- The existing constrained Chromium test still requires at least **40 FPS**, p95 frame time no greater than **45 ms**, long-frame rate no greater than **10%**, and no live backdrop blur.
- The final 2.1.2 candidate passes the clarity gate and sustained cadence gate on the first attempt, plus the complete seven-target browser/device-emulation matrix.
- Existing deterministic install, TypeScript, unit, build, PWA/package, performance-budget and release-integrity gates remain mandatory.

## Product boundary

No provider contract, normalized data schema, IndexedDB schema, observer privacy behavior, Saved Worlds behavior, service-worker reliability contract, astronomical/orbital math, or primary workflow semantics are changed by this patch.

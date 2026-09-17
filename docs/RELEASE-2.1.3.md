# Signal Earth 2.1.3

Signal Earth 2.1.3 fixes the blocky, low-detail geography exposed by close regional zoom while preserving the runtime-performance improvements shipped in 2.1.1 and 2.1.2.

## Geography fidelity correction

- Regional and local views now use bundled **Natural Earth 1:50m country geometry** instead of magnifying the low-resolution world-overview asset.
- The bundled regional asset contains 241 polygon features and roughly 99,600 source coordinate points after deterministic size reduction. Boundary vertices are preserved by the runtime renderer; quality adaptation does not simplify the coastline source data.
- The original textured globe remains the lightweight whole-Earth overview surface. At regional zoom, Signal Earth switches to a separate smooth ocean shell plus detailed vector land polygons so reduced overview tessellation cannot become the visible close-zoom coastline.
- The detailed layer is spatially culled around the current point of view rather than triangulating the entire 1:50m world on every frame.
- Polygon cap curvature is bounded at 5 degrees for interior spherical fill. This affects fill tessellation only; it does not discard coastline vertices.
- The older low-resolution country-outline mesh is overview-only. When the 1:50m regional layer is active, detailed polygon strokes own the visible coast/border line so coarse outlines cannot be drawn over corrected geography.
- If the detailed bundled asset cannot load, the existing low-resolution local asset remains a presentation fallback rather than breaking the observatory.

## Performance and regression protection

- A Chromium production regression moves the camera to the Istanbul region and verifies that runtime activates `regional-50m` geography rather than the low-resolution fallback.
- Existing capable-desktop resolution-floor and constrained-device cadence gates remain mandatory.
- The implementation passed Verify Release and the complete seven-target browser/device-emulation matrix across Chromium, Firefox, WebKit, ultrawide desktop, Android/Chromium, iPhone/WebKit and iPad/WebKit before release closure.
- The final stable commit is re-certified after version/docs/cleanup so the release tag, retained production artifact and deployment all resolve to one exact SHA.

## Data/source boundary

Natural Earth geometry is a bundled public-domain visual asset. Signal Earth makes no runtime Natural Earth network request and does not add a tile service or backend. The 1:50m geometry is presentation/cartographic context, not scientific observation data.

## Product boundary

No provider contract, normalized scientific schema, IndexedDB schema, observer privacy rule, Saved Worlds representation, astronomical/orbital math, service-worker reliability contract, or primary product workflow changes in 2.1.3.

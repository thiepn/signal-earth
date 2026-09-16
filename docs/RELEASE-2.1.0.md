# Signal Earth 2.1.0

Signal Earth 2.1.0 is a visual-system overhaul focused on removing generic AI/dashboard styling without changing the scientific product model.

## Visual direction

- Replaced floating glass-card chrome with open ruled observatory surfaces.
- Rebuilt the top bar as a quiet masthead instead of a rounded dashboard container.
- Reworked the brand voice and typography hierarchy with an editorial display face for identity and restrained sans/mono roles for controls and measurements.
- Reduced cyan saturation, glow, gradients, shadows, pills and decorative animation across the application.
- Replaced rounded control clusters with crisp near-square controls and explicit rule/active states.
- Restyled Layers, Inspector, Timeline, Search, Signal Earth Now, Above Me, Briefings, Settings, provider health and mobile surfaces as one coherent instrument family.
- Converted layer rows and data grids from card stacks into compact ruled lists/reports.
- Grounded the mobile dock at the viewport edge instead of presenting it as a floating glass pill.
- Preserved accessibility focus, high-contrast, forced-colors, reduced-motion and coarse-pointer behavior.

## Product boundary

No scientific provider, normalized data schema, IndexedDB schema, time model, orbit mechanics, Saved Worlds behavior, observer privacy behavior, service-worker reliability contract or primary workflow changes in 2.1.0.

## Certification

The release remains gated by deterministic install, TypeScript, the complete unit suite, production package/PWA verification, startup-performance verification, stable-release integrity, the seven-target Playwright matrix and exact-SHA GitHub Pages deployment before publication.

Physical Android/iPhone/iPad testing remains a manual check; those CI targets are browser/device emulation.

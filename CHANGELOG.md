# Changelog

## Unreleased — Mockup Vision V2

### Added
- photo-first Studio for flat-surface mockups;
- **Create scene / Use my photo** dual workflow;
- brand-safe scene briefing that keeps logos/text out of generated scenes;
- optional product and scene/style reference inputs;
- generated-scene handoff back into the editor;
- provider-agnostic server-side generation contract documentation;
- local object-detection seed with GPU → CPU fallback;
- four-corner perspective fitting;
- Apply and Replace modes;
- deterministic old-mockup neutralization;
- scene-light preservation and blend/tone controls;
- local PNG export;
- regression coverage for planar geometry and scene-brief rules.

### Changed
- product positioning moves from live cylindrical camera mockups to a broader photo-first workflow: **Create → Detect → Apply**;
- original cylindrical experience remains preserved as **Cylinder Lab**;
- CI validates feature branches with Node.js 24.

### Known limitations
- scene generation provider is not connected yet;
- automatic detection still seeds a rectangle rather than exact perspective geometry;
- Replace mode is neutralization, not semantic inpainting;
- occlusion-aware masking is not implemented;
- cylinders and bottles are deferred until planar workflow is validated.

## 0.1.0 — Professional foundation

### Added
- professional product/research positioning;
- architecture and validation documentation;
- security and contribution guidance;
- CI regression checks for the static runtime contract.

### Clarified
- automatic detection is a coarse bootstrap, not a can-specific classifier;
- manual fitting is an intentional fallback;
- third-party runtime/model assets are network dependencies even though user images remain local.

## Prototype baseline

- live camera and photo input;
- EfficientDet Lite2 → Lite0 model fallback;
- classical edge tracking and geometry estimation;
- Three.js cylindrical label rendering;
- real-scene luminance compositing;
- manual and four-corner fitting;
- PNG export.

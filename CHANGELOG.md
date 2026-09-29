# Changelog

## Unreleased

### Added
- guided Studio UX organized around Brief → Scene → Arts → Mockup;
- natural-language generation request with optional product/model and scene/inspiration references;
- Generate and Iterate client contract with in-session version history;
- provider-agnostic `/api/generate-scene` contract;
- multi-file brand/artwork upload;
- multiple editable mockup slots in one scene;
- automatic artwork-to-slot assignment;
- provider slot metadata normalization;
- local multi-area detection fallback;
- manual add/remove/reassign controls per mockup area;
- per-area Apply/Replace and realism controls;
- regression tests for multi-slot state and iterative generation requests.

### Changed
- Photo Studio now uses `studio-app.js` as the active V2 implementation;
- scene briefing accepts either natural language, references, or both;
- generated scenes can request up to eight mockup slots;
- README and product vision now describe the guided multi-art workflow.

### Preserved
- `index.html` remains the Cylinder Lab for the later cylindrical/proxy-3D pass;
- older V2 modules remain temporarily for comparison while the new Studio is validated.

### Clarified
- scene generation is not yet connected to a production provider;
- generated slot metadata is optional and falls back to local detection/manual areas;
- automatic detection proposes geometry but does not replace user correction;
- old-art cleanup remains deterministic neutralization, not semantic inpainting.

## Prototype baseline

- live camera and photo input;
- EfficientDet Lite2 → Lite0 model fallback;
- classical edge tracking and geometry estimation;
- Three.js cylindrical label rendering;
- real-scene luminance compositing;
- manual and four-corner fitting;
- PNG export.

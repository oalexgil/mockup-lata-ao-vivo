# Mockup Vision

**Create the scene. Apply your brand.**

Mockup Vision is evolving into a guided photo-first mockup studio. The product separates scene generation from final brand application so AI can invent the product, composition and lighting without redrawing or distorting the user's real logo, label or artwork.

> **Status:** functional V2 prototype. The guided editor, multi-art workflow, multi-slot placement and local rendering are implemented. The production image-generation provider still needs to be connected through a secure server-side adapter.

## The product flow

```text
1. Describe / reference
        ↓
2. Generate / iterate
        ↓
3. Upload one or many artworks
        ↓
4. Detect or edit one or many mockup areas
        ↓
5. Auto-assign artwork to areas
        ↓
6. Tune realism
        ↓
7. Export PNG
```

The UI is intentionally centered on this flow instead of exposing the technical pipeline first.

## 1 — Describe what you need

The user can start with:

- a natural-language request;
- product/model/object reference images;
- scene/inspiration/style reference images;
- or any combination of those inputs.

A request can be simple:

```text
recyclable cup tilted in motion, white background, soft studio light
```

or multi-surface:

```text
minimal presentation mockup with six graphic pieces on a neutral pink background,
one of them displayed on a laptop screen
```

The user may also request an explicit number of customizable spaces.

## 2 — Generate and iterate

The Studio calls:

```text
POST /api/generate-scene
```

The same endpoint supports first generation and iteration. Generated versions are kept as a lightweight in-session history (`V1`, `V2`, `V3`…), allowing the user to select an earlier result and request a change in natural language.

When the provider is not configured in the current environment, the UI exposes a manual import fallback so the rest of the Studio remains testable.

See [docs/GENERATION_API.md](docs/GENERATION_API.md).

## Brand-safe generation

The generator follows one strict product rule:

> **The generator creates the world. Mockup Vision applies the brand.**

Generation prompts explicitly request clean customizable areas with no readable logo, brand, label or invented identity. The original artwork is applied later by Mockup Vision.

This keeps brand fidelity outside the generative model.

## 3 — Upload multiple artworks

The user can upload one or many:

- logos;
- labels;
- posters;
- package fronts;
- campaign pieces;
- screen designs;
- presentation assets.

All files are loaded together and can be distributed automatically across the mockup areas.

## 4 — Multi-slot mockups

A **slot** represents one editable mockup area.

Each slot has:

- four-point geometry;
- an assigned artwork;
- Apply or Replace mode;
- zoom and rotation;
- opacity;
- old-art neutralization;
- lighting preservation;
- brightness/contrast/saturation;
- blend mode.

A scene may contain one slot or many.

Example:

```text
6 uploaded artworks
        ↓
6 generated/detected mockup slots
        ↓
automatic 1:1 assignment
        ↓
manual reassignment still available
```

If there are more slots than artworks, assignment cycles through the available assets instead of blocking the workflow.

## Surface discovery

Mockup Vision uses three levels:

1. **provider slot metadata** — preferred when the generation backend can return mockup quadrilaterals;
2. **local object detection** — MediaPipe/EfficientDet proposes several areas;
3. **manual areas** — the user can add and edit any number of four-corner regions.

Automation is always editable.

## Existing mockup replacement

**Replace** mode neutralizes part of the old artwork inside a selected region before the new artwork is rendered.

The current version is deterministic blur/neutralization, not semantic inpainting. It works as a first-pass replacement while preserving much of the original light and texture.

Future work will add:

- segmentation;
- occlusion-aware composition;
- semantic inpainting;
- better texture reconstruction.

## Realism

The current browser renderer combines:

- dense perspective warp;
- four-corner geometry;
- artwork tone controls;
- scene multiply/screen passes;
- blend modes;
- optional old-art cleanup.

The goal is a plausible editable mockup, not a claim of perfect physical simulation.

## Current V2 files

```text
photo.html                # guided Studio UI
studio-app.js             # generation + multi-slot + rendering orchestration
src/studio-core.js        # slot/version/generation request helpers
src/scene-brief.js        # brand-safe prompt normalization
src/planar-core.js        # planar geometry helpers

docs/GENERATION_API.md    # secure provider contract
docs/PRODUCT_VISION.md    # product UX and roadmap

index.html                # preserved Cylinder Lab
```

The older `photo-app.js` and `scene-builder.js` are preserved temporarily while V2 is validated, but `photo.html` now uses `studio-app.js` as the active implementation.

## Cylinder Lab

The original can/cylinder experiment remains in `index.html`:

- camera/photo input;
- EfficientDet bootstrap;
- edge tracking;
- cylinder fitting;
- Three.js label rendering;
- manual fallbacks;
- PNG export.

It is intentionally paused while the planar Studio matures. Later cylinder/bottle work should reuse the same slot/project model instead of rebuilding a separate product UX.

## 2D → 3D boundary

A single photo can support proxy 3D for assumed simple geometry, but cannot faithfully reveal arbitrary unseen sides of an object.

Future cylinder work may support constrained proxy rotation for cans, bottles and boxes. True arbitrary 3D reconstruction remains outside the current claim.

## Development

Serve the static Studio:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/photo.html
```

Repository checks:

```bash
npm run ci
```

The CI validates the active V2 modules and regression tests on Node 24.

## Privacy and security

Local editing remains browser-side. A production generator must use a server-side adapter; provider secrets must never live in browser JavaScript or `localStorage`.

See [SECURITY.md](SECURITY.md) and [docs/GENERATION_API.md](docs/GENERATION_API.md).

## Current limitations

- production image-generation provider is not connected yet;
- generic object detection is not dedicated mockup-surface segmentation;
- provider-returned slot metadata depends on the future backend implementation;
- old-art removal is not semantic inpainting;
- occlusion masks are not implemented;
- visual regression fixtures still need expansion.

## Roadmap

### V2.1 — generation integration
- connect provider backend;
- return generated image + mockup slot metadata;
- preserve iteration/version history.

### V2.2 — smarter placement
- dedicated surface/rectangle discovery;
- occlusion masks;
- stronger automatic slot proposals;
- before/after comparison.

### V2.3 — replacement quality
- semantic inpainting;
- texture-aware reconstruction;
- reflection/occlusion handling.

### V3 — cylinders and proxy 3D
- cans;
- bottles;
- cups/jars;
- simple proxy object rotation;
- shared Studio controls and multi-slot project state.

## License

MIT. See [LICENSE](LICENSE).

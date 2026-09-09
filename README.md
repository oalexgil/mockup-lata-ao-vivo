# Mockup Vision

**Create the scene. Apply your brand.**

Mockup Vision is a photo-first mockup studio that separates two jobs that generative image models often mix badly:

1. **create the product scene** without branding;
2. **apply the real logo/artwork afterwards** with perspective, lighting and manual control.

The result is a cleaner product workflow: AI can invent the scene, but the final brand asset is not redrawn or distorted by the generator.

> **Status:** functional prototype / product experiment. The planar editor works today; scene generation is already modeled in the UI and contract, while the production image-generation provider still needs a secure backend adapter.

## Product flows

### Create scene

The V2 Studio can collect:

- product description;
- scene/composition description;
- visual style;
- desired mockup surface;
- optional product reference image;
- optional scene/style reference image;
- additional notes.

It produces a **brand-safe generation brief** that explicitly asks the generator for a product with no logo, brand text or readable label on the customizable area.

Until a server-side generator adapter is connected, the prompt can be copied to an external image generator and the resulting image loaded back into Mockup Vision.

### Use my photo

The user can instead upload any existing photo or mockup and continue directly into the same editor.

Both flows converge on:

```text
Create scene OR upload photo
        ↓
Detect/edit target surface
        ↓
Upload real artwork
        ↓
Apply or Replace
        ↓
Perspective + light + blend
        ↓
Export PNG
```

## Photo Studio

Open:

```text
photo.html
```

Current capabilities:

- create-scene briefing workflow;
- product and scene reference uploads for future generator integration;
- photo-only editing — no camera required;
- local MediaPipe object detection used to seed a surface box;
- four draggable corners for exact perspective fitting;
- grid-based perspective warp for artwork;
- artwork zoom and rotation;
- opacity, brightness, contrast and saturation controls;
- Normal, Multiply, Overlay and Soft Light blend modes;
- original-scene light/shadow preservation;
- **Replace** mode that neutralizes an older mockup/label before applying the new artwork;
- local PNG export.

## Brand-safe scene generation

The key product rule is simple:

> **The generator creates the world. Mockup Vision applies the identity.**

The generator is responsible for product form, material, composition, lighting and a clean customizable surface. It should not be asked to reproduce the final logo, label typography or brand artwork.

The normalized contract lives in:

```text
src/scene-brief.js
```

The planned secure provider boundary is documented in:

```text
docs/GENERATION_API.md
```

No provider API key should be embedded in browser JavaScript or persisted in `localStorage`.

## Surface detection

Automatic detection is intentionally a **seed**, not an authority. The generic EfficientDet model finds plausible objects such as laptops, books, screens and packaging. Mockup Vision converts the best candidate into an editable surface, and the user finalizes geometry through four corner handles.

That keeps automation useful without pretending the model inferred exact printable geometry.

## Replacing an existing mockup

**Replace** mode supports photos that already contain a logo, screen image, label or prior mockup.

The first implementation performs local blur/neutralization inside the selected quadrilateral before the new artwork is applied. It reduces old high-frequency text/logo detail while preserving part of the original lighting structure.

This is not semantic inpainting yet. Complex occlusion, reflections, folds and highly textured regions remain second-pass refinement work.

## Cylinder Lab

The original can/cylinder experiment remains preserved in `index.html` as **Cylinder Lab**:

- camera/photo input;
- EfficientDet bootstrap;
- classical edge tracking;
- cylinder estimation;
- Three.js label rendering;
- manual/four-corner fallbacks;
- PNG export.

The current product focus is planar photography first. Cylinders and bottles return after the flat-surface editor is mature.

## 2D photo → 3D

A single 2D photo can support proxy 3D for known simple geometries, but it cannot faithfully reveal arbitrary hidden sides of an object.

Future cylinder work can fit a cylinder/cone/box proxy and enable constrained viewpoint changes. True free rotation of arbitrary photographed products requires additional depth or 3D reconstruction information and is not a current product claim.

## Architecture

```text
photo.html
├── scene-builder.js
├── photo-app.js
└── src/
    ├── scene-brief.js
    └── planar-core.js

index.html              # preserved Cylinder Lab
```

Product pipeline:

```text
GENERATE
  scene brief → provider adapter → clean scene image

DETECT
  object seed → editable quadrilateral

APPLY
  artwork → perspective → replacement → lighting → export
```

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Runtime dependencies

The browser editor loads pinned MediaPipe Tasks Vision `0.10.14` and EfficientDet Lite2/Lite0 assets. Detector initialization tries GPU and then CPU.

The scene-brief and planar geometry modules have no runtime dependency and are covered by Node.js regression tests.

## Local development

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/photo.html
```

Repository validation:

```bash
npm run ci
```

## Privacy

The current editor processes photos and artwork locally in the browser. Reference images selected for the not-yet-connected scene generator also remain local in this static V2.

When generation is connected, image/reference transmission must occur through a documented provider adapter with an explicit retention policy and server-side secret handling.

See [SECURITY.md](SECURITY.md).

## Known limitations

- the image-generation provider is not connected yet;
- generic object detection does not identify every printable surface;
- automatic detection currently creates a rectangular seed rather than a perspective-aware quad;
- Replace mode is deterministic neutralization, not semantic inpainting;
- occlusions are not segmented;
- perspective uses a dense affine triangle-mesh approximation;
- visual regression fixtures are still needed.

## Roadmap

### Pass 1 — Photo Studio

- [x] upload/photo workflow;
- [x] create-scene briefing UX;
- [x] brand-safe generation prompt contract;
- [x] four-corner perspective fitting;
- [x] local object-detection seed;
- [x] realistic blend/tone controls;
- [x] old-mockup neutralization;
- [x] PNG export;
- [ ] connect server-side image-generation adapter;
- [ ] smarter quadrilateral detection;
- [ ] mask/occlusion support;
- [ ] semantic inpainting option;
- [ ] before/after comparison and presets.

### Pass 2 — Cylindrical return

- cans;
- bottles;
- cups and jars;
- proxy 3D rotation;
- shared material/light controls from Photo Studio.

### Pass 3 — broader surfaces

- boxes;
- pouches;
- screens;
- garments where deformation can be modeled reliably.

## License

MIT. See [LICENSE](LICENSE).

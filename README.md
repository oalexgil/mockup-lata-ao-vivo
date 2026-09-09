# Mockup Vision

Browser-based mockup studio for applying artwork to real photos with perspective fitting, local object detection and manual four-corner control.

The project is evolving from a cylindrical live-camera experiment into a **photo-first mockup engine**. The current V2 branch focuses on flat surfaces because they are easier to validate, more useful for real client photos and a better foundation for later cylindrical and 3D work.

> **Status:** functional prototype / product experiment. Automatic detection is only a seed; the user remains in control of the final fit.

## V2 direction

The primary workflow is now:

1. upload a base photo;
2. upload artwork;
3. detect a plausible object/surface locally;
4. adjust the four corners manually;
5. apply perspective and scene-aware compositing;
6. optionally neutralize an older mockup/label underneath;
7. export a local PNG.

The original cylindrical camera experiment remains preserved as **Cylinder Lab** in `index.html`. The new flat-surface workflow lives in `photo.html`.

## Photo Studio

Open:

```text
photo.html
```

Current capabilities:

- photo-only workflow — no camera required;
- local MediaPipe object detection used to seed a surface box;
- four draggable corners for exact perspective fitting;
- grid-based perspective warp for the artwork;
- artwork zoom and rotation;
- opacity, brightness, contrast and saturation controls;
- Normal, Multiply, Overlay and Soft Light blend modes;
- scene-light preservation pass so the result inherits part of the original shadows/highlights;
- **Replace** mode that softens/neutralizes a previous mockup before applying the new artwork;
- local PNG export;
- no intentional upload of the user's photo or artwork.

## What “automatic detection” means

The detector is not a universal mockup-surface model. It uses a generic EfficientDet model to find plausible objects such as laptops, screens, books and packaging, then converts the best bounding box into an editable four-corner surface.

That is intentionally conservative:

- automation gets the user close;
- four-corner fitting provides precision;
- the product never needs to pretend the detector understood geometry it did not actually infer.

## Replacing an existing mockup

The V2 **Replace** mode is designed for photos that already contain artwork, a screen image or an existing label.

The first implementation uses a local blur/neutralization pass inside the selected quadrilateral before applying the new art. This reduces high-frequency text/logo detail while retaining much of the original lighting structure.

It is useful for first-pass replacement, but it is **not semantic inpainting**. Complex occlusion, reflections, folds or highly textured labels may still require a future inpainting/segmentation layer.

## Realism controls

The engine currently combines:

- perspective fitting;
- user-adjusted quadrilateral geometry;
- image blend modes;
- artwork tone controls;
- original-scene multiply/screen passes;
- optional cleanup of an existing mockup.

The goal is not to generate a new scene. It is to make the uploaded artwork inherit enough geometry and lighting from the existing photo to look plausible and editable.

## Cylinder Lab

`index.html` keeps the original cylindrical experiment:

- camera/photo input;
- EfficientDet bootstrap;
- classical edge tracking;
- cylinder estimation;
- Three.js label rendering;
- four-corner/manual fallbacks;
- PNG export.

This code is intentionally preserved while Photo Studio matures. Later work can reuse the stronger V2 UX and editing pipeline when cylindrical surfaces return.

## 2D photo → 3D rotation

A single 2D photo can support **proxy 3D** for simple known geometries, but not faithful arbitrary-object reconstruction.

Future cylindrical work can fit a proxy cylinder/cone/box and allow limited viewpoint changes. True free rotation of an arbitrary photographed object would require additional depth/3D reconstruction information and is outside the current V2 claim.

## Architecture

```text
photo.html
photo-app.js
src/
└── planar-core.js

index.html              # preserved Cylinder Lab
```

Target direction:

```text
src/
├── core/
├── detection/
├── fitting/
├── editing/
├── surfaces/
├── rendering/
└── ui/
```

The next refactor should move browser-independent geometry and compositing decisions out of `photo-app.js` without changing the validated UX.

## Runtime dependencies

The current browser prototype loads pinned MediaPipe Tasks Vision `0.10.14` and EfficientDet Lite2/Lite0 model assets. Detector initialization tries GPU first and CPU second.

The planar geometry core has no runtime dependency and is covered by Node.js tests.

## Local development

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/photo.html
```

Repository validation:

```bash
npm run ci
```

## Privacy

Photos and artwork are processed in the browser by the application. The code does not intentionally upload user inputs. Third-party model/runtime assets are still fetched from external hosts.

See [SECURITY.md](SECURITY.md).

## Known limitations

- generic object detection does not directly detect every printable surface;
- automatic detection currently produces a rectangular seed, not a perspective-aware quadrilateral;
- replacement mode neutralizes old artwork but does not perform semantic inpainting;
- occlusions are not segmented yet;
- the perspective warp uses a dense affine triangle mesh approximation;
- visual quality still needs fixture-based regression testing across real photographs.

## Roadmap

### Pass 1 — Photo Studio

- [x] flat-surface photo workflow;
- [x] four-corner perspective fitting;
- [x] local object-detection seed;
- [x] realistic blend/tone controls;
- [x] old-mockup neutralization;
- [x] PNG export;
- [ ] smarter quadrilateral/surface detection;
- [ ] mask/occlusion support;
- [ ] semantic inpainting option;
- [ ] project presets and before/after comparison.

### Pass 2 — Cylindrical return

- cans;
- bottles;
- cups and jars;
- proxy 3D rotation;
- reusable material/light controls from Photo Studio.

### Pass 3 — broader surfaces

- boxes;
- pouches;
- screens;
- garments where deformation can be modeled reliably.

## License

MIT. See [LICENSE](LICENSE).

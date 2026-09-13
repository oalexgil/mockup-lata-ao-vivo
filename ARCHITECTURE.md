# Architecture

## Product split

Mockup Vision now has two explicit product surfaces:

1. **Studio (`photo.html`)** — active direction for AI-assisted scene creation and photo mockups on flat surfaces;
2. **Cylinder Lab (`index.html`)** — preserved cylindrical/camera research prototype.

The Studio is organized around three engines:

```text
GENERATE → DETECT → APPLY
```

The goal is to let AI invent the product scene while Mockup Vision remains responsible for applying the final brand asset accurately.

## Current V2 architecture

```text
photo.html
├── scene-builder.js
│   ├── product / scene brief
│   ├── product reference input
│   ├── scene/style reference input
│   ├── brand-safe prompt preview
│   └── generated-scene handoff
│
├── photo-app.js
│   ├── local photo/artwork input
│   ├── MediaPipe detector bootstrap
│   ├── GPU → CPU detector fallback
│   ├── four-corner editing
│   ├── dense planar warp
│   ├── old-mockup neutralization
│   ├── lighting/blend controls
│   └── PNG export
│
└── src/
    ├── scene-brief.js
    └── planar-core.js

index.html
└── preserved Cylinder Lab
```

## V2 product pipeline

```text
CREATE SCENE
product + scene + references
  ↓
brand-safe scene brief
  ↓
server-side generation adapter (planned)
  ↓
clean unbranded product scene

OR

USE MY PHOTO
local image

        ↓
DETECT
object detector seed (optional)
  ↓
editable four-corner surface

        ↓
APPLY
old-art neutralization (optional)
  ↓
real artwork preprocessing
  ↓
planar perspective warp
  ↓
scene-light preservation
  ↓
PNG export
```

## Generate boundary

Scene generation must be provider-agnostic from the editor's perspective.

The application-level contract is:

```text
generateScene(sceneBrief, references) -> generatedImage
```

`src/scene-brief.js` owns the normalized scene brief and generation prompt rules. It intentionally instructs the generator to leave the customizable surface free from logos, brand text and readable labels.

A production provider must be called through a server-side adapter. Provider API keys must not be embedded in browser JavaScript or persisted in browser storage.

See `docs/GENERATION_API.md`.

## Detect boundary

The automatic detector is deliberately non-authoritative. A generic bounding box can be useful as a starting point, but it cannot guarantee the exact printable surface.

The editable quadrilateral remains the source of truth.

Detection initialization order:

1. load MediaPipe WASM;
2. try EfficientDet Lite2 / GPU;
3. try Lite0 / GPU;
4. try Lite2 / CPU;
5. try Lite0 / CPU;
6. if all fail, keep manual four-corner fitting fully operational.

## Apply boundary

The Apply engine owns all operations that must preserve the real brand asset:

- artwork preprocessing;
- planar perspective mapping;
- replacement/neutralization of old mockups;
- scene-light restoration;
- blend/tone controls;
- export.

Generation must never be responsible for reproducing the final logo or label typography.

## Target module boundaries

```text
src/
├── generation/
│   ├── scene-brief.js
│   ├── generator-client.js
│   └── provider-contract.js
├── core/
│   ├── project-state.js
│   └── mockup-engine.js
├── detection/
│   ├── mediapipe-detector.js
│   └── detector-policy.js
├── fitting/
│   ├── planar-core.js
│   ├── homography.js
│   └── quad-editor.js
├── editing/
│   ├── replacement.js
│   ├── lighting-match.js
│   └── tone.js
├── surfaces/
│   ├── planar.js
│   ├── screen.js
│   └── box-front.js
├── rendering/
│   ├── warp-mesh.js
│   └── export.js
└── ui/
    ├── controls.js
    └── status.js
```

## Perspective rendering

The current renderer approximates a projective warp by splitting artwork into a dense grid of affine triangles. This is lightweight, browser-native and visually adequate for the first pass.

Later refinements can compare it against explicit homography rendering or WebGL planar projection. We should only replace the current method after visual fixtures show a measurable benefit.

## Existing-mockup replacement

Current replacement is local deterministic blur/neutralization. It should not be described as semantic inpainting.

Future levels:

1. blur/neutralization — current;
2. texture-aware clone/reconstruction;
3. segmentation + inpainting;
4. occlusion-aware compositing.

## Return to cylinders

Cylinder Lab remains preserved so later versions can reuse:

- cylinder geometry;
- Three.js rendering;
- edge-based refinement;
- scene luminance compositing.

The future cylindrical product should consume the same generation, project state, editing controls and export pipeline as Studio.

## 2D-to-3D boundary

A single image can support limited **proxy 3D** when geometry is known or assumed (plane, box, cylinder, cone). It cannot faithfully reconstruct unseen arbitrary geometry.

Any future rotation feature must distinguish:

- proxy geometric rotation;
- depth-assisted approximation;
- true multi-view / reconstructed 3D.

## Testing strategy

Current automated coverage protects:

- planar geometry;
- scene brief validation;
- brand-safe generation prompt semantics.

Next tests should add:

- known quadrilateral warp fixtures;
- detector fallback-state tests;
- generator-adapter contract tests;
- export smoke tests;
- visual before/after fixtures for replacement mode;
- browser tests for pointer-based corner editing.

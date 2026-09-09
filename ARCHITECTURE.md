# Architecture

## Product split

Mockup Vision now has two explicit experiments:

1. **Photo Studio (`photo.html`)** — the active product direction for flat surfaces and existing-photo mockups;
2. **Cylinder Lab (`index.html`)** — the preserved camera/cylindrical research prototype.

Photo Studio is intentionally the simpler product surface. It gives us a stable geometry/editing foundation before returning to cans, bottles and proxy 3D.

## Current V2 architecture

```text
photo.html
└── photo-app.js
    ├── local photo/artwork input
    ├── MediaPipe detector bootstrap
    ├── GPU → CPU detector fallback
    ├── four-corner editing
    ├── dense planar warp
    ├── old-mockup neutralization
    ├── lighting/blend controls
    └── PNG export

src/
└── planar-core.js
    ├── detector-box → quadrilateral seed
    ├── bilinear surface mapping
    ├── quad bounds / area guards
    └── pointer corner selection

index.html
└── preserved Cylinder Lab
```

## V2 pipeline

```text
photo
  ↓
object detector seed (optional)
  ↓
editable four-corner surface
  ↓
old-art neutralization (optional)
  ↓
artwork preprocessing
  ↓
planar perspective warp
  ↓
scene-light preservation
  ↓
PNG export
```

The automatic detector is deliberately non-authoritative. A generic object bounding box can be useful as a starting point, but it cannot guarantee the exact printable surface. The editable quadrilateral remains the source of truth.

## Target module boundaries

```text
src/
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

## Detection policy

Photo Studio should remain usable even if MediaPipe/model loading fails.

Initialization order:

1. load MediaPipe WASM;
2. try EfficientDet Lite2 / GPU;
3. try Lite0 / GPU;
4. try Lite2 / CPU;
5. try Lite0 / CPU;
6. if all fail, keep four-corner manual fitting fully operational.

Detection produces a **seed** only. Geometry remains editable by the user.

## Perspective rendering

The current V2 renderer approximates a projective warp by splitting the artwork into a dense grid of affine triangles. This is lightweight, browser-native and visually adequate for a first pass.

Later refinements can compare it against:

- explicit homography rendering;
- WebGL planar projection;
- texture mapping on simple 3D proxy planes.

We should only replace the current warp after visual fixtures show a measurable benefit.

## Existing-mockup replacement

The current replacement pass blurs/neutralizes the selected region before new artwork is composited. It is intentionally local and deterministic.

Future levels:

1. blur/neutralization — current;
2. texture-aware clone/reconstruction;
3. segmentation + inpainting;
4. occlusion-aware compositing.

The product should not describe level 1 as semantic object removal.

## Return to cylinders

Cylinder Lab remains preserved so V2 can later reuse its strongest pieces:

- cylinder geometry;
- Three.js rendering;
- edge-based refinement;
- scene luminance compositing.

The future cylindrical product should consume the same project state, editing controls and export pipeline as Photo Studio instead of rebuilding a separate UX.

## 2D-to-3D boundary

A single image can support limited **proxy 3D** when the geometry is known or assumed (plane, box, cylinder, cone). It cannot faithfully reconstruct unseen arbitrary geometry.

Any future rotation feature must distinguish:

- proxy geometric rotation;
- depth-assisted approximation;
- true multi-view / reconstructed 3D.

## Testing strategy

Current automated coverage protects pure planar geometry. Next tests should add:

- known quadrilateral warp fixtures;
- detector fallback-state tests;
- export smoke tests;
- visual before/after fixtures for replacement mode;
- browser tests for pointer-based corner editing.

Cylinder-specific line-fit/geometry tests stay separate from Photo Studio tests.

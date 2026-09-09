# Architecture

## Current state

The deployed prototype is a static browser application concentrated in `index.html`. It contains UI, camera/photo input, object detection, edge tracking, geometry estimation, Three.js rendering, compositing and PNG export.

This is effective for experimentation but creates three risks:

1. changes in one subsystem can accidentally affect unrelated behavior;
2. geometry and tracking logic are difficult to test in isolation;
3. device/runtime fallbacks are mixed with product UI code.

## Target architecture

```text
src/
├── input/
│   ├── camera.js
│   └── photo.js
├── detection/
│   ├── mediapipe-detector.js
│   └── detector-policy.js
├── tracking/
│   ├── edge-map.js
│   ├── line-fit.js
│   └── cylinder-tracker.js
├── geometry/
│   ├── cylinder-fit.js
│   ├── pose.js
│   └── guards.js
├── rendering/
│   ├── three-scene.js
│   └── label-cylinder.js
├── compositing/
│   ├── label-blend.js
│   └── export.js
├── ui/
│   ├── controls.js
│   └── status.js
└── app.js

tests/
├── geometry/
├── tracking/
├── runtime/
└── fixtures/
```

## Boundaries

### Input
Owns camera permissions, camera selection, source orientation and local photo loading. It should not know anything about MediaPipe or Three.js.

### Detection
Produces coarse object candidates. The detector is only a bootstrap mechanism and must never be treated as authoritative geometry.

### Tracking
Consumes a frame and a seed region and returns edge evidence. It should be deterministic and testable with image fixtures.

### Geometry
Converts edge evidence into center, radius, height, roll and tilt. Sanity guards belong here so impossible fits are rejected before rendering.

### Rendering
Owns the virtual cylinder and label texture. It should consume geometry but not inspect camera pixels.

### Compositing
Combines the rendered label with the real image and exports the final result.

### UI
Maps controls and diagnostics to the domain modules. Manual fitting remains supported even when detector/tracker modules are unavailable.

## Runtime resilience

The intended detector initialization policy is:

1. MediaPipe WASM available?
2. try Lite2 on GPU;
3. try Lite2 on CPU;
4. try Lite0 on GPU;
5. try Lite0 on CPU;
6. if all fail, keep photo/manual mode fully usable and explain the failure.

The current code already falls back from Lite2 to Lite0 and then to manual mode. CPU delegate fallback is the next runtime improvement.

## Testing strategy

Before splitting the monolith, preserve the current runtime contracts with static regression tests. After extraction, add:

- deterministic unit tests for line fitting and geometry guards;
- fixture-based tracking tests;
- browser smoke tests for camera/model initialization states;
- visual benchmark images with expected fit tolerances.

## Non-goals

A framework migration is not a goal by itself. The project can remain lightweight; modularity and testability matter more than adopting a large frontend stack.

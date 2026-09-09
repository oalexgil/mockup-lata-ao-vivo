# Mockup Vision

Browser-based computer-vision prototype for applying packaging artwork to a real cylindrical object in camera or photo input.

The project combines classical vision, object detection and WebGL rendering to estimate a can-like object's pose, fit a virtual cylinder and composite label artwork while preserving light and curvature from the captured scene.

> **Status:** functional prototype / research product. The automatic detector is a heuristic bootstrap, not a can-specific trained model, and manual fitting remains an intentional fallback.

## What it demonstrates

- real-time camera and photo workflows;
- MediaPipe object detection used only to seed the initial region;
- classical edge tracking for continuous fitting;
- cylinder geometry and label rendering with Three.js;
- scene-aware label compositing using the real image luminance;
- manual four-corner fitting when automation is unreliable;
- fully client-side processing: images are not uploaded by the application.

## Why this project matters

Most mockup tools either render a generic 3D product or require manual image editing. Mockup Vision explores a different workflow: use the client's real photo or camera feed, infer the product geometry and place the artwork directly on that object.

That makes the repository useful as a portfolio example of **computer vision + geometry + WebGL + product UX**, while still being honest about the prototype's current limits.

## Current architecture

Today the runtime is intentionally simple and concentrated in a single `index.html`:

```text
index.html
├── UI and controls
├── camera / photo input
├── MediaPipe detector bootstrap
├── edge-based tracking
├── geometry estimation
├── Three.js cylinder rendering
├── image compositing
└── export to PNG
```

This keeps deployment trivial, but it is now the main maintainability constraint. The target architecture is documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Runtime pipeline

1. **Input** — camera or local photo.
2. **Detection bootstrap** — EfficientDet Lite2, with Lite0 as model fallback.
3. **Classical tracking** — vertical edge gradients refine the object's lateral boundaries.
4. **Geometry** — line fitting estimates center, radius, height, roll and approximate tilt.
5. **Rendering** — Three.js maps the uploaded artwork onto a virtual cylinder.
6. **Compositing** — label mode multiplies the virtual artwork by luminance from the real scene.
7. **Fallback** — manual mode and four-corner fitting stay available when automation is not trustworthy.

## Dependencies

The current static prototype loads pinned browser dependencies from CDNs:

- `@mediapipe/tasks-vision` `0.10.14`;
- `three` `0.128.0`;
- Google-hosted EfficientDet Lite2 and Lite0 model assets.

There is no application backend and no inference API.

## Local development

Camera access requires a secure context. `localhost` is allowed for development.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

For repository checks:

```bash
npm test
```

No package installation is required for the current test suite.

## Using the prototype

### Artwork

Use a wide label image intended to wrap around a cylinder. Seamless left/right edges produce the best result.

### Automatic fitting

The detector does **not** use a can-specific model. It accepts plausible COCO classes such as bottle, cup, vase and bowl, then classical edge tracking takes over. Detection is therefore best understood as a coarse seed, not proof that the object is a can.

### Manual fitting

Manual mode is a first-class feature, not an error state. You can drag, resize, adjust rotation, snap to edges or mark four corners directly.

### Composition modes

- **Label attached:** preserves scene luminance so the label inherits real shadow and curvature cues.
- **3D can:** renders the body and label with Three.js lighting when no physical can is available.

## Privacy and security

The application processes camera frames, photos and artwork in the browser. The current code does not intentionally upload those user inputs. Third-party runtime assets are still loaded from CDN/model hosts, so offline-first and supply-chain hardening remain future work.

See [SECURITY.md](SECURITY.md).

## Validation

A visually convincing result is not the same thing as a geometrically accurate fit. Before treating the engine as production-ready, validate it across:

- can sizes and aspect ratios;
- camera distances and angles;
- textured and low-contrast backgrounds;
- lighting conditions;
- desktop and mobile browsers;
- manual vs automatic fitting accuracy.

The proposed protocol is in [VALIDATION.md](VALIDATION.md).

## Known limitations

- EfficientDet is not trained specifically for cans in this workflow;
- edge tracking depends on visible lateral contrast;
- top-ellipse tilt is an approximation;
- a single HTML file contains most runtime responsibilities;
- WebGL/MediaPipe behavior varies by device and browser;
- there is no automated visual-regression benchmark yet.

## Roadmap

1. separate detection, tracking, geometry, rendering and compositing into modules;
2. add GPU → CPU detector initialization fallback and explicit runtime diagnostics;
3. create image fixtures and quantitative fitting benchmarks;
4. support multiple packaging profiles such as bottle, cup and box;
5. move CDN dependencies toward a reproducible build or vendored deployment;
6. add a polished client-photo workflow for commercial mockup generation.

## Repository quality

This branch adds CI and regression checks around the current static runtime so future refactors can preserve important behavior before the monolith is split.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).

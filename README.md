# Mockup Vision

**Create the scene. Apply your brand.**

Mockup Vision is a guided photo-first mockup studio. It separates scene generation from final brand application so generative AI can create the product, composition and lighting without redrawing or distorting the user's real logo, label or artwork.

> **Status:** functional V2 prototype. Cloudflare Workers AI is the default image-generation provider, OpenAI remains an optional fallback, and the browser editor already supports multi-art, multi-slot placement, perspective correction, realism controls and local PNG export.

## Product flow

```text
1. Describe what you need
        ↓
2. Generate the scene
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

## Cloudflare-first generation

The Studio calls:

```text
POST /api/generate-scene
```

Provider priority is:

```text
Cloudflare Workers AI
        ↓ fallback
OpenAI (optional)
        ↓ fallback
Manual image import
```

The default Cloudflare model is:

```text
@cf/black-forest-labs/flux-1-schnell
```

The provider secret is kept server-side. Nothing is written to browser JavaScript or `localStorage`.

Setup: [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)

## Brand-safe generation

The core rule is:

> **The generator creates the world. Mockup Vision applies the brand.**

Generation prompts request clean customizable areas with no readable logo, brand, label or invented identity. The original artwork is applied later by Mockup Vision.

## Multiple artworks and mockup areas

The user can upload one or many logos, labels, posters, package fronts, campaign pieces, screen designs or presentation assets.

A **slot** represents one editable mockup area. Each slot has:

- four-point geometry;
- an assigned artwork;
- Apply or Replace mode;
- zoom and rotation;
- opacity;
- old-art neutralization;
- lighting preservation;
- brightness/contrast/saturation;
- blend mode.

A scene may contain one slot or many. Automatic assignment is editable.

## Surface discovery

Mockup Vision currently uses:

1. local object detection with MediaPipe/EfficientDet;
2. manual four-corner areas;
3. provider slot metadata when a provider supports it.

Cloudflare scene generation is intentionally independent from slot detection, so the editor continues to work even when provider-side vision metadata is unavailable.

## Existing mockup replacement

**Replace** mode neutralizes part of the old artwork inside a selected region before the new artwork is rendered.

The current version uses deterministic blur/neutralization rather than semantic inpainting. Future passes can add segmentation, occlusion-aware composition and texture reconstruction.

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
photo.html                       # guided Studio UI
studio-app.js                    # generation + multi-slot + rendering orchestration
studio-ux.js                     # progressive UI + provider status
studio-api-monitor.js            # visible backend error reporting
src/studio-core.js               # browser-independent slot/version helpers
src/scene-brief.js               # brand-safe prompt normalization
src/planar-core.js               # planar geometry helpers
server/index.js                  # Studio server + provider routing
server/cloudflare-provider.js    # Cloudflare Workers AI adapter
server/openai-provider.js        # optional OpenAI fallback

docs/CLOUDFLARE_SETUP.md         # Cloudflare setup
docs/GENERATION_API.md           # provider contract
docs/PRODUCT_VISION.md           # product UX and roadmap

index.html                       # preserved Cylinder Lab
```

## Cylinder Lab

The original can/cylinder experiment remains in `index.html` with camera/photo input, EfficientDet bootstrap, edge tracking, cylinder fitting, Three.js label rendering, manual fallbacks and PNG export.

It is intentionally paused while the planar Studio matures.

## 2D → 3D boundary

A single photo can support proxy 3D for assumed simple geometry, but cannot faithfully reveal arbitrary unseen sides of an object.

Future cylinder work may support constrained proxy rotation for cans, bottles and boxes. True arbitrary 3D reconstruction remains outside the current claim.

## Development

Run the full Studio server:

```bash
npm start
```

Open:

```text
http://localhost:8000/
```

Repository checks:

```bash
npm run ci
```

The CI validates active V2 modules and regression tests on Node 24.

## Privacy and security

Local editing remains browser-side. Provider secrets stay on the server. Never commit Cloudflare or OpenAI credentials.

See [SECURITY.md](SECURITY.md), [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md) and [docs/GENERATION_API.md](docs/GENERATION_API.md).

## Current limitations

- the current Cloudflare adapter is text-to-image first;
- Cloudflare FLUX Schnell does not currently preserve uploaded reference images or previous-image edits in this adapter;
- iteration on Cloudflare therefore regenerates from the combined text brief rather than performing true image-to-image editing;
- generic object detection is not dedicated mockup-surface segmentation;
- old-art removal is not semantic inpainting;
- occlusion masks are not implemented yet;
- visual regression fixtures still need expansion.

These boundaries are explicit so the product does not claim capabilities it does not yet have.

## Roadmap

### V2.1 — Cloudflare validation
- validate real Cloudflare generations;
- tune prompt quality and default steps;
- improve provider errors and usage visibility.

### V2.2 — references and smarter placement
- add Cloudflare-compatible image-to-image/reference flow;
- dedicated surface/rectangle discovery;
- occlusion masks;
- stronger automatic slot proposals.

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

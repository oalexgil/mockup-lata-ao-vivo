# Mockup Vision

**Create the scene. Map the surfaces. Apply the original artwork.**

Mockup Vision is a guided AI mockup studio. It separates scene generation from final brand application so generative AI can create the product, composition and lighting while the user's real logo, label or artwork remains the source of truth.

> **Status:** functional V2.1 prototype. Cloudflare Workers AI is the default scene-generation provider. The Studio now adds universal AI surface mapping, numbered guides, one-to-one artwork mapping and AI-assisted finishing without asking the model to redraw brand artwork.

## Product flow

```text
1. Describe the mockup
        ↓
2. Generate the empty scene
        ↓
3. Iterate or approve the scene
        ↓
4. Upload one or many artworks
        ↓
5. AI identifies usable surfaces
        ↓
6. Numbered guides map artwork ↔ surface
        ↓
7. AI recommends lighting/material integration
        ↓
8. Browser renderer applies original artwork
        ↓
9. Export PNG
```

## Immutable artwork rule

This is a product invariant:

> **The uploaded artwork is never treated as generative content.**

Mockup Vision must not ask an image model to rewrite:

- colors;
- letters or wording;
- typography;
- logos;
- illustrations;
- drawings;
- internal artwork composition.

Allowed changes are only those required to place the original asset on a photographed surface:

- perspective;
- scale and rotation;
- surface deformation;
- lighting and shadow integration;
- reflection/material integration;
- conservative opacity/blend adjustments.

The AI analyzes geometry and finishing. The browser renderer applies the original uploaded pixels.

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

Default scene model:

```text
@cf/black-forest-labs/flux-1-schnell
```

Secrets remain server-side. Nothing is written to browser JavaScript or `localStorage`.

Setup: [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)

## Universal surface mapping

After the user approves a scene and uploads artwork, the Studio calls:

```text
POST /api/analyze-layout
```

Cloudflare Vision analyzes the whole mockup without assuming a particular object category. It returns one or more normalized four-point surfaces:

```json
{
  "slots": [
    {
      "index": 1,
      "label": "front printable surface",
      "quad": [
        { "x": 0.31, "y": 0.28 },
        { "x": 0.66, "y": 0.30 },
        { "x": 0.63, "y": 0.69 },
        { "x": 0.34, "y": 0.68 }
      ]
    }
  ]
}
```

The Studio draws numbered guides and maps artwork 1 → area 1, artwork 2 → area 2, and so on.

The mapping is generic: cup, box, notebook, poster, package, flyer, sign, screen and multi-piece presentation are all treated as surfaces rather than hard-coded product types.

## AI-assisted finishing

After mapping, the user clicks **Finalizar com IA**.

The Studio sends a preview with numbered slots to:

```text
POST /api/refine-plan
```

The vision model may recommend only conservative integration values such as:

- preserve scene light;
- brightness;
- contrast;
- saturation;
- opacity;
- blend mode.

Those recommendations are normalized and clamped before use. The model does **not** receive permission to rewrite the artwork itself.

The final image is then composed locally from:

```text
approved scene
+ original uploaded artwork files
+ AI surface geometry
+ conservative integration plan
```

This design is intentionally different from asking a generative image model to redraw a label inside a photo.

## Multiple artworks

One or many artwork files can be uploaded in the same session.

A **slot** represents one surface and contains:

- normalized four-corner geometry;
- a numbered visual guide;
- an assigned artwork index;
- confidence/label metadata;
- an optional finishing plan.

If the number of artworks and detected surfaces differs, the interface explains which assets have a surface and which do not.

## Existing mockups

The Studio can also start from an existing photo instead of an AI-generated scene. The same universal surface-mapping and immutable-artwork rules apply.

The original legacy editor still contains manual four-corner tools and replacement controls, but the guided flow now prioritizes AI surface mapping and deterministic artwork rendering.

## Current V2.1 files

```text
photo.html                        # guided Studio UI
studio-app.js                     # preserved editor/rendering engine
studio-ux.js                      # approval and progressive UX
studio-universal.js               # universal AI mapping + immutable artwork layer
studio-api-monitor.js             # visible backend error reporting

src/studio-core.js                # slot/version helpers
src/studio-flow.js                # approval → mapping → finalization state machine
src/universal-mockup.js           # universal slots + fidelity policy + plan normalization
src/scene-brief.js                # brand-safe scene prompt normalization
src/planar-core.js                # planar geometry helpers

server/index.js                   # Studio server + API routing
server/cloudflare-provider.js     # Cloudflare scene-generation adapter
server/vision-provider.js         # universal layout + finishing analysis
server/openai-provider.js         # optional OpenAI fallback

tests/studio-flow.test.js
tests/universal-mockup.test.js
```

## Cylinder Lab

The original can/cylinder experiment remains in `index.html` and is intentionally preserved as a separate research lab.

The main Studio no longer assumes cylindrical geometry. Cylinder-specific work can return later as an optional specialized engine rather than as the universal default.

## Development

Run:

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

## Privacy and security

Provider secrets stay on the server. Never commit Cloudflare or OpenAI credentials.

The browser keeps the original artwork files locally and performs the final deterministic composition in the client. The vision request receives the mockup preview needed to identify geometry and finishing recommendations.

See [SECURITY.md](SECURITY.md) and [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).

## Current limitations

- Cloudflare scene iteration still regenerates from text rather than preserving the previous image exactly;
- AI surface geometry is probabilistic and still needs real-world validation across many mockup categories;
- occlusion-aware masking is not implemented yet;
- automatic reflection generation is conservative rather than physically simulated;
- the universal finishing pass adjusts rendering parameters, not brand pixels;
- visual regression fixtures need expansion.

These boundaries are deliberate: artwork fidelity takes priority over aggressive generative editing.

## Roadmap

### V2.2 — universal mapping validation
- validate one-slot and multi-slot scenes;
- add confidence thresholds and retry strategy;
- add manual correction directly to universal guides;
- add screenshot-based visual regression fixtures.

### V2.3 — occlusion and materials
- foreground occlusion masks;
- material-aware reflection passes;
- texture-aware replacement of old artwork;
- stronger surface segmentation.

### V3 — specialized engines
- optional cylinder/packaging engine;
- constrained proxy 3D;
- richer material models;
- shared project state between universal Studio and specialized engines.

## License

MIT. See [LICENSE](LICENSE).

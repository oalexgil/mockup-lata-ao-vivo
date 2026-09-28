# Mockup Vision

**AI creates the scene. Your artwork stays yours.**

Mockup Vision is a fidelity-first mockup studio. It can generate or import a scene, identify usable surfaces and then apply the user's original logo, label or artwork without asking a generative model to redraw the brand asset.

> **Status:** commercial beta experiment on top of the functional V2.1 prototype.

## The product invariant

> Uploaded artwork is never treated as generative content.

The final composition may transform perspective, scale, rotation, surface deformation, light, shadow and conservative material integration. It must not rewrite:

- wording;
- typography;
- logos;
- colors inside the artwork;
- illustrations;
- the internal composition of the uploaded asset.

That distinction is the product.

## Commercial beta

The beta deliberately separates the useful core from paid inference.

### Free

- import an existing photo or generated scene;
- map one or many surfaces;
- apply one or many original artwork files;
- adjust geometry and integration;
- export PNG;
- a small configurable daily allowance of integrated scene generations.

Manual scene import does **not** consume a generation allowance.

### Creator Beta

The landing page currently exposes a **R$29/month price hypothesis** through `BETA_CREATOR_PRICE_BRL`.

A real paid CTA only activates when `BETA_CHECKOUT_URL` is configured. Until then, the UI explicitly says checkout is not connected. This lets the project test positioning and willingness-to-pay without pretending that billing or entitlements already exist.

See [docs/COMMERCIAL_BETA.md](docs/COMMERCIAL_BETA.md).

## Generation resilience

Scene generation is optional infrastructure, not a single point of product failure.

Default order:

```text
Cloudflare Workers AI
        ↓ retryable failure
Pollinations (optional experimental fallback, text-only in this beta)
        ↓ retryable failure
OpenAI (optional)
        ↓
Manual image import — always available
```

Configure the order with:

```env
IMAGE_PROVIDER_ORDER=cloudflare,pollinations,openai
```

### Why Cloudflare remains first

Workers AI currently includes a daily free allocation and FLUX.1 Schnell is among the lowest-cost image models in its catalog. The beta adds an application-level per-user scene allowance and a conservative global scene ceiling so the product can validate demand before taking on open-ended inference cost.

The application limits are operational guards, not a billing system. They are stored in memory and reset on process restart.

### Pollinations

Pollinations is optional. The beta adapter accepts a server-side `POLLINATIONS_API_KEY` and only handles text-only scene generation. Reference-image and iterative workflows remain on Cloudflare or the manual-import path.

Do not expose secret provider keys in browser code.

## Product flow

```text
1. Generate a scene OR import one
        ↓
2. Approve the scene
        ↓
3. Upload one or many original artworks
        ↓
4. Identify usable surfaces
        ↓
5. Map artwork ↔ surface
        ↓
6. Adjust geometry / conservative finishing
        ↓
7. Browser renderer applies original pixels
        ↓
8. Export PNG
```

## Provider-independent failure path

If every configured generator is unavailable or the free beta allowance is exhausted, the Studio tells the user to import a scene. Mapping, manual correction, artwork placement and export remain usable.

This is intentional: the value proposition is artwork fidelity, not subsidized image generation.

## Universal surface mapping

The Studio uses:

```text
POST /api/analyze-layout
```

to detect generic surfaces instead of hard-coded object categories. A surface can be a screen, package face, poster, notebook cover, sign, cup area or other printable/display region.

AI geometry is advisory. Manual correction remains available.

## Commercial endpoints

- `GET /api/commercial` — public beta plan/price configuration;
- `GET /api/health` — provider availability and generation-resilience status;
- `POST /api/generate-scene` — resilient provider chain + beta scene quota;
- `POST /api/analyze-layout` — surface analysis;
- `POST /api/refine-plan` — conservative integration recommendations.

## Configuration

Copy `.env.example`.

Core beta controls:

```env
FREE_SCENE_GENERATIONS_PER_DAY=3
SCENE_GLOBAL_DAILY_LIMIT=120
BETA_CREATOR_PRICE_BRL=29
BETA_CHECKOUT_URL=
BETA_WAITLIST_URL=
```

Provider secrets remain server-side.

## Development

```bash
npm start
```

Landing:

```text
http://localhost:8000/
```

Studio:

```text
http://localhost:8000/photo.html
```

Checks:

```bash
npm run ci
```

## Current boundaries

- the beta quota is an in-memory guard, not a subscription entitlement system;
- paid user accounts are not implemented yet;
- Pollinations fallback is text-only in this branch;
- Cloudflare reference generation may use a different model from text-only scene generation;
- surface geometry remains probabilistic and requires real-world validation;
- occlusion-aware masking is not complete;
- iteration quality still depends on provider capability;
- the original artwork fidelity rule takes precedence over aggressive generative editing.

## Next validation

The commercial experiment should answer three questions before adding account/billing complexity:

1. Do external users complete a useful mockup from their own scene or a generated scene?
2. Is immutable-artwork fidelity noticeably valuable to them?
3. Will any of those users click or pay for the Creator price hypothesis?

## License

MIT. See [LICENSE](LICENSE).

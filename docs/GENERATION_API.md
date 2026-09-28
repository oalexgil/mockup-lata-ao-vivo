# Scene generation strategy

Mockup Vision separates **scene sourcing** from **brand application**.

## Core rule

The product must remain useful even with zero image-generation API availability.

A user can start from:

1. an integrated generated scene;
2. a scene generated in another tool;
3. an existing product photo/mockup.

All three converge into the same surface-mapping and immutable-artwork workflow.

## Integrated provider chain

`POST /api/generate-scene`

The server tries configured providers in `IMAGE_PROVIDER_ORDER`.

Default:

```text
cloudflare → pollinations → openai
```

Only providers capable of handling the request are attempted. The Pollinations beta adapter is text-only; requests with reference images or `previousImage` skip it.

Temporary provider failures can fall through to the next provider. Invalid user input is not hidden by fallback.

## Quotas

The commercial beta protects integrated generation with:

```env
FREE_SCENE_GENERATIONS_PER_DAY=3
SCENE_GLOBAL_DAILY_LIMIT=120
```

A 429 response from the beta scene quota contains:

```json
{
  "code": "FREE_SCENE_DAILY_LIMIT",
  "manualImportAvailable": true,
  "resetAt": "..."
}
```

The Studio then directs the user to import a scene and continue.

Application quotas are in memory. Provider/account controls remain the source of truth for actual billing.

## Cloudflare

Text-only default:

```text
@cf/black-forest-labs/flux-1-schnell
```

Reference default:

```text
@cf/black-forest-labs/flux-2-klein-4b
```

The provider key stays on the server.

## Pollinations

Optional environment:

```env
POLLINATIONS_API_KEY=
POLLINATIONS_IMAGE_MODEL=flux
```

This provider is an experimental fallback and should not be marketed as permanently free. The API ecosystem can change access tiers and pricing independently of Mockup Vision.

## OpenAI

Optional last fallback. No OpenAI secret is required for the zero-generation import path.

## Security

- never expose provider secret keys in client JavaScript;
- never store provider secrets in localStorage;
- validate request size;
- rate-limit public inference;
- do not log raw uploaded artwork by default;
- imported artwork is composed locally in the browser whenever possible.

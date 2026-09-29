# Cloudflare Workers AI setup

Mockup Vision uses Cloudflare Workers AI as the default image-generation provider.

## Required Codespaces secrets

Create these repository-scoped Codespaces secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Optional:

- `IMAGE_PROVIDER=cloudflare`
- `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell`
- `CLOUDFLARE_IMAGE_STEPS=4`

The API token should be created from Cloudflare Workers AI / REST API and must have Workers AI Read/Edit permissions.

## Start

```bash
git pull --ff-only origin feature/photo-mockup-v2
npm run ci
npm start
```

Expected startup message:

```text
Mockup Vision Studio em http://localhost:8000
Gerador Cloudflare configurado (@cf/black-forest-labs/flux-1-schnell).
```

## Provider priority

1. Cloudflare Workers AI when Cloudflare credentials are configured.
2. OpenAI only as an optional fallback when `OPENAI_API_KEY` exists.
3. Manual image import when neither provider is configured.

## Current Cloudflare capabilities

The Cloudflare first pass focuses on text-to-image scene generation. The Studio keeps local/manual surface detection and artwork placement, so image generation does not depend on OpenAI.

Reference-image-conditioned generation and image-to-image iteration are kept as later provider enhancements rather than being falsely advertised as supported by the current FLUX Schnell adapter.

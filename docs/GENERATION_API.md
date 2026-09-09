# Scene generation adapter

Mockup Vision separates **scene generation** from **brand application**.

The browser editor must never embed a provider API key. A production generator should sit behind a small server-side adapter so secrets remain outside the client and providers can be changed without rewriting the editor.

## Product rule

The generator creates:

- product;
- scene;
- composition;
- lighting;
- materials;
- a clean printable/customizable surface.

The generator must **not** be asked to reproduce the final logo, brand name, label text or artwork. Those assets are applied afterwards by Mockup Vision.

## Proposed endpoint

`POST /api/generate-scene`

### Request

Multipart or JSON + uploaded references, normalized to:

```json
{
  "product": "recyclable cup tilted in motion",
  "scene": "white background, soft studio lighting",
  "style": "commercial",
  "surface": "clean visible front area",
  "notes": "",
  "references": {
    "product": "optional file reference",
    "scene": "optional file reference"
  }
}
```

### Response

```json
{
  "image": {
    "url": "temporary signed URL or application-owned asset URL",
    "width": 1536,
    "height": 1024
  },
  "provider": "adapter-name",
  "requestId": "opaque-id"
}
```

The browser then loads the returned image as a normal base photo and continues through the same Detect → Apply workflow.

## Security boundary

- no provider secret in browser JavaScript;
- no provider secret in `localStorage`;
- validate upload MIME/size server-side;
- use short-lived generated-asset URLs when possible;
- define retention/deletion policy before storing user reference images;
- log request IDs, not raw user images or prompts by default;
- add rate limiting before public deployment.

## Provider adapter

A provider implementation should expose one application-level function:

```text
generateScene(sceneBrief, references) -> generatedImage
```

The rest of the application should not depend on provider-specific request/response schemas.

## Current V2 state

The UI already builds the same normalized scene brief and brand-safe generation prompt. Until a backend adapter is connected, the user can copy the prompt to a generator and upload the resulting scene back into Photo Studio.

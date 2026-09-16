# Scene generation adapter

Mockup Vision separates **scene generation** from **brand application**.

The browser editor must never embed a provider API key. A production generator sits behind a small server-side adapter so secrets remain outside the client and providers can change without rewriting the editor.

## Product rule

The generator creates:

- product/model;
- scene and composition;
- lighting and materials;
- one or more clean customizable surfaces.

The generator must **not** reproduce the final logo, brand name, label text or user artwork. Those assets are applied afterwards by Mockup Vision.

## Endpoint

`POST /api/generate-scene`

The same endpoint handles first generation and iteration.

### Request

```json
{
  "prompt": "brand-safe normalized generation prompt",
  "references": [
    {
      "role": "product",
      "name": "cup-reference.png",
      "dataUrl": "data:image/png;base64,..."
    },
    {
      "role": "scene",
      "name": "studio-reference.jpg",
      "dataUrl": "data:image/jpeg;base64,..."
    }
  ],
  "previousImage": null,
  "output": {
    "format": "png",
    "requestMockupSlots": true,
    "maxSlots": 8
  }
}
```

For iteration, `previousImage` contains the selected generated version and `prompt` includes the requested change while preserving the original scene logic.

### Response

Preferred response:

```json
{
  "id": "generation-id",
  "imageDataUrl": "data:image/png;base64,...",
  "slots": [
    {
      "id": "poster-left",
      "label": "Poster esquerdo",
      "quad": [
        {"x": 0.08, "y": 0.18},
        {"x": 0.34, "y": 0.15},
        {"x": 0.35, "y": 0.62},
        {"x": 0.09, "y": 0.64}
      ]
    },
    {
      "id": "laptop-screen",
      "label": "Tela do notebook",
      "quad": [
        {"x": 0.58, "y": 0.30},
        {"x": 0.84, "y": 0.32},
        {"x": 0.82, "y": 0.57},
        {"x": 0.60, "y": 0.56}
      ]
    }
  ]
}
```

`quad` may use normalized `0..1` coordinates or image-pixel coordinates. Mockup Vision normalizes both forms.

If slot metadata is unavailable, return `slots: []`. The browser falls back to local object detection and manual area creation.

A same-origin `imageUrl` may be returned instead of `imageDataUrl`, but the asset must allow canvas use without CORS tainting.

## Multi-art workflow

1. generation returns one or more editable mockup slots when possible;
2. the user uploads multiple logos, labels or artwork files;
3. Mockup Vision assigns assets sequentially to the available slots;
4. each slot remains independently editable and can be reassigned;
5. final rendering happens in the browser.

This means the image generator never needs to reproduce brand artwork itself.

## Iteration

The UI keeps generated versions as a lightweight session history. A new iteration sends:

- the original normalized prompt;
- the user's change request;
- the currently selected generated image;
- the same references unless changed.

The provider should preserve product identity, composition logic and usable customizable surfaces unless the user explicitly asks to change them.

## Security boundary

- no provider secret in browser JavaScript;
- no provider secret in `localStorage`;
- validate upload MIME/size server-side;
- set request and image-size limits;
- use short-lived generated-asset URLs when possible;
- define retention/deletion policy before storing user reference images;
- log request IDs, not raw user images or prompts by default;
- add rate limiting before public deployment.

## Provider adapter

Application-level interface:

```text
generateScene(request) -> { image, slots, id }
```

Provider-specific schemas stay behind this adapter.

## Current V2 state

The browser now implements the full client contract:

- natural-language brief or image-reference input;
- Generate button;
- iteration UI and version history;
- manual import fallback while no server provider is configured;
- multi-art upload;
- multi-slot assignment and editing;
- provider-slot normalization;
- local detector/manual fallback.

The only intentionally missing production piece is the server-side image-generation provider itself.

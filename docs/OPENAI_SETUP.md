# OpenAI generation setup

Mockup Vision can generate scenes directly through the server-side `/api/generate-scene` endpoint.

## Security rule

`OPENAI_API_KEY` must exist only in the server environment. Do not paste it into browser JavaScript, HTML, localStorage, source files, commits, issues or pull requests.

## Codespaces

Recommended setup:

1. Open your GitHub account settings.
2. Go to **Codespaces → Secrets**.
3. Create a secret named `OPENAI_API_KEY`.
4. Grant it access to this repository.
5. Stop/restart the Codespace so the environment receives the secret.
6. In the repository terminal run:

```bash
npm run ci
npm start
```

Then open port `8000`.

The Studio calls `GET /api/health` to report whether the generator is configured.

## Local Mac terminal

For a temporary shell session:

```bash
export OPENAI_API_KEY='your-key-here'
npm start
```

Do not save a real key in `.env.example` or commit it.

## Provider defaults

```text
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
OPENAI_VISION_MODEL=gpt-5.6-luna
OPENAI_IMAGE_QUALITY=medium
PORT=8000
```

These can be overridden through environment variables without changing application code.

## What the server does

1. receives the normalized brand-safe generation brief;
2. optionally receives product/scene reference images;
3. optionally receives the previous generated image for an iteration;
4. calls the OpenAI Responses API with the image-generation tool;
5. returns the generated PNG as a data URL;
6. runs a second vision pass to propose normalized four-corner mockup slots;
7. the browser normalizes those slots to the canvas and automatically distributes uploaded artwork across them.

If slot analysis fails, generation still succeeds and the browser falls back to local/manual surface fitting.

## Privacy notes

The editor itself remains local for compositing and export. Scene generation and reference-image generation requests necessarily send the supplied prompt/reference images to the configured provider. The server uses `store: false` for its Responses API calls and does not intentionally persist generated assets.

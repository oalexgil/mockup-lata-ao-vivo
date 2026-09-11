const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const DEFAULT_REFERENCE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_PROMPT_CHARS = 2048;
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 4;

function clean(value, max = MAX_PROMPT_CHARS) {
  return String(value || '').trim().slice(0, max);
}

export function isValidCloudflareModel(value) {
  return /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(String(value || ''));
}

export function sanitizeCloudflareRequest(body = {}) {
  const prompt = clean(body.prompt);
  if (!prompt) {
    const error = new Error('Prompt obrigatório.');
    error.statusCode = 400;
    throw error;
  }

  const requestedSteps = Number(process.env.CLOUDFLARE_IMAGE_STEPS || 4);
  const steps = Math.max(1, Math.min(8, Number.isFinite(requestedSteps) ? requestedSteps : 4));
  const requestedSeed = Number(body.seed);
  const seed = Number.isInteger(requestedSeed) && requestedSeed >= 0
    ? requestedSeed
    : Math.floor(Math.random() * 1_000_000_000);

  return {
    prompt,
    steps,
    seed,
    referenceCount: Array.isArray(body.references) ? body.references.length : 0,
    hasPreviousImage: Boolean(body.previousImage),
  };
}

export function buildCloudflarePayload(request, model) {
  const payload = {
    prompt: request.prompt,
    steps: request.steps,
  };

  // The current REST schema used by FLUX.1 Schnell rejects `seed` even
  // though some Workers AI examples/bindings document it. Keep the seed
  // locally for version metadata, but do not send it to this endpoint.
  if (model !== DEFAULT_MODEL && process.env.CLOUDFLARE_SEND_SEED === '1') {
    payload.seed = request.seed;
  }

  return payload;
}

export function extractCloudflareImage(payload) {
  return payload?.result?.image || payload?.image || null;
}

export function cloudflareConfigured(env = process.env) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
}

export function cloudflareModel(env = process.env) {
  const requested = clean(env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_MODEL, 200);
  return isValidCloudflareModel(requested) ? requested : DEFAULT_MODEL;
}

export function cloudflareReferenceModel(env = process.env) {
  const requested = clean(env.CLOUDFLARE_SCENE_REFERENCE_MODEL || DEFAULT_REFERENCE_MODEL, 200);
  return isValidCloudflareModel(requested) ? requested : DEFAULT_REFERENCE_MODEL;
}

function parseReferenceDataUrl(value) {
  const raw = String(value || '');
  const match = raw.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_REFERENCE_BYTES) return null;
  const ext = match[1].toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return { buffer, mime };
}

export function collectSceneReferenceInputs(body = {}) {
  const candidates = [];
  if (body.previousImage) {
    candidates.push({ role: 'previous', name: 'previous-scene', dataUrl: body.previousImage });
  }
  if (Array.isArray(body.references)) {
    for (const ref of body.references) {
      if (!ref?.dataUrl) continue;
      candidates.push({
        role: ref.role === 'product' ? 'product' : ref.role === 'scene' ? 'scene' : 'inspiration',
        name: clean(ref.name, 160),
        dataUrl: ref.dataUrl,
      });
    }
  }

  return candidates
    .map((candidate) => {
      const parsed = parseReferenceDataUrl(candidate.dataUrl);
      return parsed ? { ...candidate, ...parsed } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_REFERENCE_IMAGES);
}

export function buildReferenceScenePrompt(basePrompt, inputs = []) {
  const instructions = inputs.map((input, index) => {
    if (input.role === 'previous') {
      return `Image ${index} is the previous generated scene. Treat it as the visual base for this iteration and preserve everything not explicitly requested to change.`;
    }
    if (input.role === 'product') {
      return `Image ${index} is a product/model/object reference. Use its recognizable form, proportions, materials and physical design as a required reference, but remove or ignore logos, labels, text and branding.`;
    }
    if (input.role === 'scene') {
      return `Image ${index} is a scene/style reference. Use its composition, camera language, palette, lighting and atmosphere as visual direction without copying readable text, logos or branding.`;
    }
    return `Image ${index} is a visual inspiration reference. Use only the relevant visual characteristics requested by the user and do not copy readable branding.`;
  });

  return [
    clean(basePrompt),
    'REFERENCE IMAGE RULES: the supplied images are active generation inputs, not metadata. Follow the role of each image below.',
    ...instructions,
    'Keep the requested mockup surfaces clean, clearly visible and ready for later artwork placement.',
  ].filter(Boolean).join('\n');
}

function cloudflareError(payload, status) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const message = errors.map((item) => item?.message).filter(Boolean).join(' | ')
    || payload?.error?.message
    || payload?.message
    || `Cloudflare Workers AI ${status}`;
  const error = new Error(message);
  error.statusCode = status >= 500 ? 502 : status;
  return error;
}

async function callCloudflare(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; }
  catch { payload = { raw: text }; }

  if (!response.ok || payload?.success === false) {
    throw cloudflareError(payload, response.status);
  }

  const base64 = extractCloudflareImage(payload);
  if (!base64) {
    const error = new Error('O Cloudflare Workers AI não retornou uma imagem.');
    error.statusCode = 502;
    throw error;
  }
  return { payload, base64 };
}

async function generateReferenceScene(body, request, env) {
  const inputs = collectSceneReferenceInputs(body);
  if (!inputs.length) return null;

  const model = cloudflareReferenceModel(env);
  const form = new FormData();
  form.append('prompt', buildReferenceScenePrompt(request.prompt, inputs));
  inputs.forEach((input, index) => {
    form.append(`input_image_${index}`, new Blob([input.buffer], { type: input.mime }), input.name || `reference-${index}`);
  });
  form.append('width', String(Math.max(256, Math.min(1920, Number(body?.output?.width) || 1024))));
  form.append('height', String(Math.max(256, Math.min(1920, Number(body?.output?.height) || 1024))));
  if (process.env.CLOUDFLARE_SCENE_GUIDANCE) {
    form.append('guidance', String(Number(process.env.CLOUDFLARE_SCENE_GUIDANCE) || 3.5));
  }

  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const { payload, base64 } = await callCloudflare(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    body: form,
  });

  return {
    id: payload?.result?.id || null,
    imageDataUrl: `data:image/jpeg;base64,${base64}`,
    slots: [],
    provider: 'cloudflare-reference-generation',
    models: { image: model },
    seed: request.seed,
    capabilities: {
      referenceImages: true,
      iterativeImageEdit: inputs.some((input) => input.role === 'previous'),
      automaticSlots: false,
      referenceCount: inputs.length,
      referenceRoles: inputs.map((input) => input.role),
    },
  };
}

export async function generateScene(body, env = process.env) {
  if (!cloudflareConfigured(env)) {
    const error = new Error('Cloudflare não configurado. Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.');
    error.statusCode = 503;
    throw error;
  }

  const request = sanitizeCloudflareRequest(body);
  const referenceResult = await generateReferenceScene(body, request, env);
  if (referenceResult) return referenceResult;

  const model = cloudflareModel(env);
  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const { payload, base64 } = await callCloudflare(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildCloudflarePayload(request, model)),
  });

  return {
    id: payload?.result?.id || null,
    imageDataUrl: `data:image/jpeg;base64,${base64}`,
    slots: [],
    provider: 'cloudflare',
    models: { image: model },
    seed: request.seed,
    capabilities: {
      referenceImages: false,
      iterativeImageEdit: false,
      automaticSlots: false,
    },
  };
}

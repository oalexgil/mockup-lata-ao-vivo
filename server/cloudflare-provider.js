const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT_CHARS = 2048;

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

export async function generateScene(body, env = process.env) {
  if (!cloudflareConfigured(env)) {
    const error = new Error('Cloudflare não configurado. Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.');
    error.statusCode = 503;
    throw error;
  }

  const request = sanitizeCloudflareRequest(body);
  const model = cloudflareModel(env);
  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      steps: request.steps,
      seed: request.seed,
    }),
  });

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

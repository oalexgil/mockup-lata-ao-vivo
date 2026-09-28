const DEFAULT_MODEL = 'flux';
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

function clean(value, max = 2048) {
  return String(value || '').trim().slice(0, max);
}

function clampDimension(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(512, Math.min(1536, Math.round(number)));
}

export function pollinationsConfigured(env = process.env) {
  return Boolean(env.POLLINATIONS_API_KEY);
}

export function pollinationsModel(env = process.env) {
  return clean(env.POLLINATIONS_IMAGE_MODEL || DEFAULT_MODEL, 120) || DEFAULT_MODEL;
}

export function pollinationsCanHandle(body = {}) {
  return !body.previousImage && !(Array.isArray(body.references) && body.references.length);
}

export async function generateScene(body = {}, env = process.env) {
  if (!pollinationsConfigured(env)) {
    const error = new Error('Pollinations não configurado. Defina POLLINATIONS_API_KEY.');
    error.statusCode = 503;
    throw error;
  }

  if (!pollinationsCanHandle(body)) {
    const error = new Error('O fallback Pollinations desta beta aceita apenas geração por texto. Use Cloudflare para referências ou importe a cena.');
    error.statusCode = 422;
    throw error;
  }

  const prompt = clean(body.prompt);
  if (!prompt) {
    const error = new Error('Prompt obrigatório.');
    error.statusCode = 400;
    throw error;
  }

  const model = pollinationsModel(env);
  const width = clampDimension(body?.output?.width, DEFAULT_WIDTH);
  const height = clampDimension(body?.output?.height, DEFAULT_HEIGHT);
  const seed = Number.isInteger(Number(body.seed)) ? Number(body.seed) : Math.floor(Math.random() * 1_000_000_000);
  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', model);
  url.searchParams.set('width', String(width));
  url.searchParams.set('height', String(height));
  url.searchParams.set('seed', String(seed));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.POLLINATIONS_API_KEY}`,
      Accept: 'image/*',
    },
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 700);
    const error = new Error(detail || `Pollinations ${response.status}`);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    const error = new Error('Pollinations não retornou uma imagem.');
    error.statusCode = 502;
    throw error;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) {
    const error = new Error('Pollinations retornou uma imagem vazia.');
    error.statusCode = 502;
    throw error;
  }

  return {
    id: null,
    imageDataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    slots: [],
    provider: 'pollinations',
    models: { image: model },
    seed,
    capabilities: {
      referenceImages: false,
      iterativeImageEdit: false,
      automaticSlots: false,
      experimentalFallback: true,
    },
  };
}

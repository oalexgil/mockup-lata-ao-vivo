import {
  isUsableMockupSlot,
  normalizeRefinementPlan,
  normalizeSingleApplicationPlan,
  normalizeUniversalSlots,
} from '../src/universal-mockup.js';

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const STRICT_JSON_REMINDER = 'Return only valid JSON. Do not include markdown. Do not include explanations. Do not include code fences.';
const SINGLE_APPLICATION_ROOT_PROMPT = `Apply the uploaded immutable artwork to the most appropriate visible printable or display surface in the approved mockup. The artwork itself is locked brand content: never rewrite, redraw, recolor, restyle, crop away, replace, hallucinate, or regenerate letters, wording, typography, logos, drawings, illustrations, or internal composition. Your job is only to choose a physically plausible target quadrilateral and conservative integration parameters. The browser will render the original uploaded pixels deterministically. Respect the product geometry, perspective, material, existing illumination, shadows and reflections. Never choose an interior cavity, opening, rim, handle, hole, background, shadow, negative space, or the full object bounding box.`;
let agreementPromise = null;

const POINT_SCHEMA = {
  type: 'object',
  properties: {
    x: { type: 'number', minimum: 0, maximum: 1 },
    y: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['x', 'y'],
};

const SLOT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    quad: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: POINT_SCHEMA,
    },
  },
  required: ['id', 'label', 'confidence', 'quad'],
};

const INTEGRATION_SCHEMA = {
  type: 'object',
  properties: {
    preserveLight: { type: 'number' },
    brightness: { type: 'number' },
    contrast: { type: 'number' },
    saturation: { type: 'number' },
    opacity: { type: 'number' },
    blend: { type: 'string' },
    note: { type: 'string' },
  },
  required: [
    'preserveLight',
    'brightness',
    'contrast',
    'saturation',
    'opacity',
    'blend',
    'note',
  ],
};

const LAYOUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    slots: {
      type: 'array',
      items: SLOT_SCHEMA,
    },
  },
  required: ['slots'],
};

const SINGLE_APPLICATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    target: SLOT_SCHEMA,
    integration: INTEGRATION_SCHEMA,
  },
  required: ['summary', 'target', 'integration'],
};

const REFINEMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    slots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          ...INTEGRATION_SCHEMA.properties,
        },
        required: ['index', ...INTEGRATION_SCHEMA.required],
      },
    },
  },
  required: ['summary', 'slots'],
};

function clean(value, max = 16000) {
  return String(value || '').trim().slice(0, max);
}

function cloudflareReady(env = process.env) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
}

function modelUrl(env = process.env, model = VISION_MODEL) {
  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID || '');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

async function postModel(payload, env = process.env, model = VISION_MODEL) {
  if (!cloudflareReady(env)) {
    const error = new Error('Cloudflare não configurado para análise visual.');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(modelUrl(env, model), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { raw: text }; }
  if (!response.ok || json?.success === false) {
    const message = (json?.errors || []).map((item) => item?.message).filter(Boolean).join(' | ')
      || json?.error?.message
      || json?.message
      || `Cloudflare Vision ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    error.responseBody = clean(text, 4000);
    throw error;
  }
  return json;
}

async function ensureAgreement(env = process.env) {
  if (!agreementPromise) {
    agreementPromise = postModel({ prompt: 'agree' }, env).catch((error) => {
      agreementPromise = null;
      throw error;
    });
  }
  return agreementPromise;
}

function extractText(payload) {
  const candidates = [
    payload?.result?.response,
    payload?.result?.text,
    payload?.response,
    payload?.result,
  ];
  const value = candidates.find((item) => typeof item === 'string');
  return clean(value, 24000);
}

export function extractStructuredVisionResult(payload) {
  const candidates = [
    payload?.result?.response,
    payload?.response,
    payload?.result?.json,
  ];
  return candidates.find((item) => item && typeof item === 'object' && !Array.isArray(item)) || null;
}

function firstBalancedObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return '';
}

export function sanitizeJsonText(text) {
  const raw = clean(text, 24000)
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .trim();
  const candidate = firstBalancedObject(raw) || raw;
  return candidate.replace(/,\s*([}\]])/g, '$1').trim();
}

export function parseJsonText(text) {
  const sanitized = sanitizeJsonText(text);
  if (!sanitized) throw new Error('A análise visual não retornou conteúdo.');
  try {
    return JSON.parse(sanitized);
  } catch (cause) {
    const error = new Error('A análise visual retornou JSON inválido.');
    error.cause = cause;
    error.sanitized = sanitized;
    throw error;
  }
}

function logVisionAttempt(label, attempt, raw, sanitized, error = null) {
  console.info(`[vision:${label}] resposta bruta tentativa ${attempt}:`, raw || '(vazia)');
  console.info(`[vision:${label}] resposta sanitizada tentativa ${attempt}:`, sanitized || '(vazia)');
  if (error) console.warn(`[vision:${label}] erro tentativa ${attempt}:`, error);
}

export function jsonResponseFormat(schema) {
  return {
    type: 'json_schema',
    json_schema: schema,
  };
}

async function requestStructuredVision({
  image,
  prompt,
  system,
  env,
  label,
  validate,
  schema,
  retryInstruction = 'Return a different, clearly usable exterior/display/print surface with a non-degenerate quadrilateral.',
}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retryReminder = attempt === 2
      ? `\n\n${STRICT_JSON_REMINDER} The previous candidate was rejected. ${retryInstruction}`
      : '';
    try {
      const payload = await postModel({
        messages: [
          { role: 'system', content: `${system} ${STRICT_JSON_REMINDER}` },
          { role: 'user', content: `${prompt}${retryReminder}` },
        ],
        image,
        response_format: jsonResponseFormat(schema),
      }, env);

      const structured = extractStructuredVisionResult(payload);
      const raw = structured ? JSON.stringify(structured) : extractText(payload);
      const sanitized = structured ? raw : sanitizeJsonText(raw);
      const parsed = structured || parseJsonText(raw);

      if (validate && !validate(parsed)) {
        throw new Error('A resposta JSON não respeitou o contrato visual esperado.');
      }
      logVisionAttempt(label, attempt, raw, sanitized);
      return parsed;
    } catch (error) {
      lastError = error;
      const responseBody = clean(error?.responseBody, 4000);
      const sanitized = responseBody ? sanitizeJsonText(responseBody) : '';
      logVisionAttempt(label, attempt, responseBody, sanitized, error);
    }
  }
  throw lastError || new Error('A análise visual não retornou JSON válido.');
}

function imageValue(imageDataUrl) {
  const value = clean(imageDataUrl, 24 * 1024 * 1024);
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value)) {
    const error = new Error('Imagem inválida para análise visual.');
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function normalizedArtworkAspectRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.max(0.1, Math.min(10, ratio));
}

function slotCenter(slot) {
  const quad = Array.isArray(slot?.quad) ? slot.quad : [];
  if (quad.length !== 4) return { x: 0, y: 0 };
  return quad.reduce((acc, point) => ({
    x: acc.x + Number(point.x || 0) / 4,
    y: acc.y + Number(point.y || 0) / 4,
  }), { x: 0, y: 0 });
}

function slotBounds(slot) {
  const quad = Array.isArray(slot?.quad) ? slot.quad : [];
  if (quad.length !== 4) return null;
  const xs = quad.map((point) => Number(point.x));
  const ys = quad.map((point) => Number(point.y));
  if (xs.some((value) => !Number.isFinite(value)) || ys.some((value) => !Number.isFinite(value))) return null;
  return {
    left: Math.min(...xs),
    top: Math.min(
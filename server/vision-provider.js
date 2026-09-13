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

export function sortVisionSlots(slots = []) {
  return [...slots].sort((a, b) => {
    const centerA = slotCenter(a);
    const centerB = slotCenter(b);
    const sameRow = Math.abs(centerA.y - centerB.y) < 0.08;
    return sameRow ? centerA.x - centerB.x : centerA.y - centerB.y;
  });
}

export function createUniversalFallbackSlots() {
  return normalizeUniversalSlots({
    slots: [{
      id: 'fallback-1',
      label: 'Área provisória — revisão manual necessária',
      confidence: 0.1,
      quad: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ],
    }],
  }, 1);
}

export function layoutVisionResponseFormat(requested = null) {
  const requestedCount = Number(requested);
  if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
    return jsonResponseFormat(LAYOUT_JSON_SCHEMA);
  }
  const count = Math.max(1, Math.min(8, Math.floor(requestedCount)));
  return jsonResponseFormat({
    ...LAYOUT_JSON_SCHEMA,
    properties: {
      slots: {
        ...LAYOUT_JSON_SCHEMA.properties.slots,
        minItems: 1,
        maxItems: count,
      },
    },
  });
}

export function singleApplicationVisionResponseFormat() {
  return jsonResponseFormat(SINGLE_APPLICATION_JSON_SCHEMA);
}

export function refinementVisionResponseFormat() {
  return jsonResponseFormat(REFINEMENT_JSON_SCHEMA);
}

export function singleApplicationRootPrompt() {
  return SINGLE_APPLICATION_ROOT_PROMPT;
}

export function usableVisionSlots(value, requested = 8) {
  const slots = normalizeUniversalSlots(value, requested).filter(isUsableMockupSlot);
  return sortVisionSlots(slots);
}

export function hasRequestedVisionCoverage(value, requested = 1) {
  const count = Math.max(1, Math.min(8, Number(requested) || 1));
  return usableVisionSlots(value, count).length >= count;
}

export async function analyzeSingleApplication(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const userInstruction = clean(body.instruction, 1200);
  const artworkAspectRatio = normalizedArtworkAspectRatio(body.artworkAspectRatio);
  const instructionText = userInstruction
    ? `Additional user placement instruction: ${JSON.stringify(userInstruction)}. Follow it only when it does not violate artwork fidelity or physical plausibility.`
    : 'No additional placement instruction was supplied. Choose the primary, most useful printable/display surface automatically.';
  const prompt = `${SINGLE_APPLICATION_ROOT_PROMPT}\n\n${instructionText}\nThe uploaded artwork aspect ratio is approximately ${artworkAspectRatio.toFixed(3)}. Preserve the complete artwork inside the chosen target instead of cropping brand content. Coordinates must be normalized 0..1 and ordered top-left, top-right, bottom-right, bottom-left. For curved products, choose the central visible exterior print region and approximate it with a useful four-point quadrilateral. Return a conservative integration plan. Allowed blend modes: source-over, multiply, overlay, soft-light. ${STRICT_JSON_REMINDER}`;

  try {
    const parsed = await requestStructuredVision({
      image,
      prompt,
      system: 'You are the placement planner for a professional universal mockup studio. Brand pixels are immutable and are rendered by code, not generated by you.',
      env,
      label: 'single-apply',
      schema: SINGLE_APPLICATION_JSON_SCHEMA,
      validate: (value) => Boolean(normalizeSingleApplicationPlan(value).target),
      retryInstruction: 'Choose one physically usable exterior printable/display surface. Do not choose an opening, interior, handle, background, shadow, or degenerate quad.',
    });
    const plan = normalizeSingleApplicationPlan(parsed);
    if (!plan.target) throw new Error('A IA não retornou um alvo imprimível utilizável.');
    return {
      target: plan.target,
      integration: plan.integration,
      summary: plan.summary,
      slots: [plan.target],
      applicationStatus: 'validated',
      mappingStatus: 'validated',
      surfaceValidated: true,
      artworkFidelityLocked: true,
      provider: 'cloudflare-vision',
      model: VISION_MODEL,
    };
  } catch (error) {
    console.warn('[vision:single-apply] duas tentativas falharam; mantendo revisão avançada disponível.', error);
    return {
      slots: createUniversalFallbackSlots(),
      applicationStatus: 'fallback',
      mappingStatus: 'fallback',
      surfaceValidated: false,
      artworkFidelityLocked: true,
      warning: 'A IA não conseguiu aplicar a arte automaticamente. Use Revisar áreas ou tente novamente.',
      diagnostic: clean(error?.message, 240),
      provider: 'universal-fallback',
      model: VISION_MODEL,
    };
  }
}

export async function analyzeUniversalLayout(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const requested = Math.max(1, Math.min(8, Number(body.desiredSlots || body.artworkCount || 1) || 1));
  const multiArtInstruction = requested > 1
    ? `MULTI-ART REQUIREMENT: scan the complete image from top-left to bottom-right and find ${requested} DISTINCT usable surfaces. Blank cards, panels, posters, screens, sheets, frames, package faces and display areas each count as separate surfaces when they are physically separate. When at least ${requested} real usable surfaces are visible, return exactly ${requested}; do not stop after the easiest or most central surface. Do not merge several panels into one slot. Do not return duplicate or strongly overlapping slots. Order the returned slots in visual reading order: top-to-bottom, and left-to-right within the same row. If the image truly contains fewer than ${requested} physical usable surfaces, do not invent background areas or fake surfaces.`
    : 'Choose the single clearest physically usable printable/display surface.';
  const prompt = `Analyze this mockup image and identify ${requested} clean visual surface(s) where uploaded artwork can realistically be placed. ${multiArtInstruction} Work generically: do not assume cup, bottle, poster, screen, box or any particular object type. Return JSON only using this exact schema: {"slots":[{"id":"1","label":"short surface description","confidence":0.0,"quad":[{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0}]}]}. Coordinates must be normalized from 0 to 1, ordered top-left, top-right, bottom-right, bottom-left. Select the actual exterior printable/display face where a flat artwork should visibly appear. Never select an interior cavity, opening, rim, handle, hole, background, shadow, negative space, or the full object bounding box. For a curved object, choose the central visible exterior printable region and approximate that usable region with four well-separated points inside its visible boundaries. The quadrilateral must have meaningful width and height and must not collapse to a line or point. Prefer visible, unobstructed surfaces and preserve perspective. ${STRICT_JSON_REMINDER}`;
  const layoutSchema = layoutVisionResponseFormat(requested).json_schema;

  try {
    const parsed = await requestStructuredVision({
      image,
      prompt,
      system: 'You are a precise visual geometry assistant for professional universal mockups. Detect every distinct requested surface across the full composition. Never collapse a multi-panel layout into a single central surface.',
      env,
      label: 'layout',
      schema: layoutSchema,
      validate: (value) => hasRequestedVisionCoverage(value, requested),
      retryInstruction: `The previous result did not provide all ${requested} distinct usable surfaces. Rescan the WHOLE image, including top, bottom, left, right and center. Return ${requested} separate real surface quadrilaterals when they are visible; do not repeat, merge or overlap the same area.`,
    });
    const slots = usableVisionSlots(parsed, requested);
    return {
      slots,
      requestedSlots: requested,
      mappingStatus: 'validated',
      surfaceValidated: true,
      provider: 'cloudflare-vision',
      model: VISION_MODEL,
    };
  } catch (error) {
    console.warn('[vision:layout] não foi possível validar todas as áreas solicitadas; bloqueando aplicação parcial.', error);
    return {
      slots: createUniversalFallbackSlots(),
      requestedSlots: requested,
      mappingStatus: 'fallback',
      surfaceValidated: false,
      warning: requested > 1
        ? `A IA não conseguiu validar ${requested} áreas distintas. Nenhuma arte foi aplicada para evitar uma distribuição parcial ou incorreta. Tente mapear novamente ou revise as áreas.`
        : 'A IA não encontrou uma superfície imprimível válida. Revise ou tente novamente.',
      diagnostic: clean(error?.message, 240),
      provider: 'universal-fallback',
      model: VISION_MODEL,
    };
  }
}

export async function analyzeRefinement(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const slotCount = Math.max(1, Math.min(8, Number(body.slotCount || 1) || 1));
  const prompt = `Review this mockup composition with ${slotCount} numbered artwork slot(s). The uploaded artwork is immutable brand content: never change letters, wording, colors, logos, drawings, illustrations, or internal composition. You may only recommend non-destructive integration settings for perspective-aware placement: lighting preservation, brightness, contrast, saturation, opacity and blend mode. Return JSON only using this exact schema: {"summary":"short note","slots":[{"index":1,"preserveLight":0.58,"brightness":1.0,"contrast":1.0,"saturation":1.0,"opacity":1.0,"blend":"source-over","note":"short surface note"}]}. Use conservative values. Allowed blend: source-over, multiply, overlay, soft-light. Never suggest content edits. ${STRICT_JSON_REMINDER}`;

  try {
    const parsed = await requestStructuredVision({
      image,
      prompt,
      system: 'You are a mockup finishing assistant. Brand artwork content is locked and immutable.',
      env,
      label: 'refinement',
      schema: REFINEMENT_JSON_SCHEMA,
      retryInstruction: 'Return a valid conservative integration plan for every numbered slot without proposing any content edits.',
      validate: (value) => value && typeof value === 'object' && Array.isArray(value.slots),
    });
    return {
      ...normalizeRefinementPlan(parsed, slotCount),
      refinementStatus: 'validated',
      provider: 'cloudflare-vision',
      model: VISION_MODEL,
    };
  } catch (error) {
    console.warn('[vision:refinement] duas tentativas falharam; usando plano conservador local.', error);
    return {
      ...normalizeRefinementPlan({}, slotCount),
      refinementStatus: 'fallback',
      warning: 'A IA não retornou um plano válido; foram mantidos ajustes conservadores locais.',
      provider: 'local-safe-fallback',
      model: VISION_MODEL,
    };
  }
}

export const visionModel = () => VISION_MODEL;
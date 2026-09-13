import {
  createUniversalFallbackSlots,
  extractStructuredVisionResult,
  jsonResponseFormat,
  layoutVisionResponseFormat,
  parseJsonText,
  sanitizeJsonText,
  sortVisionSlots,
  usableVisionSlots,
  visionModel,
} from './vision-provider.js';

const MAX_SLOTS = 8;
const MAX_IMAGE_CHARS = 24 * 1024 * 1024;
const STRICT_JSON_REMINDER = 'Return only valid JSON. Do not include markdown, explanations or code fences.';
let agreementPromise = null;

function clean(value, max = 16000) {
  return String(value || '').trim().slice(0, max);
}

function requestedCount(body = {}) {
  return Math.max(1, Math.min(MAX_SLOTS, Number(body.desiredSlots || body.artworkCount || 1) || 1));
}

function candidateLimit(count) {
  const normalized = Math.max(1, Math.min(MAX_SLOTS, Number(count) || 1));
  return Math.min(MAX_SLOTS, normalized + 2);
}

function normalizeExcludedSlots(value = []) {
  const source = Array.isArray(value) ? value : [];
  return source.slice(0, MAX_SLOTS).map((item, index) => {
    const quad = Array.isArray(item?.quad) ? item.quad : Array.isArray(item) ? item : null;
    if (!quad || quad.length !== 4) return null;
    const normalized = quad.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }));
    if (normalized.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    if (normalized.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return null;
    return { id: String(item?.id || `reserved-${index + 1}`), quad: normalized };
  }).filter(Boolean);
}

function imageValue(value) {
  const image = clean(value, MAX_IMAGE_CHARS);
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image)) {
    const error = new Error('Imagem inválida para análise visual.');
    error.statusCode = 400;
    throw error;
  }
  return image;
}

function modelUrl(env = process.env) {
  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID || '');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${visionModel()}`;
}

async function postVision(payload, env = process.env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    const error = new Error('Cloudflare não configurado para análise visual.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(modelUrl(env), {
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
    agreementPromise = postVision({ prompt: 'agree' }, env).catch((error) => {
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
  return clean(candidates.find((item) => typeof item === 'string'), 24000);
}

function slotBounds(slot) {
  const quad = Array.isArray(slot?.quad) ? slot.quad : [];
  if (quad.length !== 4) return null;
  const xs = quad.map((point) => Number(point.x));
  const ys = quad.map((point) => Number(point.y));
  if (xs.some((value) => !Number.isFinite(value)) || ys.some((value) => !Number.isFinite(value))) return null;
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

export function surfaceOverlap(a, b) {
  const boxA = slotBounds(a);
  const boxB = slotBounds(b);
  if (!boxA || !boxB) return 0;
  const left = Math.max(boxA.left, boxB.left);
  const top = Math.max(boxA.top, boxB.top);
  const right = Math.min(boxA.right, boxB.right);
  const bottom = Math.min(boxA.bottom, boxB.bottom);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  if (!intersection) return 0;
  const areaA = Math.max(0, boxA.right - boxA.left) * Math.max(0, boxA.bottom - boxA.top);
  const areaB = Math.max(0, boxB.right - boxB.left) * Math.max(0, boxB.bottom - boxB.top);
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

export function distinctSurfaceCandidates(slots = [], overlapThreshold = 0.68) {
  const ranked = [...slots].sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));
  const accepted = [];
  for (const slot of ranked) {
    if (accepted.some((candidate) => surfaceOverlap(slot, candidate) >= overlapThreshold)) continue;
    accepted.push(slot);
  }
  return accepted;
}

export function rejectReservedSurfaces(slots = [], excludedSlots = [], overlapThreshold = 0.42) {
  const reserved = normalizeExcludedSlots(excludedSlots);
  if (!reserved.length) return [...slots];
  return slots.filter((slot) => !reserved.some((excluded) => surfaceOverlap(slot, excluded) >= overlapThreshold));
}

export function selectSurfaceCandidates(value, requested = 1, excludedSlots = []) {
  const count = Math.max(1, Math.min(MAX_SLOTS, Number(requested) || 1));
  const usable = usableVisionSlots(value, MAX_SLOTS);
  const unreserved = rejectReservedSurfaces(usable, excludedSlots);
  const distinct = distinctSurfaceCandidates(unreserved);
  const strongest = distinct
    .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))
    .slice(0, count);
  return sortVisionSlots(strongest);
}

export function hasSurfaceCoverage(value, requested = 1, excludedSlots = []) {
  const count = Math.max(1, Math.min(MAX_SLOTS, Number(requested) || 1));
  return selectSurfaceCandidates(value, count, excludedSlots).length >= count;
}

export function universalLayoutSchema(requested = 1) {
  const count = Math.max(1, Math.min(MAX_SLOTS, Number(requested) || 1));
  const schema = structuredClone(layoutVisionResponseFormat(count).json_schema);
  schema.properties.slots.maxItems = candidateLimit(count);
  return schema;
}

function reservedPrompt(excludedSlots = []) {
  const reserved = normalizeExcludedSlots(excludedSlots);
  if (!reserved.length) return '';
  const coordinates = reserved.map((item, index) => ({ index: index + 1, quad: item.quad }));
  return ` RESERVED SURFACES: ${JSON.stringify(coordinates)}. These normalized quadrilaterals are already approved or currently occupied. Do NOT return them again, do not substantially overlap them, and continue searching for different real surfaces elsewhere in the composition.`;
}

export function universalLayoutPrompt(requested = 1, excludedSlots = [], targetInstruction = '') {
  const count = Math.max(1, Math.min(MAX_SLOTS, Number(requested) || 1));
  const limit = candidateLimit(count);
  const multi = count > 1
    ? `First inventory the ENTIRE composition object by object and region by region. Find at least ${count} DISTINCT usable target surfaces when they truly exist. You may return up to ${limit} strong candidates so validation can discard duplicates, reserved regions or weak geometry. Do not stop at the largest, easiest or most central target. Separate physical faces remain separate even when they share the same category, differ greatly in size, are tilted, peripheral, partly overlapped or shown at different perspectives. Do not split one continuous surface merely to reach the requested count.`
    : `Find the strongest NEXT usable target surface. You may return up to ${limit} candidates so validation can reject a previously reserved area and still keep a valid alternative.`;
  const userIntent = clean(targetInstruction, 600);
  const intentPrompt = userIntent ? ` USER TARGET INTENT: ${JSON.stringify(userIntent)}. Treat this explicit instruction as the highest-priority semantic target, while still requiring a real visible surface and valid geometry.` : '';

  return `Analyze this mockup scene and identify ${count} clean visual surface(s) where uploaded artwork can realistically be placed. ${multi}${reservedPrompt(excludedSlots)}${intentPrompt} A usable target is a bounded physical region intended or plausible for receiving 2D visual content. Examples include display areas, printed panels, package faces, cards, signs, covers, pages, posters, labels, boards, garment print regions and other brandable faces; these examples are illustrative, NOT a whitelist. Work from what is actually visible and do not assume any product category. For framed or electronic displays, select the active content area inside the bezel/frame, not the whole device. For packaging or rigid products, select the visible face itself. For flexible material, use a stable printable region rather than seams, edges or deep folds. For curved surfaces, use the central visible region and approximate its perspective with four well-separated points. Return JSON only as {"slots":[{"id":"1","label":"short surface description","confidence":0.0,"quad":[{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0}]}]}. Coordinates are normalized 0..1 in top-left, top-right, bottom-right, bottom-left order. Never select an interior cavity, opening, rim, handle, hole, background, shadow, negative space or full-object bounding box. Do not return duplicate or strongly overlapping slots. If fewer than ${count} real usable surfaces exist, return only the real ones instead of inventing fake targets. ${STRICT_JSON_REMINDER}`;
}

export function universalLayoutRetryPrompt(requested = 1, excludedSlots = [], targetInstruction = '') {
  const count = Math.max(1, Math.min(MAX_SLOTS, Number(requested) || 1));
  const userIntent = clean(targetInstruction, 600);
  const intentPrompt = userIntent ? ` Keep prioritizing the explicit user target intent ${JSON.stringify(userIntent)}.` : '';
  return `The previous result did not provide ${count} distinct usable unreserved target(s). Re-inventory the WHOLE image, including top, bottom, left, right and center. Reconsider small, tilted, peripheral and partially overlapped objects that still expose a real usable face. Look for independent content-bearing faces, not merely repeated categories or the largest central area. Do not merge separate objects, duplicate the same physical surface, return a reserved area, use full-object boxes or invent background regions.${intentPrompt}${reservedPrompt(excludedSlots)}`;
}

async function requestLayout(image, requested, excludedSlots = [], targetInstruction = '', env = process.env) {
  const schema = universalLayoutSchema(requested);
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retry = attempt === 2 ? `\n\n${universalLayoutRetryPrompt(requested, excludedSlots, targetInstruction)}` : '';
    try {
      const payload = await postVision({
        messages: [
          {
            role: 'system',
            content: `You are a precise visual geometry assistant for a universal professional mockup studio. Inventory the whole composition before selecting targets. Detect distinct real content-bearing surfaces regardless of object category, scale, orientation or position. Never anchor only on the largest central object and never collapse separate surfaces into one. Respect reserved/approved regions and search around them for the next unresolved targets. ${STRICT_JSON_REMINDER}`,
          },
          { role: 'user', content: `${universalLayoutPrompt(requested, excludedSlots, targetInstruction)}${retry}` },
        ],
        image,
        response_format: jsonResponseFormat(schema),
      }, env);

      const structured = extractStructuredVisionResult(payload);
      const raw = structured ? JSON.stringify(structured) : extractText(payload);
      const parsed = structured || parseJsonText(raw);
      if (!hasSurfaceCoverage(parsed, requested, excludedSlots)) {
        throw new Error('A resposta não contém áreas distintas e não reservadas suficientes para o mapeamento solicitado.');
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (error?.responseBody) {
        try { sanitizeJsonText(error.responseBody); } catch { /* diagnostic only */ }
      }
    }
  }

  throw lastError || new Error('A análise visual não retornou áreas válidas.');
}

export async function analyzeUniversalLayout(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const requested = requestedCount(body);
  const excludedSlots = normalizeExcludedSlots(body.excludedSlots || body.excludedQuads || []);
  const targetInstruction = clean(body.targetInstruction || body.instruction, 600);

  try {
    const parsed = await requestLayout(image, requested, excludedSlots, targetInstruction, env);
    return {
      slots: selectSurfaceCandidates(parsed, requested, excludedSlots),
      requestedSlots: requested,
      excludedSlots: excludedSlots.length,
      mappingStatus: 'validated',
      surfaceValidated: true,
      provider: 'cloudflare-vision-universal-layout',
      model: visionModel(),
    };
  } catch (error) {
    console.warn('[layout-provider] não foi possível validar todas as áreas solicitadas.', error);
    return {
      slots: createUniversalFallbackSlots(),
      requestedSlots: requested,
      excludedSlots: excludedSlots.length,
      mappingStatus: 'fallback',
      surfaceValidated: false,
      warning: requested > 1
        ? `A IA não conseguiu validar ${requested} áreas distintas fora das superfícies já reservadas. Nenhuma arte foi aplicada para evitar uma distribuição parcial ou incorreta.`
        : 'A IA não encontrou uma nova superfície válida fora das áreas já reservadas. Revise a composição ou tente novamente.',
      diagnostic: clean(error?.message, 240),
      provider: 'universal-layout-fallback',
      model: visionModel(),
    };
  }
}

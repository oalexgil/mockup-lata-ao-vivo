import { normalizeRefinementPlan, normalizeUniversalSlots } from '../src/universal-mockup.js';

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
let agreementPromise = null;

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

function parseJsonText(text) {
  const raw = clean(text, 24000);
  if (!raw) throw new Error('A análise visual não retornou conteúdo.');
  try { return JSON.parse(raw); }
  catch {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1));
    throw new Error('A análise visual retornou JSON inválido.');
  }
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

export async function analyzeUniversalLayout(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const requested = Math.max(1, Math.min(8, Number(body.desiredSlots || body.artworkCount || 1) || 1));
  const prompt = `Analyze this mockup image and identify ${requested} clean visual surface(s) where uploaded artwork can realistically be placed. Work generically: do not assume cup, bottle, poster, screen, box or any particular object type. Return JSON only using this schema: {"slots":[{"id":"1","label":"short surface description","confidence":0.0,"quad":[{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0},{"x":0.0,"y":0.0}]}]}. Coordinates must be normalized from 0 to 1, ordered top-left, top-right, bottom-right, bottom-left. Choose the actual printable/display surface, not the full detected object bounding box. Prefer visible, unobstructed surfaces and preserve perspective. If fewer than ${requested} reliable surfaces exist, return only the reliable ones.`;
  const payload = await postModel({
    messages: [
      { role: 'system', content: 'You are a precise visual geometry assistant for professional mockups. Return strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    image,
  }, env);
  const parsed = parseJsonText(extractText(payload));
  return {
    slots: normalizeUniversalSlots(parsed, requested),
    provider: 'cloudflare-vision',
    model: VISION_MODEL,
  };
}

export async function analyzeRefinement(body = {}, env = process.env) {
  await ensureAgreement(env);
  const image = imageValue(body.imageDataUrl);
  const slotCount = Math.max(1, Math.min(8, Number(body.slotCount || 1) || 1));
  const prompt = `Review this mockup composition with ${slotCount} numbered artwork slot(s). The uploaded artwork is immutable brand content: never change letters, wording, colors, logos, drawings, illustrations, or internal composition. You may only recommend non-destructive integration settings for perspective-aware placement: lighting preservation, brightness, contrast, saturation, opacity and blend mode. Return JSON only: {"summary":"short note","slots":[{"index":1,"preserveLight":0.58,"brightness":1.0,"contrast":1.0,"saturation":1.0,"opacity":1.0,"blend":"source-over","note":"short surface note"}]}. Use conservative values. Allowed blend: source-over, multiply, overlay, soft-light. Never suggest content edits.`;
  const payload = await postModel({
    messages: [
      { role: 'system', content: 'You are a mockup finishing assistant. Brand artwork content is locked and immutable. Return strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    image,
  }, env);
  const parsed = parseJsonText(extractText(payload));
  return {
    ...normalizeRefinementPlan(parsed, slotCount),
    provider: 'cloudflare-vision',
    model: VISION_MODEL,
  };
}

export const visionModel = () => VISION_MODEL;

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TEXT_MODEL = 'gpt-5.6-luna';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare';
const MAX_REFERENCES = 8;
const MAX_DATA_URL_CHARS = 7_500_000;

export function isSafeImageDataUrl(value) {
  return typeof value === 'string'
    && value.length <= MAX_DATA_URL_CHARS
    && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);
}

export function sanitizeGenerationRequest(body = {}) {
  const prompt = String(body.prompt || '').trim().slice(0, 16_000);
  if (!prompt) throw Object.assign(new Error('Prompt obrigatório.'), { statusCode: 400 });

  const references = Array.isArray(body.references)
    ? body.references.slice(0, MAX_REFERENCES).filter((ref) => isSafeImageDataUrl(ref?.dataUrl))
    : [];

  const previousImage = isSafeImageDataUrl(body.previousImage) ? body.previousImage : null;
  const requestedMaxSlots = Number(body?.output?.maxSlots) || 8;
  const maxSlots = Math.max(1, Math.min(12, requestedMaxSlots));

  return {
    prompt,
    references,
    previousImage,
    requestMockupSlots: body?.output?.requestMockupSlots !== false,
    maxSlots,
  };
}

function imageContent(dataUrl, detail = 'high') {
  return { type: 'input_image', image_url: dataUrl, detail };
}

function buildGenerationInput(request) {
  const content = [{
    type: 'input_text',
    text: `${request.prompt}\n\nGenerate the requested final scene image now. Keep every intended mockup surface clean and brand-free so exact artwork can be composited later.`,
  }];

  if (request.previousImage) {
    content.push(imageContent(request.previousImage, 'high'));
    content.push({
      type: 'input_text',
      text: 'The first image is the current version. Treat this as an edit/iteration: preserve composition and product identity unless the new instruction explicitly changes them.',
    });
  }

  for (const ref of request.references) {
    content.push(imageContent(ref.dataUrl, 'high'));
    content.push({
      type: 'input_text',
      text: `Reference role: ${String(ref.role || 'inspiration').slice(0, 40)}. Use it only as visual guidance; do not reproduce logos, readable labels or brand text from the reference.`,
    });
  }

  return [{ role: 'user', content }];
}

export function extractImageResult(response) {
  const call = response?.output?.find?.((item) => item?.type === 'image_generation_call' && item?.result);
  return call?.result || null;
}

export function extractOutputText(response) {
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

async function openaiResponses(payload, apiKey) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { raw: text }; }

  if (!response.ok) {
    const message = json?.error?.message || `OpenAI API ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return json;
}

function slotSchema(maxSlots) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      slots: {
        type: 'array',
        maxItems: maxSlots,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            quad: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  x: { type: 'number', minimum: 0, maximum: 1 },
                  y: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['x', 'y'],
              },
            },
          },
          required: ['id', 'label', 'confidence', 'quad'],
        },
      },
    },
    required: ['slots'],
  };
}

export function parseSlotResponse(text, maxSlots = 8) {
  try {
    const parsed = JSON.parse(String(text || ''));
    if (!Array.isArray(parsed?.slots)) return [];
    return parsed.slots.slice(0, maxSlots).filter((slot) => {
      if (!Array.isArray(slot?.quad) || slot.quad.length !== 4) return false;
      return slot.quad.every((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))
        && Number(p.x) >= 0 && Number(p.x) <= 1 && Number(p.y) >= 0 && Number(p.y) <= 1);
    });
  } catch {
    return [];
  }
}

async function detectMockupSlots(imageDataUrl, maxSlots, apiKey) {
  const model = process.env.OPENAI_VISION_MODEL || DEFAULT_TEXT_MODEL;
  const payload = {
    model,
    store: false,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Inspect this generated mockup scene. Find up to ${maxSlots} distinct flat, visible surfaces intentionally suitable for placing artwork: screens, posters, cards, paper pieces, package fronts, frames, book covers or similar. Return only real usable areas. For each area, give four normalized corner coordinates in this order: top-left, top-right, bottom-right, bottom-left. Do not return the whole object when only a smaller printable/display surface is intended.`,
        },
        imageContent(imageDataUrl, 'high'),
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'mockup_slots',
        strict: true,
        schema: slotSchema(maxSlots),
      },
    },
  };

  const response = await openaiResponses(payload, apiKey);
  return parseSlotResponse(extractOutputText(response), maxSlots);
}

export async function generateScene(body, apiKey = process.env.OPENAI_API_KEY) {
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY não configurada no servidor.');
    error.statusCode = 503;
    throw error;
  }

  const request = sanitizeGenerationRequest(body);
  const textModel = process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
  const imageModel = process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const quality = process.env.OPENAI_IMAGE_QUALITY || 'medium';

  const response = await openaiResponses({
    model: textModel,
    store: false,
    input: buildGenerationInput(request),
    tools: [{ type: 'image_generation', model: imageModel, quality }],
  }, apiKey);

  const base64 = extractImageResult(response);
  if (!base64) {
    const error = new Error('O provedor não retornou uma imagem.');
    error.statusCode = 502;
    throw error;
  }

  const imageDataUrl = `data:image/png;base64,${base64}`;
  let slots = [];
  if (request.requestMockupSlots) {
    try {
      slots = await detectMockupSlots(imageDataUrl, request.maxSlots, apiKey);
    } catch (error) {
      console.warn('slot detection fallback:', error.message);
    }
  }

  return {
    id: response.id || null,
    imageDataUrl,
    slots,
    provider: 'openai',
    models: { orchestrator: textModel, image: imageModel },
  };
}

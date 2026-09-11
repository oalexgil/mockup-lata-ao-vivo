const DEFAULT_EDIT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_PROMPT_CHARS = 2600;
const MAX_REFERENCE_BYTES = 3 * 1024 * 1024;

function clean(value, max = MAX_PROMPT_CHARS) {
  return String(value || '').trim().slice(0, max);
}

export function mockupEditModel(env = process.env) {
  const requested = clean(env.CLOUDFLARE_MOCKUP_EDIT_MODEL || DEFAULT_EDIT_MODEL, 180);
  return /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(requested)
    ? requested
    : DEFAULT_EDIT_MODEL;
}

export function parseReferenceDataUrl(value) {
  const raw = String(value || '');
  const match = raw.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    const error = new Error('Referência de imagem inválida para edição do mockup.');
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_REFERENCE_BYTES) {
    const error = new Error('Referência de imagem vazia ou grande demais.');
    error.statusCode = 413;
    throw error;
  }
  const ext = match[1].toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return { buffer, mime };
}

export function normalizeEditDimensions(width, height) {
  const rawWidth = Number(width) || 1024;
  const rawHeight = Number(height) || 1024;
  const ratio = Math.max(0.25, Math.min(4, rawWidth / rawHeight));
  const maxSide = 1280;
  let outWidth;
  let outHeight;
  if (ratio >= 1) {
    outWidth = maxSide;
    outHeight = Math.round(maxSide / ratio);
  } else {
    outHeight = maxSide;
    outWidth = Math.round(maxSide * ratio);
  }
  const round64 = (value) => Math.max(256, Math.min(1920, Math.round(value / 64) * 64));
  return { width: round64(outWidth), height: round64(outHeight) };
}

export function normalizeFidelityOptions(body = {}) {
  const requested = clean(body.fidelityMode, 32).toLowerCase();
  const fidelityMode = ['exact', 'balanced', 'integrated'].includes(requested) ? requested : 'exact';
  return {
    fidelityMode,
    preserveAspectRatio: body.preserveAspectRatio !== false,
    limitDeformation: body.limitDeformation !== false,
    safeMargins: body.safeMargins !== false,
  };
}

function fidelityInstructions(options) {
  const common = [
    'Treat Image 1 as an immutable visual asset, not as inspiration to redraw.',
    'Preserve the complete internal geometry of Image 1: faces, body proportions, objects, typography, logos, colors, illustration details and relative positions must stay visually unchanged.',
    'For photographs or portraits, preserve the person identity, facial structure, expression, hair shape, clothing details and body proportions. Never beautify, reconstruct or reinterpret the person.',
    options.preserveAspectRatio
      ? 'Preserve the original aspect ratio of Image 1 strictly. Never stretch, squash, widen or narrow the artwork to fill the target.'
      : 'Keep artwork proportions natural and avoid unnecessary non-uniform scaling.',
    options.safeMargins
      ? 'If the target surface has a different aspect ratio, scale the artwork down and leave realistic safe margins rather than cropping or stretching it.'
      : 'Prefer complete artwork visibility and avoid destructive cropping.',
    options.limitDeformation
      ? 'Use only the minimum geometric deformation required by real perspective and surface curvature. Do not warp internal artwork features independently.'
      : 'Surface conformity may be visible, but internal artwork relationships must remain coherent.',
  ];

  if (options.fidelityMode === 'exact') {
    common.push(
      'FIDELITY PRIORITY: artwork preservation is more important than filling the whole printable surface.',
      'Apply Image 1 like a rigid printed decal or photographic print attached to the surface. Keep its internal pixels and composition visually stable.',
      'Use conservative lighting/material integration. Do not repaint the artwork to match the scene; let scene light affect it only subtly and physically.'
    );
  } else if (options.fidelityMode === 'balanced') {
    common.push(
      'BALANCED PRIORITY: preserve artwork identity and proportions while allowing moderate surface conformity and material integration.'
    );
  } else {
    common.push(
      'INTEGRATED PRIORITY: allow stronger material and lighting integration, but never rewrite text, logos, faces or the internal artwork composition.'
    );
  }
  return common;
}

export function buildMockupEditPrompt(instruction = '', optionsInput = {}) {
  const userInstruction = clean(instruction, 1000);
  const options = normalizeFidelityOptions(optionsInput);
  return [
    'Create the final professional mockup using the two reference images.',
    'Image 0 is the approved mockup scene and must remain the visual base: preserve its product, camera angle, crop, background, lighting, shadows, reflections and composition.',
    'Image 1 is the uploaded artwork/label and is the source of truth for the brand and visual content.',
    'Apply Image 1 to the most appropriate visible exterior printable/display surface in Image 0 as a physically realistic mockup.',
    ...fidelityInstructions(options),
    'Artwork fidelity rule: do not translate or intentionally rewrite wording. Do not translate or rewrite wording in any way. Do not invent letters. Do not recolor logos. Do not replace illustrations or photographic subjects. Do not add brand elements that are absent from Image 1.',
    'Allowed physical adaptation is limited to perspective, scale, rotation, curvature, material response, scene lighting, shadows, reflections and physically necessary occlusion.',
    'Do not place the artwork on an opening, interior cavity, handle, background, shadow or unrelated object.',
    'Keep the scene photorealistic and output one finished mockup image, without guides, masks, labels, bounding boxes or annotations.',
    userInstruction ? `User placement instruction: ${userInstruction}` : 'Choose the primary visible brandable surface automatically and use a centered, commercially plausible placement.',
  ].join(' ');
}

function extractImage(payload) {
  return payload?.result?.image || payload?.image || null;
}

function cloudflareError(payload, status) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const message = errors.map((item) => item?.message).filter(Boolean).join(' | ')
    || payload?.error?.message
    || payload?.message
    || `Cloudflare mockup editor ${status}`;
  const error = new Error(message);
  error.statusCode = status >= 500 ? 502 : status;
  return error;
}

export async function renderMockupWithAI(body = {}, env = process.env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    const error = new Error('Cloudflare não configurado para edição do mockup.');
    error.statusCode = 503;
    throw error;
  }

  const scene = parseReferenceDataUrl(body.sceneImageDataUrl);
  const artwork = parseReferenceDataUrl(body.artworkImageDataUrl);
  const dimensions = normalizeEditDimensions(body.outputWidth, body.outputHeight);
  const fidelity = normalizeFidelityOptions(body);
  const prompt = buildMockupEditPrompt(body.instruction, fidelity);
  const model = mockupEditModel(env);

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('input_image_0', new Blob([scene.buffer], { type: scene.mime }), 'scene-reference');
  form.append('input_image_1', new Blob([artwork.buffer], { type: artwork.mime }), 'artwork-reference');
  form.append('width', String(dimensions.width));
  form.append('height', String(dimensions.height));

  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    body: form,
  });

  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; }
  catch { payload = { raw: text }; }
  if (!response.ok || payload?.success === false) throw cloudflareError(payload, response.status);

  const base64 = extractImage(payload);
  if (!base64) {
    const error = new Error('O modelo de edição não retornou a imagem final.');
    error.statusCode = 502;
    throw error;
  }

  return {
    imageDataUrl: `data:image/jpeg;base64,${base64}`,
    provider: 'cloudflare-multi-reference-edit',
    model,
    mode: 'direct-ai-edit',
    artworkReferenceUsed: true,
    fidelity: fidelity.fidelityMode,
    fidelityControls: fidelity,
    width: dimensions.width,
    height: dimensions.height,
  };
}
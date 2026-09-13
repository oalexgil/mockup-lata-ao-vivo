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

function explicitTargetInstructions(userInstruction) {
  if (!userInstruction) return [];
  const instructions = [
    'The user placement instruction has priority for TARGET SELECTION. If it names a visible surface, object, garment region or body region, place the artwork on that requested target and do not silently substitute another surface merely because it is easier to render.',
    'If the requested target is not actually visible or physically usable, preserve the scene and do not relocate the artwork to an unrelated object or region.',
  ];

  if (/\b(tattoo|tatuagem|skin|pele|arm|bra[cç]o|forearm|antebra[cç]o|shoulder|ombro|leg|perna|back|costas)\b/i.test(userInstruction)) {
    instructions.push(
      'TATTOO INTENT: human skin is an intentional valid target. Integrate the artwork like real ink following the local body perspective and subtle skin curvature, while preserving the artwork identity and avoiding arbitrary redraw.'
    );
  }

  if (/\b(shirt|t-?shirt|tee|camisa|camiseta|hoodie|moletom|dress|vestido|apparel|garment|roupa|fabric|tecido)\b/i.test(userInstruction)) {
    instructions.push(
      'APPAREL INTENT: the requested garment or fabric region is an intentional valid target. Follow the garment perspective and broad folds, but keep the artwork proportions coherent and avoid stretching it into seams, hems, sleeves or unrelated fabric regions unless the user explicitly requests those areas.'
    );
  }

  return instructions;
}

function fidelityInstructions(options) {
  const common = [
    'Treat Image 1 as an immutable visual asset, not as inspiration to redraw.',
    'Preserve the complete internal geometry of Image 1: faces, body proportions, objects, typography, logos, colors, illustration details and relative positions must stay visually unchanged.',
    'For photographs or portraits, preserve the person identity, facial structure, expression, hair shape, clothing details and body proportions. Never beautify, reconstruct or reinterpret the person.',
    'If Image 1 contains readable text, headlines, editorial layout, signage, institutional graphics or a logo, treat all typography and letterforms as rigid semantic content. Preserve exact wording, line breaks, hierarchy, baseline relationships and relative spacing.',
    'Never bend individual letters, curve text baselines aggressively, stretch a word to fill a curved surface, or locally warp typography. Apply only one coherent global perspective/surface transform to the complete artwork.',
    'For text-heavy artwork on curved or strongly distorted surfaces, prefer a smaller inset placement with safe margins over edge-to-edge coverage. Legibility and semantic fidelity are more important than filling the target.',
    'When the selected target is flexible fabric, canvas, apparel or a tote bag, use the stable central printable region. Avoid forcing the artwork into seams, hems, handles, edge tension zones or deep folds unless the user explicitly asks for that region.',
    'On flexible surfaces, material integration may follow broad surface perspective and soft folds, but do not shear, widen, narrow or independently distort internal artwork features. Prefer a slightly smaller print over visible geometry damage.',
    options.preserveAspectRatio
      ? 'Preserve the original aspect ratio of Image 1 strictly. Never stretch, squash, widen or narrow the artwork to fill the target.'
      : 'Keep artwork proportions natural and avoid unnecessary non-uniform scaling.',
    options.safeMargins
      ? 'If the target surface has a different aspect ratio, scale the artwork down and leave realistic safe margins rather than cropping or stretching it.'
      : 'Prefer complete artwork visibility and avoid destructive cropping.',
    options.limitDeformation
      ? 'Use only the minimum geometric deformation required by real perspective and surface curvature. Do not warp internal artwork features independently.'
      : 'Surface conformity may be visible, but it must remain one coherent physical transform. Never use stronger integration as permission to distort the artwork proportions or internal geometry.',
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
      'INTEGRATED PRIORITY: allow stronger material, texture, lighting, shadow and physically plausible occlusion integration, but never stronger artwork deformation.',
      'Stronger integration means the artwork belongs to the material; it does NOT mean stretching, squashing, re-composing or re-rendering the artwork.'
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
    'Apply Image 1 to the most appropriate visible surface in Image 0 as a physically realistic mockup, while honoring any explicit user target instruction.',
    ...explicitTargetInstructions(userInstruction),
    ...fidelityInstructions(options),
    'Artwork fidelity rule: do not translate or intentionally rewrite wording. Do not translate or rewrite wording in any way. Do not invent letters. Do not recolor logos. Do not replace illustrations or photographic subjects. Do not add brand elements that are absent from Image 1.',
    'Allowed physical adaptation is limited to perspective, scale, rotation, curvature, material response, scene lighting, shadows, reflections and physically necessary occlusion.',
    'Do not place the artwork on an opening, interior cavity, handle, background, shadow or unrelated object. A garment or body region is NOT unrelated when the user explicitly requests it.',
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
  try { payload = text ? JSON.parse(text) : {};
  } catch { payload = { raw: text }; }
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

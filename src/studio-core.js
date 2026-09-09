export function createSlot(id, quad, label = '') {
  return {
    id: String(id),
    label: label || `Área ${id}`,
    quad: quad.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
    assetIndex: null,
    mode: 'apply',
    cleanup: 0,
    opacity: 1,
    preserveLight: 0.55,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    zoom: 1,
    rotation: 0,
    blend: 'source-over',
  };
}

export function normalizeProviderSlots(slots, width, height) {
  if (!Array.isArray(slots)) return [];
  return slots
    .map((slot, index) => {
      const q = slot?.quad;
      if (!Array.isArray(q) || q.length !== 4) return null;
      const normalized = q.map((p) => ({
        x: Math.max(0, Math.min(width, Number(p.x) <= 1 ? Number(p.x) * width : Number(p.x))),
        y: Math.max(0, Math.min(height, Number(p.y) <= 1 ? Number(p.y) * height : Number(p.y))),
      }));
      if (normalized.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
      return createSlot(slot.id || index + 1, normalized, slot.label || `Área ${index + 1}`);
    })
    .filter(Boolean);
}

export function autoAssignAssets(slots, assetCount) {
  const count = Math.max(0, Number(assetCount) || 0);
  return slots.map((slot, index) => ({
    ...slot,
    assetIndex: count ? index % count : null,
  }));
}

export function addManualSlot(slots, width, height) {
  const index = slots.length;
  const sizeW = width * 0.42;
  const sizeH = height * 0.34;
  const offset = Math.min(index, 4) * Math.min(width, height) * 0.025;
  const cx = width / 2 + offset;
  const cy = height / 2 + offset;
  return [
    ...slots,
    createSlot(index + 1, [
      { x: cx - sizeW / 2, y: cy - sizeH / 2 },
      { x: cx + sizeW / 2, y: cy - sizeH / 2 },
      { x: cx + sizeW / 2, y: cy + sizeH / 2 },
      { x: cx - sizeW / 2, y: cy + sizeH / 2 },
    ]),
  ];
}

export function buildIterationPrompt(basePrompt, iterationInstruction) {
  const base = String(basePrompt || '').trim();
  const iteration = String(iterationInstruction || '').trim();
  if (!base) return '';
  if (!iteration) return base;
  return `${base}\n\nITERATION REQUEST:\n${iteration}\n\nPreserve the same product identity, scene logic and clean customizable mockup surfaces unless the iteration explicitly asks to change them.`;
}

export function generationRequest({ prompt, references = [], previousImage = null, iteration = '' }) {
  return {
    prompt: buildIterationPrompt(prompt, iteration),
    references: references.map((ref) => ({
      role: ref.role || 'inspiration',
      name: ref.name || '',
      dataUrl: ref.dataUrl || null,
    })),
    previousImage,
    output: {
      format: 'png',
      requestMockupSlots: true,
      maxSlots: 8,
    },
  };
}

export function nextVersionLabel(count) {
  return `V${Math.max(1, Number(count) + 1)}`;
}

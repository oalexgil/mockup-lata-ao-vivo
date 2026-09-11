const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

function point(value = {}) {
  return {
    x: clamp(value.x, 0, 1),
    y: clamp(value.y, 0, 1),
  };
}

export const ARTWORK_FIDELITY_POLICY = Object.freeze({
  immutableContent: true,
  allowTextRewrite: false,
  allowColorRewrite: false,
  allowLogoRedraw: false,
  allowIllustrationRewrite: false,
  allowedAdjustments: [
    'perspective',
    'surface-deformation',
    'scale',
    'rotation',
    'lighting',
    'shadow',
    'reflection',
    'material-integration',
  ],
});

export function normalizeUniversalSlots(input, maxSlots = 8) {
  const source = Array.isArray(input) ? input : Array.isArray(input?.slots) ? input.slots : [];
  return source.slice(0, Math.max(1, Math.min(8, Number(maxSlots) || 8))).map((slot, index) => {
    const quad = Array.isArray(slot?.quad) && slot.quad.length === 4
      ? slot.quad.map(point)
      : null;
    if (!quad) return null;
    return {
      id: String(slot.id || index + 1),
      index: index + 1,
      label: String(slot.label || `Área ${index + 1}`).slice(0, 80),
      confidence: clamp(Number.isFinite(Number(slot.confidence)) ? slot.confidence : 0.5, 0, 1),
      quad,
    };
  }).filter(Boolean);
}

export function mapArtworksToSlots(artworkCount, slots = []) {
  const arts = Math.max(0, Number(artworkCount) || 0);
  return slots.map((slot, index) => ({
    ...slot,
    artworkIndex: index < arts ? index : null,
  }));
}

export function quadToPixels(quad, width, height) {
  return quad.map((p) => ({ x: p.x * width, y: p.y * height }));
}

const BLENDS = new Set(['source-over', 'multiply', 'overlay', 'soft-light']);

export function normalizeRefinementPlan(input, slotCount = 0) {
  const source = Array.isArray(input?.slots) ? input.slots : [];
  const count = Math.max(0, Number(slotCount) || 0);
  const byIndex = new Map(source.map((slot) => [Number(slot.index), slot]));
  const slots = [];
  for (let index = 1; index <= count; index += 1) {
    const candidate = byIndex.get(index) || {};
    slots.push({
      index,
      preserveLight: clamp(candidate.preserveLight ?? 0.58, 0, 1),
      brightness: clamp(candidate.brightness ?? 1, 0.82, 1.18),
      contrast: clamp(candidate.contrast ?? 1, 0.82, 1.22),
      saturation: clamp(candidate.saturation ?? 1, 0.88, 1.12),
      opacity: clamp(candidate.opacity ?? 1, 0.86, 1),
      blend: BLENDS.has(candidate.blend) ? candidate.blend : 'source-over',
      note: String(candidate.note || '').slice(0, 160),
    });
  }
  return {
    slots,
    summary: String(input?.summary || '').slice(0, 500),
    artworkFidelityLocked: true,
  };
}

export function universalMappingMessage(artworkCount, slotCount) {
  const arts = Math.max(0, Number(artworkCount) || 0);
  const slots = Math.max(0, Number(slotCount) || 0);
  if (!slots) return 'Nenhuma área confiável foi identificada.';
  if (arts === slots) return `${slots} área(s) numerada(s) para ${arts} arte(s).`;
  if (arts < slots) return `${slots} área(s) identificada(s); ${arts} receberão arte automaticamente.`;
  return `${slots} área(s) identificada(s); ${arts - slots} arte(s) ficarão sem área até haver outro slot.`;
}

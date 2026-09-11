const finiteNumber = (value) => Number.isFinite(Number(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

function point(value = {}) {
  if (!value || typeof value !== 'object' || !finiteNumber(value.x) || !finiteNumber(value.y)) return null;
  return {
    x: clamp(value.x, 0, 1),
    y: clamp(value.y, 0, 1),
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function quadArea(quad = []) {
  if (!Array.isArray(quad) || quad.length !== 4) return 0;
  let area = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const current = quad[index];
    const next = quad[(index + 1) % quad.length];
    if (!current || !next || !finiteNumber(current.x) || !finiteNumber(current.y) || !finiteNumber(next.x) || !finiteNumber(next.y)) return 0;
    area += Number(current.x) * Number(next.y) - Number(next.x) * Number(current.y);
  }
  return Math.abs(area) / 2;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

export function isValidNormalizedQuad(quad = [], options = {}) {
  const minArea = Number(options.minArea ?? 0.0025);
  const minSpan = Number(options.minSpan ?? 0.04);
  const minEdge = Number(options.minEdge ?? 0.02);
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  if (!quad.every((p) => p && finiteNumber(p.x) && finiteNumber(p.y)
    && Number(p.x) >= 0 && Number(p.x) <= 1 && Number(p.y) >= 0 && Number(p.y) <= 1)) return false;

  const xs = quad.map((p) => Number(p.x));
  const ys = quad.map((p) => Number(p.y));
  if (Math.max(...xs) - Math.min(...xs) < minSpan) return false;
  if (Math.max(...ys) - Math.min(...ys) < minSpan) return false;
  if (quadArea(quad) < minArea) return false;
  if (quad.some((p, index) => distance(p, quad[(index + 1) % 4]) < minEdge)) return false;
  if (segmentsIntersect(quad[0], quad[1], quad[2], quad[3])) return false;
  if (segmentsIntersect(quad[1], quad[2], quad[3], quad[0])) return false;
  return true;
}

const NON_PRINTABLE_LABEL = /\b(interior|inside|opening|rim|handle|hole|cavity|background|shadow|negative\s+space|abertura|al[cç]a|asa|buraco|cavidade|fundo|sombra)\b/i;

export function isUsableMockupSlot(slot = {}) {
  if (!slot || typeof slot !== 'object') return false;
  if (!isValidNormalizedQuad(slot.quad)) return false;
  if (NON_PRINTABLE_LABEL.test(String(slot.label || ''))) return false;
  const confidence = Number(slot.confidence);
  return !Number.isFinite(confidence) || confidence >= 0.2;
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
    if (!quad || quad.some((p) => !p) || !isValidNormalizedQuad(quad)) return null;
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

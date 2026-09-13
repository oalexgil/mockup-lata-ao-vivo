const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value)));
const finite = (value) => Number.isFinite(Number(value));

export function normalizeFocusPoint(value) {
  if (!value || !finite(value.x) || !finite(value.y)) return null;
  return { x: clamp(value.x), y: clamp(value.y) };
}

export function pointFromClient(clientX, clientY, rect) {
  if (!rect || !finite(rect.left) || !finite(rect.top) || !finite(rect.width) || !finite(rect.height)) return null;
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (width <= 0 || height <= 0) return null;
  return normalizeFocusPoint({
    x: (Number(clientX) - Number(rect.left)) / width,
    y: (Number(clientY) - Number(rect.top)) / height,
  });
}

function polygonArea(quad = []) {
  if (!Array.isArray(quad) || quad.length !== 4) return 0;
  let total = 0;
  for (let index = 0; index < 4; index += 1) {
    const a = quad[index];
    const b = quad[(index + 1) % 4];
    total += a.x * b.y - b.x * a.y;
  }
  return Math.abs(total) / 2;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function intersects(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

export function normalizeEditableQuad(quad = []) {
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const result = quad.map(normalizeFocusPoint);
  return result.some((point) => !point) ? null : result;
}

export function isEditableQuad(quad = [], { minArea = 0.0012, minSpan = 0.025 } = {}) {
  const q = normalizeEditableQuad(quad);
  if (!q) return false;
  const xs = q.map((point) => point.x);
  const ys = q.map((point) => point.y);
  if (Math.max(...xs) - Math.min(...xs) < minSpan) return false;
  if (Math.max(...ys) - Math.min(...ys) < minSpan) return false;
  if (polygonArea(q) < minArea) return false;
  if (intersects(q[0], q[1], q[2], q[3])) return false;
  if (intersects(q[1], q[2], q[3], q[0])) return false;
  const turns = q.map((point, index) => {
    const a = point;
    const b = q[(index + 1) % 4];
    const c = q[(index + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const nonZero = turns.filter((value) => Math.abs(value) > 1e-8);
  if (nonZero.length !== 4) return false;
  if (!nonZero.every((value) => Math.sign(value) === Math.sign(nonZero[0]))) return false;
  return true;
}

export function quadAroundPoint(point, options = {}) {
  const center = normalizeFocusPoint(point);
  if (!center) return null;
  const canvasAspect = Math.max(0.15, Number(options.canvasAspect) || 1);
  const artAspect = Math.max(0.15, Number(options.artAspect) || 1);
  const margin = clamp(options.margin ?? 0.018, 0, 0.12);
  const maxWidth = clamp(options.width ?? 0.34, 0.08, 0.72);
  const maxHeight = clamp(options.height ?? 0.28, 0.08, 0.72);
  let width = maxWidth;
  let height = width * canvasAspect / artAspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * artAspect / canvasAspect;
  }
  width = clamp(width, 0.06, 1 - 2 * margin);
  height = clamp(height, 0.06, 1 - 2 * margin);
  const halfW = width / 2;
  const halfH = height / 2;
  const cx = clamp(center.x, margin + halfW, 1 - margin - halfW);
  const cy = clamp(center.y, margin + halfH, 1 - margin - halfH);
  return [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH },
  ];
}

export function closestQuadCorner(quad = [], point, radius = 0.05) {
  const q = normalizeEditableQuad(quad);
  const p = normalizeFocusPoint(point);
  if (!q || !p) return -1;
  let best = -1;
  let distance = Math.max(0.005, Number(radius) || 0.05);
  q.forEach((corner, index) => {
    const current = Math.hypot(corner.x - p.x, corner.y - p.y);
    if (current <= distance) {
      best = index;
      distance = current;
    }
  });
  return best;
}

export function moveQuadCorner(quad = [], cornerIndex, point, options = {}) {
  const q = normalizeEditableQuad(quad);
  const p = normalizeFocusPoint(point);
  const index = Number(cornerIndex);
  if (!q || !p || !Number.isInteger(index) || index < 0 || index > 3) return q;
  const next = q.map((corner) => ({ ...corner }));
  next[index] = p;
  return isEditableQuad(next, options) ? next : q;
}

function bounds(slot) {
  const q = normalizeEditableQuad(slot?.quad || slot);
  if (!q) return null;
  const xs = q.map((point) => point.x);
  const ys = q.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

export function distanceToSurface(slot, focusPoint) {
  const box = bounds(slot);
  const point = normalizeFocusPoint(focusPoint);
  if (!box || !point) return Number.POSITIVE_INFINITY;
  const dx = Math.max(box.left - point.x, 0, point.x - box.right);
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return Math.hypot(dx, dy);
}

export function focusContainsPoint(slot, focusPoint) {
  return distanceToSurface(slot, focusPoint) === 0;
}

export function rankSlotsByFocus(slots = [], focusPoint, radius = 0.3) {
  const point = normalizeFocusPoint(focusPoint);
  if (!point) return [...(Array.isArray(slots) ? slots : [])];
  const maxDistance = clamp(radius, 0.04, 0.8);
  return (Array.isArray(slots) ? slots : [])
    .map((slot, order) => ({
      slot,
      order,
      distance: distanceToSurface(slot, point),
      confidence: Number(slot?.confidence || 0),
    }))
    .filter((entry) => Number.isFinite(entry.distance) && entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || b.confidence - a.confidence || a.order - b.order)
    .map((entry) => entry.slot);
}

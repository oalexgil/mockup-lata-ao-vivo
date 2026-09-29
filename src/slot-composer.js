const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v)));
const point = (p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) ? { x: clamp(p.x), y: clamp(p.y) } : null;

export function orderQuadPoints(points = []) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const pts = points.map(point);
  if (pts.some((p) => !p)) return null;
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0;
  let best = Infinity;
  sorted.forEach((p, i) => { const score = p.x + p.y; if (score < best) { best = score; start = i; } });
  const q = [...sorted.slice(start), ...sorted.slice(0, start)];
  if (q[1].x < q[3].x) return [q[0], q[3], q[2], q[1]];
  return q;
}

function cross(a, b, c) { return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); }
function area(q) { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }

export function validQuad(value = [], { minArea = 0.001, minSpan = 0.02 } = {}) {
  const q = orderQuadPoints(value);
  if (!q) return false;
  const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  if (Math.max(...xs) - Math.min(...xs) < minSpan || Math.max(...ys) - Math.min(...ys) < minSpan || area(q) < minArea) return false;
  const turns = q.map((p, i) => cross(p, q[(i + 1) % 4], q[(i + 2) % 4])).filter((v) => Math.abs(v) > 1e-8);
  return turns.length === 4 && turns.every((v) => Math.sign(v) === Math.sign(turns[0]));
}

export function cropAroundPoint(focus, { width = 0.5, height = 0.5, margin = 0 } = {}) {
  const p = point(focus); if (!p) return null;
  const w = clamp(width, 0.18, 1 - margin * 2), h = clamp(height, 0.18, 1 - margin * 2);
  const left = clamp(p.x - w / 2, margin, 1 - margin - w);
  const top = clamp(p.y - h / 2, margin, 1 - margin - h);
  return { left, top, width: w, height: h };
}
export function pointToCrop(p, crop) { const n = point(p); if (!n || !crop) return null; return { x: clamp((n.x - crop.left) / crop.width), y: clamp((n.y - crop.top) / crop.height) }; }
export function quadFromCrop(quad = [], crop) {
  if (!crop || !Array.isArray(quad) || quad.length !== 4) return null;
  const mapped = quad.map((p) => ({ x: crop.left + Number(p.x) * crop.width, y: crop.top + Number(p.y) * crop.height }));
  const ordered = orderQuadPoints(mapped); return validQuad(ordered) ? ordered : null;
}
export function quadBounds(value = []) { const q = orderQuadPoints(value); if (!q) return null; const xs = q.map((p) => p.x), ys = q.map((p) => p.y); return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }; }
export function distanceToQuad(value, focus) { const b = quadBounds(value), p = point(focus); if (!b || !p) return Infinity; const dx = Math.max(b.left - p.x, 0, p.x - b.right), dy = Math.max(b.top - p.y, 0, p.y - b.bottom); return Math.hypot(dx, dy); }
export function overlapRatio(a, b) { const A = quadBounds(a), B = quadBounds(b); if (!A || !B) return 0; const l = Math.max(A.left,B.left), t = Math.max(A.top,B.top), r = Math.min(A.right,B.right), d = Math.min(A.bottom,B.bottom); const inter = Math.max(0,r-l)*Math.max(0,d-t); if (!inter) return 0; const aa=(A.right-A.left)*(A.bottom-A.top), bb=(B.right-B.left)*(B.bottom-B.top); return inter / Math.min(aa,bb); }
export function moveCorner(value, index, next) { const q = orderQuadPoints(value), p = point(next); if (!q || !p || index < 0 || index > 3) return q; const candidate = q.map((v) => ({...v})); candidate[index] = p; const ordered = orderQuadPoints(candidate); return validQuad(ordered) ? ordered : q; }
export function nearestCorner(value, focus, radius = 0.04) { const q = orderQuadPoints(value), p = point(focus); if (!q || !p) return -1; let best=-1, dist=radius; q.forEach((v,i)=>{const d=Math.hypot(v.x-p.x,v.y-p.y);if(d<=dist){best=i;dist=d;}}); return best; }

export const SLOT_STATUS = Object.freeze({ PREVIEW: 'preview', FROZEN: 'frozen' });
export function createSlot({ id, quad, artworkKey, label = 'Superfície' }) { const q=orderQuadPoints(quad); if (!validQuad(q) || !artworkKey) return null; return { id:String(id), quad:q, artworkKey:String(artworkKey), label:String(label).slice(0,80), status:SLOT_STATUS.PREVIEW, integrationPlan:null }; }
export function updateSlot(slots, id, patch = {}) { return slots.map((s)=>String(s.id)!==String(id)?s:{...s,...patch,status:SLOT_STATUS.PREVIEW,integrationPlan:null,quad:patch.quad?orderQuadPoints(patch.quad):s.quad}); }
export function freezeSlot(slots,id){return slots.map((s)=>String(s.id)===String(id)?{...s,status:SLOT_STATUS.FROZEN}:s);}
export function reopenSlot(slots,id){return slots.map((s)=>String(s.id)===String(id)?{...s,status:SLOT_STATUS.PREVIEW,integrationPlan:null}:s);}
export function outputReady(slots=[]){return slots.some((s)=>s.status===SLOT_STATUS.FROZEN)&&!slots.some((s)=>s.status===SLOT_STATUS.PREVIEW);}

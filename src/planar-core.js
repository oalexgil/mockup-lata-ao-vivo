export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function suggestQuadFromBox(box, imageWidth, imageHeight, inset = 0.03) {
  if (!box || !imageWidth || !imageHeight) throw new Error('Invalid box or image dimensions');
  const padX = box.width * inset;
  const padY = box.height * inset;
  const x1 = clamp(box.originX + padX, 0, imageWidth);
  const y1 = clamp(box.originY + padY, 0, imageHeight);
  const x2 = clamp(box.originX + box.width - padX, 0, imageWidth);
  const y2 = clamp(box.originY + box.height - padY, 0, imageHeight);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function defaultQuad(imageWidth, imageHeight, scale = 0.62) {
  const w = imageWidth * scale;
  const h = imageHeight * scale;
  const x = (imageWidth - w) / 2;
  const y = (imageHeight - h) / 2;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function bilinearPoint(quad, u, v) {
  const [tl, tr, br, bl] = quad;
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  };
}

export function quadArea(quad) {
  let area = 0;
  for (let i = 0; i < quad.length; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % quad.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function clampQuad(quad, imageWidth, imageHeight) {
  return quad.map((p) => ({
    x: clamp(p.x, 0, imageWidth),
    y: clamp(p.y, 0, imageHeight),
  }));
}

export function nearestCorner(quad, point, radius = 28) {
  let best = -1;
  let bestDistance = radius;
  quad.forEach((corner, index) => {
    const distance = Math.hypot(corner.x - point.x, corner.y - point.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function quadBoundingBox(quad) {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function isUsableQuad(quad, imageWidth, imageHeight) {
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  const minArea = imageWidth * imageHeight * 0.0025;
  return quadArea(quad) >= minArea;
}

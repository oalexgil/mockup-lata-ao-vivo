const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

function validPoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function edgeLength(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
}

export function bilinearQuadPoint(quad, u, v) {
  if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(validPoint)) return null;
  const [a, b, c, d] = quad;
  return {
    x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v,
    y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v,
  };
}

export function approximateQuadAspectRatio(quad) {
  if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(validPoint)) return 1;
  const width = (edgeLength(quad[0], quad[1]) + edgeLength(quad[3], quad[2])) / 2;
  const height = (edgeLength(quad[0], quad[3]) + edgeLength(quad[1], quad[2])) / 2;
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 1e-6) return 1;
  return width / height;
}

export function fidelityApplicationStrategy(options = {}) {
  const fidelityMode = String(options.fidelityMode || 'exact').trim().toLowerCase();
  return fidelityMode === 'exact' ? 'deterministic-exact' : 'direct-ai-edit';
}

export function fitArtworkQuad(quad, artworkAspectRatio, options = {}) {
  if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(validPoint)) return quad;

  const preserveAspectRatio = options.preserveAspectRatio !== false;
  const safeMargins = options.safeMargins !== false;
  const limitDeformation = options.limitDeformation !== false;
  const ratio = Number(artworkAspectRatio);
  const artworkRatio = Number.isFinite(ratio) && ratio > 0 ? clamp(ratio, 0.1, 10) : 1;
  const surfaceRatio = clamp(approximateQuadAspectRatio(quad), 0.1, 10);

  const requestedMargin = Number(options.safeMargin);
  const baseMargin = safeMargins
    ? clamp(Number.isFinite(requestedMargin) ? requestedMargin : (limitDeformation ? 0.055 : 0.035), 0, 0.22)
    : 0;

  let uMargin = baseMargin;
  let vMargin = baseMargin;

  if (preserveAspectRatio) {
    const usable = Math.max(0.1, 1 - 2 * baseMargin);
    if (artworkRatio > surfaceRatio) {
      const requiredHeightScale = clamp(surfaceRatio / artworkRatio, 0.2, 1);
      vMargin = Math.max(baseMargin, (1 - usable * requiredHeightScale) / 2);
    } else if (artworkRatio < surfaceRatio) {
      const requiredWidthScale = clamp(artworkRatio / surfaceRatio, 0.2, 1);
      uMargin = Math.max(baseMargin, (1 - usable * requiredWidthScale) / 2);
    }
  }

  // Never collapse the artwork into an unusably small inset. The cap still
  // allows large letterboxed/pillarboxed margins for strong aspect mismatch.
  uMargin = clamp(uMargin, 0, 0.39);
  vMargin = clamp(vMargin, 0, 0.39);

  const fitted = [
    bilinearQuadPoint(quad, uMargin, vMargin),
    bilinearQuadPoint(quad, 1 - uMargin, vMargin),
    bilinearQuadPoint(quad, 1 - uMargin, 1 - vMargin),
    bilinearQuadPoint(quad, uMargin, 1 - vMargin),
  ];

  return fitted.every(validPoint) ? fitted : quad;
}

export function artworkFitSummary(quad, fittedQuad, artworkAspectRatio) {
  const surfaceRatio = approximateQuadAspectRatio(quad);
  const fittedRatio = approximateQuadAspectRatio(fittedQuad);
  const targetRatio = Number(artworkAspectRatio) || 1;
  return {
    surfaceRatio,
    fittedRatio,
    targetRatio,
    ratioError: Math.abs(fittedRatio - targetRatio) / Math.max(0.001, targetRatio),
  };
}

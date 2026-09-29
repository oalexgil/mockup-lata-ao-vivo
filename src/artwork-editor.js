const DEFAULTS = Object.freeze({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  sharpness: 0,
  opacity: 1,
  transparency: 0,
  blendIntensity: 1,
  blacks: 0,
  whites: 0,
  whiteReduction: 0,
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  safeMargin: 0.04,
  fit: 'contain',
  curvature: 0,
  reflection: 0,
  contactShadow: 0,
  materialIntegration: 0.55,
});

const LIMITS = Object.freeze({
  brightness: [0.5, 1.5],
  contrast: [0.5, 1.6],
  saturation: [0, 1.8],
  temperature: [-1, 1],
  sharpness: [0, 1],
  opacity: [0, 1],
  transparency: [0, 1],
  blendIntensity: [0, 1],
  blacks: [-1, 1],
  whites: [-1, 1],
  whiteReduction: [0, 1],
  scale: [0.25, 3],
  rotation: [-180, 180],
  offsetX: [-1, 1],
  offsetY: [-1, 1],
  safeMargin: [0, 0.3],
  curvature: [0, 1],
  reflection: [0, 1],
  contactShadow: [0, 1],
  materialIntegration: [0, 1],
});

const store = new Map();

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function defaultArtworkAdjustments() {
  return { ...DEFAULTS };
}

export function normalizeArtworkAdjustments(input = {}) {
  const next = { ...DEFAULTS, ...(input || {}) };
  for (const [key, range] of Object.entries(LIMITS)) {
    next[key] = clamp(next[key], range[0], range[1]);
  }
  next.fit = next.fit === 'cover' ? 'cover' : 'contain';
  return next;
}

export function artworkKey(fileLike, index = 0) {
  const name = String(fileLike?.name || `artwork-${index + 1}`);
  const modified = Number(fileLike?.lastModified || 0);
  return `${index}:${name}:${modified}`;
}

export function getArtworkAdjustments(key) {
  return normalizeArtworkAdjustments(store.get(String(key)) || DEFAULTS);
}

export function setArtworkAdjustments(key, patch = {}) {
  const id = String(key);
  const current = getArtworkAdjustments(id);
  const next = normalizeArtworkAdjustments({ ...current, ...(patch || {}) });
  store.set(id, next);
  return { ...next };
}

export function resetArtworkAdjustments(key) {
  const id = String(key);
  store.delete(id);
  return defaultArtworkAdjustments();
}

export function resetAllArtworkAdjustments() {
  store.clear();
}

export function artworkAdjustmentSnapshot(key) {
  return Object.freeze({ ...getArtworkAdjustments(key) });
}

export function effectiveArtworkOpacity(input = {}) {
  const adjustments = normalizeArtworkAdjustments(input);
  return clamp(adjustments.opacity * (1 - adjustments.transparency), 0, 1);
}

export function artworkFitRect(sourceWidth, sourceHeight, targetWidth, targetHeight, input = {}) {
  const adjustments = normalizeArtworkAdjustments(input);
  const marginX = targetWidth * adjustments.safeMargin;
  const marginY = targetHeight * adjustments.safeMargin;
  const innerWidth = Math.max(1, targetWidth - marginX * 2);
  const innerHeight = Math.max(1, targetHeight - marginY * 2);
  const contain = Math.min(innerWidth / Math.max(1, sourceWidth), innerHeight / Math.max(1, sourceHeight));
  const cover = Math.max(innerWidth / Math.max(1, sourceWidth), innerHeight / Math.max(1, sourceHeight));
  const fit = adjustments.fit === 'cover' ? cover : contain;
  const width = sourceWidth * fit * adjustments.scale;
  const height = sourceHeight * fit * adjustments.scale;
  return {
    width,
    height,
    x: targetWidth / 2 - width / 2 + adjustments.offsetX * innerWidth * 0.5,
    y: targetHeight / 2 - height / 2 + adjustments.offsetY * innerHeight * 0.5,
    innerWidth,
    innerHeight,
  };
}

export function artworkCssFilter(input = {}) {
  const adjustments = normalizeArtworkAdjustments(input);
  const temperatureWarm = adjustments.temperature > 0 ? 1 + adjustments.temperature * 0.08 : 1;
  const temperatureCool = adjustments.temperature < 0 ? 1 + Math.abs(adjustments.temperature) * 0.06 : 1;
  const sharpnessContrast = 1 + adjustments.sharpness * 0.08;
  return `brightness(${adjustments.brightness * temperatureWarm}) contrast(${adjustments.contrast * sharpnessContrast}) saturate(${adjustments.saturation * temperatureCool})`;
}

export function integrationStrength(input = {}) {
  const adjustments = normalizeArtworkAdjustments(input);
  return clamp(adjustments.materialIntegration * adjustments.blendIntensity, 0, 1);
}

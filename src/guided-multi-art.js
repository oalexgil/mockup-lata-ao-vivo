export const GUIDED_STATUS = Object.freeze({
  AVAILABLE: 'available',
  PREVIEW: 'preview',
  FROZEN: 'frozen',
});

const toIndex = (value) => {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
};

function normalizeStatus(value) {
  return Object.values(GUIDED_STATUS).includes(value) ? value : GUIDED_STATUS.AVAILABLE;
}

function normalizedSlot(slot = {}, index = 0) {
  const status = normalizeStatus(slot.guidedStatus);
  const artworkIndex = toIndex(slot.artworkIndex);
  return {
    ...slot,
    index: index + 1,
    artworkIndex,
    guidedStatus: artworkIndex == null && status !== GUIDED_STATUS.FROZEN ? GUIDED_STATUS.AVAILABLE : status,
    frozen: status === GUIDED_STATUS.FROZEN,
  };
}

export function normalizeGuidedMapping(slots = []) {
  return (Array.isArray(slots) ? slots : []).map(normalizedSlot);
}

export function addGuidedSurfaces(mapping = [], surfaces = []) {
  const current = normalizeGuidedMapping(mapping);
  const seen = new Set(current.map((slot) => String(slot.id)));
  for (const surface of Array.isArray(surfaces) ? surfaces : []) {
    const id = String(surface?.id || `guided-${current.length + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    current.push({
      ...surface,
      id,
      artworkIndex: null,
      guidedStatus: GUIDED_STATUS.AVAILABLE,
      frozen: false,
    });
  }
  return normalizeGuidedMapping(current);
}

export function assignedArtworkIndices(mapping = []) {
  return new Set(normalizeGuidedMapping(mapping)
    .map((slot) => slot.artworkIndex)
    .filter((index) => index != null));
}

export function frozenArtworkIndices(mapping = []) {
  return new Set(normalizeGuidedMapping(mapping)
    .filter((slot) => slot.guidedStatus === GUIDED_STATUS.FROZEN)
    .map((slot) => slot.artworkIndex)
    .filter((index) => index != null));
}

export function remainingArtworkIndices(mapping = [], artworkCount = 0) {
  const count = Math.max(0, Number(artworkCount) || 0);
  const assigned = assignedArtworkIndices(mapping);
  return Array.from({ length: count }, (_, index) => index).filter((index) => !assigned.has(index));
}

export function assignGuidedArtwork(mapping = [], surfaceId, artworkIndex) {
  const nextArtwork = toIndex(artworkIndex);
  if (nextArtwork == null) return normalizeGuidedMapping(mapping);
  const id = String(surfaceId);
  const normalized = normalizeGuidedMapping(mapping);
  const owner = normalized.find((slot) => slot.artworkIndex === nextArtwork && String(slot.id) !== id);
  if (owner?.guidedStatus === GUIDED_STATUS.FROZEN) return normalized;

  return normalizeGuidedMapping(normalized.map((slot) => {
    if (String(slot.id) === id) {
      return {
        ...slot,
        artworkIndex: nextArtwork,
        guidedStatus: GUIDED_STATUS.PREVIEW,
        frozen: false,
        integrationPlan: null,
      };
    }
    if (slot.artworkIndex === nextArtwork && slot.guidedStatus !== GUIDED_STATUS.FROZEN) {
      return {
        ...slot,
        artworkIndex: null,
        guidedStatus: GUIDED_STATUS.AVAILABLE,
        frozen: false,
        integrationPlan: null,
      };
    }
    return slot;
  }));
}

export function clearGuidedArtwork(mapping = [], surfaceId) {
  const id = String(surfaceId);
  return normalizeGuidedMapping(mapping).map((slot) => String(slot.id) === id
    ? { ...slot, artworkIndex: null, guidedStatus: GUIDED_STATUS.AVAILABLE, frozen: false, integrationPlan: null }
    : slot);
}

export function freezeGuidedSurface(mapping = [], surfaceId) {
  const id = String(surfaceId);
  return normalizeGuidedMapping(mapping).map((slot) => {
    if (String(slot.id) !== id || slot.artworkIndex == null) return slot;
    return { ...slot, guidedStatus: GUIDED_STATUS.FROZEN, frozen: true };
  });
}

export function unfreezeGuidedSurface(mapping = [], surfaceId) {
  const id = String(surfaceId);
  return normalizeGuidedMapping(mapping).map((slot) => {
    if (String(slot.id) !== id) return slot;
    return {
      ...slot,
      guidedStatus: slot.artworkIndex == null ? GUIDED_STATUS.AVAILABLE : GUIDED_STATUS.PREVIEW,
      frozen: false,
      integrationPlan: null,
    };
  });
}

export function removeGuidedSurface(mapping = [], surfaceId) {
  const id = String(surfaceId);
  return normalizeGuidedMapping(mapping).filter((slot) => String(slot.id) !== id).map(normalizedSlot);
}

export function moveGuidedSurface(mapping = [], surfaceId, direction = 0) {
  const normalized = normalizeGuidedMapping(mapping);
  const index = normalized.findIndex((slot) => String(slot.id) === String(surfaceId));
  const delta = Math.sign(Number(direction) || 0);
  if (index < 0 || !delta) return normalized;
  const target = index + delta;
  if (target < 0 || target >= normalized.length) return normalized;
  const copy = [...normalized];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy.map(normalizedSlot);
}

export function autoAssignGuidedArtworks(mapping = [], artworkCount = 0) {
  let result = normalizeGuidedMapping(mapping);
  const remaining = remainingArtworkIndices(result, artworkCount);
  const availableIds = result
    .filter((slot) => slot.guidedStatus === GUIDED_STATUS.AVAILABLE && slot.artworkIndex == null)
    .map((slot) => slot.id);
  for (let index = 0; index < Math.min(remaining.length, availableIds.length); index += 1) {
    result = assignGuidedArtwork(result, availableIds[index], remaining[index]);
  }
  return result;
}

export function freezeAllPreviews(mapping = []) {
  return normalizeGuidedMapping(mapping).map((slot) => slot.guidedStatus === GUIDED_STATUS.PREVIEW && slot.artworkIndex != null
    ? { ...slot, guidedStatus: GUIDED_STATUS.FROZEN, frozen: true }
    : slot);
}

export function occupiedQuads(mapping = []) {
  return normalizeGuidedMapping(mapping)
    .filter((slot) => Array.isArray(slot.quad) && slot.quad.length === 4)
    .map((slot) => ({ id: String(slot.id), quad: slot.quad }));
}

export function frozenQuads(mapping = []) {
  return normalizeGuidedMapping(mapping)
    .filter((slot) => slot.guidedStatus === GUIDED_STATUS.FROZEN && Array.isArray(slot.quad) && slot.quad.length === 4)
    .map((slot) => ({ id: String(slot.id), quad: slot.quad }));
}

export function guidedComplete(mapping = [], artworkCount = 0) {
  const count = Math.max(0, Number(artworkCount) || 0);
  if (!count) return false;
  const frozen = frozenArtworkIndices(mapping);
  return Array.from({ length: count }, (_, index) => index).every((index) => frozen.has(index));
}

function lineLength(a, b) {
  return Math.hypot(Number(b?.x || 0) - Number(a?.x || 0), Number(b?.y || 0) - Number(a?.y || 0));
}

function bilinear(quad, u, v) {
  const [a, b, c, d] = quad;
  return {
    x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v,
    y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v,
  };
}

export function containedArtworkQuad(quad = [], artworkWidth = 1, artworkHeight = 1, margin = 0.96) {
  if (!Array.isArray(quad) || quad.length !== 4) return quad;
  const width = (lineLength(quad[0], quad[1]) + lineLength(quad[3], quad[2])) / 2;
  const height = (lineLength(quad[0], quad[3]) + lineLength(quad[1], quad[2])) / 2;
  const artWidth = Math.max(1, Number(artworkWidth) || 1);
  const artHeight = Math.max(1, Number(artworkHeight) || 1);
  if (width <= 0 || height <= 0) return quad;
  const safeMargin = Math.max(0.5, Math.min(1, Number(margin) || 0.96));
  const slotRatio = width / height;
  const artRatio = artWidth / artHeight;
  let uScale = safeMargin;
  let vScale = safeMargin;
  if (artRatio > slotRatio) {
    vScale *= slotRatio / artRatio;
  } else {
    uScale *= artRatio / slotRatio;
  }
  const u0 = (1 - uScale) / 2;
  const u1 = 1 - u0;
  const v0 = (1 - vScale) / 2;
  const v1 = 1 - v0;
  return [
    bilinear(quad, u0, v0),
    bilinear(quad, u1, v0),
    bilinear(quad, u1, v1),
    bilinear(quad, u0, v1),
  ];
}

export function guidedProgress(mapping = [], artworkCount = 0) {
  const count = Math.max(0, Number(artworkCount) || 0);
  const normalized = normalizeGuidedMapping(mapping);
  const frozen = normalized.filter((slot) => slot.guidedStatus === GUIDED_STATUS.FROZEN && slot.artworkIndex != null).length;
  const previews = normalized.filter((slot) => slot.guidedStatus === GUIDED_STATUS.PREVIEW && slot.artworkIndex != null).length;
  return {
    artworkCount: count,
    surfaceCount: normalized.length,
    frozen,
    previews,
    remaining: Math.max(0, count - frozen),
    complete: guidedComplete(normalized, count),
  };
}

export function createFlowState(input = {}) {
  return {
    sceneReady: Boolean(input.sceneReady),
    sceneApproved: Boolean(input.sceneApproved),
    artworkCount: Math.max(0, Number(input.artworkCount) || 0),
    autoApplied: Boolean(input.autoApplied),
    fineTuneOpen: Boolean(input.fineTuneOpen),
  };
}

export function canApproveScene(state = {}) {
  return Boolean(state.sceneReady) && !state.sceneApproved;
}

export function approveScene(state = {}) {
  const next = createFlowState(state);
  if (!next.sceneReady) return next;
  return { ...next, sceneApproved: true, autoApplied: false, fineTuneOpen: false };
}

export function reopenScene(state = {}) {
  return { ...createFlowState(state), sceneApproved: false, autoApplied: false, fineTuneOpen: false };
}

export function setArtworkCount(state = {}, count = 0) {
  return {
    ...createFlowState(state),
    artworkCount: Math.max(0, Number(count) || 0),
    autoApplied: false,
  };
}

export function markAutoApplied(state = {}) {
  const next = createFlowState(state);
  if (!next.sceneApproved || !next.artworkCount) return next;
  return { ...next, autoApplied: true };
}

export function setFineTuneOpen(state = {}, open = true) {
  const next = createFlowState(state);
  return { ...next, fineTuneOpen: Boolean(open) && next.autoApplied };
}

export function flowStep(state = {}) {
  const s = createFlowState(state);
  if (!s.sceneReady) return 1;
  if (!s.sceneApproved) return 2;
  if (!s.artworkCount) return 3;
  return 4;
}

export function autoApplyMessage(artworkCount, slotCount) {
  const arts = Math.max(0, Number(artworkCount) || 0);
  const slots = Math.max(0, Number(slotCount) || 0);
  if (!arts) return 'Envie pelo menos uma arte.';
  if (!slots) return 'Nenhuma área foi detectada; usando a área inicial como fallback.';
  if (arts === slots) return `${arts} arte(s) distribuída(s) em ${slots} área(s).`;
  if (arts < slots) return `${arts} arte(s) aplicada(s). Há ${slots - arts} área(s) adicional(is) para ajuste opcional.`;
  return `${slots} área(s) preenchida(s). ${arts - slots} arte(s) ficaram sem área e podem ser atribuídas nos ajustes finos.`;
}

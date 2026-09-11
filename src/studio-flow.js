export function createFlowState(input = {}) {
  return {
    sceneReady: Boolean(input.sceneReady),
    sceneApproved: Boolean(input.sceneApproved),
    artworkCount: Math.max(0, Number(input.artworkCount) || 0),
    mappingReady: Boolean(input.mappingReady),
    aiFinalized: Boolean(input.aiFinalized),
    fineTuneOpen: Boolean(input.fineTuneOpen),
  };
}

export function canApproveScene(state = {}) {
  const s = createFlowState(state);
  return s.sceneReady && !s.sceneApproved;
}

export function approveScene(state = {}) {
  const next = createFlowState(state);
  if (!next.sceneReady) return next;
  return {
    ...next,
    sceneApproved: true,
    mappingReady: false,
    aiFinalized: false,
    fineTuneOpen: false,
  };
}

export function reopenScene(state = {}) {
  return {
    ...createFlowState(state),
    sceneApproved: false,
    mappingReady: false,
    aiFinalized: false,
    fineTuneOpen: false,
  };
}

export function setArtworkCount(state = {}, count = 0) {
  const next = createFlowState(state);
  return {
    ...next,
    artworkCount: Math.max(0, Number(count) || 0),
    mappingReady: false,
    aiFinalized: false,
    fineTuneOpen: false,
  };
}

export function markMappingReady(state = {}, ready = true) {
  const next = createFlowState(state);
  if (!next.sceneApproved || !next.artworkCount) return next;
  return {
    ...next,
    mappingReady: Boolean(ready),
    aiFinalized: ready ? false : next.aiFinalized,
    fineTuneOpen: false,
  };
}

export function markAiFinalized(state = {}) {
  const next = createFlowState(state);
  if (!next.sceneApproved || !next.artworkCount || !next.mappingReady) return next;
  return { ...next, aiFinalized: true };
}

export function setFineTuneOpen(state = {}, open = true) {
  const next = createFlowState(state);
  return { ...next, fineTuneOpen: Boolean(open) && next.aiFinalized };
}

export function flowStep(state = {}) {
  const s = createFlowState(state);
  if (!s.sceneReady) return 1;
  if (!s.sceneApproved) return 2;
  if (!s.artworkCount) return 3;
  if (!s.mappingReady) return 4;
  return 5;
}

const nextFetch = globalThis.fetch.bind(globalThis);

function workflowHasCommittedPlacement() {
  const panel = document.getElementById('guidedWorkflowPanel');
  if (!panel) return false;
  const text = String(panel.textContent || '');
  const approved = text.match(/(\d+)\s+aprovad/i);
  const previews = text.match(/(\d+)\s+pr[eé]via/i);
  return Number(approved?.[1] || 0) > 0 || Number(previews?.[1] || 0) > 0;
}

function currentSceneDataUrl() {
  const canvas = document.getElementById('display');
  const empty = document.getElementById('empty');
  if (!canvas?.width || !canvas?.height || !empty?.classList.contains('hidden')) return '';
  try { return canvas.toDataURL('image/jpeg', 0.94); }
  catch { return ''; }
}

function guidedHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  return String(headers.get('X-Mockup-Workflow') || '').toLowerCase().includes('guided-progressive');
}

function requestUrl(input) {
  return typeof input === 'string' ? input : input?.url || '';
}

async function responsePayload(response) {
  try { return await response.clone().json(); }
  catch { return null; }
}

function prepareGuidedLayoutRequest(init = {}, { relaxReservations = false } = {}) {
  if (typeof init.body !== 'string') return init;
  let payload;
  try { payload = JSON.parse(init.body); }
  catch { return init; }

  const liveScene = currentSceneDataUrl();
  if (liveScene) payload.imageDataUrl = liveScene;

  const hasCommitted = workflowHasCommittedPlacement();
  if (!hasCommitted || relaxReservations) payload.excludedSlots = [];

  if (payload.targetInstruction) {
    payload.targetInstruction = String(payload.targetInstruction).trim();
  }

  return { ...init, body: JSON.stringify(payload) };
}

globalThis.fetch = async function guidedFreshFetch(input, init = {}) {
  const url = requestUrl(input);
  if (!url.includes('/api/analyze-layout') || !guidedHeaders(init)) {
    return nextFetch(input, init);
  }

  const prepared = prepareGuidedLayoutRequest(init);
  let response = await nextFetch(input, prepared);
  const payload = await responsePayload(response);

  // A new composition with zero previews/approvals must never be blocked by
  // reservations left from an earlier attempt. Retry once against the current
  // canvas without exclusions before reporting that no target exists.
  if (response.ok && payload?.surfaceValidated === false && !workflowHasCommittedPlacement()) {
    response = await nextFetch(input, prepareGuidedLayoutRequest(init, { relaxReservations: true }));
  }

  return response;
};

import {
  GUIDED_STATUS,
  addGuidedSurfaces,
  assignGuidedArtwork,
  containedArtworkQuad,
  freezeAllPreviews,
  freezeGuidedSurface,
  guidedProgress,
  moveGuidedSurface,
  occupiedQuads,
  remainingArtworkIndices,
  removeGuidedSurface,
  unfreezeGuidedSurface,
} from './src/guided-multi-art.js';
import {
  markArtworkReplaced,
  parseArtworkTargetPlan,
  removeArtworkFromMapping,
  summarizeArtworkTargetPlan,
  targetForArtwork,
} from './src/guided-routing.js';
import {
  closestQuadCorner,
  moveQuadCorner,
  pointFromClient,
  quadAroundPoint,
} from './src/assisted-surface.js';
import { quadToPixels } from './src/universal-mockup.js';

const $ = (id) => document.getElementById(id);
const baseCanvas = $('display');
const stage = baseCanvas?.parentElement;
const G = {
  mode: 'auto',
  files: [],
  artworks: [],
  mapping: [],
  activeId: null,
  baseDataUrl: null,
  finalized: false,
  busy: false,
  rejectedSlots: [],
  armed: null,
  drag: null,
  surfaceSequence: 0,
};

const overlay = document.createElement('canvas');
overlay.id = 'guidedWorkflowOverlay';
Object.assign(overlay.style, {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: '9',
  display: 'none',
  touchAction: 'none',
});
stage?.appendChild(overlay);
const overlayCtx = overlay.getContext('2d');

const guided = () => G.mode === 'guided';
const fileKey = (file) => `${file?.name || ''}:${file?.size || 0}:${file?.lastModified || 0}`;
const frozenSlots = () => G.mapping.filter((slot) => slot.guidedStatus === GUIDED_STATUS.FROZEN && slot.artworkIndex != null);
const previewSlots = () => G.mapping.filter((slot) => slot.guidedStatus === GUIDED_STATUS.PREVIEW && slot.artworkIndex != null);
const readyForOutput = () => frozenSlots().length > 0 && previewSlots().length === 0;

function status(message, kind = '') {
  const el = $('guidedWorkflowStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `guided-workflow-status ${kind}`.trim();
}

function friendly(error) {
  const text = String(error?.message || error || 'Não foi possível concluir a operação.');
  if (/3036|10[,.]?000\s*neurons|daily free allocation|workers paid/i.test(text)) {
    return 'O limite diário do provedor foi atingido. As áreas já aprovadas foram preservadas; você ainda pode usar o modo manual.';
  }
  if (/429|rate limit|too many requests/i.test(text)) {
    return 'O serviço está temporariamente no limite. Você pode aguardar ou criar a área manualmente.';
  }
  return text.replace(/^AiError:\s*/i, '').slice(0, 420);
}

function setBusy(value) {
  G.busy = Boolean(value);
  document.querySelectorAll('#guidedWorkflowPanel button,#guidedWorkflowPanel select,#guidedWorkflowPanel textarea')
    .forEach((el) => { el.disabled = G.busy; });
  updateOverlayInteraction();
}

function fileToArtwork(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler a arte.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve({ file, image, dataUrl: String(reader.result) });
      image.onerror = () => reject(new Error(`Arquivo de imagem inválido: ${file.name}`));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function addFiles(files, append = true) {
  const existing = append ? new Set(G.files.map(fileKey)) : new Set();
  if (!append) {
    G.files = [];
    G.artworks = [];
  }
  for (const file of [...files]) {
    if (!file?.type?.startsWith('image/') || existing.has(fileKey(file))) continue;
    existing.add(fileKey(file));
    G.files.push(file);
    G.artworks.push(await fileToArtwork(file));
  }
  syncBrandInput(false);
}

function syncBrandInput(dispatch = false) {
  const input = $('brandFiles');
  if (!input || typeof DataTransfer === 'undefined') return;
  const transfer = new DataTransfer();
  G.files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  const count = $('assetCount');
  if (count && guided()) count.textContent = G.files.length ? `${G.files.length} arquivo(s)` : 'nenhuma arte';
  if (dispatch) input.dispatchEvent(new Event('change', { bubbles: true }));
}

function captureScene() {
  if (!baseCanvas?.width || !baseCanvas?.height || !$('empty')?.classList.contains('hidden')) {
    throw new Error('Crie ou aprove uma cena antes de aplicar as artes.');
  }
  G.baseDataUrl = baseCanvas.toDataURL('image/jpeg', 0.96);
  return G.baseDataUrl;
}

function activeEditableSlot() {
  if (!G.activeId) return null;
  const slot = G.mapping.find((item) => String(item.id) === String(G.activeId));
  return slot?.guidedStatus === GUIDED_STATUS.FROZEN ? null : slot || null;
}

function syncOverlay() {
  if (!baseCanvas || !stage || !baseCanvas.width || !baseCanvas.height) return;
  overlay.width = baseCanvas.width;
  overlay.height = baseCanvas.height;
  const rect = baseCanvas.getBoundingClientRect();
  const parent = stage.getBoundingClientRect();
  overlay.style.left = `${rect.left - parent.left + stage.scrollLeft}px`;
  overlay.style.top = `${rect.top - parent.top + stage.scrollTop}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = guided() && (G.mapping.length || G.armed) ? 'block' : 'none';
  updateOverlayInteraction();
}

function updateOverlayInteraction() {
  if (!guided() || G.busy) {
    overlay.style.pointerEvents = 'none';
    overlay.style.cursor = 'default';
    return;
  }
  const editable = Boolean(activeEditableSlot());
  overlay.style.pointerEvents = (G.armed || editable) ? 'auto' : 'none';
  overlay.style.cursor = G.armed ? 'crosshair' : editable ? 'grab' : 'default';
}

function affine(src, dst) {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(den) < 1e-8) return null;
  const solve = (v0, v1, v2) => ({
    a: (v0 * (s1.y - s2.y) + v1 * (s2.y - s0.y) + v2 * (s0.y - s1.y)) / den,
    c: (v0 * (s2.x - s1.x) + v1 * (s0.x - s2.x) + v2 * (s1.x - s0.x)) / den,
    e: (v0 * (s1.x * s2.y - s2.x * s1.y) + v1 * (s2.x * s0.y - s0.x * s2.y) + v2 * (s0.x * s1.y - s1.x * s0.y)) / den,
  });
  const x = solve(d0.x, d1.x, d2.x);
  const y = solve(d0.y, d1.y, d2.y);
  return { a: x.a, b: y.a, c: x.c, d: y.c, e: x.e, f: y.e };
}

function bilinear(q, u, v) {
  const [a, b, c, d] = q;
  return {
    x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v,
    y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v,
  };
}

function triangle(ctx, image, src, dst) {
  const matrix = affine(src, dst);
  if (!matrix) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dst[0].x, dst[0].y);
  ctx.lineTo(dst[1].x, dst[1].y);
  ctx.lineTo(dst[2].x, dst[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function prepared(art, plan = {}) {
  const image = art?.image;
  if (!image) return null;
  const width = image.naturalWidth || 1;
  const height = image.naturalHeight || 1;
  const scale = Math.min(1, 2200 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = `brightness(${plan.brightness ?? 1}) contrast(${plan.contrast ?? 1}) saturate(${plan.saturation ?? 1})`;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function warp(ctx, slot, art) {
  const plan = slot.integrationPlan || {};
  const image = prepared(art, plan);
  if (!image) return;
  const raw = quadToPixels(slot.quad, overlay.width, overlay.height);
  const quad = containedArtworkQuad(raw, image.width, image.height, 0.94);
  const cols = 24;
  const rows = 24;
  const sw = image.width;
  const sh = image.height;
  ctx.save();
  ctx.globalAlpha = plan.opacity ?? 1;
  ctx.globalCompositeOperation = plan.blend || 'source-over';
  for (let y = 0; y < rows; y += 1) {
    const v0 = y / rows;
    const v1 = (y + 1) / rows;
    for (let x = 0; x < cols; x += 1) {
      const u0 = x / cols;
      const u1 = (x + 1) / cols;
      const s00 = { x: u0 * sw, y: v0 * sh };
      const s10 = { x: u1 * sw, y: v0 * sh };
      const s11 = { x: u1 * sw, y: v1 * sh };
      const s01 = { x: u0 * sw, y: v1 * sh };
      const d00 = bilinear(quad, u0, v0);
      const d10 = bilinear(quad, u1, v0);
      const d11 = bilinear(quad, u1, v1);
      const d01 = bilinear(quad, u0, v1);
      triangle(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      triangle(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  ctx.restore();
  const light = Math.max(0, Math.min(1, Number(plan.preserveLight ?? 0.42)));
  if (light > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = light * 0.14;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.globalAlpha = light * 0.05;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.restore();
  }
}

function guides() {
  const ctx = overlayCtx;
  ctx.save();
  ctx.lineWidth = Math.max(2, overlay.width / 700);
  ctx.font = `${Math.max(12, overlay.width / 62)}px Space Mono, monospace`;
  G.mapping.forEach((slot) => {
    const quad = quadToPixels(slot.quad, overlay.width, overlay.height);
    const frozen = slot.guidedStatus === GUIDED_STATUS.FROZEN;
    const preview = slot.guidedStatus === GUIDED_STATUS.PREVIEW;
    const active = String(slot.id) === String(G.activeId);
    const color = frozen ? '#5ed6aa' : preview ? '#f2bd73' : '#6edbe3';
    ctx.strokeStyle = color;
    ctx.fillStyle = frozen ? 'rgba(94,214,170,.045)' : preview ? 'rgba(242,189,115,.05)' : 'rgba(110,219,227,.04)';
    ctx.setLineDash(frozen ? [] : [9, 7]);
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const radius = Math.max(10, overlay.width / 78);
    const anchor = quad[0];
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(anchor.x + radius, anchor.y + radius, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#07131b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frozen ? '✓' : String(slot.index), anchor.x + radius, anchor.y + radius);
    if (active && !frozen) {
      quad.forEach((corner) => {
        ctx.beginPath();
        ctx.fillStyle = '#f8fbff';
        ctx.strokeStyle = '#17384d';
        ctx.lineWidth = Math.max(2, overlay.width / 900);
        ctx.arc(corner.x, corner.y, Math.max(8, overlay.width / 105), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  });
  ctx.restore();
}

function renderOverlay(showGuides = true) {
  syncOverlay();
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!guided()) return;
  G.mapping.forEach((slot) => {
    if (![GUIDED_STATUS.PREVIEW, GUIDED_STATUS.FROZEN].includes(slot.guidedStatus)) return;
    if (slot.artworkIndex == null || !G.artworks[slot.artworkIndex]) return;
    warp(overlayCtx, slot, G.artworks[slot.artworkIndex]);
  });
  if (showGuides) guides();
}

function mergedCanvas() {
  renderOverlay(false);
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(overlay, 0, 0);
  return out;
}

const routePlan = () => parseArtworkTargetPlan($('guidedRouting')?.value || '', G.artworks.length);

function uniqueSurface(surface, label = '') {
  G.surfaceSequence += 1;
  return {
    ...surface,
    id: `guided-${Date.now()}-${G.surfaceSequence}`,
    label: String(surface?.label || label || 'superfície selecionada').slice(0, 80),
  };
}

async function requestSurface(target = '', focusPoint = null) {
  captureScene();
  const excluded = [...occupiedQuads(G.mapping), ...G.rejectedSlots];
  const response = await fetch('/api/analyze-layout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mockup-Workflow': focusPoint ? 'assisted-click-v1' : 'guided-progressive-v3',
    },
    body: JSON.stringify({
      imageDataUrl: G.baseDataUrl,
      artworkCount: 1,
      desiredSlots: 1,
      excludedSlots: excluded,
      targetInstruction: String(target || '').trim(),
      focusPoint,
      focusRadius: focusPoint ? 0.24 : undefined,
    }),
  });
  let result = {};
  try { result = await response.json(); }
  catch { throw new Error(`Resposta inválida do serviço (${response.status}).`); }
  if (!response.ok) throw new Error(result?.error || `Análise ${response.status}`);
  if (result.surfaceValidated === false || result.mappingStatus !== 'validated' || !result.slots?.length) {
    throw new Error(result.warning || 'Nenhuma superfície confiável foi encontrada.');
  }
  return result.slots[0];
}

function addSurface(surface, artworkIndex) {
  const candidate = uniqueSurface(surface);
  G.mapping = addGuidedSurfaces(G.mapping, [candidate]);
  const added = G.mapping.find((slot) => String(slot.id) === String(candidate.id));
  if (!added) return null;
  G.mapping = assignGuidedArtwork(G.mapping, candidate.id, artworkIndex);
  G.activeId = candidate.id;
  G.finalized = false;
  return G.mapping.find((slot) => String(slot.id) === String(candidate.id)) || null;
}

function manualSurfaceFor(point, artworkIndex, label = 'Área manual') {
  const art = G.artworks[artworkIndex]?.image;
  const artAspect = (art?.naturalWidth || 1) / Math.max(1, art?.naturalHeight || 1);
  const canvasAspect = overlay.width / Math.max(1, overlay.height);
  const quad = quadAroundPoint(point, { artAspect, canvasAspect, width: 0.34, height: 0.3 });
  return addSurface({ label, confidence: 1, quad }, artworkIndex);
}

function selectedArtworkIndex() {
  const picker = $('guidedArtworkPicker');
  const value = Number(picker?.value);
  if (Number.isInteger(value) && value >= 0 && value < G.artworks.length) return value;
  return remainingArtworkIndices(G.mapping, G.artworks.length)[0] ?? null;
}

function armPick(kind = 'assisted', forcedArtworkIndex = null) {
  if (G.busy) return;
  if (!G.artworks.length) return status('Adicione pelo menos uma arte antes de selecionar uma superfície.', 'warn');
  const index = forcedArtworkIndex ?? selectedArtworkIndex();
  if (index == null || !G.artworks[index]) return status('Escolha uma arte pendente para continuar.', 'warn');
  const owner = G.mapping.find((slot) => slot.artworkIndex === index);
  if (owner?.guidedStatus === GUIDED_STATUS.FROZEN) return status('Esta arte já está aprovada. Reabra a área antes de remapear.', 'warn');
  G.armed = { kind, artworkIndex: index };
  G.activeId = null;
  G.finalized = false;
  syncOverlay();
  renderPanel();
  status(
    kind === 'manual'
      ? `Arte ${index + 1}: clique no centro da área desejada. Depois ajuste os quatro cantos.`
      : `Arte ${index + 1}: clique diretamente sobre a superfície desejada. A análise ficará restrita à região clicada.`,
    'ok'
  );
}

function cancelArmed() {
  G.armed = null;
  G.drag = null;
  updateOverlayInteraction();
  renderPanel();
}

async function handleArmedPick(point) {
  const armed = G.armed;
  if (!armed) return;
  G.armed = null;
  const index = armed.artworkIndex;
  const target = targetForArtwork(routePlan(), index, { useGeneral: true });
  if (armed.kind === 'manual') {
    manualSurfaceFor(point, index, 'Área manual ajustável');
    renderOverlay(true);
    renderPanel();
    status(`Área manual criada para a Arte ${index + 1}. Arraste os quatro pontos brancos até os cantos reais da superfície e aprove.`, 'ok');
    return;
  }
  setBusy(true);
  status(`Arte ${index + 1}: analisando somente a região clicada${target ? ` (${target})` : ''}…`);
  try {
    const surface = await requestSurface(target, point);
    addSurface(surface, index);
    renderOverlay(true);
    renderPanel();
    status(`Superfície localizada perto do clique para a Arte ${index + 1}. Ajuste os cantos se necessário e aprove.`, 'ok');
  } catch (error) {
    manualSurfaceFor(point, index, 'Área manual após detecção local');
    renderOverlay(true);
    renderPanel();
    status(`${friendly(error)} Uma área manual foi criada no ponto clicado para você concluir sem depender da detecção automática.`, 'warn');
  } finally {
    setBusy(false);
    renderPanel();
  }
}

async function distributeRemaining() {
  if (G.busy) return;
  const pending = remainingArtworkIndices(G.mapping, G.artworks.length);
  if (!G.artworks.length) return status('Adicione pelo menos uma arte.', 'warn');
  if (!pending.length) return status('Não há artes pendentes.', 'ok');
  setBusy(true);
  const plan = routePlan();
  let created = 0;
  try {
    for (const index of pending) {
      if (plan.explicit && !plan.targets.has(index)) continue;
      const target = targetForArtwork(plan, index, { useGeneral: !plan.explicit });
      status(`Automático (beta): procurando destino da Arte ${index + 1}${target ? ` — ${target}` : ''}…`);
      try {
        const surface = await requestSurface(target, null);
        if (addSurface(surface, index)) created += 1;
      } catch (error) {
        const message = friendly(error);
        if (/limite diário|temporariamente no limite/i.test(message)) {
          status(message, 'warn');
          break;
        }
      }
    }
    G.finalized = false;
    renderOverlay(true);
    renderPanel();
    const left = remainingArtworkIndices(G.mapping, G.artworks.length);
    status(
      left.length
        ? `${created} prévia(s) automática(s) criada(s). ${left.length} arte(s) continuam pendentes. Use “Selecionar no mockup” para resolver as restantes com precisão.`
        : `${created} prévia(s) automática(s) criada(s). Revise cada área antes de aprovar.`,
      left.length ? 'warn' : 'ok'
    );
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function updateSurfaceQuad(id, quad) {
  G.mapping = G.mapping.map((slot) => String(slot.id) === String(id)
    ? { ...slot, quad, integrationPlan: null, guidedStatus: slot.artworkIndex == null ? GUIDED_STATUS.AVAILABLE : GUIDED_STATUS.PREVIEW, frozen: false }
    : slot);
  G.finalized = false;
}

function applyArtwork(id, index) {
  G.mapping = assignGuidedArtwork(G.mapping, id, Number(index));
  G.activeId = id;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  status('Prévia atualizada com a arte original e proporção preservada. Ajuste os cantos se necessário.', 'ok');
}

function freeze(id) {
  G.mapping = freezeGuidedSurface(G.mapping, id);
  G.activeId = null;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  const progress = guidedProgress(G.mapping, G.artworks.length);
  const pending = remainingArtworkIndices(G.mapping, G.artworks.length).length;
  status(
    pending
      ? `Área aprovada e congelada. ${progress.frozen} aprovada(s); ${pending} arte(s) ainda pendente(s).`
      : 'Todas as artes associadas estão aprovadas. Você pode refinar o acabamento ou exportar.',
    'ok'
  );
}

function unfreeze(id) {
  G.mapping = unfreezeGuidedSurface(G.mapping, id);
  G.activeId = id;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  status('Área reaberta. Arraste os pontos brancos para corrigir a geometria ou troque a arte.', 'ok');
}

function editCorners(id) {
  const slot = G.mapping.find((item) => String(item.id) === String(id));
  if (!slot) return;
  if (slot.guidedStatus === GUIDED_STATUS.FROZEN) G.mapping = unfreezeGuidedSurface(G.mapping, id);
  G.activeId = id;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  status('Ajuste manual: arraste os quatro pontos brancos para os cantos reais da superfície.', 'ok');
}

function removeSurface(id) {
  G.mapping = removeGuidedSurface(G.mapping, id);
  if (String(G.activeId) === String(id)) G.activeId = null;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  status('Área removida. A arte voltou para a fila pendente.', 'ok');
}

function redetect(id) {
  const slot = G.mapping.find((item) => String(item.id) === String(id));
  const index = slot?.artworkIndex;
  if (slot?.quad?.length === 4) G.rejectedSlots.push({ id: `rejected-${Date.now()}`, quad: slot.quad });
  G.mapping = removeGuidedSurface(G.mapping, id);
  G.activeId = null;
  renderOverlay(true);
  renderPanel();
  if (index == null) return;
  armPick('assisted', index);
}

function move(id, direction) {
  G.mapping = moveGuidedSurface(G.mapping, id, direction);
  G.activeId = id;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
}

function approveAll() {
  G.mapping = freezeAllPreviews(G.mapping);
  G.activeId = null;
  G.finalized = false;
  renderOverlay(true);
  renderPanel();
  const pending = remainingArtworkIndices(G.mapping, G.artworks.length).length;
  status(pending ? `Prévias aprovadas. ${pending} arte(s) continuam pendentes e não serão forçadas.` : 'Todas as prévias foram aprovadas.', 'ok');
}

async function finalize() {
  if (!readyForOutput()) return status('Aprove ao menos uma área e resolva todas as prévias antes de refinar.', 'warn');
  if (G.busy) return;
  setBusy(true);
  status('Refinando luz, material e integração sem redesenhar as artes…');
  try {
    const rendered = frozenSlots();
    const review = mergedCanvas().toDataURL('image/jpeg', 0.95);
    const response = await fetch('/api/refine-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: review, slotCount: rendered.length }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `Refino ${response.status}`);
    G.mapping = G.mapping.map((slot) => {
      const index = rendered.findIndex((item) => String(item.id) === String(slot.id));
      return index < 0 ? slot : { ...slot, integrationPlan: result.slots?.[index] || {} };
    });
    G.finalized = true;
    renderOverlay(false);
    renderPanel();
    status('Acabamento refinado. Geometria e pixels originais das artes foram preservados.', 'ok');
    document.dispatchEvent(new CustomEvent('mockup:ai-finalized', { detail: { source: 'assisted-guided' } }));
  } catch (error) {
    status(friendly(error), 'warn');
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function exportPng() {
  if (!readyForOutput()) return status('Aprove ao menos uma área e resolva todas as prévias antes de exportar.', 'warn');
  const pending = remainingArtworkIndices(G.mapping, G.artworks.length).length;
  const link = document.createElement('a');
  link.download = 'mockup-vision.png';
  link.href = mergedCanvas().toDataURL('image/png');
  link.click();
  renderOverlay(!G.finalized);
  status(pending ? `PNG exportado. ${pending} arte(s) pendente(s) não foram incluídas.` : 'PNG exportado.', 'ok');
}

async function removeArt(index) {
  const used = G.mapping.find((slot) => slot.artworkIndex === index);
  if (used?.guidedStatus === GUIDED_STATUS.FROZEN && !window.confirm('Esta arte está em uma área aprovada. Remover a arte e liberar a área?')) return;
  G.mapping = removeArtworkFromMapping(G.mapping, index);
  G.files.splice(index, 1);
  G.artworks.splice(index, 1);
  G.finalized = false;
  syncBrandInput(false);
  renderOverlay(true);
  renderPanel();
  status('Arte removida. As associações restantes foram preservadas.', 'ok');
}

function replaceArt(index) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    try {
      const art = await fileToArtwork(file);
      G.files[index] = file;
      G.artworks[index] = art;
      G.mapping = markArtworkReplaced(G.mapping, index);
      G.finalized = false;
      syncBrandInput(false);
      renderOverlay(true);
      renderPanel();
      status('Arte substituída. A superfície vinculada foi mantida e voltou para revisão.', 'ok');
    } catch (error) {
      status(friendly(error), 'warn');
    }
  }, { once: true });
  picker.click();
}

function reset(keepFiles = true) {
  G.mapping = [];
  G.activeId = null;
  G.baseDataUrl = null;
  G.finalized = false;
  G.rejectedSlots = [];
  G.armed = null;
  G.drag = null;
  if (!keepFiles) {
    G.files = [];
    G.artworks = [];
    const input = $('guidedBrandFiles');
    if (input) input.value = '';
    syncBrandInput(false);
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlay.style.display = 'none';
  renderPanel();
}

function artState(index) {
  const slot = G.mapping.find((item) => item.artworkIndex === index);
  if (!slot) return 'PENDENTE';
  if (slot.guidedStatus === GUIDED_STATUS.FROZEN) return 'APROVADA';
  return 'PRÉVIA';
}

function renderArts() {
  const box = $('guidedArtworkList');
  if (!box) return;
  box.innerHTML = '';
  const plan = routePlan();
  G.artworks.forEach((art, index) => {
    const card = document.createElement('div');
    card.className = 'guided-art-card';
    card.innerHTML = `<img alt="Arte ${index + 1}"><div class="guided-art-meta"><strong>Arte ${String(index + 1).padStart(2, '0')}</strong><span></span><small></small><em>${artState(index)}</em></div><div class="guided-art-actions"><button type="button" data-replace>Trocar</button><button type="button" data-remove class="danger-soft">Remover</button></div>`;
    card.querySelector('img').src = art.dataUrl;
    card.querySelector('span').textContent = art.file.name;
    card.querySelector('small').textContent = targetForArtwork(plan, index) ? `Destino: ${targetForArtwork(plan, index)}` : 'Destino livre';
    card.querySelector('[data-replace]').onclick = () => replaceArt(index);
    card.querySelector('[data-remove]').onclick = () => removeArt(index);
    box.appendChild(card);
  });
}

function surfaceState(slot) {
  return slot.guidedStatus === GUIDED_STATUS.FROZEN ? 'APROVADA' : slot.guidedStatus === GUIDED_STATUS.PREVIEW ? 'PRÉVIA' : 'LIVRE';
}

function renderSurface(slot) {
  const row = document.createElement('div');
  row.className = `guided-surface-card ${slot.guidedStatus} ${String(slot.id) === String(G.activeId) ? 'active' : ''}`;
  const head = document.createElement('div');
  head.className = 'guided-surface-head';
  head.innerHTML = `<div><strong>Área ${slot.index}</strong><span>${surfaceState(slot)} · ${slot.label || 'superfície'}</span></div>`;
  const order = document.createElement('div');
  order.className = 'guided-order';
  order.innerHTML = '<button type="button" aria-label="Mover área para cima">↑</button><button type="button" aria-label="Mover área para baixo">↓</button>';
  order.children[0].onclick = () => move(slot.id, -1);
  order.children[1].onclick = () => move(slot.id, 1);
  head.appendChild(order);
  row.appendChild(head);
  const select = document.createElement('select');
  select.innerHTML = '<option value="">Escolha uma arte</option>';
  const frozen = new Set(G.mapping.filter((item) => item.guidedStatus === GUIDED_STATUS.FROZEN && String(item.id) !== String(slot.id)).map((item) => item.artworkIndex));
  G.artworks.forEach((art, index) => {
    if (frozen.has(index)) return;
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `Arte ${index + 1} · ${art.file.name}`;
    option.selected = slot.artworkIndex === index;
    select.appendChild(option);
  });
  row.appendChild(select);
  const actions = document.createElement('div');
  actions.className = 'guided-surface-actions';
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.textContent = 'Aplicar arte';
  preview.onclick = () => {
    if (select.value === '') return status('Escolha uma arte para esta área.', 'warn');
    if (slot.guidedStatus === GUIDED_STATUS.FROZEN) G.mapping = unfreezeGuidedSurface(G.mapping, slot.id);
    applyArtwork(slot.id, Number(select.value));
  };
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Editar cantos';
  edit.onclick = () => editCorners(slot.id);
  const approve = document.createElement('button');
  approve.type = 'button';
  if (slot.guidedStatus === GUIDED_STATUS.FROZEN) {
    approve.textContent = 'Reabrir';
    approve.onclick = () => unfreeze(slot.id);
  } else {
    approve.textContent = 'Aprovar';
    approve.disabled = slot.guidedStatus !== GUIDED_STATUS.PREVIEW || slot.artworkIndex == null;
    approve.onclick = () => freeze(slot.id);
  }
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'Redetectar';
  again.onclick = () => redetect(slot.id);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remover área';
  remove.className = 'danger-soft';
  remove.onclick = () => removeSurface(slot.id);
  actions.append(preview, edit, approve, again, remove);
  row.appendChild(actions);
  row.onclick = (event) => {
    if (event.target.closest('button,select')) return;
    G.activeId = slot.id;
    renderOverlay(true);
    renderPanel();
  };
  return row;
}

function renderArtworkPicker() {
  const picker = $('guidedArtworkPicker');
  if (!picker) return;
  const previous = picker.value;
  picker.innerHTML = '';
  const remaining = remainingArtworkIndices(G.mapping, G.artworks.length);
  if (!remaining.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhuma arte pendente';
    picker.appendChild(option);
    picker.disabled = true;
    return;
  }
  remaining.forEach((index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `Arte ${String(index + 1).padStart(2, '0')} · ${G.artworks[index]?.file?.name || 'arquivo'}`;
    picker.appendChild(option);
  });
  picker.disabled = G.busy;
  if ([...picker.options].some((option) => option.value === previous)) picker.value = previous;
}

function renderPanel() {
  const panel = $('guidedWorkflowPanel');
  if (!panel) return;
  panel.classList.toggle('hidden', !guided());
  renderArts();
  renderArtworkPicker();
  const list = $('guidedSurfaceList');
  if (list) {
    list.innerHTML = '';
    G.mapping.forEach((slot) => list.appendChild(renderSurface(slot)));
  }
  const progressData = guidedProgress(G.mapping, G.artworks.length);
  const pendingCount = remainingArtworkIndices(G.mapping, G.artworks.length).length;
  const progress = $('guidedProgress');
  if (progress) progress.innerHTML = `<strong>${progressData.frozen}</strong><span>aprovadas</span><strong>${progressData.previews}</strong><span>prévias</span><strong>${pendingCount}</strong><span>pendentes</span>`;
  const bar = $('guidedProgressBar');
  if (bar) bar.style.width = G.artworks.length ? `${Math.round((progressData.frozen / G.artworks.length) * 100)}%` : '0%';
  const plan = $('guidedPlanSummary');
  if (plan) plan.textContent = summarizeArtworkTargetPlan(routePlan(), G.artworks.length);
  const armed = $('guidedArmedState');
  if (armed) armed.textContent = G.armed ? `Seleção ativa · Arte ${G.armed.artworkIndex + 1} · ${G.armed.kind === 'manual' ? 'manual' : 'assistida'}` : 'Clique no mockup para selecionar uma superfície com precisão.';
  const disabledMap = {
    guidedPickAssisted: G.busy || !pendingCount,
    guidedPickManual: G.busy || !pendingCount,
    guidedAutoRemaining: G.busy || !pendingCount,
    guidedApproveAll: G.busy || !progressData.previews,
    guidedFinalize: G.busy || !readyForOutput(),
    guidedExport: G.busy || !readyForOutput(),
  };
  Object.entries(disabledMap).forEach(([id, disabled]) => {
    const element = $(id);
    if (element) element.disabled = Boolean(disabled);
  });
  const cancel = $('guidedCancelPick');
  if (cancel) cancel.style.display = G.armed ? '' : 'none';
  updateOverlayInteraction();
}

async function handleFiles(files) {
  if (!files.length) return;
  setBusy(true);
  try {
    await addFiles(files, true);
    renderPanel();
    status(`${G.artworks.length} arte(s) na composição. Escolha uma arte e clique na superfície onde ela deve entrar.`, 'ok');
  } catch (error) {
    status(friendly(error), 'warn');
  } finally {
    const input = $('guidedBrandFiles');
    if (input) input.value = '';
    setBusy(false);
    renderPanel();
  }
}

function importAutoFiles() {
  const files = [...($('brandFiles')?.files || [])];
  if (!files.length || G.files.length) return Promise.resolve();
  return addFiles(files, false);
}

function applyVisibility() {
  const on = guided();
  const normalLabel = document.querySelector('label[for="brandFiles"]');
  const normalCount = $('assetCount');
  const normalList = $('assetList');
  const autoFlow = $('autoApplyFlow');
  const save = $('saveBtn');
  const exportPanel = $('mockupExportPanel');
  const canvasHint = $('canvasHint');
  const universal = $('universalOverlay');
  if (normalLabel) normalLabel.style.display = on ? 'none' : '';
  if (normalCount) normalCount.style.display = on ? 'none' : '';
  if (normalList) normalList.style.display = on ? 'none' : '';
  if (autoFlow) autoFlow.style.display = on ? 'none' : '';
  if (save) save.style.display = on ? 'none' : '';
  if (exportPanel) exportPanel.style.display = on ? 'none' : '';
  if (canvasHint) canvasHint.style.display = on ? 'none' : '';
  if (universal && on) universal.style.display = 'none';
  const upload = $('guidedUploadLabel');
  if (upload) upload.style.display = on ? '' : 'none';
}

async function setMode(mode) {
  G.mode = mode === 'guided' ? 'guided' : 'auto';
  G.armed = null;
  document.querySelectorAll('[data-guided-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.guidedMode === G.mode));
  });
  if (guided()) await importAutoFiles();
  else {
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    syncBrandInput(true);
  }
  applyVisibility();
  renderPanel();
  if (guided() && G.mapping.length) renderOverlay(!G.finalized);
}

function overlayPoint(event) {
  return pointFromClient(event.clientX, event.clientY, overlay.getBoundingClientRect());
}

overlay.addEventListener('pointerdown', (event) => {
  if (!guided() || G.busy) return;
  const point = overlayPoint(event);
  if (!point) return;
  if (G.armed) {
    event.preventDefault();
    handleArmedPick(point);
    return;
  }
  const slot = activeEditableSlot();
  if (!slot) return;
  const rect = overlay.getBoundingClientRect();
  const radius = Math.max(0.018, 18 / Math.max(1, Math.min(rect.width, rect.height)));
  const corner = closestQuadCorner(slot.quad, point, radius);
  if (corner < 0) return;
  event.preventDefault();
  G.drag = { id: slot.id, corner };
  overlay.setPointerCapture?.(event.pointerId);
  overlay.style.cursor = 'grabbing';
});

overlay.addEventListener('pointermove', (event) => {
  if (!G.drag) return;
  const point = overlayPoint(event);
  if (!point) return;
  const slot = G.mapping.find((item) => String(item.id) === String(G.drag.id));
  if (!slot) return;
  const quad = moveQuadCorner(slot.quad, G.drag.corner, point, { minArea: 0.001, minSpan: 0.02 });
  updateSurfaceQuad(slot.id, quad);
  renderOverlay(true);
});

function endDrag(event) {
  if (!G.drag) return;
  G.drag = null;
  try { overlay.releasePointerCapture?.(event.pointerId); } catch { }
  updateOverlayInteraction();
  renderPanel();
  status('Geometria atualizada. Confira a prévia e aprove quando estiver correta.', 'ok');
}
overlay.addEventListener('pointerup', endDrag);
overlay.addEventListener('pointercancel', endDrag);

function styles() {
  if ($('guidedWorkflowStyles')) return;
  const style = document.createElement('style');
  style.id = 'guidedWorkflowStyles';
  style.textContent = `
    .guided-mode-switch{display:grid;grid-template-columns:1.15fr .85fr;gap:7px;margin-bottom:11px;padding:4px;border:1px solid #314b60;border-radius:13px;background:#0b1722}
    .guided-mode-switch button{min-height:39px;font-size:10px;border-radius:9px}.guided-mode-switch button[aria-pressed=true]{background:linear-gradient(135deg,#1a4e56,#203f62);border-color:#69d8d1;color:#e9fffb;box-shadow:0 6px 18px rgba(13,63,75,.24)}
    .guided-upload{display:block;margin-bottom:10px;padding:12px;text-align:center;border:1px dashed #496d84;border-radius:11px;color:#d3e0e9;cursor:pointer;background:rgba(17,37,52,.58)}
    .guided-workflow-panel{display:grid;gap:11px;padding:12px;border:1px solid #35536b;border-radius:14px;background:linear-gradient(180deg,#102232,#0b1824);box-shadow:0 12px 34px rgba(0,0,0,.18)}.guided-workflow-panel.hidden{display:none!important}
    .guided-panel-head{display:flex;justify-content:space-between;gap:10px}.guided-panel-head strong{font-size:13px}.guided-panel-head span{display:block;color:var(--dim);font-size:9px;line-height:1.4}.guided-badge{font:8px var(--mono);color:#8de2c0;white-space:nowrap}
    .guided-guidance{padding:10px;border:1px solid #31536a;border-radius:11px;background:linear-gradient(135deg,rgba(29,72,85,.36),rgba(24,51,79,.28))}.guided-guidance strong{font-size:10px}.guided-guidance span{display:block;margin-top:3px;color:#a9c0cf;font-size:8.5px;line-height:1.45}
    .guided-progress{display:grid;grid-template-columns:auto 1fr auto 1fr auto 1fr;gap:4px 7px;align-items:center;color:var(--dim);font-size:9px}.guided-progress strong{font-size:12px;color:var(--ink)}.guided-progress-track{height:5px;border-radius:999px;background:#08131c;overflow:hidden}.guided-progress-bar{height:100%;background:linear-gradient(90deg,#5bd3c7,#78a5ff)}
    .guided-routing{display:grid;gap:6px;padding:9px;border:1px solid #304b60;border-radius:11px;background:#0b1823}.guided-routing label{font-size:10px;font-weight:700}.guided-routing textarea{min-height:78px;font-size:10px}.guided-routing small{font-size:8.5px;color:var(--dim)}
    .guided-pick-box{display:grid;gap:7px;padding:10px;border:1px solid #355a6f;border-radius:11px;background:#0c1a26}.guided-pick-box label{font-size:9px;font-weight:700}.guided-pick-box select{min-height:37px}.guided-pick-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.guided-pick-actions .wide{grid-column:1/-1}.guided-armed{font-size:8.5px;color:#a9c4d2;line-height:1.4}.guided-cancel{color:#efc77f!important}
    .guided-art-list{display:grid;gap:6px}.guided-art-card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px;border:1px solid #2d4558;border-radius:10px;background:#0a1721}.guided-art-card img{width:44px;height:44px;object-fit:cover;border-radius:7px}.guided-art-meta{display:grid;min-width:0;gap:1px}.guided-art-meta strong{font-size:10px}.guided-art-meta span,.guided-art-meta small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dim);font-size:8px}.guided-art-meta em{width:max-content;padding:2px 5px;border-radius:999px;background:#172b3b;color:#b7c8d4;font:7px var(--mono);font-style:normal}.guided-art-actions{display:grid;gap:3px}.guided-art-actions button{width:auto;padding:5px 6px;font-size:8px}.danger-soft{color:#ff9da6!important}
    .guided-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.guided-actions .wide{grid-column:1/-1}.guided-actions button{min-height:38px;font-size:10px}.guided-beta{font-size:8px;color:#dfb878;margin:-3px 0 0}
    .guided-surface-list{display:grid;gap:7px}.guided-surface-card{padding:9px;border:1px solid #2d4558;border-radius:11px;background:#0a1721}.guided-surface-card.preview{border-color:#80683a}.guided-surface-card.frozen{border-color:#2f6b55;background:#0c1e1a}.guided-surface-card.active{box-shadow:0 0 0 1px rgba(105,216,209,.38)}.guided-surface-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}.guided-surface-head strong{font-size:10px}.guided-surface-head span{display:block;color:var(--dim);font-size:8px}.guided-order{display:flex;gap:3px}.guided-order button{width:27px;padding:4px}.guided-surface-card select{min-height:33px;padding:6px;font-size:9px}.guided-surface-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px}.guided-surface-actions button{padding:6px 3px;font-size:8px}.guided-surface-actions button:last-child{grid-column:2/4}
    .guided-workflow-status{padding:10px;border:1px solid #304b60;border-radius:10px;background:#0a1721;color:var(--dim);font-size:9px;line-height:1.45}.guided-workflow-status.ok{color:#8bdfbd;border-color:#2a604c}.guided-workflow-status.warn{color:#efc77f;border-color:#745d34}
    @media(max-width:900px){.guided-art-card{grid-template-columns:42px 1fr}.guided-art-actions{grid-column:1/-1;grid-template-columns:1fr 1fr}.guided-pick-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function ensureControls() {
  const input = $('brandFiles');
  const label = document.querySelector('label[for="brandFiles"]');
  if (!input || !label) return false;
  if ($('guidedWorkflowMode')) return true;
  styles();
  const mode = document.createElement('div');
  mode.id = 'guidedWorkflowMode';
  mode.className = 'guided-mode-switch';
  mode.innerHTML = '<button type="button" data-guided-mode="guided">Assistido · recomendado</button><button type="button" data-guided-mode="auto" aria-pressed="true">Automático · rápido</button>';
  label.insertAdjacentElement('beforebegin', mode);
  mode.querySelectorAll('button').forEach((button) => { button.onclick = () => setMode(button.dataset.guidedMode); });
  const picker = document.createElement('input');
  picker.id = 'guidedBrandFiles';
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.multiple = true;
  picker.hidden = true;
  picker.onchange = () => handleFiles([...(picker.files || [])]);
  label.insertAdjacentElement('afterend', picker);
  const upload = document.createElement('label');
  upload.id = 'guidedUploadLabel';
  upload.className = 'guided-upload';
  upload.htmlFor = 'guidedBrandFiles';
  upload.textContent = 'Adicionar artes à composição';
  picker.insertAdjacentElement('afterend', upload);
  const panel = document.createElement('div');
  panel.id = 'guidedWorkflowPanel';
  panel.className = 'guided-workflow-panel hidden';
  panel.innerHTML = `
    <div class="guided-panel-head"><div><strong>Composição assistida</strong><span>Você escolhe a superfície; o sistema cuida da perspectiva e preserva a arte.</span></div><div class="guided-badge">CLICK-TO-MAP</div></div>
    <div class="guided-guidance"><strong>Fluxo recomendado</strong><span>1. Escolha a arte. 2. Clique na superfície no mockup. 3. Ajuste os quatro cantos se necessário. 4. Aprove e congele. Repita para as demais.</span></div>
    <div id="guidedProgress" class="guided-progress"></div><div class="guided-progress-track"><div id="guidedProgressBar" class="guided-progress-bar"></div></div>
    <div id="guidedArtworkList" class="guided-art-list"></div>
    <div class="guided-routing"><label for="guidedRouting">Destinos das artes · opcional</label><textarea id="guidedRouting" maxlength="2400" placeholder="Arte 01: tela do monitor\nArte 02: capa do notebook\nArte 03: tela do celular"></textarea><small>O clique define a posição. O texto ajuda a análise a entender qual superfície você pretende usar.</small><small id="guidedPlanSummary"></small></div>
    <div class="guided-pick-box"><label for="guidedArtworkPicker">Arte a aplicar agora</label><select id="guidedArtworkPicker"></select><div class="guided-pick-actions"><button id="guidedPickAssisted" class="primary">Selecionar no mockup</button><button id="guidedPickManual">Criar área manual</button><button id="guidedAutoRemaining" class="wide">Distribuir automaticamente · beta</button></div><div id="guidedArmedState" class="guided-armed"></div><button id="guidedCancelPick" class="guided-cancel" type="button" style="display:none">Cancelar seleção</button><div class="guided-beta">Assistido é o modo recomendado. O automático continua disponível para composições simples.</div></div>
    <div id="guidedSurfaceList" class="guided-surface-list"></div>
    <div class="guided-actions"><button id="guidedApproveAll" class="wide">Aprovar todas as prévias</button><button id="guidedFinalize">Refinar acabamento</button><button id="guidedExport" class="primary">Exportar PNG</button><button id="guidedRestart" class="wide">Reiniciar áreas mantendo artes</button></div>
    <div id="guidedWorkflowStatus" class="guided-workflow-status" aria-live="polite">Adicione uma arte, clique na superfície desejada e ajuste os cantos antes de aprovar.</div>
  `;
  upload.insertAdjacentElement('afterend', panel);
  $('guidedRouting').oninput = renderPanel;
  $('guidedPickAssisted').onclick = () => armPick('assisted');
  $('guidedPickManual').onclick = () => armPick('manual');
  $('guidedAutoRemaining').onclick = distributeRemaining;
  $('guidedApproveAll').onclick = approveAll;
  $('guidedFinalize').onclick = finalize;
  $('guidedExport').onclick = exportPng;
  $('guidedRestart').onclick = () => { reset(true); status('Áreas reiniciadas. As artes foram mantidas.', 'ok'); };
  $('guidedCancelPick').onclick = () => { cancelArmed(); status('Seleção cancelada.'); };
  setMode('auto');
  return true;
}

function boot() {
  if (!ensureControls()) return setTimeout(boot, 120);
  const rail = document.querySelector('.rail');
  if (rail) new MutationObserver(applyVisibility).observe(rail, { childList: true, subtree: true });
  window.addEventListener('resize', () => { if (guided()) renderOverlay(!G.finalized); });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.new-mockup-btn')) setTimeout(() => reset(false), 0);
  });
  window.MockupVisionGuided = {
    setMode,
    reset,
    armAssisted: () => armPick('assisted'),
    armManual: () => armPick('manual'),
    state: () => ({
      mode: G.mode,
      artworks: G.artworks.length,
      surfaces: G.mapping.length,
      approved: frozenSlots().length,
      previews: previewSlots().length,
      armed: G.armed ? { ...G.armed } : null,
    }),
  };
  renderPanel();
}

boot();

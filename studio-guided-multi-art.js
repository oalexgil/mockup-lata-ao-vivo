import {
  GUIDED_STATUS,
  addGuidedSurfaces,
  assignGuidedArtwork,
  autoAssignGuidedArtworks,
  containedArtworkQuad,
  freezeAllPreviews,
  freezeGuidedSurface,
  guidedComplete,
  guidedProgress,
  moveGuidedSurface,
  occupiedQuads,
  remainingArtworkIndices,
  removeGuidedSurface,
  unfreezeGuidedSurface,
} from './src/guided-multi-art.js';
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
};

const overlay = document.createElement('canvas');
overlay.id = 'guidedMultiArtOverlay';
overlay.style.position = 'absolute';
overlay.style.pointerEvents = 'none';
overlay.style.zIndex = '6';
overlay.style.display = 'none';
stage?.appendChild(overlay);
const overlayCtx = overlay.getContext('2d');

function setGuidedStatus(message, kind = '') {
  const el = $('guidedMultiArtStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `guided-status ${kind}`.trim();
}

function isGuided() {
  return G.mode === 'guided';
}

function addStyles() {
  if ($('guidedMultiArtStyles')) return;
  const style = document.createElement('style');
  style.id = 'guidedMultiArtStyles';
  style.textContent = `
    .guided-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;padding:5px;border:1px solid #2b4053;border-radius:10px;background:#0b141d}
    .guided-mode-switch button{min-height:36px;padding:8px;font-size:10.5px}.guided-mode-switch button[aria-pressed=true]{background:#18333d;border-color:#4fc4d4;color:#baf5fa;font-weight:700}
    .guided-panel{display:grid;gap:9px;margin:8px 0 2px;padding:11px;border:1px solid #315066;border-radius:11px;background:linear-gradient(180deg,#0d1923,#0b131c)}
    .guided-panel.hidden{display:none!important}.guided-panel-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.guided-panel-head strong{font-size:12px}.guided-pill{padding:4px 7px;border-radius:999px;border:1px solid #2d5f68;background:#102b31;color:#86e5ec;font:9px var(--mono)}
    .guided-upload{display:block;text-align:center;padding:10px;border:1px dashed #3d6077;border-radius:8px;background:#111e29;color:#c7dbe8;cursor:pointer;font-size:11px}
    .guided-art-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.guided-art{display:grid;gap:4px;min-width:0}.guided-art img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:6px;border:1px solid #2a3f50}.guided-art span{font-size:8.5px;color:#8fa4b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .guided-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.guided-actions .wide{grid-column:1/-1}.guided-status{padding:8px 9px;border:1px solid #293e50;border-radius:8px;background:#0b141d;color:#91a8ba;font-size:10px;line-height:1.45}.guided-status.ok{border-color:#285846;color:#79ddb4}.guided-status.warn{border-color:#695426;color:#ebc56f}
    .guided-surface-list{display:grid;gap:7px}.guided-surface{padding:8px;border:1px solid #293e50;border-radius:9px;background:#0b141d}.guided-surface.active{border-color:#52cbd8;box-shadow:0 0 0 2px rgba(82,203,216,.08)}.guided-surface.frozen{border-color:#285846;background:#0d1b18}.guided-surface.preview{border-color:#725a27;background:#19170f}
    .guided-surface-head{display:flex;gap:7px;align-items:center;justify-content:space-between;margin-bottom:6px}.guided-surface-head strong{font-size:10.5px}.guided-surface-state{font:8.5px var(--mono);color:#8fa4b6}.guided-surface select{min-height:34px;padding:7px;font-size:10px}.guided-row-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px}.guided-row-actions button{padding:6px 4px;font-size:9px;min-width:0}.guided-order{display:flex;gap:4px}.guided-order button{width:28px;padding:5px}.guided-progress{font-size:9.5px;color:#8ea4b6;line-height:1.45}.guided-progress strong{color:#dbeaf2}
    #guidedTargetHint{min-height:38px}
    @media(max-width:900px){.guided-art-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

function syncOverlayGeometry() {
  if (!baseCanvas || !stage || !baseCanvas.width || !baseCanvas.height) return;
  overlay.width = baseCanvas.width;
  overlay.height = baseCanvas.height;
  const rect = baseCanvas.getBoundingClientRect();
  const parent = stage.getBoundingClientRect();
  overlay.style.left = `${rect.left - parent.left + stage.scrollLeft}px`;
  overlay.style.top = `${rect.top - parent.top + stage.scrollTop}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = isGuided() && G.mapping.length ? 'block' : 'none';
}

function fileToArtwork(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arte.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve({ file, image, dataUrl: String(reader.result) });
      image.onerror = () => reject(new Error(`Arte inválida: ${file.name}`));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function loadFiles(files, { append = false } = {}) {
  const incoming = [...files];
  const existing = append ? [...G.files] : [];
  const keys = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const additions = incoming.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  G.files = [...existing, ...additions];
  if (!append) G.artworks = [];
  for (const file of additions) G.artworks.push(await fileToArtwork(file));
}

function captureBaseScene() {
  if (!baseCanvas?.width || !baseCanvas?.height) throw new Error('Aprove uma cena antes de iniciar o multi-art guiado.');
  G.baseDataUrl = baseCanvas.toDataURL('image/jpeg', 0.94);
}

function affineFromTriangles(src, dst) {
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

function bilinearPoint(quad, u, v) {
  const [a, b, c, d] = quad;
  return {
    x: a.x * (1-u)*(1-v) + b.x*u*(1-v) + c.x*u*v + d.x*(1-u)*v,
    y: a.y * (1-u)*(1-v) + b.y*u*(1-v) + c.y*u*v + d.y*(1-u)*v,
  };
}

function drawTriangle(ctx, image, src, dst) {
  const matrix = affineFromTriangles(src, dst);
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

function preparedArtwork(artwork, plan = {}) {
  const image = artwork?.image;
  if (!image) return null;
  const sourceWidth = image.naturalWidth || 1;
  const sourceHeight = image.naturalHeight || 1;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const ctx = work.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.filter = `brightness(${plan.brightness ?? 1}) contrast(${plan.contrast ?? 1}) saturate(${plan.saturation ?? 1})`;
  ctx.drawImage(image, 0, 0, width, height);
  return work;
}

function warpArtwork(ctx, slot, artwork) {
  const plan = slot.integrationPlan || {};
  const image = preparedArtwork(artwork, plan);
  if (!image) return;
  const sourceQuad = quadToPixels(slot.quad, overlay.width, overlay.height);
  const quad = containedArtworkQuad(sourceQuad, image.width, image.height, 0.96);
  const cols = 20;
  const rows = 20;
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
      const d00 = bilinearPoint(quad, u0, v0);
      const d10 = bilinearPoint(quad, u1, v0);
      const d11 = bilinearPoint(quad, u1, v1);
      const d01 = bilinearPoint(quad, u0, v1);
      drawTriangle(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  ctx.restore();

  const light = plan.preserveLight ?? 0.44;
  if (light > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = light * 0.18;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.globalAlpha = light * 0.06;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.restore();
  }
}

function drawGuides() {
  const ctx = overlayCtx;
  ctx.save();
  ctx.lineWidth = Math.max(2, overlay.width / 650);
  ctx.font = `${Math.max(13, overlay.width / 58)}px Space Mono, monospace`;
  G.mapping.forEach((slot) => {
    const quad = quadToPixels(slot.quad, overlay.width, overlay.height);
    const frozen = slot.guidedStatus === GUIDED_STATUS.FROZEN;
    const preview = slot.guidedStatus === GUIDED_STATUS.PREVIEW;
    const active = String(slot.id) === String(G.activeId);
    const color = frozen ? '#57d9a3' : preview ? '#f4bd62' : '#63e6f2';
    ctx.strokeStyle = color;
    ctx.fillStyle = frozen ? 'rgba(87,217,163,.08)' : preview ? 'rgba(244,189,98,.08)' : 'rgba(99,230,242,.06)';
    ctx.setLineDash(frozen ? [] : [10, 7]);
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const p = quad[0];
    const r = Math.max(11, overlay.width / 72);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x + r, p.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#071217';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frozen ? '✓' : active ? String(slot.index) : String(slot.index), p.x + r, p.y + r);
  });
  ctx.restore();
}

function renderOverlay({ guides = true } = {}) {
  syncOverlayGeometry();
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!isGuided()) return;
  G.mapping.forEach((slot) => {
    if (![GUIDED_STATUS.PREVIEW, GUIDED_STATUS.FROZEN].includes(slot.guidedStatus)) return;
    if (slot.artworkIndex == null) return;
    warpArtwork(overlayCtx, slot, G.artworks[slot.artworkIndex]);
  });
  if (guides) drawGuides();
}

function mergedCanvas({ guides = false } = {}) {
  renderOverlay({ guides });
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(overlay, 0, 0);
  return out;
}

function setBusy(value) {
  G.busy = Boolean(value);
  document.querySelectorAll('#guidedMultiArtPanel button, #guidedMultiArtPanel select').forEach((element) => {
    if (element.dataset.keepEnabled === 'true') return;
    element.disabled = G.busy;
  });
}

function resetGuidedState({ keepFiles = true } = {}) {
  G.mapping = [];
  G.activeId = null;
  G.baseDataUrl = null;
  G.finalized = false;
  G.rejectedSlots = [];
  if (!keepFiles) {
    G.files = [];
    G.artworks = [];
    const input = $('guidedBrandFiles');
    if (input) input.value = '';
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlay.style.display = 'none';
  renderPanel();
}

function activeSlot() {
  return G.mapping.find((slot) => String(slot.id) === String(G.activeId)) || null;
}

async function requestSurfaces(count) {
  if (!G.baseDataUrl) captureBaseScene();
  const response = await fetch('/api/analyze-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mockup-Workflow': 'guided-progressive' },
    body: JSON.stringify({
      imageDataUrl: G.baseDataUrl,
      artworkCount: count,
      desiredSlots: count,
      excludedSlots: [...occupiedQuads(G.mapping), ...G.rejectedSlots],
      targetInstruction: String($('guidedTargetHint')?.value || '').trim(),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error || `layout ${response.status}`);
  if (result.surfaceValidated === false || result.mappingStatus !== 'validated') {
    throw new Error(result.warning || 'Nenhuma nova superfície confiável foi encontrada.');
  }
  return result.slots || [];
}

async function detectNextSurface() {
  if (G.busy) return;
  if (!G.artworks.length) return setGuidedStatus('Envie pelo menos uma arte para usar o fluxo guiado.', 'warn');
  if (remainingArtworkIndices(G.mapping, G.artworks.length).length === 0) {
    return setGuidedStatus('Todas as artes já estão vinculadas. Aprove/congele as prévias ou finalize.', 'ok');
  }
  setBusy(true);
  setGuidedStatus('Procurando a próxima superfície livre, sem tocar nas áreas já resolvidas…');
  try {
    if (!G.baseDataUrl) captureBaseScene();
    const surfaces = await requestSurfaces(1);
    const before = new Set(G.mapping.map((slot) => String(slot.id)));
    G.mapping = addGuidedSurfaces(G.mapping, surfaces);
    const added = G.mapping.find((slot) => !before.has(String(slot.id)));
    G.activeId = added?.id || G.mapping.at(-1)?.id || null;
    G.finalized = false;
    renderOverlay({ guides: true });
    renderPanel();
    setGuidedStatus(`Área ${activeSlot()?.index || G.mapping.length} identificada. Escolha a arte, gere a prévia e congele quando aprovar.`, 'ok');
  } catch (error) {
    console.warn(error);
    setGuidedStatus(error.message, 'warn');
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function applyArtwork(surfaceId, artworkIndex) {
  G.mapping = assignGuidedArtwork(G.mapping, surfaceId, Number(artworkIndex));
  G.activeId = surfaceId;
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
  setGuidedStatus('Prévia aplicada com contenção e proporção preservada. Aprove e congele ou troque a arte.', 'ok');
}

function freezeSurface(surfaceId) {
  G.mapping = freezeGuidedSurface(G.mapping, surfaceId);
  G.activeId = surfaceId;
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
  const progress = guidedProgress(G.mapping, G.artworks.length);
  setGuidedStatus(progress.complete
    ? 'Todas as artes foram aprovadas e congeladas. Você pode finalizar a integração ou exportar.'
    : `Área congelada. ${progress.frozen}/${progress.artworkCount} artes aprovadas. Identifique a próxima superfície.`, 'ok');
}

function unfreezeSurface(surfaceId) {
  G.mapping = unfreezeGuidedSurface(G.mapping, surfaceId);
  G.activeId = surfaceId;
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
  setGuidedStatus('Área descongelada. Você pode trocar a arte, revisar e aprovar novamente.');
}

async function redoSurface(surfaceId) {
  const rejected = G.mapping.find((slot) => String(slot.id) === String(surfaceId));
  if (rejected?.quad?.length === 4) {
    G.rejectedSlots.push({ id: `rejected-${rejected.id}-${Date.now()}`, quad: rejected.quad });
  }
  G.mapping = removeGuidedSurface(G.mapping, surfaceId);
  G.activeId = null;
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
  setGuidedStatus('Área descartada. Procurando uma alternativa…');
  await detectNextSurface();
}

function reorderSurface(surfaceId, direction) {
  G.mapping = moveGuidedSurface(G.mapping, surfaceId, direction);
  G.activeId = surfaceId;
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
}

async function autoApplyRemaining() {
  if (G.busy) return;
  if (!G.artworks.length) return setGuidedStatus('Envie pelo menos uma arte.', 'warn');
  setBusy(true);
  setGuidedStatus('Completando automaticamente apenas as artes e superfícies ainda não resolvidas…');
  try {
    if (!G.baseDataUrl) captureBaseScene();
    G.mapping = autoAssignGuidedArtworks(G.mapping, G.artworks.length);
    let remaining = remainingArtworkIndices(G.mapping, G.artworks.length);
    if (remaining.length) {
      const surfaces = await requestSurfaces(remaining.length);
      G.mapping = addGuidedSurfaces(G.mapping, surfaces);
      G.mapping = autoAssignGuidedArtworks(G.mapping, G.artworks.length);
      remaining = remainingArtworkIndices(G.mapping, G.artworks.length);
    }
    G.finalized = false;
    renderOverlay({ guides: true });
    renderPanel();
    if (remaining.length) {
      setGuidedStatus(`${remaining.length} arte(s) ainda ficaram sem superfície confiável. As áreas aprovadas permaneceram congeladas.`, 'warn');
    } else {
      setGuidedStatus('As áreas restantes receberam prévias automaticamente. Revise e congele individualmente ou aprove todas as prévias.', 'ok');
    }
  } catch (error) {
    console.warn(error);
    setGuidedStatus(`Não foi possível completar automaticamente: ${error.message}`, 'warn');
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function approveAllPreviews() {
  G.mapping = freezeAllPreviews(G.mapping);
  G.finalized = false;
  renderOverlay({ guides: true });
  renderPanel();
  setGuidedStatus(guidedComplete(G.mapping, G.artworks.length)
    ? 'Todas as prévias foram congeladas. Composição pronta para finalização/exportação.'
    : 'Pré-visualizações aprovadas. Ainda há artes sem superfície.', 'ok');
}

async function finalizeGuided() {
  if (!guidedComplete(G.mapping, G.artworks.length)) {
    return setGuidedStatus('Finalize somente depois que todas as artes estiverem aprovadas e congeladas.', 'warn');
  }
  if (G.busy) return;
  setBusy(true);
  setGuidedStatus('Analisando luz e material das áreas congeladas sem redesenhar as artes…');
  try {
    const rendered = G.mapping.filter((slot) => slot.guidedStatus === GUIDED_STATUS.FROZEN && slot.artworkIndex != null);
    const review = mergedCanvas({ guides: false }).toDataURL('image/jpeg', 0.94);
    const response = await fetch('/api/refine-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: review, slotCount: rendered.length }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `refine ${response.status}`);
    G.mapping = G.mapping.map((slot) => {
      const renderedIndex = rendered.findIndex((item) => String(item.id) === String(slot.id));
      if (renderedIndex < 0) return slot;
      return { ...slot, integrationPlan: result.slots?.[renderedIndex] || {} };
    });
    G.finalized = true;
    renderOverlay({ guides: false });
    renderPanel();
    setGuidedStatus('Finalização concluída. As superfícies congeladas permaneceram fixas e só receberam ajustes de integração.', result.refinementStatus === 'fallback' ? 'warn' : 'ok');
  } catch (error) {
    console.warn(error);
    setGuidedStatus(`Falha na finalização: ${error.message}`, 'warn');
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function exportGuided() {
  if (!guidedComplete(G.mapping, G.artworks.length)) {
    return setGuidedStatus('Aprove e congele todas as artes antes de exportar a composição final.', 'warn');
  }
  const out = mergedCanvas({ guides: false });
  const link = document.createElement('a');
  link.download = 'mockup-vision-guided.png';
  link.href = out.toDataURL('image/png');
  link.click();
  setGuidedStatus('PNG exportado com todas as áreas congeladas.', 'ok');
}

function availableArtworkOptions(slot) {
  const usedFrozen = new Set(G.mapping
    .filter((item) => item.guidedStatus === GUIDED_STATUS.FROZEN && String(item.id) !== String(slot.id))
    .map((item) => item.artworkIndex));
  return G.artworks.map((artwork, index) => ({ artwork, index }))
    .filter(({ index }) => !usedFrozen.has(index));
}

function surfaceStateLabel(slot) {
  if (slot.guidedStatus === GUIDED_STATUS.FROZEN) return 'CONGELADA';
  if (slot.guidedStatus === GUIDED_STATUS.PREVIEW) return 'PRÉVIA';
  return 'LIVRE';
}

function renderSurfaceRow(slot) {
  const row = document.createElement('div');
  row.className = `guided-surface ${slot.guidedStatus} ${String(slot.id) === String(G.activeId) ? 'active' : ''}`;
  const head = document.createElement('div');
  head.className = 'guided-surface-head';
  head.innerHTML = `<div><strong>Área ${slot.index}</strong><div class="guided-surface-state">${surfaceStateLabel(slot)} · ${slot.label || 'superfície'}</div></div>`;
  const order = document.createElement('div');
  order.className = 'guided-order';
  order.innerHTML = '<button type="button" title="Mover para cima">↑</button><button type="button" title="Mover para baixo">↓</button>';
  const [up, down] = order.querySelectorAll('button');
  up.addEventListener('click', () => reorderSurface(slot.id, -1));
  down.addEventListener('click', () => reorderSurface(slot.id, 1));
  head.appendChild(order);
  row.appendChild(head);

  const select = document.createElement('select');
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Escolha a arte para esta área';
  select.appendChild(empty);
  availableArtworkOptions(slot).forEach(({ artwork, index }) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `Arte ${index + 1} · ${artwork.file.name}`;
    option.selected = slot.artworkIndex === index;
    select.appendChild(option);
  });
  row.appendChild(select);

  const actions = document.createElement('div');
  actions.className = 'guided-row-actions';
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.textContent = slot.guidedStatus === GUIDED_STATUS.FROZEN ? 'Trocar arte' : 'Gerar prévia';
  preview.addEventListener('click', () => {
    if (select.value === '') return setGuidedStatus('Escolha uma arte para esta área.', 'warn');
    if (slot.guidedStatus === GUIDED_STATUS.FROZEN) G.mapping = unfreezeGuidedSurface(G.mapping, slot.id);
    applyArtwork(slot.id, Number(select.value));
  });
  actions.appendChild(preview);

  const approval = document.createElement('button');
  approval.type = 'button';
  if (slot.guidedStatus === GUIDED_STATUS.FROZEN) {
    approval.textContent = 'Descongelar';
    approval.addEventListener('click', () => unfreezeSurface(slot.id));
  } else {
    approval.textContent = 'Aprovar + congelar';
    approval.disabled = slot.artworkIndex == null || slot.guidedStatus !== GUIDED_STATUS.PREVIEW;
    approval.addEventListener('click', () => freezeSurface(slot.id));
  }
  actions.appendChild(approval);

  const redo = document.createElement('button');
  redo.type = 'button';
  redo.textContent = 'Refazer área';
  redo.addEventListener('click', () => redoSurface(slot.id));
  actions.appendChild(redo);
  row.appendChild(actions);
  row.addEventListener('click', (event) => {
    if (event.target.closest('button,select')) return;
    G.activeId = slot.id;
    renderOverlay({ guides: true });
    renderPanel();
  });
  return row;
}

function renderArtworkList() {
  const box = $('guidedArtworkList');
  if (!box) return;
  box.innerHTML = '';
  G.artworks.forEach((artwork, index) => {
    const item = document.createElement('div');
    item.className = 'guided-art';
    item.innerHTML = `<img alt="Arte ${index + 1}"><span>${index + 1}. ${artwork.file.name}</span>`;
    item.querySelector('img').src = artwork.dataUrl;
    box.appendChild(item);
  });
}

function renderPanel() {
  const panel = $('guidedMultiArtPanel');
  if (!panel) return;
  panel.classList.toggle('hidden', !isGuided());
  const list = $('guidedSurfaceList');
  if (list) {
    list.innerHTML = '';
    G.mapping.forEach((slot) => list.appendChild(renderSurfaceRow(slot)));
  }
  renderArtworkList();
  const progress = guidedProgress(G.mapping, G.artworks.length);
  const progressEl = $('guidedProgress');
  if (progressEl) {
    progressEl.innerHTML = G.artworks.length
      ? `<strong>${progress.frozen}/${progress.artworkCount} aprovadas</strong> · ${progress.previews} prévia(s) · ${progress.surfaceCount} área(s) identificada(s)`
      : 'Envie uma ou mais artes para começar.';
  }
  const next = $('guidedDetectNext');
  const auto = $('guidedAutoRemaining');
  const approveAll = $('guidedApproveAll');
  const finalize = $('guidedFinalize');
  const exportBtn = $('guidedExport');
  if (next) next.disabled = G.busy || !G.artworks.length || remainingArtworkIndices(G.mapping, G.artworks.length).length === 0;
  if (auto) auto.disabled = G.busy || !G.artworks.length || remainingArtworkIndices(G.mapping, G.artworks.length).length === 0;
  if (approveAll) approveAll.disabled = G.busy || progress.previews === 0;
  if (finalize) finalize.disabled = G.busy || !progress.complete;
  if (exportBtn) exportBtn.disabled = G.busy || !progress.complete;
}

async function handleGuidedFiles(files) {
  if (!files.length) return;
  setBusy(true);
  try {
    const append = G.files.length > 0;
    await loadFiles(files, { append });
    if (!append) resetGuidedState({ keepFiles: true });
    renderPanel();
    setGuidedStatus(`${G.artworks.length} arte(s) disponível(is). Identifique uma área, escolha a arte e congele após aprovar. Você pode adicionar novas artes a qualquer momento.`, 'ok');
  } catch (error) {
    console.warn(error);
    setGuidedStatus(error.message, 'warn');
  } finally {
    const input = $('guidedBrandFiles');
    if (input) input.value = '';
    setBusy(false);
    renderPanel();
  }
}

function applyModeVisibility() {
  const normalLabel = document.querySelector('label[for="brandFiles"]');
  const guidedUpload = $('guidedUploadLabel');
  const normalCount = $('assetCount');
  const normalList = $('assetList');
  const autoFlow = $('autoApplyFlow');
  const guided = isGuided();
  if (normalLabel) normalLabel.style.display = guided ? 'none' : '';
  if (guidedUpload) guidedUpload.style.display = guided ? '' : 'none';
  if (normalCount) normalCount.style.display = guided ? 'none' : '';
  if (normalList) normalList.style.display = guided ? 'none' : '';
  if (autoFlow) autoFlow.style.display = guided ? 'none' : '';
  const save = $('saveBtn');
  if (save) save.style.display = guided ? 'none' : '';
}

function setMode(mode) {
  G.mode = mode === 'guided' ? 'guided' : 'auto';
  document.querySelectorAll('[data-guided-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.guidedMode === G.mode));
  });
  applyModeVisibility();
  if (!isGuided()) {
    overlay.style.display = 'none';
  } else if (G.mapping.length) {
    renderOverlay({ guides: !G.finalized });
  }
  renderPanel();
}

function ensureControls() {
  const brandInput = $('brandFiles');
  const normalLabel = document.querySelector('label[for="brandFiles"]');
  if (!brandInput || !normalLabel || $('guidedMultiArtMode')) return Boolean($('guidedMultiArtMode'));
  addStyles();

  const mode = document.createElement('div');
  mode.id = 'guidedMultiArtMode';
  mode.className = 'guided-mode-switch';
  mode.innerHTML = `
    <button type="button" data-guided-mode="guided" aria-pressed="false">Guiado · mais preciso</button>
    <button type="button" data-guided-mode="auto" aria-pressed="true">Automático · mais rápido</button>`;
  normalLabel.insertAdjacentElement('beforebegin', mode);
  mode.querySelectorAll('[data-guided-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.guidedMode)));

  const input = document.createElement('input');
  input.id = 'guidedBrandFiles';
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  input.addEventListener('change', () => handleGuidedFiles([...(input.files || [])]));
  normalLabel.insertAdjacentElement('afterend', input);

  const upload = document.createElement('label');
  upload.id = 'guidedUploadLabel';
  upload.className = 'guided-upload';
  upload.htmlFor = 'guidedBrandFiles';
  upload.textContent = 'Enviar / adicionar artes ao fluxo guiado';
  input.insertAdjacentElement('afterend', upload);

  const panel = document.createElement('div');
  panel.id = 'guidedMultiArtPanel';
  panel.className = 'guided-panel';
  panel.innerHTML = `
    <div class="guided-panel-head"><strong>Multi-art guiado</strong><span class="guided-pill">APROVAR → CONGELAR</span></div>
    <div id="guidedProgress" class="guided-progress">Envie uma ou mais artes para começar.</div>
    <div id="guidedArtworkList" class="guided-art-list"></div>
    <input id="guidedTargetHint" type="text" maxlength="600" placeholder="Opcional · qual superfície procurar? Ex.: tela da direita, frente da caixa, manga esquerda">
    <div class="guided-actions">
      <button type="button" id="guidedDetectNext" class="primary">Identificar próxima área</button>
      <button type="button" id="guidedAutoRemaining">Aplicar automaticamente restantes</button>
      <button type="button" id="guidedApproveAll" class="wide">Aprovar e congelar todas as prévias</button>
    </div>
    <div id="guidedSurfaceList" class="guided-surface-list"></div>
    <div class="guided-actions">
      <button type="button" id="guidedFinalize">Finalizar integração com IA</button>
      <button type="button" id="guidedExport" class="primary">Exportar PNG guiado</button>
      <button type="button" id="guidedRestart" class="wide">Reiniciar mapeamento mantendo artes</button>
    </div>
    <div id="guidedMultiArtStatus" class="guided-status">O modo guiado resolve uma superfície por vez e mantém as áreas aprovadas congeladas.</div>`;
  upload.insertAdjacentElement('afterend', panel);

  $('guidedDetectNext')?.addEventListener('click', detectNextSurface);
  $('guidedAutoRemaining')?.addEventListener('click', autoApplyRemaining);
  $('guidedApproveAll')?.addEventListener('click', approveAllPreviews);
  $('guidedFinalize')?.addEventListener('click', finalizeGuided);
  $('guidedExport')?.addEventListener('click', exportGuided);
  $('guidedRestart')?.addEventListener('click', () => {
    resetGuidedState({ keepFiles: true });
    setGuidedStatus('Mapeamento reiniciado. As artes foram mantidas; identifique a primeira área novamente.');
  });

  setMode('auto');
  renderPanel();
  return true;
}

function boot() {
  if (!ensureControls()) return setTimeout(boot, 120);
  const rail = document.querySelector('.rail');
  if (rail) {
    const observer = new MutationObserver(() => applyModeVisibility());
    observer.observe(rail, { childList: true, subtree: true });
  }
  window.addEventListener('resize', () => {
    if (isGuided() && G.mapping.length) renderOverlay({ guides: !G.finalized });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.new-mockup-btn')) return;
    setTimeout(() => resetGuidedState({ keepFiles: false }), 0);
  });
}

boot();

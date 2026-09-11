import {
  mapArtworksToSlots,
  quadToPixels,
  universalMappingMessage,
} from './src/universal-mockup.js';

const $ = (id) => document.getElementById(id);
const baseCanvas = $('display');
const stage = baseCanvas?.parentElement;

const U = {
  slots: [],
  mapping: [],
  artworks: [],
  plan: null,
  baseDataUrl: null,
  finalized: false,
};

const overlay = document.createElement('canvas');
overlay.id = 'universalOverlay';
overlay.style.position = 'absolute';
overlay.style.pointerEvents = 'none';
overlay.style.zIndex = '3';
overlay.style.display = 'none';
stage?.appendChild(overlay);
const overlayCtx = overlay.getContext('2d');

function setFlowStatus(message, kind = '') {
  const el = $('autoApplyFlowStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `auto-status ${kind}`.trim();
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
  overlay.style.display = 'block';
}

function existingGuidesVisible() {
  return /ocultar/i.test($('toggleGuides')?.textContent || '');
}

function hideExistingGuides() {
  if (existingGuidesVisible()) $('toggleGuides')?.click();
}

function clearLegacyArtworkAssignments() {
  document.querySelectorAll('#slotsList select[data-slot-asset]').forEach((select) => {
    if (select.value !== '') {
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arte.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve({ file, image, dataUrl: String(reader.result) });
      image.onerror = () => reject(new Error('Arte inválida.'));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function loadArtworks() {
  const files = [...($('brandFiles')?.files || [])];
  U.artworks = [];
  for (const file of files) U.artworks.push(await fileToImage(file));
  return U.artworks;
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

function drawTriangle(targetCtx, image, src, dst) {
  const m = affineFromTriangles(src, dst);
  if (!m) return;
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.moveTo(dst[0].x, dst[0].y);
  targetCtx.lineTo(dst[1].x, dst[1].y);
  targetCtx.lineTo(dst[2].x, dst[2].y);
  targetCtx.closePath();
  targetCtx.clip();
  targetCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  targetCtx.drawImage(image, 0, 0);
  targetCtx.restore();
}

function preparedArtwork(artwork, plan = {}) {
  const image = artwork?.image;
  if (!image) return null;
  const work = document.createElement('canvas');
  const width = Math.min(1600, Math.max(480, image.naturalWidth));
  const height = Math.min(1600, Math.max(480, image.naturalHeight));
  work.width = width;
  work.height = height;
  const workCtx = work.getContext('2d');
  workCtx.clearRect(0, 0, width, height);
  workCtx.filter = `brightness(${plan.brightness ?? 1}) contrast(${plan.contrast ?? 1}) saturate(${plan.saturation ?? 1})`;
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const dw = image.naturalWidth * fit;
  const dh = image.naturalHeight * fit;
  workCtx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return work;
}

function warpArtwork(targetCtx, quad, artwork, plan = {}) {
  const image = preparedArtwork(artwork, plan);
  if (!image) return;
  const cols = 22;
  const rows = 22;
  const sw = image.width;
  const sh = image.height;
  targetCtx.save();
  targetCtx.globalAlpha = plan.opacity ?? 1;
  targetCtx.globalCompositeOperation = plan.blend || 'source-over';
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
      drawTriangle(targetCtx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(targetCtx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  targetCtx.restore();

  const light = plan.preserveLight ?? 0.58;
  if (light > 0) {
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((p) => targetCtx.lineTo(p.x, p.y));
    targetCtx.closePath();
    targetCtx.clip();
    targetCtx.globalAlpha = light * 0.24;
    targetCtx.globalCompositeOperation = 'multiply';
    targetCtx.drawImage(baseCanvas, 0, 0);
    targetCtx.globalAlpha = light * 0.08;
    targetCtx.globalCompositeOperation = 'screen';
    targetCtx.drawImage(baseCanvas, 0, 0);
    targetCtx.restore();
  }
}

function drawGuides() {
  const ctx = overlayCtx;
  ctx.save();
  ctx.lineWidth = Math.max(2, overlay.width / 650);
  ctx.font = `${Math.max(14, overlay.width / 55)}px Space Mono, monospace`;
  U.mapping.forEach((slot) => {
    const quad = quadToPixels(slot.quad, overlay.width, overlay.height);
    ctx.strokeStyle = '#00d8ff';
    ctx.fillStyle = 'rgba(0,216,255,.13)';
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const p = quad[0];
    const r = Math.max(13, overlay.width / 65);
    ctx.fillStyle = '#00d8ff';
    ctx.beginPath();
    ctx.arc(p.x + r, p.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#061619';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(slot.index), p.x + r, p.y + r);
  });
  ctx.restore();
}

function renderOverlay({ guides = false } = {}) {
  syncOverlayGeometry();
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  U.mapping.forEach((slot) => {
    if (slot.artworkIndex == null) return;
    const artwork = U.artworks[slot.artworkIndex];
    const plan = U.plan?.slots?.find((item) => Number(item.index) === Number(slot.index)) || {};
    warpArtwork(overlayCtx, quadToPixels(slot.quad, overlay.width, overlay.height), artwork, plan);
  });
  if (guides) drawGuides();
}

function mergedCanvas({ guides = false } = {}) {
  renderOverlay({ guides });
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const outCtx = out.getContext('2d');
  outCtx.drawImage(baseCanvas, 0, 0);
  outCtx.drawImage(overlay, 0, 0);
  return out;
}

function mappingList() {
  let box = $('universalMappingList');
  if (!box) {
    box = document.createElement('div');
    box.id = 'universalMappingList';
    box.style.display = 'grid';
    box.style.gap = '6px';
    $('autoApplyFlowStatus')?.insertAdjacentElement('afterend', box);
  }
  box.innerHTML = '';
  U.mapping.forEach((slot) => {
    const row = document.createElement('div');
    row.className = 'tiny';
    const art = slot.artworkIndex == null ? 'sem arte' : `Arte ${slot.artworkIndex + 1}`;
    row.textContent = `Área ${slot.index} · ${slot.label} ← ${art}`;
    box.appendChild(row);
  });
}

async function analyzeLayout() {
  if (!baseCanvas?.width || !baseCanvas?.height) return setFlowStatus('Aprove uma cena antes de identificar áreas.', 'warn');
  const files = [...($('brandFiles')?.files || [])];
  if (!files.length) return setFlowStatus('Envie pelo menos uma arte.', 'warn');

  const button = $('autoApplyFlowBtn');
  if (button) button.disabled = true;
  setFlowStatus('A IA está identificando as superfícies de aplicação…');
  try {
    await loadArtworks();
    hideExistingGuides();
    clearLegacyArtworkAssignments();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    U.baseDataUrl = baseCanvas.toDataURL('image/jpeg', 0.94);
    const desiredSlots = Number($('desiredSlots')?.value) || files.length;
    const response = await fetch('/api/analyze-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: U.baseDataUrl,
        artworkCount: files.length,
        desiredSlots,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `layout ${response.status}`);
    U.slots = result.slots || [];
    U.mapping = mapArtworksToSlots(files.length, U.slots);
    U.plan = null;
    U.finalized = false;
    renderOverlay({ guides: true });
    mappingList();
    setFlowStatus(`${universalMappingMessage(files.length, U.slots.length)} Revise as guias numeradas antes de finalizar.`, U.slots.length ? 'ok' : 'warn');
    document.dispatchEvent(new CustomEvent('mockup:mapping-ready', { detail: { slots: U.slots.length } }));
  } catch (error) {
    console.warn(error);
    setFlowStatus(`Falha ao identificar áreas com IA: ${error.message}`, 'warn');
  } finally {
    if (button) button.disabled = false;
  }
}

async function finalizeWithAI() {
  if (!U.mapping.length) return setFlowStatus('Primeiro identifique as áreas do mockup.', 'warn');
  const button = $('finalizeAiBtn');
  if (button) button.disabled = true;
  setFlowStatus('A IA está analisando luz, material e integração sem redesenhar sua arte…');
  try {
    const review = mergedCanvas({ guides: true }).toDataURL('image/jpeg', 0.94);
    const response = await fetch('/api/refine-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: review, slotCount: U.mapping.length }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `refine ${response.status}`);
    U.plan = result;
    U.finalized = true;
    renderOverlay({ guides: false });
    setFlowStatus('Finalização concluída. A arte original foi preservada; a IA ajustou apenas parâmetros de integração visual.', 'ok');
    document.dispatchEvent(new CustomEvent('mockup:ai-finalized', { detail: { plan: result } }));
  } catch (error) {
    console.warn(error);
    setFlowStatus(`Não foi possível finalizar com IA: ${error.message}`, 'warn');
  } finally {
    if (button) button.disabled = false;
  }
}

function ensureUniversalControls() {
  const flow = $('autoApplyFlow');
  if (!flow) return false;
  const mapButton = $('autoApplyFlowBtn');
  if (mapButton) mapButton.textContent = 'Identificar áreas e mapear artes';
  if (!$('finalizeAiBtn')) {
    const button = document.createElement('button');
    button.id = 'finalizeAiBtn';
    button.className = 'primary';
    button.textContent = 'Finalizar com IA';
    button.disabled = true;
    mapButton?.insertAdjacentElement('afterend', button);
    button.addEventListener('click', finalizeWithAI);
  }
  mapButton?.addEventListener('click', analyzeLayout);
  return true;
}

function boot() {
  if (!ensureUniversalControls()) return setTimeout(boot, 120);
  $('brandFiles')?.addEventListener('change', () => {
    U.slots = [];
    U.mapping = [];
    U.plan = null;
    U.finalized = false;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    const button = $('finalizeAiBtn');
    if (button) button.disabled = true;
  });
  document.addEventListener('mockup:mapping-ready', () => {
    const button = $('finalizeAiBtn');
    if (button) button.disabled = !U.mapping.length;
  });
  window.addEventListener('resize', () => {
    syncOverlayGeometry();
    if (U.mapping.length) renderOverlay({ guides: !U.finalized });
  });

  $('saveBtn')?.addEventListener('click', (event) => {
    if (!U.mapping.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const out = mergedCanvas({ guides: false });
    const link = document.createElement('a');
    link.download = 'mockup-vision.png';
    link.href = out.toDataURL('image/png');
    link.click();
  }, true);
}

boot();

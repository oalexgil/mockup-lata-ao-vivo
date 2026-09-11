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
  surfaceValidated: false,
  mappingStatus: 'idle',
  workflowMode: 'direct',
  directRenderImage: null,
  directRenderReady: false,
  directRenderMeta: null,
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

function uploadedFileCount() {
  return $('brandFiles')?.files?.length || 0;
}

function updateModeControls() {
  const count = uploadedFileCount();
  const primary = $('autoApplyFlowBtn');
  const advanced = $('advancedMappingBtn');
  const finalize = $('finalizeAiBtn');
  const instruction = $('mockupApplyInstruction');
  const single = count <= 1;

  if (primary) primary.textContent = single ? 'Aplicar mockup com IA' : 'Mapear várias artes com IA';
  if (instruction) instruction.style.display = single ? 'block' : 'none';
  if (advanced) advanced.style.display = single ? 'block' : 'none';
  if (finalize) finalize.style.display = U.workflowMode === 'advanced' || !single ? '' : 'none';
}

function setFinalizeAvailability() {
  const button = $('finalizeAiBtn');
  if (!button) return;
  const advancedMode = U.workflowMode === 'advanced' || uploadedFileCount() > 1;
  const disabled = !advancedMode || !U.surfaceValidated || !U.mapping.length;
  button.disabled = disabled;
  button.setAttribute('aria-disabled', String(disabled));
  button.style.opacity = disabled ? '0.42' : '';
  button.style.cursor = disabled ? 'not-allowed' : '';
  button.title = disabled
    ? 'Disponível no modo avançado após a IA validar uma superfície real.'
    : 'Finalizar integração visual sem redesenhar a arte.';
  updateModeControls();
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

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A imagem final retornada pela IA é inválida.'));
    image.src = dataUrl;
  });
}

async function loadArtworks() {
  const files = [...($('brandFiles')?.files || [])];
  U.artworks = [];
  for (const file of files) U.artworks.push(await fileToImage(file));
  return U.artworks;
}

function resizeSourceToDataUrl(source, maxSide = 480, type = 'image/png', quality = 0.92) {
  const sourceWidth = source.naturalWidth || source.width || 1;
  const sourceHeight = source.naturalHeight || source.height || 1;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL(type, quality);
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
  const provisional = !U.surfaceValidated;
  ctx.save();
  ctx.lineWidth = Math.max(2, overlay.width / 650);
  ctx.font = `${Math.max(14, overlay.width / 55)}px Space Mono, monospace`;
  U.mapping.forEach((slot) => {
    const quad = quadToPixels(slot.quad, overlay.width, overlay.height);
    ctx.strokeStyle = provisional ? '#f2b84b' : '#00d8ff';
    ctx.fillStyle = provisional ? 'rgba(242,184,75,.09)' : 'rgba(0,216,255,.13)';
    ctx.setLineDash(provisional ? [12, 8] : []);
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const p = quad[0];
    const r = Math.max(13, overlay.width / 65);
    ctx.setLineDash([]);
    ctx.fillStyle = provisional ? '#f2b84b' : '#00d8ff';
    ctx.beginPath();
    ctx.arc(p.x + r, p.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#061619';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(provisional ? '?' : String(slot.index), p.x + r, p.y + r);
  });
  ctx.restore();
}

function renderOverlay({ guides = false } = {}) {
  syncOverlayGeometry();
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  if (U.directRenderReady && U.directRenderImage) {
    overlayCtx.drawImage(U.directRenderImage, 0, 0, overlay.width, overlay.height);
    return;
  }

  if (U.surfaceValidated) {
    U.mapping.forEach((slot) => {
      if (slot.artworkIndex == null) return;
      const artwork = U.artworks[slot.artworkIndex];
      const plan = U.plan?.slots?.find((item) => Number(item.index) === Number(slot.index)) || {};
      warpArtwork(overlayCtx, quadToPixels(slot.quad, overlay.width, overlay.height), artwork, plan);
    });
  }

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

  if (U.directRenderReady) {
    const row = document.createElement('div');
    row.className = 'tiny';
    row.textContent = 'Aplicação direta com IA · cena + Arte 1 → mockup final';
    box.appendChild(row);
    return;
  }

  U.mapping.forEach((slot) => {
    const row = document.createElement('div');
    row.className = 'tiny';
    if (!U.surfaceValidated) {
      row.textContent = `Área ${slot.index} · ${slot.label} · sem aplicação até validação`;
    } else {
      const art = slot.artworkIndex == null ? 'sem arte' : `Arte ${slot.artworkIndex + 1}`;
      row.textContent = `Área ${slot.index} · ${slot.label} ← ${art}`;
    }
    box.appendChild(row);
  });
}

function resetApplicationState(mode = uploadedFileCount() > 1 ? 'advanced' : 'direct') {
  U.slots = [];
  U.mapping = [];
  U.plan = null;
  U.finalized = false;
  U.surfaceValidated = false;
  U.mappingStatus = 'idle';
  U.workflowMode = mode;
  U.directRenderImage = null;
  U.directRenderReady = false;
  U.directRenderMeta = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  mappingList();
  setFinalizeAvailability();
}

async function prepareApplication() {
  await loadArtworks();
  hideExistingGuides();
  clearLegacyArtworkAssignments();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  U.baseDataUrl = baseCanvas.toDataURL('image/jpeg', 0.94);
}

async function applySingleWithAI() {
  if (!baseCanvas?.width || !baseCanvas?.height) return setFlowStatus('Aprove uma cena antes de aplicar a arte.', 'warn');
  const files = [...($('brandFiles')?.files || [])];
  if (files.length !== 1) return analyzeLayout();

  const primary = $('autoApplyFlowBtn');
  const advanced = $('advancedMappingBtn');
  if (primary) primary.disabled = true;
  if (advanced) advanced.disabled = true;
  resetApplicationState('direct');
  U.mappingStatus = 'direct-rendering';
  setFlowStatus('A IA está usando a cena e a arte como referências para gerar o mockup final…');

  try {
    await prepareApplication();
    const artwork = U.artworks[0];
    const instruction = String($('mockupApplyInstruction')?.value || '').trim();
    const sceneReference = resizeSourceToDataUrl(baseCanvas, 480, 'image/jpeg', 0.9);
    const artworkReference = resizeSourceToDataUrl(artwork.image, 480, 'image/png');

    const response = await fetch('/api/render-mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneImageDataUrl: sceneReference,
        artworkImageDataUrl: artworkReference,
        instruction,
        outputWidth: baseCanvas.width,
        outputHeight: baseCanvas.height,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || `render ${response.status}`);
    if (!result?.imageDataUrl) throw new Error('A IA não retornou a imagem final.');

    U.directRenderImage = await loadImage(result.imageDataUrl);
    U.directRenderReady = true;
    U.directRenderMeta = result;
    U.mappingStatus = 'direct-rendered';
    U.finalized = true;
    renderOverlay({ guides: false });
    mappingList();
    setFlowStatus('Mockup final gerado com IA usando a cena e a arte como referências. Confira letras e detalhes finos do rótulo antes de salvar.', 'ok');
    document.dispatchEvent(new CustomEvent('mockup:direct-rendered', { detail: { result } }));
  } catch (error) {
    console.warn(error);
    resetApplicationState('direct');
    setFlowStatus(`Não foi possível gerar o mockup direto: ${error.message}. Você ainda pode usar Revisar áreas / fidelidade exata.`, 'warn');
  } finally {
    if (primary) primary.disabled = false;
    if (advanced) advanced.disabled = false;
    setFinalizeAvailability();
  }
}

async function analyzeLayout() {
  if (!baseCanvas?.width || !baseCanvas?.height) return setFlowStatus('Aprove uma cena antes de identificar áreas.', 'warn');
  const files = [...($('brandFiles')?.files || [])];
  if (!files.length) return setFlowStatus('Envie pelo menos uma arte.', 'warn');

  const button = $('autoApplyFlowBtn');
  const advanced = $('advancedMappingBtn');
  if (button) button.disabled = true;
  if (advanced) advanced.disabled = true;
  resetApplicationState('advanced');
  U.mappingStatus = 'analyzing';
  setFlowStatus('A IA está identificando superfícies para o modo avançado de fidelidade…');
  try {
    await prepareApplication();
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
    U.mappingStatus = result.mappingStatus || (result.surfaceValidated === false ? 'fallback' : 'validated');
    U.surfaceValidated = result.surfaceValidated !== false && U.mappingStatus === 'validated' && U.slots.length > 0;
    renderOverlay({ guides: true });
    mappingList();
    setFinalizeAvailability();

    if (!U.surfaceValidated) {
      setFlowStatus(result.warning || 'A IA não conseguiu validar a superfície. Revise ou tente novamente.', 'warn');
    } else {
      setFlowStatus(`${universalMappingMessage(files.length, U.slots.length)} Revise as guias numeradas antes de finalizar.`, 'ok');
    }
    document.dispatchEvent(new CustomEvent('mockup:mapping-ready', {
      detail: { slots: U.slots.length, validated: U.surfaceValidated, status: U.mappingStatus },
    }));
  } catch (error) {
    console.warn(error);
    resetApplicationState('advanced');
    setFlowStatus(`Falha ao identificar áreas com IA: ${error.message}`, 'warn');
  } finally {
    if (button) button.disabled = false;
    if (advanced) advanced.disabled = false;
    setFinalizeAvailability();
  }
}

async function finalizeWithAI() {
  if (!U.mapping.length || !U.surfaceValidated) {
    setFinalizeAvailability();
    return setFlowStatus('A IA não conseguiu validar a superfície. Revise ou tente novamente.', 'warn');
  }
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
    const fallbackNote = result.refinementStatus === 'fallback'
      ? ' Foram mantidos parâmetros conservadores locais porque a IA não retornou um plano válido.'
      : '';
    setFlowStatus(`Finalização concluída. A arte original foi preservada; a IA ajustou apenas parâmetros de integração visual.${fallbackNote}`, result.refinementStatus === 'fallback' ? 'warn' : 'ok');
    document.dispatchEvent(new CustomEvent('mockup:ai-finalized', { detail: { plan: result } }));
  } catch (error) {
    console.warn(error);
    setFlowStatus(`Não foi possível finalizar com IA: ${error.message}`, 'warn');
  } finally {
    setFinalizeAvailability();
  }
}

function primaryApply() {
  return uploadedFileCount() === 1 ? applySingleWithAI() : analyzeLayout();
}

function ensureUniversalControls() {
  const flow = $('autoApplyFlow');
  if (!flow) return false;
  const mapButton = $('autoApplyFlowBtn');

  if (!$('mockupApplyInstruction')) {
    const field = document.createElement('textarea');
    field.id = 'mockupApplyInstruction';
    field.rows = 3;
    field.maxLength = 1200;
    field.placeholder = 'Instrução opcional. Ex.: aplicar na face frontal principal e centralizar. Se deixar vazio, o Mockup Vision decide automaticamente.';
    field.setAttribute('aria-label', 'Instrução opcional para aplicação da arte');
    field.style.width = '100%';
    field.style.boxSizing = 'border-box';
    field.style.margin = '8px 0';
    mapButton?.insertAdjacentElement('beforebegin', field);
  }

  if (mapButton && !mapButton.dataset.universalBound) {
    mapButton.dataset.universalBound = 'true';
    mapButton.addEventListener('click', primaryApply);
  }

  if (!$('finalizeAiBtn')) {
    const button = document.createElement('button');
    button.id = 'finalizeAiBtn';
    button.className = 'primary';
    button.textContent = 'Finalizar com IA';
    button.disabled = true;
    mapButton?.insertAdjacentElement('afterend', button);
    button.addEventListener('click', finalizeWithAI);
  }

  if (!$('advancedMappingBtn')) {
    const advanced = document.createElement('button');
    advanced.id = 'advancedMappingBtn';
    advanced.type = 'button';
    advanced.textContent = 'Revisar áreas / fidelidade exata';
    advanced.style.width = '100%';
    advanced.style.marginTop = '8px';
    $('finalizeAiBtn')?.insertAdjacentElement('afterend', advanced);
    advanced.addEventListener('click', analyzeLayout);
  }

  updateModeControls();
  setFinalizeAvailability();
  return true;
}

function waitForLegacyAssetLoad(expected, timeoutMs = 6000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const match = String($('assetCount')?.textContent || '').match(/(\d+)/);
      const loaded = match ? Number(match[1]) : 0;
      if (loaded >= expected || Date.now() - started > timeoutMs) return resolve();
      setTimeout(tick, 100);
    };
    tick();
  });
}

function boot() {
  if (!ensureUniversalControls()) return setTimeout(boot, 120);
  $('brandFiles')?.addEventListener('change', async () => {
    const expected = uploadedFileCount();
    resetApplicationState(expected > 1 ? 'advanced' : 'direct');
    updateModeControls();
    if (expected) {
      setFlowStatus(expected === 1
        ? 'Arte carregada. Preparando edição direta do mockup com IA…'
        : 'Artes carregadas. Preparando mapeamento automático das áreas…');
      await waitForLegacyAssetLoad(expected);
      if (expected === 1) applySingleWithAI();
      else analyzeLayout();
    }
  });
  document.addEventListener('mockup:mapping-ready', setFinalizeAvailability);
  window.addEventListener('resize', () => {
    syncOverlayGeometry();
    if (U.directRenderReady || U.mapping.length) {
      const guides = !U.directRenderReady && (!U.surfaceValidated || (U.workflowMode === 'advanced' && !U.finalized));
      renderOverlay({ guides });
    }
  });

  $('saveBtn')?.addEventListener('click', (event) => {
    if (U.directRenderReady) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const out = mergedCanvas({ guides: false });
      const link = document.createElement('a');
      link.download = 'mockup-vision-ai.png';
      link.href = out.toDataURL('image/png');
      link.click();
      return;
    }

    if (!U.mapping.length) return;
    if (!U.surfaceValidated) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setFlowStatus('Não é possível exportar uma aplicação provisória. Aplique novamente ou use o modo avançado.', 'warn');
      return;
    }
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
import { ObjectDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { buildGenerationPrompt } from './src/scene-brief.js';
import {
  addManualSlot,
  autoAssignAssets,
  createSlot,
  generationRequest,
  nextVersionLabel,
  normalizeProviderSlots,
} from './src/studio-core.js';
import { clampQuad, nearestCorner, suggestQuadFromBox } from './src/planar-core.js';

const $ = (id) => document.getElementById(id);
const canvas = $('display');
const ctx = canvas.getContext('2d');
const photoCanvas = document.createElement('canvas');
const photoCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
const blurCanvas = document.createElement('canvas');
const blurCtx = blurCanvas.getContext('2d');
const artCanvas = document.createElement('canvas');
const artCtx = artCanvas.getContext('2d');

const S = {
  photo: null,
  photoDataUrl: null,
  assets: [],
  slots: [],
  activeSlot: -1,
  activeCorner: -1,
  guides: true,
  detector: null,
  detectorState: 'idle',
  detectorName: '',
  versions: [],
  currentVersion: -1,
  generationPrompt: '',
};

const MODELS = [
  ['Lite2', 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite'],
  ['Lite0', 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite'],
];

const PREFERRED = new Set(['laptop', 'tv', 'cell phone', 'book', 'bottle', 'cup', 'vase', 'clock', 'suitcase', 'handbag']);

function setStatus(message, kind = '') {
  const el = $('status');
  if (!el) return;
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function setGenerateStatus(message, kind = '') {
  const el = $('generateStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImageSource(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(source)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = source;
  });
}

async function loadImageFile(file) {
  const dataUrl = await fileToDataUrl(file);
  return { image: await loadImageSource(dataUrl), dataUrl };
}

function resizeWorkingCanvas() {
  if (!S.photo) return;
  const maxSide = 1900;
  const scale = Math.min(1, maxSide / Math.max(S.photo.naturalWidth, S.photo.naturalHeight));
  const w = Math.max(1, Math.round(S.photo.naturalWidth * scale));
  const h = Math.max(1, Math.round(S.photo.naturalHeight * scale));
  for (const c of [canvas, photoCanvas, blurCanvas]) {
    c.width = w;
    c.height = h;
  }
  photoCtx.clearRect(0, 0, w, h);
  photoCtx.drawImage(S.photo, 0, 0, w, h);
  $('empty')?.classList.add('hidden');
  $('canvasHint')?.classList.remove('hidden');
}

async function setPhotoFromSource(source, providerSlots = null, keepVersions = true) {
  try {
    S.photo = await loadImageSource(source);
    S.photoDataUrl = source.startsWith('data:') ? source : null;
    resizeWorkingCanvas();
    const slots = normalizeProviderSlots(providerSlots, canvas.width, canvas.height);
    S.slots = slots.length ? slots : addManualSlot([], canvas.width, canvas.height);
    S.slots = autoAssignAssets(S.slots, S.assets.length);
    S.activeSlot = S.slots.length ? 0 : -1;
    syncActiveControls();
    renderSlotsPanel();
    render();
    refreshProgress();
    if (!keepVersions) {
      S.versions = [];
      S.currentVersion = -1;
      renderVersions();
    }
    setStatus('Imagem pronta. Detecte ou ajuste as áreas e envie suas artes.', 'ok');
  } catch (error) {
    console.warn(error);
    setStatus('Não consegui carregar esta imagem.', 'warn');
  }
}

function currentSlot() {
  return S.activeSlot >= 0 ? S.slots[S.activeSlot] : null;
}

function quadPath(targetCtx, quad) {
  if (!quad?.length) return;
  targetCtx.beginPath();
  targetCtx.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i += 1) targetCtx.lineTo(quad[i].x, quad[i].y);
  targetCtx.closePath();
}

function preparedArtwork(slot) {
  const asset = S.assets[slot.assetIndex];
  if (!asset?.image) return null;
  const image = asset.image;
  const w = Math.min(1500, Math.max(480, image.naturalWidth));
  const h = Math.min(1500, Math.max(480, image.naturalHeight));
  artCanvas.width = w;
  artCanvas.height = h;
  artCtx.clearRect(0, 0, w, h);
  artCtx.save();
  artCtx.translate(w / 2, h / 2);
  artCtx.rotate((slot.rotation * Math.PI) / 180);
  artCtx.scale(slot.zoom, slot.zoom);
  artCtx.filter = `brightness(${slot.brightness}) contrast(${slot.contrast}) saturate(${slot.saturation})`;
  const fit = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * fit;
  const dh = image.naturalHeight * fit;
  artCtx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
  artCtx.restore();
  return artCanvas;
}

function renderCleanup(targetCtx, slot) {
  if (!S.photo || slot.mode !== 'replace' || slot.cleanup <= 0) return;
  blurCtx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  blurCtx.save();
  blurCtx.filter = `blur(${Math.round(4 + slot.cleanup * 20)}px)`;
  blurCtx.drawImage(photoCanvas, 0, 0);
  blurCtx.restore();
  targetCtx.save();
  quadPath(targetCtx, slot.quad);
  targetCtx.clip();
  targetCtx.globalAlpha = Math.min(0.94, slot.cleanup * 0.96);
  targetCtx.drawImage(blurCanvas, 0, 0);
  targetCtx.restore();
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

function warpArtwork(targetCtx, slot, image) {
  if (!image || !slot?.quad) return;
  const cols = 18;
  const rows = 18;
  const sw = image.width;
  const sh = image.height;
  targetCtx.save();
  targetCtx.globalAlpha = slot.opacity;
  targetCtx.globalCompositeOperation = slot.blend;
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
      const d00 = bilinearPoint(slot.quad, u0, v0);
      const d10 = bilinearPoint(slot.quad, u1, v0);
      const d11 = bilinearPoint(slot.quad, u1, v1);
      const d01 = bilinearPoint(slot.quad, u0, v1);
      drawTriangle(targetCtx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(targetCtx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  targetCtx.restore();
}

function reapplyLighting(targetCtx, slot) {
  if (slot.preserveLight <= 0) return;
  targetCtx.save();
  quadPath(targetCtx, slot.quad);
  targetCtx.clip();
  targetCtx.globalAlpha = slot.preserveLight * 0.34;
  targetCtx.globalCompositeOperation = 'multiply';
  targetCtx.drawImage(photoCanvas, 0, 0);
  targetCtx.globalAlpha = slot.preserveLight * 0.12;
  targetCtx.globalCompositeOperation = 'screen';
  targetCtx.drawImage(photoCanvas, 0, 0);
  targetCtx.restore();
}

function drawGuides(targetCtx) {
  if (!S.guides) return;
  const radius = Math.max(7, canvas.width / 120);
  S.slots.forEach((slot, index) => {
    const active = index === S.activeSlot;
    targetCtx.save();
    targetCtx.strokeStyle = active ? '#00d8ff' : '#f4b942';
    targetCtx.fillStyle = '#081215';
    targetCtx.lineWidth = Math.max(2, canvas.width / 700);
    quadPath(targetCtx, slot.quad);
    targetCtx.stroke();
    slot.quad.forEach((point) => {
      targetCtx.beginPath();
      targetCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    });
    const anchor = slot.quad[0];
    targetCtx.fillStyle = active ? '#00d8ff' : '#f4b942';
    targetCtx.font = `${Math.max(11, radius * 1.1)}px Space Mono, monospace`;
    targetCtx.fillText(`${index + 1} · ${slot.label}`, anchor.x, Math.max(15, anchor.y - radius * 1.6));
    targetCtx.restore();
  });
}

function render(targetCtx = ctx, withGuides = S.guides) {
  if (!S.photo) return;
  targetCtx.save();
  targetCtx.setTransform(1,0,0,1,0,0);
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.clearRect(0,0,canvas.width,canvas.height);
  targetCtx.drawImage(photoCanvas,0,0);
  for (const slot of S.slots) {
    renderCleanup(targetCtx, slot);
    const art = preparedArtwork(slot);
    if (art) {
      warpArtwork(targetCtx, slot, art);
      reapplyLighting(targetCtx, slot);
    }
  }
  if (withGuides) drawGuides(targetCtx);
  targetCtx.restore();
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!S.slots.length) return;
  const point = eventPoint(event);
  const radius = Math.max(26, canvas.width / 36);
  let best = null;
  S.slots.forEach((slot, slotIndex) => {
    const corner = nearestCorner(slot.quad, point, radius);
    if (corner < 0) return;
    const p = slot.quad[corner];
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (!best || distance < best.distance) best = { slotIndex, corner, distance };
  });
  if (!best) return;
  S.activeSlot = best.slotIndex;
  S.activeCorner = best.corner;
  syncActiveControls();
  renderSlotsPanel();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (S.activeSlot < 0 || S.activeCorner < 0) return;
  const point = eventPoint(event);
  const slot = currentSlot();
  slot.quad[S.activeCorner] = {
    x: Math.max(0, Math.min(canvas.width, point.x)),
    y: Math.max(0, Math.min(canvas.height, point.y)),
  };
  slot.quad = clampQuad(slot.quad, canvas.width, canvas.height);
  render();
});

function releasePointer() { S.activeCorner = -1; }
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

async function initDetector() {
  if (S.detector || S.detectorState === 'loading') return S.detector;
  S.detectorState = 'loading';
  setStatus('Carregando detecção local…', 'warn');
  try {
    const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    for (const delegate of ['GPU','CPU']) {
      for (const [name,url] of MODELS) {
        try {
          S.detector = await ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: url, delegate },
            scoreThreshold: 0.15,
            maxResults: 16,
            runningMode: 'IMAGE',
          });
          S.detectorState = 'ready';
          S.detectorName = `${name}/${delegate}`;
          return S.detector;
        } catch (error) { console.warn('detector fallback', name, delegate, error); }
      }
    }
  } catch (error) { console.warn(error); }
  S.detectorState = 'failed';
  setStatus('Detector indisponível. Adicione as áreas manualmente.', 'warn');
  return null;
}

function detectionScore(detection) {
  const category = detection.categories?.[0];
  const box = detection.boundingBox;
  if (!category || !box) return -Infinity;
  const area = (box.width * box.height) / Math.max(1, canvas.width * canvas.height);
  const cx = (box.originX + box.width / 2) / canvas.width;
  const cy = (box.originY + box.height / 2) / canvas.height;
  return category.score + (PREFERRED.has(category.categoryName) ? 0.35 : 0) + Math.min(.3, area) - Math.hypot(cx-.5,cy-.5)*.2;
}

async function detectAreas() {
  if (!S.photo) return setStatus('Gere ou carregue uma imagem primeiro.', 'warn');
  const detector = await initDetector();
  if (!detector) return;
  let detections = [];
  try { detections = detector.detect(photoCanvas).detections || []; }
  catch (error) { console.warn(error); return setStatus('A detecção falhou. Use “Adicionar área”.', 'warn'); }
  detections.sort((a,b) => detectionScore(b)-detectionScore(a));
  const desired = Number($('desiredSlots')?.value) || Math.max(1, Math.min(6, S.assets.length || 4));
  const selected = detections.filter((d) => d.boundingBox).slice(0, desired);
  if (!selected.length) return setStatus('Nenhuma área confiável encontrada. Adicione áreas manualmente.', 'warn');
  S.slots = selected.map((d,index) => createSlot(index+1, suggestQuadFromBox(d.boundingBox, canvas.width, canvas.height, 0.04), d.categories?.[0]?.categoryName || `Área ${index+1}`));
  S.slots = autoAssignAssets(S.slots, S.assets.length);
  S.activeSlot = 0;
  syncActiveControls();
  renderSlotsPanel();
  render();
  refreshProgress();
  setStatus(`${S.slots.length} área(s) sugerida(s). Ajuste os cantos se necessário.`, 'ok');
}

function renderAssets() {
  const box = $('assetList');
  if (!box) return;
  box.innerHTML = '';
  S.assets.forEach((asset,index) => {
    const row = document.createElement('div');
    row.className = 'asset-chip';
    row.innerHTML = `<img src="${asset.dataUrl}" alt=""><span>${index+1}. ${escapeHtml(asset.name)}</span>`;
    box.appendChild(row);
  });
  $('assetCount').textContent = S.assets.length ? `${S.assets.length} arquivo(s)` : 'nenhuma arte';
}

function renderSlotsPanel() {
  const box = $('slotsList');
  if (!box) return;
  box.innerHTML = '';
  S.slots.forEach((slot,index) => {
    const card = document.createElement('div');
    card.className = `slot-card ${index === S.activeSlot ? 'active' : ''}`;
    const options = ['<option value="">Sem arte</option>', ...S.assets.map((asset,assetIndex) => `<option value="${assetIndex}" ${slot.assetIndex===assetIndex?'selected':''}>${assetIndex+1}. ${escapeHtml(asset.name)}</option>`)].join('');
    card.innerHTML = `
      <button class="slot-title" data-select-slot="${index}"><b>Área ${index+1}</b><span>${escapeHtml(slot.label)}</span></button>
      <select data-slot-asset="${index}">${options}</select>
      <button class="slot-remove" data-remove-slot="${index}">Remover área</button>`;
    box.appendChild(card);
  });
  box.querySelectorAll('[data-select-slot]').forEach((button) => button.addEventListener('click', () => {
    S.activeSlot = Number(button.dataset.selectSlot);
    syncActiveControls();
    renderSlotsPanel();
    render();
  }));
  box.querySelectorAll('[data-slot-asset]').forEach((select) => select.addEventListener('change', () => {
    const slot = S.slots[Number(select.dataset.slotAsset)];
    slot.assetIndex = select.value === '' ? null : Number(select.value);
    render();
  }));
  box.querySelectorAll('[data-remove-slot]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeSlot);
    S.slots.splice(index,1);
    S.activeSlot = S.slots.length ? Math.min(S.activeSlot, S.slots.length-1) : -1;
    syncActiveControls();
    renderSlotsPanel();
    render();
    refreshProgress();
  }));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function syncActiveControls() {
  const slot = currentSlot();
  const controls = $('adjustments');
  controls?.classList.toggle('disabled', !slot);
  if (!slot) return;
  const mapping = {
    sZoom: slot.zoom, sRotate: slot.rotation, sOpacity: slot.opacity, sCleanup: slot.cleanup,
    sLight: slot.preserveLight, sBrightness: slot.brightness, sContrast: slot.contrast, sSaturation: slot.saturation,
  };
  for (const [id,value] of Object.entries(mapping)) if ($(id)) $(id).value = value;
  if ($('blendMode')) $('blendMode').value = slot.blend;
  $('modeApply')?.setAttribute('aria-pressed', String(slot.mode==='apply'));
  $('modeReplace')?.setAttribute('aria-pressed', String(slot.mode==='replace'));
  updateControlLabels();
}

function updateControlLabels() {
  const slot = currentSlot();
  if (!slot) return;
  $('vZoom').textContent = `${Math.round(slot.zoom*100)}%`;
  $('vRotate').textContent = `${Math.round(slot.rotation)}°`;
  $('vOpacity').textContent = `${Math.round(slot.opacity*100)}%`;
  $('vCleanup').textContent = `${Math.round(slot.cleanup*100)}%`;
  $('vLight').textContent = `${Math.round(slot.preserveLight*100)}%`;
}

function bindSlotControl(id, key, parser = Number) {
  $(id)?.addEventListener('input', (event) => {
    const slot = currentSlot();
    if (!slot) return;
    slot[key] = parser(event.target.value);
    updateControlLabels();
    render();
  });
}

bindSlotControl('sZoom','zoom');
bindSlotControl('sRotate','rotation');
bindSlotControl('sOpacity','opacity');
bindSlotControl('sCleanup','cleanup');
bindSlotControl('sLight','preserveLight');
bindSlotControl('sBrightness','brightness');
bindSlotControl('sContrast','contrast');
bindSlotControl('sSaturation','saturation');
$('blendMode')?.addEventListener('change', (event) => { const slot=currentSlot(); if(slot){slot.blend=event.target.value; render();} });
$('modeApply')?.addEventListener('click', () => { const slot=currentSlot(); if(slot){slot.mode='apply';syncActiveControls();render();} });
$('modeReplace')?.addEventListener('click', () => { const slot=currentSlot(); if(slot){slot.mode='replace';syncActiveControls();render();} });

$('brandFiles')?.addEventListener('change', async (event) => {
  const files = [...(event.target.files || [])];
  S.assets = [];
  for (const file of files) {
    try {
      const { image, dataUrl } = await loadImageFile(file);
      S.assets.push({ name: file.name, image, dataUrl });
    } catch (error) { console.warn(error); }
  }
  S.slots = autoAssignAssets(S.slots, S.assets.length);
  renderAssets();
  renderSlotsPanel();
  render();
  refreshProgress();
  setStatus(S.assets.length ? `${S.assets.length} arte(s) carregada(s) e distribuída(s) pelas áreas.` : 'Nenhuma arte carregada.', S.assets.length ? 'ok' : '');
});

$('detectAreasBtn')?.addEventListener('click', detectAreas);
$('addAreaBtn')?.addEventListener('click', () => {
  if (!S.photo) return setStatus('Gere ou carregue uma imagem primeiro.', 'warn');
  S.slots = addManualSlot(S.slots, canvas.width, canvas.height);
  S.slots = autoAssignAssets(S.slots, S.assets.length);
  S.activeSlot = S.slots.length - 1;
  syncActiveControls(); renderSlotsPanel(); render(); refreshProgress();
});
$('autoAssignBtn')?.addEventListener('click', () => {
  S.slots = autoAssignAssets(S.slots, S.assets.length);
  renderSlotsPanel(); render();
});
$('toggleGuides')?.addEventListener('click', () => { S.guides=!S.guides; $('toggleGuides').textContent=S.guides?'Ocultar guias':'Mostrar guias'; render(); });
$('saveBtn')?.addEventListener('click', () => {
  if (!S.photo) return setStatus('Nada para exportar.', 'warn');
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  render(out.getContext('2d'), false);
  const link = document.createElement('a');
  link.download = 'mockup-vision.png';
  link.href = out.toDataURL('image/png');
  link.click();
});

$('photoFile')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const { dataUrl } = await loadImageFile(file);
  await setPhotoFromSource(dataUrl, null, false);
});
$('generatedFallback')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const { dataUrl } = await loadImageFile(file);
  addVersion({ imageDataUrl: dataUrl, slots: [], source: 'manual' });
  await setPhotoFromSource(dataUrl, null, true);
});

async function collectReferences() {
  const refs = [];
  for (const [id,role] of [['productRefs','product'],['sceneRefs','scene']]) {
    for (const file of [...($(id)?.files || [])]) {
      refs.push({ role, name: file.name, dataUrl: await fileToDataUrl(file) });
    }
  }
  return refs;
}

function prepareGenerationPrompt() {
  const result = buildGenerationPrompt({
    request: $('mockupPrompt')?.value,
    style: $('sceneStyle')?.value,
    surface: $('surfaceHint')?.value,
    slotCount: $('desiredSlots')?.value,
    hasProductReference: Boolean($('productRefs')?.files?.length),
    hasSceneReference: Boolean($('sceneRefs')?.files?.length),
  });
  if (result.problems.length) {
    setGenerateStatus(result.problems.join(' '), 'warn');
    return null;
  }
  S.generationPrompt = result.prompt;
  return result;
}

async function callGeneration(iteration = '') {
  const prepared = prepareGenerationPrompt();
  if (!prepared) return;
  const button = iteration ? $('iterateBtn') : $('generateBtn');
  if (button) button.disabled = true;
  setGenerateStatus(iteration ? 'Gerando nova versão…' : 'Gerando imagem…', 'warn');
  try {
    const references = await collectReferences();
    const previous = S.currentVersion >= 0 ? S.versions[S.currentVersion]?.imageDataUrl || null : null;
    const body = generationRequest({ prompt: prepared.prompt, references, previousImage: previous, iteration });
    const response = await fetch('/api/generate-scene', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`generation endpoint ${response.status}`);
    const result = await response.json();
    const source = result.imageDataUrl || result.imageUrl;
    if (!source) throw new Error('provider returned no image');
    addVersion({ imageDataUrl: source, slots: result.slots || [], source: 'api', providerId: result.id || null });
    await setPhotoFromSource(source, result.slots || [], true);
    setGenerateStatus('Imagem gerada. Você pode iterar ou seguir para as artes.', 'ok');
  } catch (error) {
    console.warn(error);
    setGenerateStatus('O gerador ainda não está conectado neste ambiente. Gere externamente com o briefing preparado e carregue o resultado em “Importar imagem gerada”.', 'warn');
    $('fallbackBox')?.classList.remove('hidden');
  } finally {
    if (button) button.disabled = false;
  }
}

$('generateBtn')?.addEventListener('click', () => callGeneration(''));
$('iterateBtn')?.addEventListener('click', () => {
  const instruction = $('iterationPrompt')?.value?.trim();
  if (!instruction) return setGenerateStatus('Escreva o que deseja mudar nesta versão.', 'warn');
  callGeneration(instruction);
});

function addVersion(version) {
  S.versions.push({ ...version, label: nextVersionLabel(S.versions.length) });
  S.currentVersion = S.versions.length - 1;
  $('iterationBox')?.classList.remove('hidden');
  renderVersions();
}

function renderVersions() {
  const box = $('versions');
  if (!box) return;
  box.innerHTML = '';
  S.versions.forEach((version,index) => {
    const button = document.createElement('button');
    button.className = `version-card ${index===S.currentVersion?'active':''}`;
    button.innerHTML = `<img src="${version.imageDataUrl}" alt="${version.label}"><span>${version.label}</span>`;
    button.addEventListener('click', async () => {
      S.currentVersion = index;
      renderVersions();
      await setPhotoFromSource(version.imageDataUrl, version.slots || [], true);
    });
    box.appendChild(button);
  });
}

function refreshProgress() {
  const steps = [
    Boolean(S.photo || $('mockupPrompt')?.value?.trim() || $('productRefs')?.files?.length || $('sceneRefs')?.files?.length),
    Boolean(S.photo),
    Boolean(S.assets.length),
    Boolean(S.photo && S.assets.length && S.slots.length),
  ];
  steps.forEach((done,index) => {
    const el = $(`progress${index+1}`);
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('active', !done && steps.slice(0,index).every(Boolean));
  });
}

for (const id of ['mockupPrompt','productRefs','sceneRefs']) $(id)?.addEventListener('input', refreshProgress);
$('productRefs')?.addEventListener('change', refreshProgress);
$('sceneRefs')?.addEventListener('change', refreshProgress);

renderAssets();
renderSlotsPanel();
refreshProgress();

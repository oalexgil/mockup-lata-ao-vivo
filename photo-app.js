import { ObjectDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import {
  bilinearPoint,
  clampQuad,
  defaultQuad,
  isUsableQuad,
  nearestCorner,
  suggestQuadFromBox,
} from './src/planar-core.js';

const $ = (id) => document.getElementById(id);
const canvas = $('display');
const ctx = canvas.getContext('2d');
const empty = $('empty');
const topnote = $('topnote');
const status = $('status');

const photoCanvas = document.createElement('canvas');
const photoCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
const blurCanvas = document.createElement('canvas');
const blurCtx = blurCanvas.getContext('2d');
const artCanvas = document.createElement('canvas');
const artCtx = artCanvas.getContext('2d');

const S = {
  photo: null,
  art: null,
  quad: null,
  activeCorner: -1,
  guides: true,
  mode: 'apply',
  cleanup: 0,
  opacity: 1,
  preserveLight: 0.55,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  zoom: 1,
  rotation: 0,
  blend: 'source-over',
  detector: null,
  detectorState: 'idle',
  detectorName: '',
};

const MODELS = [
  ['Lite2', 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite'],
  ['Lite0', 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite'],
];

const PREFERRED = new Set([
  'laptop', 'tv', 'cell phone', 'book', 'bottle', 'cup', 'vase', 'suitcase', 'handbag', 'backpack', 'clock',
]);

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function press(a, b, active) {
  $(a).setAttribute('aria-pressed', String(active));
  $(b).setAttribute('aria-pressed', String(!active));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

function resizeToPhoto() {
  if (!S.photo) return;
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(S.photo.naturalWidth, S.photo.naturalHeight));
  const w = Math.max(1, Math.round(S.photo.naturalWidth * scale));
  const h = Math.max(1, Math.round(S.photo.naturalHeight * scale));
  for (const c of [canvas, photoCanvas, blurCanvas]) {
    c.width = w;
    c.height = h;
  }
  photoCtx.clearRect(0, 0, w, h);
  photoCtx.drawImage(S.photo, 0, 0, w, h);
  S.quad = defaultQuad(w, h, 0.62);
  empty.classList.add('hidden');
  topnote.classList.remove('hidden');
  render();
}

function prepareArtwork() {
  if (!S.art) return null;
  const w = Math.min(1400, Math.max(420, S.art.naturalWidth));
  const h = Math.min(1400, Math.max(420, S.art.naturalHeight));
  artCanvas.width = w;
  artCanvas.height = h;
  artCtx.save();
  artCtx.clearRect(0, 0, w, h);
  artCtx.translate(w / 2, h / 2);
  artCtx.rotate((S.rotation * Math.PI) / 180);
  artCtx.scale(S.zoom, S.zoom);
  artCtx.filter = `brightness(${S.brightness}) contrast(${S.contrast}) saturate(${S.saturation})`;
  const fit = Math.min(w / S.art.naturalWidth, h / S.art.naturalHeight);
  const dw = S.art.naturalWidth * fit;
  const dh = S.art.naturalHeight * fit;
  artCtx.drawImage(S.art, -dw / 2, -dh / 2, dw, dh);
  artCtx.restore();
  return artCanvas;
}

function quadPath(targetCtx) {
  const [a, b, c, d] = S.quad;
  targetCtx.beginPath();
  targetCtx.moveTo(a.x, a.y);
  targetCtx.lineTo(b.x, b.y);
  targetCtx.lineTo(c.x, c.y);
  targetCtx.lineTo(d.x, d.y);
  targetCtx.closePath();
}

function renderCleanup(targetCtx) {
  if (!S.photo || !S.quad || S.mode !== 'replace' || S.cleanup <= 0) return;
  blurCtx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  blurCtx.save();
  blurCtx.filter = `blur(${Math.round(4 + S.cleanup * 18)}px)`;
  blurCtx.drawImage(photoCanvas, 0, 0);
  blurCtx.restore();

  targetCtx.save();
  quadPath(targetCtx);
  targetCtx.clip();
  targetCtx.globalAlpha = Math.min(0.92, S.cleanup * 0.95);
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

function warpArtwork(targetCtx, image) {
  if (!image || !S.quad || !isUsableQuad(S.quad, canvas.width, canvas.height)) return;
  const cols = 18;
  const rows = 18;
  const sw = image.width;
  const sh = image.height;
  targetCtx.save();
  targetCtx.globalAlpha = S.opacity;
  targetCtx.globalCompositeOperation = S.blend;

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
      const d00 = bilinearPoint(S.quad, u0, v0);
      const d10 = bilinearPoint(S.quad, u1, v0);
      const d11 = bilinearPoint(S.quad, u1, v1);
      const d01 = bilinearPoint(S.quad, u0, v1);
      drawTriangle(targetCtx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(targetCtx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  targetCtx.restore();
}

function reapplySceneLighting(targetCtx) {
  if (!S.photo || !S.quad || S.preserveLight <= 0) return;
  targetCtx.save();
  quadPath(targetCtx);
  targetCtx.clip();
  targetCtx.globalAlpha = S.preserveLight * 0.34;
  targetCtx.globalCompositeOperation = 'multiply';
  targetCtx.drawImage(photoCanvas, 0, 0);
  targetCtx.globalAlpha = S.preserveLight * 0.12;
  targetCtx.globalCompositeOperation = 'screen';
  targetCtx.drawImage(photoCanvas, 0, 0);
  targetCtx.restore();
}

function drawGuides(targetCtx) {
  if (!S.guides || !S.quad) return;
  targetCtx.save();
  targetCtx.lineWidth = Math.max(2, canvas.width / 650);
  targetCtx.strokeStyle = '#00d8ff';
  targetCtx.fillStyle = '#07171b';
  quadPath(targetCtx);
  targetCtx.stroke();
  const r = Math.max(8, canvas.width / 110);
  S.quad.forEach((p, i) => {
    targetCtx.beginPath();
    targetCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.fillStyle = '#00d8ff';
    targetCtx.font = `${Math.max(10, r)}px Space Mono, monospace`;
    targetCtx.fillText(String(i + 1), p.x + r * 1.2, p.y - r * 0.8);
    targetCtx.fillStyle = '#07171b';
  });
  targetCtx.restore();
}

function render(targetCtx = ctx, guides = S.guides) {
  if (!S.photo) return;
  targetCtx.save();
  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  targetCtx.drawImage(photoCanvas, 0, 0);
  renderCleanup(targetCtx);
  const prepared = prepareArtwork();
  if (prepared) {
    warpArtwork(targetCtx, prepared);
    reapplySceneLighting(targetCtx);
  }
  if (guides) drawGuides(targetCtx);
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
  if (!S.quad) return;
  const point = eventPoint(event);
  const radius = Math.max(24, canvas.width / 40);
  S.activeCorner = nearestCorner(S.quad, point, radius);
  if (S.activeCorner >= 0) canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (S.activeCorner < 0 || !S.quad) return;
  const point = eventPoint(event);
  S.quad[S.activeCorner] = {
    x: Math.max(0, Math.min(canvas.width, point.x)),
    y: Math.max(0, Math.min(canvas.height, point.y)),
  };
  S.quad = clampQuad(S.quad, canvas.width, canvas.height);
  render();
});

function releasePointer() {
  S.activeCorner = -1;
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

async function initDetector() {
  if (S.detector || S.detectorState === 'loading') return S.detector;
  S.detectorState = 'loading';
  setStatus('Carregando detector local…', 'warn');
  try {
    const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    for (const delegate of ['GPU', 'CPU']) {
      for (const [name, url] of MODELS) {
        try {
          S.detector = await ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: url, delegate },
            scoreThreshold: 0.16,
            maxResults: 14,
            runningMode: 'IMAGE',
          });
          S.detectorState = 'ready';
          S.detectorName = `${name}/${delegate}`;
          setStatus(`Detector pronto · ${S.detectorName}`, 'ok');
          return S.detector;
        } catch (error) {
          console.warn('Detector fallback:', name, delegate, error);
        }
      }
    }
  } catch (error) {
    console.warn(error);
  }
  S.detectorState = 'failed';
  setStatus('Detector indisponível. Use os 4 cantos manualmente.', 'warn');
  return null;
}

function detectionScore(detection) {
  const category = detection.categories?.[0];
  const box = detection.boundingBox;
  if (!category || !box) return -Infinity;
  const area = (box.width * box.height) / Math.max(1, canvas.width * canvas.height);
  const cx = (box.originX + box.width / 2) / canvas.width;
  const cy = (box.originY + box.height / 2) / canvas.height;
  const centerPenalty = Math.hypot(cx - 0.5, cy - 0.5);
  return category.score + (PREFERRED.has(category.categoryName) ? 0.35 : 0) + Math.min(0.28, area) - centerPenalty * 0.25;
}

async function detectSurface() {
  if (!S.photo) return setStatus('Carregue uma foto primeiro.', 'warn');
  const detector = await initDetector();
  if (!detector) return;
  let result;
  try {
    result = detector.detect(photoCanvas);
  } catch (error) {
    console.warn(error);
    return setStatus('A detecção falhou nesta foto. Ajuste os 4 cantos manualmente.', 'warn');
  }
  const detections = result.detections || [];
  const best = detections.sort((a, b) => detectionScore(b) - detectionScore(a))[0];
  if (!best?.boundingBox) {
    setStatus('Nenhum objeto confiável encontrado. Área manual mantida.', 'warn');
    return;
  }
  S.quad = suggestQuadFromBox(best.boundingBox, canvas.width, canvas.height, 0.02);
  const cat = best.categories?.[0];
  setStatus(`Objeto detectado: ${cat?.categoryName || 'superfície'} · ajuste os 4 cantos.`, 'ok');
  render();
}

$('photoFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    S.photo = await loadImage(file);
    resizeToPhoto();
    setStatus('Foto carregada. Detecte a superfície ou ajuste os 4 cantos.', 'ok');
  } catch (error) {
    setStatus(error.message, 'warn');
  }
});

$('artFile').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    S.art = await loadImage(file);
    setStatus('Arte carregada. Ajuste perspectiva e realismo.', 'ok');
    render();
  } catch (error) {
    setStatus(error.message, 'warn');
  }
});

$('detectBtn').addEventListener('click', detectSurface);
$('resetQuadBtn').addEventListener('click', () => {
  if (!S.photo) return;
  S.quad = defaultQuad(canvas.width, canvas.height, 0.62);
  setStatus('Área manual centralizada.', 'ok');
  render();
});

$('modeApply').addEventListener('click', () => {
  S.mode = 'apply';
  S.cleanup = 0;
  $('sCleanup').value = '0';
  $('vCleanup').textContent = '0%';
  press('modeApply', 'modeReplace', true);
  render();
});
$('modeReplace').addEventListener('click', () => {
  S.mode = 'replace';
  if (S.cleanup === 0) {
    S.cleanup = 0.55;
    $('sCleanup').value = '0.55';
    $('vCleanup').textContent = '55%';
  }
  press('modeApply', 'modeReplace', false);
  render();
});

const bindRange = (id, key, format) => {
  $(id).addEventListener('input', (event) => {
    S[key] = Number(event.target.value);
    const valueId = `v${id.slice(1)}`;
    const out = $(valueId);
    if (out) out.textContent = format(S[key]);
    render();
  });
};

bindRange('sCleanup', 'cleanup', (v) => `${Math.round(v * 100)}%`);
bindRange('sOpacity', 'opacity', (v) => `${Math.round(v * 100)}%`);
bindRange('sLight', 'preserveLight', (v) => `${Math.round(v * 100)}%`);
bindRange('sBrightness', 'brightness', (v) => `${Math.round(v * 100)}%`);
bindRange('sContrast', 'contrast', (v) => `${Math.round(v * 100)}%`);
bindRange('sSaturation', 'saturation', (v) => `${Math.round(v * 100)}%`);
bindRange('sZoom', 'zoom', (v) => `${Math.round(v * 100)}%`);
bindRange('sRotate', 'rotation', (v) => `${Math.round(v)}°`);

$('blendMode').addEventListener('change', (event) => {
  S.blend = event.target.value;
  render();
});

$('toggleGuides').addEventListener('click', () => {
  S.guides = !S.guides;
  $('toggleGuides').textContent = S.guides ? 'Ocultar guias' : 'Mostrar guias';
  topnote.classList.toggle('hidden', !S.guides || !S.photo);
  render();
});

$('saveBtn').addEventListener('click', () => {
  if (!S.photo) return setStatus('Carregue uma foto antes de exportar.', 'warn');
  const previous = S.guides;
  S.guides = false;
  render(ctx, false);
  canvas.toBlob((blob) => {
    S.guides = previous;
    render();
    if (!blob) return setStatus('Não foi possível gerar o PNG.', 'warn');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mockup-vision.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('PNG exportado.', 'ok');
  }, 'image/png');
});

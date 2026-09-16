import {
  artworkCssFilter,
  artworkFitRect,
  effectiveArtworkOpacity,
  integrationStrength,
  normalizeArtworkAdjustments,
} from './src/artwork-editor.js';

const $ = (id) => document.getElementById(id);
let originals = [];
let appliedFiles = [];
let internalFileUpdate = false;

function setEditorStatus(message, kind = '') {
  const target = $('status');
  if (!target) return;
  target.textContent = message;
  target.className = `status ${kind}`.trim();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a arte original.'));
    };
    image.src = url;
  });
}

function pixelTone(canvas, input) {
  const adjustments = normalizeArtworkAdjustments(input);
  const needsPixels = Math.abs(adjustments.temperature) > 0.001
    || Math.abs(adjustments.blacks) > 0.001
    || Math.abs(adjustments.whites) > 0.001
    || adjustments.whiteReduction > 0.001;
  if (!needsPixels) return;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const luma = Math.max(0, Math.min(1, (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255));

    if (adjustments.temperature) {
      const shift = adjustments.temperature * 20;
      r += shift;
      g += shift * 0.25;
      b -= shift;
    }

    if (adjustments.blacks) {
      const influence = (1 - luma) ** 2;
      const delta = adjustments.blacks * 42 * influence;
      r += delta; g += delta; b += delta;
    }

    if (adjustments.whites) {
      const influence = luma ** 2;
      const delta = adjustments.whites * 42 * influence;
      r += delta; g += delta; b += delta;
    }

    if (adjustments.whiteReduction) {
      const t = Math.max(0, Math.min(1, (luma - 0.82) / 0.18));
      const smooth = t * t * (3 - 2 * t);
      data[i + 3] = Math.round(data[i + 3] * (1 - adjustments.whiteReduction * smooth));
    }

    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
  context.putImageData(imageData, 0, 0);
}

function curveArtwork(source, amount) {
  const curvature = Math.max(0, Math.min(1, Number(amount) || 0));
  if (curvature <= 0.001) return source;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const context = out.getContext('2d');
  const strips = Math.min(180, Math.max(48, Math.round(source.width / 12)));
  const stripWidth = source.width / strips;
  for (let index = 0; index < strips; index += 1) {
    const x = index * stripWidth;
    const center = ((index + 0.5) / strips) * 2 - 1;
    const edge = center * center;
    const heightScale = 1 - curvature * edge * 0.09;
    const targetHeight = source.height * heightScale;
    const targetY = (source.height - targetHeight) / 2;
    context.drawImage(
      source,
      x,
      0,
      Math.ceil(stripWidth) + 1,
      source.height,
      x,
      targetY,
      Math.ceil(stripWidth) + 1,
      targetHeight,
    );
  }
  return out;
}

async function renderAdjustedFile(original, input) {
  const adjustments = normalizeArtworkAdjustments(input);
  const image = await loadImage(original);
  const maxSide = 4096;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.save();
  context.globalAlpha = effectiveArtworkOpacity(adjustments);
  context.filter = artworkCssFilter(adjustments);
  const rect = artworkFitRect(image.naturalWidth, image.naturalHeight, width, height, adjustments);
  context.translate(width / 2, height / 2);
  context.rotate((adjustments.rotation * Math.PI) / 180);
  context.drawImage(
    image,
    rect.x - width / 2,
    rect.y - height / 2,
    rect.width,
    rect.height,
  );
  context.restore();
  pixelTone(canvas, adjustments);
  const curved = curveArtwork(canvas, adjustments.curvature);

  const blob = await new Promise((resolve, reject) => {
    curved.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao gerar versão ajustada.')), 'image/png');
  });
  return new File([blob], original.name, {
    type: 'image/png',
    lastModified: original.lastModified,
  });
}

function replaceFileInput() {
  const input = $('brandFiles');
  if (!input || typeof DataTransfer === 'undefined') throw new Error('Este navegador não permite atualizar a versão aplicada da arte.');
  const transfer = new DataTransfer();
  appliedFiles.forEach((file) => { if (file) transfer.items.add(file); });
  internalFileUpdate = true;
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  internalFileUpdate = false;
}

function dispatchIntegration(index, adjustments) {
  document.dispatchEvent(new CustomEvent('mockup:artwork-integration', {
    detail: {
      index,
      preserveLight: Math.max(0, Math.min(1, integrationStrength(adjustments) * 0.78 + adjustments.reflection * 0.14 + adjustments.contactShadow * 0.08)),
      reflection: adjustments.reflection,
      contactShadow: adjustments.contactShadow,
      materialIntegration: adjustments.materialIntegration,
      blendIntensity: adjustments.blendIntensity,
      immutableSource: true,
    },
  }));
}

function syncVisibleSlotIntegration(index, adjustments, attempt = 0) {
  const assignments = [...document.querySelectorAll('#slotsList select[data-slot-asset]')]
    .filter((select) => Number(select.value) === Number(index));
  if (!assignments.length && attempt < 10) {
    setTimeout(() => syncVisibleSlotIntegration(index, adjustments, attempt + 1), 120);
    return;
  }
  const preserveLight = Math.max(0, Math.min(1, integrationStrength(adjustments) * 0.78 + adjustments.reflection * 0.14 + adjustments.contactShadow * 0.08));
  assignments.forEach((select) => {
    const slotIndex = Number(select.dataset.slotAsset);
    document.querySelector(`[data-select-slot="${slotIndex}"]`)?.click();
    const light = $('sLight');
    if (light) {
      light.value = String(preserveLight);
      light.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

$('brandFiles')?.addEventListener('change', (event) => {
  if (internalFileUpdate) return;
  originals = [...(event.target.files || [])];
  appliedFiles = [...originals];
});

document.addEventListener('mockup:artwork-adjusted', async (event) => {
  const detail = event.detail || {};
  const index = Number(detail.index);
  if (!Number.isInteger(index) || index < 0) return;
  const original = originals[index] || $('brandFiles')?.files?.[index];
  if (!original) return;

  try {
    if (detail.reason === 'reset') {
      appliedFiles[index] = original;
      replaceFileInput();
      setEditorStatus('Arte restaurada ao original. O arquivo enviado permaneceu preservado.', 'ok');
      return;
    }
    const adjustments = normalizeArtworkAdjustments(detail.adjustments || {});
    appliedFiles[index] = await renderAdjustedFile(original, adjustments);
    replaceFileInput();
    dispatchIntegration(index, adjustments);
    syncVisibleSlotIntegration(index, adjustments);
    setEditorStatus('Versão ajustada aplicada de forma não destrutiva. O original continua preservado.', 'ok');
  } catch (error) {
    console.warn(error);
    setEditorStatus(`Não foi possível aplicar os ajustes: ${error.message}`, 'warn');
  }
});

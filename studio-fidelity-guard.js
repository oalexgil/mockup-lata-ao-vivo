import {
  fidelityApplicationStrategy,
  fitArtworkQuad,
} from './src/artwork-fit.js';

const $ = (id) => document.getElementById(id);
const nextFetch = window.fetch.bind(window);

function fidelitySettings() {
  return {
    fidelityMode: $('mockupFidelityMode')?.value || 'exact',
    preserveAspectRatio: $('preserveAspectRatio')?.checked !== false,
    limitDeformation: $('limitDeformation')?.checked !== false,
    safeMargins: $('safeMargins')?.checked !== false,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler a arte original.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a arte original.'));
    image.src = source;
  });
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

function warpOriginalArtwork(ctx, image, quad) {
  const cols = 20;
  const rows = 20;
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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
}

function quadPath(ctx, quad) {
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function addConservativeSceneLight(ctx, sceneCanvas, quad, preserveLight) {
  const light = Math.max(0, Math.min(0.18, Number(preserveLight) || 0));
  if (light <= 0) return;
  ctx.save();
  quadPath(ctx, quad);
  ctx.clip();
  ctx.globalAlpha = light * 0.42;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(sceneCanvas, 0, 0);
  ctx.globalAlpha = light * 0.12;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(sceneCanvas, 0, 0);
  ctx.restore();
}

function normalizeTargetQuad(target, width, height) {
  const quad = target?.quad;
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const points = quad.map((point) => ({
    x: Number(point?.x) * width,
    y: Number(point?.y) * height,
  }));
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ? points : null;
}

async function deterministicExactResponse(body) {
  const sceneCanvas = $('display');
  const artworkFile = $('brandFiles')?.files?.[0];
  if (!sceneCanvas?.width || !sceneCanvas?.height || !artworkFile) {
    throw new Error('Cena ou arte original indisponível para o modo de fidelidade máxima.');
  }

  const artwork = await loadImage(await fileToDataUrl(artworkFile));
  const artworkAspectRatio = (artwork.naturalWidth || artwork.width) / Math.max(1, artwork.naturalHeight || artwork.height);
  const sceneDataUrl = sceneCanvas.toDataURL('image/jpeg', 0.94);

  const planResponse = await nextFetch('/api/apply-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl: sceneDataUrl,
      artworkAspectRatio,
      instruction: String(body.instruction || '').trim(),
    }),
  });
  const plan = await planResponse.json();
  if (!planResponse.ok) throw new Error(plan?.error || `apply-plan ${planResponse.status}`);
  if (plan?.surfaceValidated === false) throw new Error(plan?.warning || 'A superfície não foi validada para aplicação exata.');

  const target = plan?.target || plan?.slots?.[0];
  const rawQuad = normalizeTargetQuad(target, sceneCanvas.width, sceneCanvas.height);
  if (!rawQuad) throw new Error('A IA não retornou uma área segura para a arte.');

  const settings = fidelitySettings();
  const fittedQuad = fitArtworkQuad(rawQuad, artworkAspectRatio, settings);
  const output = document.createElement('canvas');
  output.width = sceneCanvas.width;
  output.height = sceneCanvas.height;
  const ctx = output.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sceneCanvas, 0, 0);
  warpOriginalArtwork(ctx, artwork, fittedQuad);
  addConservativeSceneLight(ctx, sceneCanvas, fittedQuad, plan?.integration?.preserveLight);

  return {
    imageDataUrl: output.toDataURL('image/png'),
    provider: 'mockup-vision-local-fidelity-guard',
    model: plan?.model || null,
    mode: 'deterministic-exact',
    artworkReferenceUsed: true,
    artworkOriginalPixelsUsed: true,
    fidelity: 'exact',
    fidelityControls: settings,
    surface: target?.label || 'validated surface',
    surfaceValidated: true,
    width: output.width,
    height: output.height,
  };
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.includes('/api/render-mockup') || typeof init?.body !== 'string') {
    return nextFetch(input, init);
  }

  const settings = fidelitySettings();
  if (fidelityApplicationStrategy(settings) !== 'deterministic-exact') {
    return nextFetch(input, init);
  }

  try {
    const body = JSON.parse(init.body);
    const result = await deterministicExactResponse(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    console.warn('[fidelity-guard] aplicação exata bloqueada para evitar deformação destrutiva', error);
    return new Response(JSON.stringify({
      error: `Fidelidade máxima protegeu a arte de uma aplicação insegura: ${error.message}`,
      mode: 'deterministic-exact-blocked',
    }), {
      status: 422,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};

document.addEventListener('mockup:direct-rendered', (event) => {
  const result = event.detail?.result;
  if (result?.mode !== 'deterministic-exact') return;
  const status = $('autoApplyFlowStatus');
  if (!status) return;
  status.textContent = 'Fidelidade máxima: a arte original foi aplicada por geometria determinística, com proporção e margens seguras. A IA escolheu a superfície, mas não redesenhou letras, logos ou ilustrações.';
  status.className = 'auto-status ok';
});

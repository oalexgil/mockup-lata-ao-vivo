import {
  artworkAdjustmentSnapshot,
  artworkCssFilter,
  artworkKey,
  defaultArtworkAdjustments,
  getArtworkAdjustments,
  normalizeArtworkAdjustments,
  resetArtworkAdjustments,
  setArtworkAdjustments,
} from './src/artwork-editor.js';

const $ = (id) => document.getElementById(id);
const versions = new Map();
let activeIndex = 0;
let draft = defaultArtworkAdjustments();

const CONTROL_GROUPS = [
  {
    title: 'Imagem',
    controls: [
      ['brightness', 'Brilho', 0.5, 1.5, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['contrast', 'Contraste', 0.5, 1.6, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['saturation', 'Saturação', 0, 1.8, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['temperature', 'Temperatura', -1, 1, 0.01, (v) => `${Math.round(v * 100)}`],
      ['sharpness', 'Nitidez', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['blacks', 'Pretos', -1, 1, 0.01, (v) => `${Math.round(v * 100)}`],
      ['whites', 'Brancos', -1, 1, 0.01, (v) => `${Math.round(v * 100)}`],
      ['whiteReduction', 'Reduzir fundo branco', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
  },
  {
    title: 'Posição e encaixe',
    controls: [
      ['scale', 'Escala', 0.25, 3, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['rotation', 'Rotação', -180, 180, 1, (v) => `${Math.round(v)}°`],
      ['offsetX', 'Deslocamento X', -1, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['offsetY', 'Deslocamento Y', -1, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['safeMargin', 'Margem segura', 0, 0.3, 0.005, (v) => `${Math.round(v * 100)}%`],
      ['curvature', 'Curvatura / deformação', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
  },
  {
    title: 'Integração',
    controls: [
      ['opacity', 'Opacidade', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['transparency', 'Transparência', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['blendIntensity', 'Intensidade de blend', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['reflection', 'Reflexo', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['contactShadow', 'Sombra de contato', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
      ['materialIntegration', 'Integração com material', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
    ],
  },
];

function files() {
  return [...($('brandFiles')?.files || [])];
}

function currentFile() {
  return files()[activeIndex] || null;
}

function currentKey() {
  const file = currentFile();
  return file ? artworkKey(file, activeIndex) : null;
}

function injectStyles() {
  if ($('artworkEditorStyles')) return;
  const style = document.createElement('style');
  style.id = 'artworkEditorStyles';
  style.textContent = `
    .art-editor-launch{margin-top:8px}
    .art-editor-launch[disabled]{opacity:.45;cursor:not-allowed}
    .art-editor-backdrop{position:fixed;inset:0;z-index:120;background:rgba(4,7,8,.78);backdrop-filter:blur(10px);display:grid;place-items:center;padding:22px}
    .art-editor-dialog{width:min(1080px,96vw);max-height:92vh;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#101517;border:1px solid #314047;border-radius:14px;box-shadow:0 28px 100px rgba(0,0,0,.55)}
    .art-editor-head,.art-editor-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #2b3539}
    .art-editor-foot{border-top:1px solid #2b3539;border-bottom:0;flex-wrap:wrap}
    .art-editor-title{display:flex;align-items:center;gap:10px;min-width:0}.art-editor-title strong{font-size:14px}.art-editor-preserved{font:10px var(--mono);color:#8ce0bb;border:1px solid #245f48;background:#102019;padding:4px 7px;border-radius:999px;white-space:nowrap}
    .art-editor-close{width:auto;margin:0;padding:7px 10px}
    .art-editor-body{min-height:0;overflow:auto;padding:16px;display:grid;grid-template-columns:minmax(340px,1.05fr) minmax(320px,.95fr);gap:16px}
    .art-editor-previews{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start}.art-editor-preview{min-height:300px;border:1px solid #2b3539;border-radius:10px;background:repeating-conic-gradient(#192023 0 25%,#111719 0 50%) 50%/22px 22px;overflow:hidden;display:grid;grid-template-rows:auto 1fr}.art-editor-preview b{padding:8px 10px;background:#0d1214;border-bottom:1px solid #2b3539;font-size:11px}.art-editor-preview-frame{min-height:260px;display:grid;place-items:center;overflow:hidden;position:relative;padding:22px}.art-editor-preview img{max-width:92%;max-height:360px;object-fit:contain;transform-origin:center}
    .art-editor-panel{display:grid;gap:12px;align-content:start}.art-editor-select{display:grid;grid-template-columns:1fr 150px;gap:8px}.art-editor-group{border:1px solid #2b3539;border-radius:9px;padding:10px 11px;background:#0d1214}.art-editor-group summary{cursor:pointer;font-size:11.5px;font-weight:700;color:#b7c7cd}.art-editor-control{display:grid;grid-template-columns:1fr auto;gap:5px 8px;align-items:center;margin-top:10px}.art-editor-control label{font-size:11px;color:#93a0a5}.art-editor-control output{font:10px var(--mono);color:#00d8ff}.art-editor-control input{grid-column:1/2}.art-editor-reset{grid-column:2/3;grid-row:2;width:30px;padding:4px;margin:0;font-size:11px}.art-editor-meta{font-size:10.5px;color:#93a0a5;line-height:1.5}.art-editor-fit{display:grid;grid-template-columns:1fr 1fr;gap:8px}.art-editor-fit label{font-size:11px;color:#93a0a5}.art-editor-version{font:10px var(--mono);color:#93a0a5}
    @media(max-width:820px){.art-editor-body{grid-template-columns:1fr}.art-editor-previews{grid-template-columns:1fr}.art-editor-preview{min-height:220px}.art-editor-preview-frame{min-height:190px}}
  `;
  document.head.appendChild(style);
}

function previewTransform() {
  const scale = draft.scale;
  const x = draft.offsetX * 18;
  const y = draft.offsetY * 18;
  return `translate(${x}%, ${y}%) rotate(${draft.rotation}deg) scale(${scale})`;
}

function previewFilter() {
  const temperature = draft.temperature;
  const sepia = Math.abs(temperature) * 0.16;
  const hue = temperature * -14;
  return `${artworkCssFilter(draft)} sepia(${sepia}) hue-rotate(${hue}deg)`;
}

function refreshPreview() {
  const adjusted = $('artEditorAdjusted');
  if (!adjusted) return;
  adjusted.style.filter = previewFilter();
  adjusted.style.transform = previewTransform();
  adjusted.style.opacity = String(Math.max(0, Math.min(1, draft.opacity * (1 - draft.transparency))));
  adjusted.style.objectFit = draft.fit;
  const meta = $('artEditorMeta');
  const key = currentKey();
  const count = key ? (versions.get(key)?.length || 0) : 0;
  if (meta) meta.textContent = `${draft.fit === 'cover' ? 'Preencher' : 'Conter'} · margem segura ${Math.round(draft.safeMargin * 100)}% · ${count} versão(ões) de parâmetros salva(s). O arquivo original nunca é sobrescrito.`;
  CONTROL_GROUPS.flatMap((group) => group.controls).forEach(([keyName,,, , format]) => {
    const input = $(`artEditor-${keyName}`);
    const output = $(`artEditorOut-${keyName}`);
    if (input && Number(input.value) !== Number(draft[keyName])) input.value = draft[keyName];
    if (output) output.textContent = format(draft[keyName]);
  });
  if ($('artEditorFit')) $('artEditorFit').value = draft.fit;
}

function syncImages() {
  const file = currentFile();
  const original = $('artEditorOriginal');
  const adjusted = $('artEditorAdjusted');
  const select = $('artEditorAsset');
  if (!file || !original || !adjusted || !select) return;
  const url = URL.createObjectURL(file);
  original.onload = () => URL.revokeObjectURL(url);
  original.src = url;
  adjusted.src = url;
  select.innerHTML = files().map((item, index) => `<option value="${index}">${index + 1}. ${escapeHtml(item.name)}</option>`).join('');
  select.value = String(activeIndex);
  draft = getArtworkAdjustments(currentKey());
  refreshPreview();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function controlMarkup(definition) {
  const [key, label, min, max, step, format] = definition;
  const value = draft[key];
  return `<div class="art-editor-control">
    <label for="artEditor-${key}">${label}</label>
    <output id="artEditorOut-${key}">${format(value)}</output>
    <input id="artEditor-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    <button class="art-editor-reset" type="button" data-reset-control="${key}" title="Restaurar ${label}">↺</button>
  </div>`;
}

function buildDialog() {
  if ($('artworkEditorBackdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'artworkEditorBackdrop';
  backdrop.className = 'art-editor-backdrop hidden';
  backdrop.innerHTML = `<div class="art-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="artEditorTitle">
    <div class="art-editor-head">
      <div class="art-editor-title"><strong id="artEditorTitle">Editar arte / rótulo</strong><span class="art-editor-preserved">Original preservado</span></div>
      <button id="artEditorClose" class="art-editor-close" type="button" aria-label="Fechar editor">Fechar</button>
    </div>
    <div class="art-editor-body">
      <div class="art-editor-previews">
        <div class="art-editor-preview"><b>Original</b><div class="art-editor-preview-frame"><img id="artEditorOriginal" alt="Arte original"></div></div>
        <div class="art-editor-preview"><b>Ajustado</b><div class="art-editor-preview-frame"><img id="artEditorAdjusted" alt="Prévia ajustada"></div></div>
      </div>
      <div class="art-editor-panel">
        <div class="art-editor-select">
          <select id="artEditorAsset" aria-label="Arte em edição"></select>
          <button id="artEditorResetAll" type="button">Reset geral</button>
        </div>
        <div class="art-editor-fit">
          <label>Encaixe<select id="artEditorFit"><option value="contain">Conter</option><option value="cover">Preencher</option></select></label>
          <label>Versão<span id="artEditorVersion" class="art-editor-version" style="display:block;padding-top:11px">Ajuste atual</span></label>
        </div>
        ${CONTROL_GROUPS.map((group, index) => `<details class="art-editor-group" ${index < 2 ? 'open' : ''}><summary>${group.title}</summary>${group.controls.map(controlMarkup).join('')}</details>`).join('')}
        <div id="artEditorMeta" class="art-editor-meta"></div>
      </div>
    </div>
    <div class="art-editor-foot">
      <button id="artEditorSaveVersion" type="button">Salvar versão ajustada</button>
      <div style="display:flex;gap:8px;margin-left:auto"><button id="artEditorRevert" type="button">Voltar ao original</button><button id="artEditorApply" type="button" class="primary">Aplicar ao mockup</button></div>
    </div>
  </div>`;
  document.body.appendChild(backdrop);

  $('artEditorClose')?.addEventListener('click', closeEditor);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeEditor(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !backdrop.classList.contains('hidden')) closeEditor(); });
  $('artEditorAsset')?.addEventListener('change', (event) => {
    activeIndex = Number(event.target.value) || 0;
    syncImages();
  });
  $('artEditorFit')?.addEventListener('change', (event) => {
    draft = normalizeArtworkAdjustments({ ...draft, fit: event.target.value });
    refreshPreview();
  });
  CONTROL_GROUPS.flatMap((group) => group.controls).forEach(([key]) => {
    $(`artEditor-${key}`)?.addEventListener('input', (event) => {
      draft = normalizeArtworkAdjustments({ ...draft, [key]: Number(event.target.value) });
      refreshPreview();
    });
  });
  backdrop.querySelectorAll('[data-reset-control]').forEach((button) => button.addEventListener('click', () => {
    const defaults = defaultArtworkAdjustments();
    const key = button.dataset.resetControl;
    draft = normalizeArtworkAdjustments({ ...draft, [key]: defaults[key] });
    refreshPreview();
  }));
  $('artEditorResetAll')?.addEventListener('click', () => {
    draft = defaultArtworkAdjustments();
    refreshPreview();
  });
  $('artEditorRevert')?.addEventListener('click', () => {
    const key = currentKey();
    if (!key) return;
    draft = resetArtworkAdjustments(key);
    refreshPreview();
    dispatchAdjustment('reset');
  });
  $('artEditorSaveVersion')?.addEventListener('click', () => {
    const key = currentKey();
    if (!key) return;
    const list = versions.get(key) || [];
    list.push(Object.freeze({ ...normalizeArtworkAdjustments(draft) }));
    versions.set(key, list);
    $('artEditorVersion').textContent = `Versão ${list.length}`;
    refreshPreview();
  });
  $('artEditorApply')?.addEventListener('click', () => {
    const key = currentKey();
    if (!key) return;
    draft = setArtworkAdjustments(key, draft);
    dispatchAdjustment('apply');
    closeEditor();
  });
}

function dispatchAdjustment(reason) {
  const file = currentFile();
  const key = currentKey();
  if (!file || !key) return;
  document.dispatchEvent(new CustomEvent('mockup:artwork-adjusted', {
    detail: {
      reason,
      index: activeIndex,
      key,
      name: file.name,
      adjustments: artworkAdjustmentSnapshot(key),
    },
  }));
}

function openEditor(index = 0) {
  if (!files().length) return;
  buildDialog();
  activeIndex = Math.max(0, Math.min(files().length - 1, Number(index) || 0));
  $('artworkEditorBackdrop')?.classList.remove('hidden');
  syncImages();
  $('artEditorAsset')?.focus();
}

function closeEditor() {
  $('artworkEditorBackdrop')?.classList.add('hidden');
}

function installLauncher() {
  const assetList = $('assetList');
  if (!assetList || $('artworkEditorLaunch')) return false;
  const button = document.createElement('button');
  button.id = 'artworkEditorLaunch';
  button.className = 'secondary art-editor-launch';
  button.type = 'button';
  button.textContent = 'Editar arte / rótulo';
  button.disabled = files().length === 0;
  assetList.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => openEditor(0));
  $('brandFiles')?.addEventListener('change', () => {
    button.disabled = files().length === 0;
    if (!files().length) closeEditor();
  });
  document.addEventListener('mockup:open-artwork-editor', (event) => openEditor(event.detail?.index || 0));
  return true;
}

function boot() {
  injectStyles();
  if (!installLauncher()) setTimeout(boot, 120);
}

boot();

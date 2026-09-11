import {
  approveScene,
  autoApplyMessage,
  createFlowState,
  markAutoApplied,
  reopenScene,
  setArtworkCount,
  setFineTuneOpen,
} from './src/studio-flow.js';

const $ = (id) => document.getElementById(id);
const cards = [...document.querySelectorAll('section.card')];
const [briefCard, artsCard, areasCard, adjustmentsCard, finalizeCard] = cards;
let flow = createFlowState();
let autoApplyTimer = null;
let autoApplying = false;

function addFlowStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .flow-box{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:7px;background:#0d1214;display:grid;gap:8px}
    .flow-box strong{font-size:12px}.flow-box p{margin:0;color:var(--dim);font-size:11px;line-height:1.45}
    .flow-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.flow-actions.one{grid-template-columns:1fr}
    .scene-approved{border-color:#245f48!important;background:#102019!important}.scene-approved strong{color:#8ce0bb}
    .auto-status{font-size:11px;color:var(--dim);line-height:1.45}.auto-status.ok{color:#8ce0bb}.auto-status.warn{color:#e8c568}
    .fine-tune-note{padding:8px 9px;border:1px dashed var(--line);border-radius:6px;color:var(--dim);font-size:10.5px;line-height:1.45}
    .scene-locked #mockupPrompt,.scene-locked #sceneStyle,.scene-locked #desiredSlots,.scene-locked #surfaceHint,.scene-locked label[for=productRefs],.scene-locked label[for=sceneRefs]{opacity:.55;pointer-events:none}
    @media(max-width:520px){.flow-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function providerLabel(provider) {
  if (provider === 'cloudflare') return 'Cloudflare Workers AI';
  if (provider === 'openai') return 'OpenAI';
  return 'gerador';
}

function sceneIsReady() {
  return Boolean($('empty')?.classList.contains('hidden'));
}

function artworkCount() {
  const text = $('assetCount')?.textContent || '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function slotCount() {
  return document.querySelectorAll('#slotsList .slot-card').length;
}

function setGuidesVisible(visible) {
  const button = $('toggleGuides');
  if (!button || !sceneIsReady()) return;
  const guidesVisible = /ocultar/i.test(button.textContent || '');
  if (visible !== guidesVisible) button.click();
}

function setSceneLocked(locked) {
  briefCard?.classList.toggle('scene-locked', locked);
  for (const id of ['generateBtn', 'iterateBtn']) {
    const el = $(id);
    if (el) el.disabled = locked;
  }
  const versions = $('versions');
  if (versions) {
    versions.style.pointerEvents = locked ? 'none' : '';
    versions.style.opacity = locked ? '.7' : '';
  }
}

function ensureFlowControls() {
  if (!$('sceneApprovalBox')) {
    const box = document.createElement('div');
    box.id = 'sceneApprovalBox';
    box.className = 'flow-box hidden';
    box.innerHTML = `
      <strong>Gostou da cena?</strong>
      <p id="sceneApprovalText">Itere até chegar ao mockup vazio ideal. Quando aprovar, a cena fica travada e você envia as artes.</p>
      <div class="flow-actions">
        <button id="approveSceneBtn" class="primary">Aprovar mockup</button>
        <button id="reopenSceneBtn" class="secondary hidden">Alterar cena</button>
      </div>`;
    const anchor = $('iterationBox') || $('versions');
    anchor?.insertAdjacentElement('afterend', box);
  }

  if (!$('autoApplyFlow')) {
    const box = document.createElement('div');
    box.id = 'autoApplyFlow';
    box.className = 'flow-box';
    box.innerHTML = `
      <strong>Aplicação automática</strong>
      <p>Envie uma ou várias artes. O detector encontra as áreas e o motor aplica os arquivos originais preservando perspectiva, luz e qualidade.</p>
      <button id="autoApplyFlowBtn" class="primary">Aplicar artes automaticamente</button>
      <div id="autoApplyFlowStatus" class="auto-status">Aguardando artes.</div>
      <button id="fineTuneFlowBtn" class="secondary hidden">Ajustes finos opcionais</button>
      <div class="fine-tune-note">A edição manual é opcional. Use apenas se quiser corrigir uma área, trocar a arte de um espaço ou refinar os quatro cantos.</div>`;
    artsCard?.querySelector('.card-body')?.appendChild(box);
  }
}

function setProgressActive(step) {
  for (let i = 1; i <= 4; i += 1) {
    $('progress' + i)?.classList.toggle('active', i === step);
  }
}

function renderFlow() {
  const ready = sceneIsReady();
  flow = createFlowState({ ...flow, sceneReady: ready, artworkCount: artworkCount() });

  const approvalBox = $('sceneApprovalBox');
  approvalBox?.classList.toggle('hidden', !ready);
  approvalBox?.classList.toggle('scene-approved', flow.sceneApproved);
  $('approveSceneBtn')?.classList.toggle('hidden', flow.sceneApproved);
  $('reopenSceneBtn')?.classList.toggle('hidden', !flow.sceneApproved);

  const approvalText = $('sceneApprovalText');
  if (approvalText) {
    approvalText.textContent = flow.sceneApproved
      ? 'Cena aprovada. Agora envie as artes; o Mockup Vision fará a primeira aplicação automaticamente.'
      : 'Itere até chegar ao mockup vazio ideal. Quando aprovar, a cena fica travada e você envia as artes.';
  }

  artsCard?.classList.toggle('hidden', !flow.sceneApproved);
  areasCard?.classList.toggle('hidden', !flow.fineTuneOpen);
  adjustmentsCard?.classList.toggle('hidden', !flow.fineTuneOpen);
  finalizeCard?.classList.toggle('hidden', !flow.autoApplied);

  setSceneLocked(flow.sceneApproved);
  if (!flow.fineTuneOpen) setGuidesVisible(false);

  const fineTune = $('fineTuneFlowBtn');
  if (fineTune) {
    fineTune.classList.toggle('hidden', !flow.autoApplied);
    fineTune.textContent = flow.fineTuneOpen ? 'Fechar ajustes finos' : 'Ajustes finos opcionais';
  }

  const step = !ready ? 1 : !flow.sceneApproved ? 2 : !flow.artworkCount ? 3 : 4;
  setProgressActive(step);
}

async function checkGenerator() {
  const status = $('generateStatus');
  if (!status) return;
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('health unavailable');
    const health = await response.json();
    if (health.generatorConfigured) {
      if (!sceneIsReady()) {
        status.textContent = `${providerLabel(health.provider)} conectado. Escreva o pedido e clique em “Gerar imagem”.`;
        status.className = 'status ok';
      }
      $('fallbackBox')?.classList.add('hidden');
    } else {
      status.textContent = 'Gerador não configurado. Para o modo gratuito, adicione CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN aos Codespaces Secrets.';
      status.className = 'status warn';
    }
  } catch {
    status.textContent = 'Abra o Studio com “npm start” para habilitar a geração integrada.';
    status.className = 'status warn';
  }
}

function waitForDetection(timeoutMs = 15000) {
  const status = $('status');
  return new Promise((resolve) => {
    const started = Date.now();
    let sawLoading = false;
    const tick = () => {
      const text = (status?.textContent || '').toLowerCase();
      if (/carregando|detec|modelo|gpu|cpu/.test(text)) sawLoading = true;
      const finished = sawLoading && !/carregando|tentando|inicializando/.test(text);
      if (finished || Date.now() - started > timeoutMs) return resolve();
      setTimeout(tick, 180);
    };
    tick();
  });
}

async function autoApply() {
  if (autoApplying) return;
  const count = artworkCount();
  flow = setArtworkCount(flow, count);
  if (!flow.sceneApproved) return;

  const status = $('autoApplyFlowStatus');
  if (!count) {
    if (status) {
      status.textContent = 'Envie pelo menos uma arte.';
      status.className = 'auto-status warn';
    }
    renderFlow();
    return;
  }

  autoApplying = true;
  const button = $('autoApplyFlowBtn');
  if (button) button.disabled = true;
  if (status) {
    status.textContent = 'Detectando áreas e aplicando as artes…';
    status.className = 'auto-status';
  }

  try {
    $('detectAreasBtn')?.click();
    await waitForDetection();
    $('autoAssignBtn')?.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    flow = markAutoApplied(setArtworkCount(flow, count));
    setGuidesVisible(false);
    const message = autoApplyMessage(count, slotCount());
    if (status) {
      status.textContent = `Pronto. ${message} Revise o resultado no canvas; ajustes manuais são opcionais.`;
      status.className = 'auto-status ok';
    }
  } catch (error) {
    console.warn(error);
    if (status) {
      status.textContent = 'A aplicação automática encontrou um problema. Você pode abrir os ajustes finos e continuar manualmente.';
      status.className = 'auto-status warn';
    }
    flow = markAutoApplied(setArtworkCount(flow, count));
  } finally {
    autoApplying = false;
    if (button) button.disabled = false;
    renderFlow();
  }
}

function scheduleAutoApply() {
  clearTimeout(autoApplyTimer);
  autoApplyTimer = setTimeout(() => {
    if (flow.sceneApproved && artworkCount() > 0) autoApply();
  }, 350);
}

addFlowStyles();
ensureFlowControls();
renderFlow();
checkGenerator();

$('approveSceneBtn')?.addEventListener('click', () => {
  flow = approveScene({ ...flow, sceneReady: sceneIsReady(), artworkCount: artworkCount() });
  if (!flow.sceneApproved) return;
  setGuidesVisible(false);
  renderFlow();
  if (flow.artworkCount) scheduleAutoApply();
});

$('reopenSceneBtn')?.addEventListener('click', () => {
  flow = reopenScene(flow);
  setSceneLocked(false);
  renderFlow();
  $('iterationPrompt')?.focus();
});

$('autoApplyFlowBtn')?.addEventListener('click', autoApply);
$('fineTuneFlowBtn')?.addEventListener('click', () => {
  flow = setFineTuneOpen(flow, !flow.fineTuneOpen);
  renderFlow();
  setGuidesVisible(flow.fineTuneOpen);
});

for (const id of ['generateBtn', 'iterateBtn']) {
  $(id)?.addEventListener('click', () => {
    if (flow.sceneApproved) flow = reopenScene(flow);
    renderFlow();
  });
}

const empty = $('empty');
if (empty) {
  new MutationObserver(() => {
    if (!sceneIsReady()) flow = reopenScene({ ...flow, sceneReady: false });
    renderFlow();
  }).observe(empty, { attributes: true, attributeFilter: ['class'] });
}

const assetCountEl = $('assetCount');
if (assetCountEl) {
  new MutationObserver(() => {
    const count = artworkCount();
    flow = setArtworkCount(flow, count);
    renderFlow();
    if (flow.sceneApproved && count > 0) scheduleAutoApply();
  }).observe(assetCountEl, { childList: true, characterData: true, subtree: true });
}

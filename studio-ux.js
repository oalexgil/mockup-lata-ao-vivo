import {
  approveScene,
  createFlowState,
  markAiFinalized,
  markMappingReady,
  reopenScene,
  setArtworkCount,
} from './src/studio-flow.js';

const $ = (id) => document.getElementById(id);
const cards = [...document.querySelectorAll('section.card')];
const [briefCard, artsCard, areasCard, adjustmentsCard, finalizeCard] = cards;
let flow = createFlowState();

function addFlowStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .flow-box{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:7px;background:#0d1214;display:grid;gap:8px}
    .flow-box strong{font-size:12px}.flow-box p{margin:0;color:var(--dim);font-size:11px;line-height:1.45}
    .flow-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .scene-approved{border-color:#245f48!important;background:#102019!important}.scene-approved strong{color:#8ce0bb}
    .auto-status{font-size:11px;color:var(--dim);line-height:1.45}.auto-status.ok{color:#8ce0bb}.auto-status.warn{color:#e8c568}
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
  return $('empty')?.classList.contains('hidden') || false;
}

function artworkCount() {
  const text = $('assetCount')?.textContent || '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
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
      <p id="sceneApprovalText">Itere até chegar ao mockup vazio ideal. Depois aprove a cena para travá-la e enviar as artes.</p>
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
      <strong>Mapear artes no mockup</strong>
      <p>A IA identifica superfícies utilizáveis sem assumir um tipo específico de objeto. Se houver várias artes, as áreas ficam numeradas e correspondentes.</p>
      <button id="autoApplyFlowBtn" class="primary">Identificar áreas e mapear artes</button>
      <div id="autoApplyFlowStatus" class="auto-status">Envie suas artes para começar.</div>`;
    artsCard?.querySelector('.card-body')?.appendChild(box);
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
  if ($('sceneApprovalText')) {
    $('sceneApprovalText').textContent = flow.sceneApproved
      ? 'Cena aprovada e travada. Agora envie uma ou várias artes.'
      : 'Itere até chegar ao mockup vazio ideal. Depois aprove a cena para travá-la e enviar as artes.';
  }

  artsCard?.classList.toggle('hidden', !flow.sceneApproved);
  areasCard?.classList.add('hidden');
  adjustmentsCard?.classList.add('hidden');
  finalizeCard?.classList.toggle('hidden', !flow.aiFinalized);
  setSceneLocked(flow.sceneApproved);

  for (let i = 1; i <= 4; i += 1) $('progress' + i)?.classList.remove('active');
  if (!ready) $('progress1')?.classList.add('active');
  else if (!flow.sceneApproved) $('progress2')?.classList.add('active');
  else if (!flow.artworkCount) $('progress3')?.classList.add('active');
  else $('progress4')?.classList.add('active');
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

addFlowStyles();
ensureFlowControls();
renderFlow();
checkGenerator();

$('approveSceneBtn')?.addEventListener('click', () => {
  flow = approveScene({ ...flow, sceneReady: sceneIsReady(), artworkCount: artworkCount() });
  renderFlow();
});

$('reopenSceneBtn')?.addEventListener('click', () => {
  flow = reopenScene(flow);
  renderFlow();
  $('iterationPrompt')?.focus();
});

for (const id of ['generateBtn', 'iterateBtn']) {
  $(id)?.addEventListener('click', () => {
    if (flow.sceneApproved) flow = reopenScene(flow);
    renderFlow();
  });
}

const empty = $('empty');
if (empty) new MutationObserver(renderFlow).observe(empty, { attributes: true, attributeFilter: ['class'] });

const assetCountEl = $('assetCount');
if (assetCountEl) {
  new MutationObserver(() => {
    flow = setArtworkCount(flow, artworkCount());
    renderFlow();
  }).observe(assetCountEl, { childList: true, characterData: true, subtree: true });
}

document.addEventListener('mockup:mapping-ready', () => {
  flow = markMappingReady({ ...flow, artworkCount: artworkCount() }, true);
  renderFlow();
});

document.addEventListener('mockup:ai-finalized', () => {
  flow = markAiFinalized(flow);
  renderFlow();
});

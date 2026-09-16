const $ = (id) => document.getElementById(id);

function cardFor(id) {
  return $(id)?.closest('section.card') || null;
}

function addWorkspaceStyles() {
  if ($('mockupVisionWorkspaceStyles')) return;
  const style = document.createElement('style');
  style.id = 'mockupVisionWorkspaceStyles';
  style.textContent = `
    body.mv-workspace .progress{display:none!important}
    .workspace-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:2px 0 16px;padding:5px;border:1px solid rgba(83,118,145,.28);border-radius:13px;background:rgba(5,13,22,.46)}
    .workspace-step{min-width:0;padding:8px 6px;border-radius:9px;color:#7f95a8;font:10px var(--mono);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .16s ease,color .16s ease,box-shadow .16s ease}
    .workspace-step.done{color:#82d5b1}.workspace-step.active{color:#c4f5ef;background:rgba(91,211,199,.11);box-shadow:inset 0 0 0 1px rgba(91,211,199,.25)}
    .workspace-step-index{display:inline-grid;place-items:center;width:17px;height:17px;margin-right:4px;border-radius:50%;background:rgba(126,155,179,.1);font-size:8px}.workspace-step.active .workspace-step-index{background:rgba(91,211,199,.18)}
    .workspace-stagebar{position:absolute;z-index:10;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;pointer-events:none}
    .workspace-stagebar-group{display:flex;align-items:center;gap:7px;min-width:0}.workspace-pill{display:flex;align-items:center;gap:6px;max-width:min(310px,45vw);padding:6px 9px;border:1px solid rgba(85,119,145,.3);border-radius:999px;background:rgba(6,14,23,.78);backdrop-filter:blur(12px);color:#91a7b9;font:9.5px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 22px rgba(0,0,0,.16)}
    .workspace-pill-dot{width:7px;height:7px;border-radius:50%;background:#72889b;box-shadow:0 0 0 3px rgba(114,136,155,.08);flex:none}.workspace-pill.ok .workspace-pill-dot{background:#65d8a9;box-shadow:0 0 0 3px rgba(101,216,169,.09)}.workspace-pill.warn .workspace-pill-dot{background:#efbb6b;box-shadow:0 0 0 3px rgba(239,187,107,.09)}
    body.mv-workspace .stage{padding-top:54px!important}
    body.mv-workspace section.card{transition:border-color .16s ease,box-shadow .16s ease}
    body.mv-workspace section.card:not(.hidden):focus-within{border-color:rgba(91,211,199,.38)!important;box-shadow:0 12px 38px rgba(0,0,0,.16),0 0 0 1px rgba(91,211,199,.06)!important}
    body.mv-workspace .card-head{position:relative}.workspace-section-tag{margin-left:auto;color:#6f879a;font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em}
    .workspace-advanced{margin-top:12px;border-top:1px solid rgba(76,105,129,.25);padding-top:10px}.workspace-advanced>summary{cursor:pointer;color:#9eb1c0;font-size:11px;font-weight:600;list-style:none;display:flex;justify-content:space-between;align-items:center}.workspace-advanced>summary::-webkit-details-marker{display:none}.workspace-advanced>summary::after{content:'+';font:14px var(--mono);color:#6f899c}.workspace-advanced[open]>summary::after{content:'−'}.workspace-advanced-content{padding-top:2px}
    body.mv-workspace button,body.mv-workspace .filebtn{min-height:39px}body.mv-workspace button:focus-visible,body.mv-workspace .filebtn:focus-visible,body.mv-workspace textarea:focus-visible,body.mv-workspace input:focus-visible,body.mv-workspace select:focus-visible,body.mv-workspace summary:focus-visible{outline:2px solid #74ddd4!important;outline-offset:2px!important}
    body.mv-workspace button:disabled{cursor:not-allowed;filter:saturate(.55)}
    body.mv-workspace .technical-copy{display:none!important}
    .workspace-original-note{display:flex;align-items:flex-start;gap:7px;margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(101,216,169,.055);border:1px solid rgba(101,216,169,.14);color:#8db7a7;font-size:10.5px;line-height:1.45}.workspace-original-note strong{color:#9ee4c8}
    @media(max-width:900px){.workspace-stagebar{top:9px;left:9px;right:9px}.workspace-stagebar .workspace-pill.secondary-pill{display:none}body.mv-workspace .stage{padding-top:48px!important}.workspace-nav{position:sticky;top:0;z-index:20;background:rgba(10,20,32,.95);backdrop-filter:blur(10px)}}
    @media(max-width:520px){.workspace-step{font-size:9px;padding:7px 3px}.workspace-step-index{display:none}.workspace-pill{max-width:72vw}}
  `;
  document.head.appendChild(style);
}

function labelCard(card, title, tag) {
  if (!card) return;
  const heading = card.querySelector('.card-head strong');
  if (heading) heading.textContent = title;
  const head = card.querySelector('.card-head');
  if (head && !head.querySelector('.workspace-section-tag')) {
    const meta = document.createElement('span');
    meta.className = 'workspace-section-tag';
    meta.textContent = tag;
    head.appendChild(meta);
  }
}

function ensureNavigation() {
  if ($('workspaceNav')) return;
  const nav = document.createElement('div');
  nav.id = 'workspaceNav';
  nav.className = 'workspace-nav';
  nav.setAttribute('aria-label', 'Etapas do trabalho');
  nav.innerHTML = [
    ['Criar', 'Cena e referências'],
    ['Aplicar', 'Artes e superfícies'],
    ['Ajustar', 'Encaixe e acabamento'],
    ['Finalizar', 'Revisão e exportação'],
  ].map(([name, title], index) => `<div class="workspace-step" data-workspace-step="${index}" title="${title}"><span class="workspace-step-index">${index + 1}</span>${name}</div>`).join('');
  const confidence = document.querySelector('.studio-confidence');
  const sub = document.querySelector('.sub');
  (confidence || sub)?.insertAdjacentElement('afterend', nav);
}

function ensureStageBar() {
  const stage = document.querySelector('.stage');
  if (!stage || $('workspaceStagebar')) return;
  const bar = document.createElement('div');
  bar.id = 'workspaceStagebar';
  bar.className = 'workspace-stagebar';
  bar.innerHTML = `
    <div class="workspace-stagebar-group"><div id="workspaceProvider" class="workspace-pill"><span class="workspace-pill-dot"></span><span>Verificando renderização…</span></div></div>
    <div class="workspace-stagebar-group"><div id="workspaceSession" class="workspace-pill secondary-pill ok"><span class="workspace-pill-dot"></span><span>Original preservado</span></div></div>`;
  stage.appendChild(bar);
}

function wrapAdvancedAdjustments() {
  const card = $('adjustments');
  const body = card?.querySelector('.card-body');
  if (!body || body.dataset.workspaceWrapped === 'true') return;
  body.dataset.workspaceWrapped = 'true';

  const advancedIds = ['sOpacity', 'sCleanup', 'sLight', 'sBrightness', 'sContrast', 'sSaturation'];
  const nodes = advancedIds
    .map((id) => $(id)?.closest('label.range'))
    .filter(Boolean);
  const blend = $('blendMode');
  const blendCaption = blend?.previousElementSibling?.matches('label.caption') ? blend.previousElementSibling : null;
  if (!nodes.length && !blend) return;

  const details = document.createElement('details');
  details.className = 'workspace-advanced';
  details.innerHTML = '<summary>Integração e aparência</summary><div class="workspace-advanced-content"></div>';
  const content = details.querySelector('.workspace-advanced-content');
  nodes.forEach((node) => content.appendChild(node));
  if (blendCaption) content.appendChild(blendCaption);
  if (blend) content.appendChild(blend);
  body.appendChild(details);
}

function ensureOriginalNote() {
  const arts = cardFor('brandFiles');
  const body = arts?.querySelector('.card-body');
  if (!body || body.querySelector('.workspace-original-note')) return;
  const note = document.createElement('div');
  note.className = 'workspace-original-note';
  note.innerHTML = '<span>✓</span><span><strong>Arquivo original preservado.</strong> Ajustes e encaixes são aplicados como versões derivadas; você pode voltar ao original.</span>';
  const assets = $('assetList');
  assets?.insertAdjacentElement('afterend', note);
}

function polishLanguage() {
  const labels = {
    generateBtn: 'Gerar cena',
    iterateBtn: 'Criar nova versão',
    approveSceneBtn: 'Usar esta cena',
    reopenSceneBtn: 'Editar cena',
    detectAreasBtn: 'Localizar superfícies',
    addAreaBtn: '+ Marcar superfície',
    autoAssignBtn: 'Distribuir artes',
    advancedMappingBtn: 'Revisar superfícies',
    finalizeAiBtn: 'Refinar acabamento',
  };
  for (const [id, label] of Object.entries(labels)) {
    const element = $(id);
    if (element && element.textContent !== label) element.textContent = label;
  }

  const flowTitle = $('autoApplyFlow')?.querySelector('strong');
  if (flowTitle) flowTitle.textContent = 'Aplicar no mockup';
  const flowCopy = $('autoApplyFlow')?.querySelector('p');
  if (flowCopy) flowCopy.textContent = 'Escolha a aplicação e revise a superfície antes do acabamento final. Em composições complexas, o modo assistido oferece controle de quatro cantos.';

  const instruction = $('mockupApplyInstruction');
  if (instruction) instruction.setAttribute('aria-label', 'Orientação de aplicação da arte');

  const tooltips = {
    detectAreasBtn: 'Sugere superfícies utilizáveis na cena.',
    addAreaBtn: 'Cria uma superfície para ajuste manual pelos quatro cantos.',
    autoAssignBtn: 'Distribui as artes carregadas entre as superfícies disponíveis.',
    advancedMappingBtn: 'Abre o fluxo de maior controle e fidelidade geométrica.',
    finalizeAiBtn: 'Ajusta luz, material e integração sem substituir a arte original.',
    toggleGuides: 'Mostra ou oculta as guias de superfície.',
  };
  for (const [id, title] of Object.entries(tooltips)) if ($(id)) $(id).title = title;

  for (const id of ['generateStatus', 'autoApplyFlowStatus', 'guidedWorkflowStatus', 'status']) {
    $(id)?.setAttribute('aria-live', 'polite');
  }
}

function sceneReady() {
  return Boolean($('empty')?.classList.contains('hidden'));
}

function uploadedCount() {
  return $('brandFiles')?.files?.length || 0;
}

function currentWorkspaceStep() {
  const arts = cardFor('brandFiles');
  const finalize = cardFor('saveBtn');
  if (!sceneReady() || arts?.classList.contains('hidden')) return 0;
  if (!uploadedCount()) return 1;
  if (finalize?.classList.contains('hidden')) return 2;
  return 3;
}

function updateNavigation() {
  const current = currentWorkspaceStep();
  document.querySelectorAll('[data-workspace-step]').forEach((item) => {
    const index = Number(item.dataset.workspaceStep);
    item.classList.toggle('active', index === current);
    item.classList.toggle('done', index < current);
    item.setAttribute('aria-current', index === current ? 'step' : 'false');
  });
}

async function updateProviderStatus() {
  const pill = $('workspaceProvider');
  if (!pill) return;
  const label = pill.querySelector('span:last-child');
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('health');
    const health = await response.json();
    pill.classList.remove('ok', 'warn');
    if (health.provider === 'cloudflare' && health.generatorConfigured) {
      pill.classList.add('ok');
      label.textContent = 'Cloudflare · conectado';
    } else if (health.generatorConfigured) {
      pill.classList.add('ok');
      label.textContent = 'Renderização · conectada';
    } else {
      pill.classList.add('warn');
      label.textContent = 'Renderização · configuração necessária';
    }
  } catch {
    pill.classList.add('warn');
    label.textContent = 'Servidor local necessário';
  }
}

function trackSessionState() {
  const session = $('workspaceSession');
  const label = session?.querySelector('span:last-child');
  if (!session || !label || document.body.dataset.workspaceTracked === 'true') return;
  document.body.dataset.workspaceTracked = 'true';
  const changed = () => {
    session.classList.remove('ok');
    label.textContent = 'Sessão em edição';
  };
  document.querySelector('.rail')?.addEventListener('input', changed, true);
  document.querySelector('.rail')?.addEventListener('change', changed, true);
  document.addEventListener('mockup:direct-rendered', changed);
  document.addEventListener('mockup:ai-finalized', changed);
  $('saveBtn')?.addEventListener('click', () => {
    session.classList.add('ok');
    label.textContent = 'Exportação preparada';
  });
}

function configureWorkspace() {
  document.body.classList.add('mv-workspace');
  labelCard(cardFor('mockupPrompt'), 'Criar cena', 'Criar');
  labelCard(cardFor('brandFiles'), 'Aplicar artes', 'Aplicar');
  labelCard(cardFor('detectAreasBtn'), 'Superfícies', 'Aplicar');
  labelCard($('adjustments'), 'Ajustar superfície', 'Ajustar');
  labelCard(cardFor('saveBtn'), 'Finalizar', 'Finalizar');
  ensureNavigation();
  ensureStageBar();
  wrapAdvancedAdjustments();
  ensureOriginalNote();
  polishLanguage();
  updateNavigation();
  trackSessionState();
}

function boot() {
  addWorkspaceStyles();
  configureWorkspace();
  updateProviderStatus();

  const rail = document.querySelector('.rail');
  if (rail && rail.dataset.workspaceObserved !== 'true') {
    rail.dataset.workspaceObserved = 'true';
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        configureWorkspace();
      });
    }).observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  const empty = $('empty');
  if (empty) new MutationObserver(updateNavigation).observe(empty, { attributes: true, attributeFilter: ['class'] });
  $('brandFiles')?.addEventListener('change', () => setTimeout(updateNavigation, 0));
  document.addEventListener('mockup:mapping-ready', updateNavigation);
  document.addEventListener('mockup:ai-finalized', updateNavigation);
}

boot();

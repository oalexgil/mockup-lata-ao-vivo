const $ = (id) => document.getElementById(id);

const nativeFetch = window.fetch.bind(window);
let freshSessionPending = false;
let hiddenVersionCount = 0;
let versionObserver = null;

function fidelitySettings() {
  return {
    fidelityMode: $('mockupFidelityMode')?.value || 'exact',
    preserveAspectRatio: $('preserveAspectRatio')?.checked !== false,
    limitDeformation: $('limitDeformation')?.checked !== false,
    safeMargins: $('safeMargins')?.checked !== false,
  };
}

// Enrich direct-render requests with fidelity controls and make the first
// generation after "Novo mockup" independent from any previous version.
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  let isFreshGeneration = false;

  if (url.includes('/api/render-mockup') && typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      init = {
        ...init,
        body: JSON.stringify({ ...body, ...fidelitySettings() }),
      };
    } catch {
      // Preserve the original request if a future caller uses another body format.
    }
  }

  if (freshSessionPending && url.includes('/api/generate-scene') && typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      init = {
        ...init,
        body: JSON.stringify({ ...body, previousImage: null, iteration: '' }),
      };
      isFreshGeneration = true;
    } catch {
      // The normal generator validation will handle an unexpected body format.
    }
  }

  const response = await nativeFetch(input, init);
  if (isFreshGeneration && response.ok) freshSessionPending = false;
  return response;
};

function addStudioStyles() {
  if ($('mockupVisionEnhancementStyles')) return;
  const style = document.createElement('style');
  style.id = 'mockupVisionEnhancementStyles';
  style.textContent = `
    :root{
      --bg:#070a0f;--panel:#0e141c;--panel2:#151e29;--line:#263546;
      --ink:#f3f8fb;--dim:#8ea1b5;--accent:#63e6f2;--accent2:#7c8cff;
      --ok:#57d9a3;--warn:#f4bd62;--danger:#ff7d88;
    }
    body{background:radial-gradient(circle at 70% 10%,#111d28 0,#070a0f 42%,#05070a 100%)}
    .app{grid-template-columns:410px minmax(0,1fr)}
    .rail{padding:18px 18px 40px;background:linear-gradient(180deg,#101721 0%,#0b1017 100%);box-shadow:18px 0 42px rgba(0,0,0,.22)}
    .stage{background:radial-gradient(circle at 50% 42%,#111820 0%,#080b0f 60%,#05070a 100%);padding:34px}
    .brand h1{font-size:23px;letter-spacing:-.5px;background:linear-gradient(90deg,var(--ink),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
    .sub{margin-top:6px;color:#9aadc0}
    .progress{gap:7px;margin:16px 0 20px}.progress div{border-radius:999px;padding:8px 6px;background:#0b1118}.progress .active{background:#10232b;border-color:#376d79;color:#8cebf3}.progress .done{background:#102019}
    section.card{border-color:#223142;border-radius:14px;background:linear-gradient(180deg,rgba(20,29,39,.96),rgba(13,19,27,.96));box-shadow:0 10px 28px rgba(0,0,0,.16);margin-bottom:14px}
    .card-head{padding:14px 15px;border-bottom-color:#223142}.card-head strong{font-size:13.5px}.num{width:26px;height:26px;background:#102b35;border:1px solid #214e5c}
    .card-body{padding:14px 15px}
    textarea,input[type=text],select,button,.filebtn{border-radius:9px;border-color:#2c3b4d;background:#16202b;transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease,background .16s ease}
    textarea:focus,input[type=text]:focus,select:focus{outline:none;border-color:#4fc4d4;box-shadow:0 0 0 3px rgba(99,230,242,.10)}
    button:hover,.filebtn:hover{border-color:#527087;background:#1a2734}button:active{transform:translateY(1px)}
    .primary{border:0;background:linear-gradient(135deg,var(--accent),#59c6ff);color:#06141a;box-shadow:0 8px 22px rgba(73,205,231,.18);min-height:42px}
    .primary:hover{background:linear-gradient(135deg,#80edf5,#69d1ff);box-shadow:0 10px 28px rgba(73,205,231,.26)}
    .secondary{background:#15202b}.filebtn{border-style:dashed;color:#c8d6e2;padding:11px}.hint{color:#91a5b8}.tiny{color:#869bae}
    .status,.flow-box{border-radius:10px!important;background:#0d151e!important;border-color:#253648!important}
    .flow-box{padding:12px!important;gap:10px!important}.flow-box strong{font-size:13px!important}.flow-box p{color:#91a5b8!important}
    .scene-approved{background:linear-gradient(180deg,#10251e,#0e1d19)!important;border-color:#285b48!important}
    #display{border-radius:10px;box-shadow:0 34px 90px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.04)}
    .canvas-hint{border-radius:8px;background:rgba(8,12,17,.86);backdrop-filter:blur(8px)}
    .studio-quickbar{display:flex;align-items:center;gap:8px;margin:12px 0 4px}
    .new-mockup-btn{display:flex;align-items:center;justify-content:center;gap:7px;background:#121d28;border:1px solid #31475d;color:#dce8f1;font-weight:700;min-height:39px}
    .new-mockup-btn:hover{border-color:#6d8198;background:#192736}
    .fidelity-panel{display:grid;gap:9px;padding:11px;border:1px solid #2b4053;border-radius:10px;background:linear-gradient(180deg,#111c27,#0e1720);margin:2px 0 8px}
    .fidelity-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11.5px;font-weight:700;color:#dfeaf2}
    .fidelity-badge{font:9px var(--mono);padding:4px 7px;border-radius:999px;background:#123129;color:#78e4b4;border:1px solid #245944}
    .fidelity-panel select{min-height:39px}
    .fidelity-checks{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .fidelity-check{display:flex;gap:7px;align-items:flex-start;padding:8px;border:1px solid #263849;border-radius:8px;background:#0c141c;color:#a9bac8;font-size:10.5px;line-height:1.3;cursor:pointer}
    .fidelity-check input{margin:1px 0 0;accent-color:var(--accent)}
    .fidelity-description{font-size:10.5px;line-height:1.45;color:#8fa3b5}
    #mockupApplyInstruction{min-height:74px!important;margin:4px 0 8px!important}
    #advancedMappingBtn{border-style:dashed!important;color:#b9c8d4!important}
    .auto-status.ok{color:#72deb1!important}.auto-status.warn{color:#f1c572!important}
    .reset-flash{animation:resetPulse .42s ease}@keyframes resetPulse{0%{opacity:.55}100%{opacity:1}}
    *{scrollbar-width:thin;scrollbar-color:#34495e transparent}
    @media(max-width:900px){.app{grid-template-columns:1fr}.rail{box-shadow:none}.stage{padding:18px}.fidelity-checks{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function clearFileInput(id) {
  const input = $(id);
  if (!input) return;
  input.value = '';
}

function watchVersionHistory() {
  const versions = $('versions');
  if (!versions || versionObserver) return;
  const hidePreviousSessionVersions = () => {
    [...versions.children].forEach((child, index) => {
      child.style.display = index < hiddenVersionCount ? 'none' : '';
    });
  };
  versionObserver = new MutationObserver(hidePreviousSessionVersions);
  versionObserver.observe(versions, { childList: true });
}

function softResetStudio() {
  const hasWork = !$('empty')?.classList.contains('hidden') || Boolean($('brandFiles')?.files?.length) || Boolean($('mockupPrompt')?.value?.trim());
  if (hasWork && !window.confirm('Começar um novo mockup? A cena, as artes e o histórico visual desta sessão serão limpos.')) return;

  hiddenVersionCount = $('versions')?.children?.length || hiddenVersionCount;
  freshSessionPending = true;

  const reopen = $('reopenSceneBtn');
  if (reopen && !reopen.classList.contains('hidden')) reopen.click();

  for (const id of ['mockupPrompt', 'surfaceHint', 'iterationPrompt', 'mockupApplyInstruction']) {
    if ($(id)) $(id).value = '';
  }
  if ($('sceneStyle')) $('sceneStyle').value = 'commercial';
  if ($('desiredSlots')) $('desiredSlots').value = '';
  if ($('mockupFidelityMode')) $('mockupFidelityMode').value = 'exact';
  for (const id of ['preserveAspectRatio', 'limitDeformation', 'safeMargins']) if ($(id)) $(id).checked = true;
  if ($('fidelityDescription')) $('fidelityDescription').textContent = fidelityDescription('exact');

  for (const id of ['productRefs', 'sceneRefs', 'photoFile', 'generatedFallback']) clearFileInput(id);
  clearFileInput('brandFiles');
  $('brandFiles')?.dispatchEvent(new Event('change', { bubbles: true }));
  $('productRefs')?.dispatchEvent(new Event('change', { bubbles: true }));
  $('sceneRefs')?.dispatchEvent(new Event('change', { bubbles: true }));

  const canvas = $('display');
  canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  $('universalOverlay')?.getContext('2d')?.clearRect(0, 0, $('universalOverlay').width, $('universalOverlay').height);
  $('empty')?.classList.remove('hidden');
  $('canvasHint')?.classList.add('hidden');
  $('iterationBox')?.classList.add('hidden');
  if ($('versions')) $('versions').innerHTML = '';
  if ($('universalMappingList')) $('universalMappingList').innerHTML = '';

  const status = $('status');
  if (status) {
    status.textContent = 'Nova sessão pronta. Descreva o próximo mockup.';
    status.className = 'status ok';
  }
  const generateStatus = $('generateStatus');
  if (generateStatus) {
    generateStatus.textContent = 'Novo mockup pronto. Escreva um pedido ou envie referências.';
    generateStatus.className = 'status';
  }
  const flowStatus = $('autoApplyFlowStatus');
  if (flowStatus) {
    flowStatus.textContent = 'Envie uma arte depois de aprovar a nova cena.';
    flowStatus.className = 'auto-status';
  }

  document.querySelector('.rail')?.classList.add('reset-flash');
  setTimeout(() => document.querySelector('.rail')?.classList.remove('reset-flash'), 450);
  document.dispatchEvent(new CustomEvent('mockup:soft-reset'));
  $('mockupPrompt')?.focus();
}

function addNewMockupControl() {
  if ($('newMockupBtn')) return;
  const brand = document.querySelector('.brand');
  if (!brand) return;
  const bar = document.createElement('div');
  bar.className = 'studio-quickbar';
  bar.innerHTML = '<button id="newMockupBtn" type="button" class="new-mockup-btn">＋ Novo mockup</button>';
  brand.insertAdjacentElement('afterend', bar);
  $('newMockupBtn')?.addEventListener('click', softResetStudio);
}

function fidelityDescription(mode) {
  if (mode === 'balanced') return 'Mantém identidade e proporção, permitindo integração moderada com material e curvatura.';
  if (mode === 'integrated') return 'Permite integração visual mais forte. Use quando a arte não tiver texto, retratos ou detalhes críticos.';
  return 'Prioriza a imagem original: sem esticar, sem achatar e com deformação mínima. Recomendado para fotos, logos e rótulos.';
}

function addFidelityControls() {
  const flow = $('autoApplyFlow');
  const anchor = $('autoApplyFlowBtn');
  if (!flow || !anchor || $('mockupFidelityMode')) return false;

  const panel = document.createElement('div');
  panel.className = 'fidelity-panel';
  panel.innerHTML = `
    <div class="fidelity-title"><span>Fidelidade da arte</span><span class="fidelity-badge">RECOMENDADO</span></div>
    <select id="mockupFidelityMode" aria-label="Modo de fidelidade da arte">
      <option value="exact">Fidelidade máxima</option>
      <option value="balanced">Equilibrado</option>
      <option value="integrated">Integração mais forte</option>
    </select>
    <div class="fidelity-checks">
      <label class="fidelity-check"><input id="preserveAspectRatio" type="checkbox" checked><span>Preservar proporção original</span></label>
      <label class="fidelity-check"><input id="limitDeformation" type="checkbox" checked><span>Limitar deformação</span></label>
      <label class="fidelity-check"><input id="safeMargins" type="checkbox" checked><span>Usar margens seguras</span></label>
    </div>
    <div id="fidelityDescription" class="fidelity-description">${fidelityDescription('exact')}</div>`;
  anchor.insertAdjacentElement('beforebegin', panel);

  $('mockupFidelityMode')?.addEventListener('change', (event) => {
    const description = $('fidelityDescription');
    if (description) description.textContent = fidelityDescription(event.target.value);
  });
  return true;
}

function improveFlowCopy() {
  const flow = $('autoApplyFlow');
  if (!flow) return;
  const title = flow.querySelector('strong');
  const copy = flow.querySelector('p');
  if (title) title.textContent = 'Aplicação inteligente';
  if (copy) copy.textContent = 'Com 1 arte, a IA aplica diretamente no mockup. Para múltiplas artes ou fidelidade pixel a pixel, use o modo avançado.';
}

function bridgeDirectCompletion() {
  document.addEventListener('mockup:direct-rendered', (event) => {
    const result = event.detail?.result || {};
    const status = $('autoApplyFlowStatus');
    if (status) {
      const label = result.fidelity === 'exact' ? 'Fidelidade máxima' : result.fidelity === 'balanced' ? 'Equilibrado' : 'Integração forte';
      status.textContent = `Mockup aplicado · ${label}. Compare detalhes da arte antes de salvar.`;
      status.className = 'auto-status ok';
    }
    document.dispatchEvent(new CustomEvent('mockup:ai-finalized', { detail: { source: 'direct-render' } }));
  });
}

function bootEnhancements() {
  addStudioStyles();
  addNewMockupControl();
  watchVersionHistory();
  improveFlowCopy();
  if (!addFidelityControls()) {
    setTimeout(bootEnhancements, 120);
  }
}

bridgeDirectCompletion();
bootEnhancements();

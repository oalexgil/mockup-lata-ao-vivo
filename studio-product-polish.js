const $ = (id) => document.getElementById(id);

function addStyles() {
  if ($('mockupVisionProductPolish')) return;
  const style = document.createElement('style');
  style.id = 'mockupVisionProductPolish';
  style.textContent = `
    :root{
      --bg:#08111d!important;--panel:#101b29!important;--panel2:#172638!important;--line:#2a3c50!important;
      --ink:#f4f8fb!important;--dim:#91a5b8!important;--accent:#5bd3c7!important;--ok:#65d8a9!important;--warn:#efbb6b!important;--danger:#ff8791!important;
    }
    html,body{background:#08111d!important}
    body{background:
      radial-gradient(circle at 78% 8%,rgba(117,167,255,.12),transparent 34%),
      radial-gradient(circle at 25% 92%,rgba(91,211,199,.09),transparent 31%),
      linear-gradient(145deg,#0a1421,#07101b 62%,#08111d)!important}
    .app{grid-template-columns:clamp(390px,30vw,448px) minmax(0,1fr)!important}
    .rail{padding:20px 20px 44px!important;background:linear-gradient(180deg,rgba(17,29,43,.985),rgba(9,18,29,.99))!important;border-right:1px solid rgba(111,151,184,.17)!important;box-shadow:20px 0 70px rgba(0,0,0,.24)!important}
    .stage{padding:36px!important;background:
      radial-gradient(circle at 80% 16%,rgba(240,185,107,.06),transparent 28%),
      radial-gradient(circle at 20% 80%,rgba(91,211,199,.05),transparent 34%),
      #070d14!important}
    .brand{padding:2px 2px 4px}.brand h1{font-size:24px!important;letter-spacing:-.7px!important;background:linear-gradient(100deg,#fff,#a9e8e2 58%,#9dbbff)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}.brand a{padding:5px 8px;border:1px solid rgba(112,145,171,.2);border-radius:999px;color:#9eb2c3!important;background:rgba(9,18,27,.35)}
    .sub{margin:5px 2px 16px!important;color:#9bb0c1!important;font-size:12px!important}
    .studio-confidence{display:flex;align-items:center;gap:7px;margin:-7px 2px 14px;color:#7f95a8;font-size:9.5px}.studio-confidence::before{content:"";width:7px;height:7px;border-radius:50%;background:#65d8a9;box-shadow:0 0 0 4px rgba(101,216,169,.08)}
    .progress{padding:5px;border:1px solid rgba(70,101,128,.3);border-radius:13px;background:rgba(7,15,24,.44);gap:5px!important}.progress div{padding:8px 5px!important;border:0!important;background:transparent!important;color:#7f95a8!important}.progress .active{background:rgba(91,211,199,.11)!important;color:#b9eee8!important;box-shadow:inset 0 0 0 1px rgba(91,211,199,.25)}.progress .done{color:#87d9b7!important}
    section.card{margin-bottom:14px!important;border:1px solid rgba(71,102,129,.3)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(20,34,49,.94),rgba(13,25,37,.96))!important;box-shadow:0 10px 30px rgba(0,0,0,.12)!important;overflow:hidden}.card-head{padding:14px 15px!important;border-bottom:1px solid rgba(65,94,120,.26)!important}.card-head strong{font-size:13.5px!important;letter-spacing:-.1px}.num{background:rgba(91,211,199,.09)!important;border:1px solid rgba(91,211,199,.22)!important;color:#86e3da!important}.card-body{padding:14px 15px 15px!important}
    textarea,input[type=text],select,button,.filebtn{border-radius:10px!important;border-color:rgba(78,108,134,.42)!important;background:#162538!important;color:#eef5fa!important}textarea,input[type=text],select{box-shadow:inset 0 1px 0 rgba(255,255,255,.015)}textarea:focus,input[type=text]:focus,select:focus{border-color:rgba(91,211,199,.66)!important;box-shadow:0 0 0 3px rgba(91,211,199,.08)!important}
    button,.filebtn{font-weight:600!important;letter-spacing:-.05px}button:hover,.filebtn:hover{background:#1b2d41!important;border-color:rgba(117,160,193,.62)!important}.primary{background:linear-gradient(135deg,#5bd3c7,#69b7e9)!important;border-color:transparent!important;color:#07151d!important;box-shadow:0 8px 24px rgba(74,190,190,.14)!important}.primary:hover{background:linear-gradient(135deg,#71dfd4,#7ac4ef)!important;box-shadow:0 10px 28px rgba(74,190,190,.2)!important}
    .filebtn{border-style:dashed!important;color:#c8d7e3!important;background:rgba(19,35,50,.72)!important}.hint,.tiny{color:#8ea3b5!important}.status,.flow-box{border-radius:11px!important;background:rgba(8,17,27,.56)!important;border-color:rgba(68,98,124,.36)!important}.status.ok,.auto-status.ok{color:#8cdfbc!important}.status.warn,.auto-status.warn{color:#efc57d!important}
    .fidelity-panel,.export-panel{border-radius:12px!important;background:linear-gradient(180deg,rgba(16,31,45,.92),rgba(11,22,33,.94))!important;border-color:rgba(71,105,133,.38)!important}.fidelity-badge{background:rgba(101,216,169,.1)!important;color:#8ce0bc!important;border-color:rgba(101,216,169,.26)!important}
    #display{border-radius:13px!important;box-shadow:0 30px 90px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.035)!important}.canvas-hint{border-radius:999px!important;padding:7px 10px!important;background:rgba(7,14,22,.76)!important;backdrop-filter:blur(10px);border-color:rgba(108,142,169,.3)!important;color:#8fa5b7!important}
    .asset-chip{border-radius:10px!important;background:rgba(8,16,25,.55)!important}.asset-chip img{border-radius:7px!important}.version-card{border-radius:9px!important}.version-card.active{border-color:#5bd3c7!important}
    .mockup-toast-stack{position:fixed;right:18px;bottom:18px;z-index:9999;display:grid;gap:8px;width:min(360px,calc(100vw - 36px));pointer-events:none}.mockup-toast{padding:11px 12px;border-radius:12px;border:1px solid rgba(74,104,129,.45);background:rgba(12,23,34,.96);box-shadow:0 16px 40px rgba(0,0,0,.28);color:#dbe7ef;font-size:10.5px;line-height:1.45;backdrop-filter:blur(12px);animation:toastIn .18s ease}.mockup-toast.warn{border-color:rgba(239,187,107,.34);color:#f0cb8c}.mockup-toast.ok{border-color:rgba(101,216,169,.32);color:#9de4c7}@keyframes toastIn{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
    .technical-copy{display:none!important}
    @media(max-width:900px){.app{grid-template-columns:1fr!important}.rail{padding:16px!important}.stage{padding:18px!important;min-height:62vh!important}}
  `;
  document.head.appendChild(style);
}

function ensureToastStack() {
  let stack = $('mockupToastStack');
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = 'mockupToastStack';
  stack.className = 'mockup-toast-stack';
  document.body.appendChild(stack);
  return stack;
}

function toast(message, kind = '') {
  const text = String(message || '').trim();
  if (!text) return;
  const item = document.createElement('div');
  item.className = `mockup-toast ${kind}`.trim();
  item.textContent = text;
  ensureToastStack().appendChild(item);
  setTimeout(() => item.remove(), 5200);
}

function setText(id, value) {
  const el = $(id);
  if (el && el.textContent !== value) el.textContent = value;
}

function softenStatusCopy() {
  const rewrites = [
    ['Cloudflare Workers AI conectado.', 'Gerador conectado.'],
    ['OpenAI conectado.', 'Gerador conectado.'],
  ];
  for (const id of ['generateStatus','autoApplyFlowStatus','status']) {
    const el = $(id);
    if (!el) continue;
    let text = String(el.textContent || '');
    for (const [from, to] of rewrites) text = text.replace(from, to);
    text = text
      .replace(/^A IA está identificando superfícies[^…]*…?$/i, 'Analisando superfícies do mockup…')
      .replace(/^A IA está analisando luz, material e integração[^…]*…?$/i, 'Refinando luz, material e integração…')
      .replace(/^A IA não conseguiu /i, 'Não foi possível ')
      .replace(/ com IA\b/gi, '')
      .replace(/\bIA-assisted\b/gi, 'assistido');
    if (el.textContent !== text) el.textContent = text;
  }
}

function polishCopy() {
  const sub = document.querySelector('.sub');
  if (sub && sub.textContent !== 'Crie a cena, aplique suas artes e exporte com precisão.') {
    sub.textContent = 'Crie a cena, aplique suas artes e exporte com precisão.';
  }
  if (!document.querySelector('.studio-confidence')) {
    const meta = document.createElement('div');
    meta.className = 'studio-confidence';
    meta.textContent = 'Fluxo local de composição · artes originais preservadas';
    sub?.insertAdjacentElement('afterend', meta);
  }

  const flow = $('autoApplyFlow');
  const title = flow?.querySelector('strong');
  const copy = flow?.querySelector('p');
  if (title && title.textContent !== 'Aplicação no mockup') title.textContent = 'Aplicação no mockup';
  const flowCopy = 'Localize as superfícies e aplique os arquivos originais com proporção preservada. Para composições complexas, use o modo guiado.';
  if (copy && copy.textContent !== flowCopy) copy.textContent = flowCopy;

  const primary = $('autoApplyFlowBtn');
  if (primary) {
    const count = $('brandFiles')?.files?.length || 0;
    const label = count <= 1 ? 'Aplicar no mockup' : 'Mapear artes';
    if (primary.textContent !== label) primary.textContent = label;
  }
  setText('advancedMappingBtn', 'Revisar áreas');
  setText('finalizeAiBtn', 'Refinar acabamento');
  setText('mockupExportBtn', 'Exportar imagem');

  const instruction = $('mockupApplyInstruction');
  if (instruction && instruction.placeholder?.includes('Instrução opcional')) {
    instruction.placeholder = 'Onde e como aplicar? Ex.: centralizar na face frontal, 6 cm abaixo da gola, usar o braço direito como tatuagem.';
  }

  softenStatusCopy();

  for (const id of ['generateStatus','autoApplyFlowStatus','guidedWorkflowStatus','status']) {
    const el = $(id);
    if (el) el.setAttribute('aria-live', 'polite');
  }
}

function friendlyApiMessage(detail = {}) {
  const raw = String(detail.message || 'Não foi possível concluir a operação.');
  if (/3036|10[,.]?000\s*neurons|daily free allocation|workers paid/i.test(raw)) {
    return 'O limite diário do provedor foi atingido. Seu trabalho local permanece salvo nesta sessão.';
  }
  if (detail.status === 429) return 'O serviço está temporariamente no limite. Aguarde um pouco e tente novamente.';
  if (detail.status === 413) return 'Os arquivos enviados ficaram grandes demais para esta operação. Reduza o tamanho ou a quantidade de referências.';
  if (detail.status >= 500) return 'O serviço não concluiu esta etapa. Tente novamente; as artes já aprovadas não foram alteradas.';
  return raw.replace(/^Falha[^:]*:\s*/i, '').slice(0, 360);
}

function bindRuntimeFeedback() {
  document.addEventListener('mockup:api-error', (event) => toast(friendlyApiMessage(event.detail), 'warn'));
  document.addEventListener('mockup:direct-rendered', () => toast('Aplicação concluída. Revise os detalhes antes de exportar.', 'ok'));
  document.addEventListener('mockup:ai-finalized', () => toast('Acabamento atualizado.', 'ok'));
}

function boot() {
  addStyles();
  polishCopy();
  const rail = document.querySelector('.rail');
  if (rail && !$('productPolishObserverMarker')) {
    const marker = document.createElement('i');
    marker.id = 'productPolishObserverMarker';
    marker.hidden = true;
    rail.appendChild(marker);
    const observer = new MutationObserver(() => polishCopy());
    observer.observe(rail, { childList: true, subtree: true });
  }
}

bindRuntimeFeedback();
boot();

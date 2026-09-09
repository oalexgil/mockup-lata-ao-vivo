const $ = (id) => document.getElementById(id);

const cards = [...document.querySelectorAll('section.card')];
const [briefCard, artsCard, areasCard, adjustmentsCard, finalizeCard] = cards;

function setSceneReady(ready) {
  for (const card of [artsCard, areasCard, finalizeCard]) {
    card?.classList.toggle('hidden', !ready);
  }
  if (!ready) adjustmentsCard?.classList.add('hidden');
  else adjustmentsCard?.classList.remove('hidden');
}

function sceneIsReady() {
  return $('progress2')?.classList.contains('done') || false;
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
        status.textContent = 'Gerador conectado. Escreva o pedido e clique em “Gerar imagem”.';
        status.className = 'status ok';
      }
      $('fallbackBox')?.classList.add('hidden');
    } else {
      status.textContent = 'Gerador pronto no app, mas falta configurar OPENAI_API_KEY no ambiente do servidor.';
      status.className = 'status warn';
    }
  } catch {
    status.textContent = 'Abra o Studio com “npm start” para habilitar a geração integrada.';
    status.className = 'status warn';
  }
}

setSceneReady(false);

const progress2 = $('progress2');
if (progress2) {
  new MutationObserver(() => setSceneReady(sceneIsReady()))
    .observe(progress2, { attributes: true, attributeFilter: ['class'] });
}

checkGenerator();

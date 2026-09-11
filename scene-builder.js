import { buildGenerationPrompt } from './src/scene-brief.js';

const $ = (id) => document.getElementById(id);
const generatePanel = $('generatePanel');
const photoPanel = $('photoPanel');
const sceneStatus = $('sceneStatus');
const promptPreview = $('promptPreview');
const flowGenerate = $('flowGenerate');
const flowPhoto = $('flowPhoto');
const generatedSceneFile = $('generatedSceneFile');
const photoFile = $('photoFile');

function setFlow(flow) {
  const generate = flow === 'generate';
  flowGenerate?.setAttribute('aria-pressed', String(generate));
  flowPhoto?.setAttribute('aria-pressed', String(!generate));
  generatePanel?.classList.toggle('hidden', !generate);
  photoPanel?.classList.toggle('hidden', generate);
}

function fileName(id) {
  const file = $(id)?.files?.[0];
  return file ? file.name : '';
}

function collectInput() {
  return {
    product: $('sceneProduct')?.value,
    scene: $('sceneDescription')?.value,
    style: $('sceneStyle')?.value,
    surface: $('sceneSurface')?.value,
    notes: $('sceneNotes')?.value,
    hasProductReference: Boolean(fileName('productReference')),
    hasSceneReference: Boolean(fileName('sceneReference')),
    hasArtwork: Boolean($('artFile')?.files?.[0]),
  };
}

function setSceneStatus(message, kind = '') {
  if (!sceneStatus) return;
  sceneStatus.textContent = message;
  sceneStatus.className = `status ${kind}`.trim();
}

function preparePrompt() {
  const result = buildGenerationPrompt(collectInput());
  if (result.problems.length) {
    promptPreview.value = '';
    setSceneStatus(result.problems.join(' '), 'warn');
    return null;
  }
  promptPreview.value = result.prompt;
  setSceneStatus('Briefing pronto. A cena deve ser gerada sem logo/texto; a identidade entra depois no Mockup Vision.', 'ok');
  return result;
}

flowGenerate?.addEventListener('click', () => setFlow('generate'));
flowPhoto?.addEventListener('click', () => setFlow('photo'));
$('prepareSceneBtn')?.addEventListener('click', preparePrompt);

$('copyPromptBtn')?.addEventListener('click', async () => {
  const result = preparePrompt();
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.prompt);
    setSceneStatus('Prompt copiado. Gere a cena no provedor desejado e carregue o resultado abaixo.', 'ok');
  } catch {
    promptPreview.focus();
    promptPreview.select();
    setSceneStatus('Selecione e copie o prompt manualmente.', 'warn');
  }
});

$('downloadBriefBtn')?.addEventListener('click', () => {
  const result = preparePrompt();
  if (!result) return;
  const blob = new Blob([JSON.stringify({ ...result.brief, prompt: result.prompt }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mockup-vision-scene-brief.json';
  a.click();
  URL.revokeObjectURL(url);
});

for (const [inputId, outputId] of [
  ['productReference', 'productReferenceName'],
  ['sceneReference', 'sceneReferenceName'],
]) {
  $(inputId)?.addEventListener('change', () => {
    const value = fileName(inputId);
    if ($(outputId)) $(outputId).textContent = value || 'nenhuma referência';
  });
}

generatedSceneFile?.addEventListener('change', () => {
  const file = generatedSceneFile.files?.[0];
  if (!file || !photoFile) return;
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    photoFile.files = transfer.files;
    photoFile.dispatchEvent(new Event('change', { bubbles: true }));
    setSceneStatus('Cena carregada no editor. Agora detecte/ajuste a superfície e aplique a arte.', 'ok');
  } catch {
    setSceneStatus('Não consegui encaminhar a imagem automaticamente. Use “Usar minha foto” e carregue a cena gerada.', 'warn');
  }
});

setFlow('generate');

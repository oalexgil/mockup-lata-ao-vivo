const $ = (id) => document.getElementById(id);
const nextFetch = window.fetch.bind(window);
const REFERENCE_MAX_SIDE = 500;
const MAX_CLOUDFLARE_REFERENCES = 4;
const previewUrls = new Map();

function setReferenceStatus(message, kind = '') {
  const el = $('generateStatus');
  if (!el || /Gerando/i.test(el.textContent || '')) return;
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function addReferenceStyles() {
  if ($('mockupVisionReferenceStyles')) return;
  const style = document.createElement('style');
  style.id = 'mockupVisionReferenceStyles';
  style.textContent = `
    .reference-list{display:grid;gap:6px;margin:7px 0 2px}
    .reference-list:empty{display:none}
    .reference-chip{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid #2a3b4c;border-radius:8px;background:#0d151e}
    .reference-chip img{width:42px;height:42px;object-fit:cover;border-radius:6px;background:#111b24}
    .reference-copy{min-width:0}.reference-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:#dbe8f1}.reference-copy span{display:block;margin-top:2px;font-size:9px;color:#7890a5}
    .reference-remove{width:auto!important;padding:6px 7px!important;border-radius:7px!important;color:#ff9aa4!important;border-color:#5f343c!important;font-size:9.5px!important}
    .reference-summary{margin:5px 0 2px;font-size:9.5px;line-height:1.35;color:#7f96aa}
  `;
  document.head.appendChild(style);
}

function ensureReferenceList(inputId, roleLabel) {
  const input = $(inputId);
  if (!input) return null;
  const listId = `${inputId}List`;
  let list = $(listId);
  if (!list) {
    list = document.createElement('div');
    list.id = listId;
    list.className = 'reference-list';
    input.insertAdjacentElement('afterend', list);
    const summary = document.createElement('div');
    summary.id = `${inputId}Summary`;
    summary.className = 'reference-summary';
    summary.dataset.roleLabel = roleLabel;
    list.insertAdjacentElement('afterend', summary);
  }
  return list;
}

function replaceFiles(input, files) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearPreviewUrls(inputId) {
  const urls = previewUrls.get(inputId) || [];
  urls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.set(inputId, []);
}

function renderReferenceInput(inputId, roleLabel) {
  const input = $(inputId);
  const list = ensureReferenceList(inputId, roleLabel);
  if (!input || !list) return;
  clearPreviewUrls(inputId);
  list.innerHTML = '';
  const files = [...(input.files || [])];
  const urls = [];

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    urls.push(url);
    const row = document.createElement('div');
    row.className = 'reference-chip';
    row.innerHTML = `
      <img src="${url}" alt="">
      <div class="reference-copy"><strong></strong><span>${roleLabel}</span></div>
      <button type="button" class="reference-remove">Excluir</button>`;
    row.querySelector('strong').textContent = file.name;
    row.querySelector('.reference-remove')?.addEventListener('click', () => {
      const next = [...(input.files || [])];
      next.splice(index, 1);
      replaceFiles(input, next);
    });
    list.appendChild(row);
  });
  previewUrls.set(inputId, urls);

  const summary = $(`${inputId}Summary`);
  if (summary) {
    summary.textContent = files.length
      ? `${files.length} referência(s) selecionada(s) · serão realmente enviadas ao gerador.`
      : '';
  }
}

function totalReferenceCount() {
  return ($('productRefs')?.files?.length || 0) + ($('sceneRefs')?.files?.length || 0);
}

function updateReferenceUX() {
  renderReferenceInput('productRefs', 'Produto / objeto');
  renderReferenceInput('sceneRefs', 'Cena / estilo');
  const count = totalReferenceCount();
  if (!count) return;
  if (count > MAX_CLOUDFLARE_REFERENCES) {
    setReferenceStatus(`${count} referências selecionadas. O gerador usa no máximo ${MAX_CLOUDFLARE_REFERENCES} imagens por geração; produto/objeto tem prioridade.`, 'warn');
  } else {
    setReferenceStatus(`${count} referência(s) pronta(s). Ao gerar, elas serão usadas pelo FLUX.2 como entradas visuais reais.`, 'ok');
  }
}

function loadDataUrlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao preparar referência visual.'));
    image.src = dataUrl;
  });
}

async function downscaleReferenceDataUrl(dataUrl) {
  if (!/^data:image\//i.test(String(dataUrl || ''))) return dataUrl;
  try {
    const image = await loadDataUrlImage(dataUrl);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (longest <= REFERENCE_MAX_SIDE) return dataUrl;
    const scale = REFERENCE_MAX_SIDE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.warn('reference resize fallback', error);
    return dataUrl;
  }
}

async function prepareGenerationBody(body) {
  const references = Array.isArray(body.references) ? body.references : [];
  const preparedReferences = [];
  for (const ref of references.slice(0, MAX_CLOUDFLARE_REFERENCES)) {
    preparedReferences.push({
      ...ref,
      dataUrl: await downscaleReferenceDataUrl(ref.dataUrl),
    });
  }

  let previousImage = body.previousImage || null;
  if (previousImage) previousImage = await downscaleReferenceDataUrl(previousImage);

  // FLUX.2 supports four image inputs total. During iteration the previous
  // scene occupies image 0, so keep at most three additional references.
  const referenceLimit = previousImage ? MAX_CLOUDFLARE_REFERENCES - 1 : MAX_CLOUDFLARE_REFERENCES;
  return {
    ...body,
    previousImage,
    references: preparedReferences.slice(0, referenceLimit),
  };
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (url.includes('/api/generate-scene') && typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      const prepared = await prepareGenerationBody(body);
      init = { ...init, body: JSON.stringify(prepared) };
    } catch (error) {
      console.warn('reference preparation fallback', error);
    }
  }
  return nextFetch(input, init);
};

addReferenceStyles();
ensureReferenceList('productRefs', 'Produto / objeto');
ensureReferenceList('sceneRefs', 'Cena / estilo');
$('productRefs')?.addEventListener('change', updateReferenceUX);
$('sceneRefs')?.addEventListener('change', updateReferenceUX);
updateReferenceUX();

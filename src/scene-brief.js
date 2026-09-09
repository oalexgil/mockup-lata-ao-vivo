const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const STYLE_LABELS = {
  commercial: 'fotografia publicitária de produto',
  ecommerce: 'fotografia e-commerce limpa e objetiva',
  editorial: 'fotografia editorial sofisticada',
  lifestyle: 'fotografia lifestyle natural',
  minimal: 'fotografia minimalista de estúdio',
};

export function buildSceneBrief(input = {}) {
  const product = clean(input.product);
  const scene = clean(input.scene);
  const style = STYLE_LABELS[input.style] || clean(input.style) || STYLE_LABELS.commercial;
  const surface = clean(input.surface) || 'superfície frontal limpa e visível';
  const notes = clean(input.notes);

  return {
    product,
    scene,
    style,
    surface,
    notes,
    hasProductReference: Boolean(input.hasProductReference),
    hasSceneReference: Boolean(input.hasSceneReference),
    hasArtwork: Boolean(input.hasArtwork),
  };
}

export function validateSceneBrief(brief) {
  const problems = [];
  if (!brief?.product) problems.push('Descreva o produto.');
  if (!brief?.scene) problems.push('Descreva o cenário ou composição.');
  return problems;
}

export function buildGenerationPrompt(input = {}) {
  const brief = buildSceneBrief(input);
  const problems = validateSceneBrief(brief);
  if (problems.length) return { prompt: '', problems, brief };

  const referenceHints = [
    brief.hasProductReference ? 'Use a referência de produto para forma, material e proporções, sem copiar marcas ou textos.' : '',
    brief.hasSceneReference ? 'Use a referência de cenário apenas para composição, atmosfera, luz e enquadramento.' : '',
  ].filter(Boolean);

  const lines = [
    `Crie uma ${brief.style} mostrando ${brief.product}.`,
    `Cena: ${brief.scene}.`,
    `A superfície destinada ao mockup deve ser ${brief.surface}, com geometria legível e perspectiva natural.`,
    'O produto deve estar SEM LOGO, SEM MARCA, SEM TEXTO e SEM RÓTULO legível na área personalizável.',
    'Preserve material, textura, reflexos, sombras de contato, profundidade e iluminação realistas.',
    'Evite elementos atravessando a superfície personalizável, salvo quando forem parte intencional da composição.',
    ...referenceHints,
    brief.notes ? `Observações adicionais: ${brief.notes}.` : '',
    'Entregue uma fotografia final plausível, pronta para receber a identidade visual posteriormente pelo Mockup Vision.',
  ].filter(Boolean);

  return { prompt: lines.join('\n'), problems: [], brief };
}

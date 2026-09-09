const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const STYLE_LABELS = {
  commercial: 'fotografia publicitária de produto',
  ecommerce: 'fotografia e-commerce limpa e objetiva',
  editorial: 'fotografia editorial sofisticada',
  lifestyle: 'fotografia lifestyle natural',
  minimal: 'fotografia minimalista de estúdio',
};

export function buildSceneBrief(input = {}) {
  const request = clean(input.request || [input.product, input.scene].filter(Boolean).join('. '));
  const style = STYLE_LABELS[input.style] || clean(input.style) || STYLE_LABELS.commercial;
  const surface = clean(input.surface) || 'superfície(s) de mockup limpa(s), bem visível(is), sem oclusões desnecessárias';
  const slotCount = Number(input.slotCount) > 0 ? Math.min(8, Number(input.slotCount)) : null;
  const notes = clean(input.notes);

  return {
    request,
    style,
    surface,
    slotCount,
    notes,
    hasProductReference: Boolean(input.hasProductReference),
    hasSceneReference: Boolean(input.hasSceneReference),
  };
}

export function validateSceneBrief(brief) {
  const problems = [];
  if (!brief?.request && !brief?.hasProductReference && !brief?.hasSceneReference) {
    problems.push('Escreva o que precisa ou envie pelo menos uma imagem de referência.');
  }
  return problems;
}

export function buildGenerationPrompt(input = {}) {
  const brief = buildSceneBrief(input);
  const problems = validateSceneBrief(brief);
  if (problems.length) return { prompt: '', problems, brief };

  const referenceHints = [
    brief.hasProductReference ? 'Use as referências de produto/modelo para forma, material, proporções e linguagem visual; não copie marcas, logos ou textos existentes.' : '',
    brief.hasSceneReference ? 'Use as referências de cena/inspiração para composição, atmosfera, luz, enquadramento e direção de arte.' : '',
  ].filter(Boolean);

  const slots = brief.slotCount
    ? `Crie exatamente ${brief.slotCount} superfícies de mockup claramente separadas e utilizáveis na composição.`
    : 'Quando o pedido implicar várias peças ou espaços de apresentação, crie superfícies de mockup claramente separadas e utilizáveis.';

  const lines = [
    `Crie ${brief.style} a partir deste pedido: ${brief.request || 'use as referências enviadas como base do conceito'}.`,
    `As superfícies destinadas ao mockup devem ser ${brief.surface}, com geometria legível e perspectiva natural.`,
    slots,
    'As áreas personalizáveis devem estar SEM LOGO, SEM MARCA, SEM TEXTO e SEM RÓTULO legível.',
    'Não invente identidade visual. O Mockup Vision aplicará os arquivos originais depois da geração.',
    'Preserve material, textura, reflexos, sombras de contato, profundidade e iluminação realistas.',
    'Evite elementos atravessando as superfícies personalizáveis, salvo quando forem parte intencional da composição.',
    ...referenceHints,
    brief.notes ? `Observações adicionais: ${brief.notes}.` : '',
    'Entregue uma imagem final plausível, pronta para receber uma ou mais identidades visuais posteriormente pelo Mockup Vision.',
  ].filter(Boolean);

  return { prompt: lines.join('\n'), problems: [], brief };
}

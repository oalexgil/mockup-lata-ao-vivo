const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const STYLE_LABELS = {
  commercial: 'fotografia publicitária de produto',
  ecommerce: 'fotografia e-commerce limpa e objetiva',
  editorial: 'fotografia editorial sofisticada',
  lifestyle: 'fotografia lifestyle natural',
  minimal: 'fotografia minimalista de estúdio',
};

const NUMBER_WORDS = new Map([
  ['um', 1], ['uma', 1],
  ['dois', 2], ['duas', 2],
  ['tres', 3], ['três', 3],
  ['quatro', 4],
  ['cinco', 5],
  ['seis', 6],
  ['sete', 7],
  ['oito', 8],
]);

const SURFACE_NOUNS = '(?:telas?|peças?|pecas?|áreas?|areas?|superfícies?|superficies?|quadros?|cartões?|cartoes?|cards?|mockups?|pôsteres?|posters?|flyers?|displays?|painéis?|paineis?|artes?|itens?)';

export function inferSlotCountFromRequest(value) {
  const request = clean(value).toLowerCase();
  if (!request) return null;

  const digitMatch = request.match(new RegExp(`\\b([1-8])\\s+${SURFACE_NOUNS}\\b`, 'i'))
    || request.match(new RegExp(`\\b(?:sequ[eê]ncia|conjunto|mosaico|layout|apresenta[cç][aã]o)\\s+(?:de|com)\\s+([1-8])\\s+${SURFACE_NOUNS}\\b`, 'i'));
  if (digitMatch) return Number(digitMatch[1]);

  for (const [word, number] of NUMBER_WORDS.entries()) {
    const pattern = new RegExp(`\\b${word}\\s+${SURFACE_NOUNS}\\b`, 'i');
    const contextualPattern = new RegExp(`\\b(?:sequ[eê]ncia|conjunto|mosaico|layout|apresenta[cç][aã]o)\\s+(?:de|com)\\s+${word}\\s+${SURFACE_NOUNS}\\b`, 'i');
    if (pattern.test(request) || contextualPattern.test(request)) return number;
  }
  return null;
}

function isSequenceRequest(value) {
  return /\b(sequ[eê]ncia|sequencia|cascata|progress[aã]o|fileira|linha\s+de)\b/i.test(clean(value));
}

export function buildSceneBrief(input = {}) {
  const request = clean(input.request || [input.product, input.scene].filter(Boolean).join('. '));
  const style = STYLE_LABELS[input.style] || clean(input.style) || STYLE_LABELS.commercial;
  const surface = clean(input.surface) || 'superfície(s) de mockup limpa(s), bem visível(is), sem oclusões desnecessárias';
  const explicitSlotCount = Number(input.slotCount) > 0 ? Math.min(8, Number(input.slotCount)) : null;
  const inferredSlotCount = explicitSlotCount ? null : inferSlotCountFromRequest(request);
  const slotCount = explicitSlotCount || inferredSlotCount;
  const notes = clean(input.notes);

  return {
    request,
    style,
    surface,
    slotCount,
    slotCountSource: explicitSlotCount ? 'explicit' : inferredSlotCount ? 'inferred' : null,
    sequenceLayout: isSequenceRequest(request),
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
    brief.hasProductReference ? 'Use as referências de produto/modelo como entrada visual obrigatória para forma, material, proporções e linguagem física; não copie marcas, logos ou textos existentes.' : '',
    brief.hasSceneReference ? 'Use as referências de cena/inspiração como entrada visual obrigatória para composição, atmosfera, luz, enquadramento e direção de arte.' : '',
  ].filter(Boolean);

  const slots = brief.slotCount
    ? `Crie EXATAMENTE ${brief.slotCount} superfícies de mockup claramente separadas, visíveis ao mesmo tempo e utilizáveis na composição. A contagem se refere às superfícies finais de aplicação, não a versões da imagem.`
    : 'Quando o pedido implicar várias peças ou espaços de apresentação, crie superfícies de mockup claramente separadas, simultaneamente visíveis e utilizáveis.';

  const sequenceInstruction = brief.sequenceLayout && brief.slotCount
    ? `O pedido descreve uma sequência: mostre as ${brief.slotCount} superfícies na mesma imagem em progressão visual coerente, com perspectiva/inclinação perceptível entre elas. Não reduza a composição a um único monitor, quadro ou objeto. Se a sequência terminar em um dispositivo, esse dispositivo conta como uma das ${brief.slotCount} superfícies, salvo se o pedido disser explicitamente que ele é adicional.`
    : brief.sequenceLayout
      ? 'O pedido descreve uma sequência: mostre os elementos simultaneamente na mesma composição em progressão visual coerente, sem colapsar tudo em um único objeto.'
      : '';

  const lines = [
    `Crie ${brief.style} a partir deste pedido: ${brief.request || 'use as referências enviadas como base do conceito'}.`,
    `As superfícies destinadas ao mockup devem ser ${brief.surface}, com geometria legível e perspectiva natural.`,
    slots,
    sequenceInstruction,
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

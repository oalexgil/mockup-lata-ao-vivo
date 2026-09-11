import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGenerationPrompt,
  buildSceneBrief,
  inferSlotCountFromRequest,
  validateSceneBrief,
} from '../src/scene-brief.js';

test('scene brief accepts a natural-language request', () => {
  const brief = buildSceneBrief({ request: 'copo reciclável em fundo branco' });
  assert.deepEqual(validateSceneBrief(brief), []);
});

test('scene brief also accepts reference-only workflows', () => {
  const brief = buildSceneBrief({ hasProductReference: true });
  assert.deepEqual(validateSceneBrief(brief), []);
});

test('scene brief rejects an entirely empty request', () => {
  const brief = buildSceneBrief({});
  assert.deepEqual(validateSceneBrief(brief), ['Escreva o que precisa ou envie pelo menos uma imagem de referência.']);
});

test('generation prompt protects customizable surfaces from invented branding', () => {
  const { prompt, problems } = buildGenerationPrompt({
    request: 'copo reciclável inclinado em movimento, fundo branco, iluminação soft de estúdio',
    style: 'commercial',
    surface: 'frente do copo limpa e bem visível',
    hasProductReference: true,
  });
  assert.equal(problems.length, 0);
  assert.match(prompt, /SEM LOGO, SEM MARCA, SEM TEXTO/i);
  assert.match(prompt, /copo reciclável inclinado em movimento/i);
  assert.match(prompt, /referências de produto\/modelo/i);
});

test('generation prompt can explicitly request multiple mockup spaces', () => {
  const { prompt } = buildGenerationPrompt({
    request: 'apresentação minimalista de peças gráficas',
    slotCount: 6,
  });
  assert.match(prompt, /EXATAMENTE 6 superfícies de mockup/i);
  assert.match(prompt, /uma ou mais identidades visuais/i);
});

test('infers four surfaces from the natural sequence request used in Studio', () => {
  const request = 'gere uma sequencia de 4 telas com inclinação e terminando em um monitor com fundo em tons pasteis';
  assert.equal(inferSlotCountFromRequest(request), 4);
  const { brief, prompt } = buildGenerationPrompt({ request });
  assert.equal(brief.slotCount, 4);
  assert.equal(brief.slotCountSource, 'inferred');
  assert.equal(brief.sequenceLayout, true);
  assert.match(prompt, /EXATAMENTE 4 superfícies/i);
  assert.match(prompt, /Não reduza a composição a um único monitor/i);
  assert.match(prompt, /dispositivo conta como uma das 4 superfícies/i);
});

test('word-based counts are also inferred for universal layouts', () => {
  assert.equal(inferSlotCountFromRequest('mosaico com seis peças gráficas'), 6);
  assert.equal(inferSlotCountFromRequest('duas telas inclinadas'), 2);
  assert.equal(inferSlotCountFromRequest('uma caixa em fundo branco'), null);
});

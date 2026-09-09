import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationPrompt, buildSceneBrief, validateSceneBrief } from '../src/scene-brief.js';

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
  assert.match(prompt, /exatamente 6 superfícies de mockup/i);
  assert.match(prompt, /uma ou mais identidades visuais/i);
});

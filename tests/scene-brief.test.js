import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationPrompt, buildSceneBrief, validateSceneBrief } from '../src/scene-brief.js';

test('scene brief requires product and scene', () => {
  const brief = buildSceneBrief({ product: 'copo reciclável' });
  assert.deepEqual(validateSceneBrief(brief), ['Descreva o cenário ou composição.']);
});

test('generation prompt protects the artwork surface from invented branding', () => {
  const { prompt, problems } = buildGenerationPrompt({
    product: 'copo reciclável inclinado em movimento',
    scene: 'fundo branco, iluminação soft de estúdio',
    style: 'commercial',
    surface: 'frente do copo limpa e bem visível',
    hasProductReference: true,
  });
  assert.equal(problems.length, 0);
  assert.match(prompt, /SEM LOGO, SEM MARCA, SEM TEXTO/i);
  assert.match(prompt, /copo reciclável inclinado em movimento/i);
  assert.match(prompt, /fundo branco, iluminação soft de estúdio/i);
  assert.match(prompt, /referência de produto/i);
});

test('artwork is intentionally excluded from scene generation semantics', () => {
  const { prompt } = buildGenerationPrompt({
    product: 'caixa de cosmético',
    scene: 'pedestal de pedra em estúdio',
    hasArtwork: true,
  });
  assert.match(prompt, /identidade visual posteriormente pelo Mockup Vision/i);
  assert.doesNotMatch(prompt, /aplique a logo/i);
});

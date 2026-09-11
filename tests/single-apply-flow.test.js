import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync(new URL('../studio-universal.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

test('single artwork uses one-click AI application endpoint', () => {
  assert.match(studio, /Aplicar mockup com IA/);
  assert.match(studio, /fetch\(['"]\/api\/apply-plan['"]/);
  assert.match(studio, /applySingleWithAI\(\)/);
  assert.match(server, /\/api\/apply-plan/);
});

test('single artwork upload starts automatic application without requiring a typed prompt', () => {
  assert.match(studio, /expected === 1\) applySingleWithAI\(\)/);
  assert.match(studio, /instruction = String\(\$\(['"]mockupApplyInstruction['"]\)/);
  assert.match(studio, /instruction,/);
});

test('optional placement instruction remains available', () => {
  assert.match(studio, /id = ['"]mockupApplyInstruction['"]/);
  assert.match(studio, /Instrução opcional/);
  assert.match(studio, /Se deixar vazio/);
});

test('advanced multi-slot mapping remains available as fallback', () => {
  assert.match(studio, /Revisar áreas \/ modo avançado/);
  assert.match(studio, /fetch\(['"]\/api\/analyze-layout['"]/);
  assert.match(studio, /uploadedFileCount\(\) === 1 \? applySingleWithAI\(\) : analyzeLayout\(\)/);
});

test('single application renders original artwork locally and keeps export local', () => {
  assert.match(studio, /warpArtwork\(/);
  assert.match(studio, /artworkFidelityLocked: true/);
  assert.match(studio, /toDataURL\(['"]image\/png['"]\)/);
  assert.doesNotMatch(studio, /FormData/);
});

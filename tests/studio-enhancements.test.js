import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancements = fs.readFileSync(new URL('../studio-enhancements.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

test('studio injects fidelity enhancement module', () => {
  assert.match(server, /studio-enhancements\.js/);
});

test('fidelity UX defaults to maximum preservation', () => {
  assert.match(enhancements, /id="mockupFidelityMode"/);
  assert.match(enhancements, /value="exact">Fidelidade máxima/);
  assert.match(enhancements, /id="preserveAspectRatio"[^>]*checked/);
  assert.match(enhancements, /id="limitDeformation"[^>]*checked/);
  assert.match(enhancements, /id="safeMargins"[^>]*checked/);
});

test('direct mockup requests receive fidelity controls without changing core renderer', () => {
  assert.match(enhancements, /\/api\/render-mockup/);
  assert.match(enhancements, /fidelityMode/);
  assert.match(enhancements, /preserveAspectRatio/);
  assert.match(enhancements, /limitDeformation/);
  assert.match(enhancements, /safeMargins/);
});

test('one-click new mockup control starts a clean session', () => {
  assert.match(enhancements, /id="newMockupBtn"/);
  assert.match(enhancements, /Novo mockup/);
  assert.match(enhancements, /searchParams\.set\(['"]new['"]/);
  assert.match(enhancements, /location\.replace/);
});

test('direct AI completion is bridged to final workflow state', () => {
  assert.match(enhancements, /mockup:direct-rendered/);
  assert.match(enhancements, /mockup:ai-finalized/);
});

test('visual polish includes responsive layout and explicit focus states', () => {
  assert.match(enhancements, /grid-template-columns:410px/);
  assert.match(enhancements, /textarea:focus/);
  assert.match(enhancements, /@media\(max-width:900px\)/);
});

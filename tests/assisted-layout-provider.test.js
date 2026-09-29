import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasSurfaceCoverage,
  selectSurfaceCandidates,
  universalLayoutPrompt,
  universalLayoutRetryPrompt,
} from '../server/layout-provider.js';

const slot = (id, x, y, w, h, confidence = 0.9) => ({
  id,
  label: id,
  confidence,
  quad: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

test('focused selection rejects a remote high-confidence surface', () => {
  const remote = slot('monitor', 0.05, 0.05, 0.45, 0.4, 0.99);
  const phone = slot('phone', 0.76, 0.46, 0.12, 0.3, 0.72);
  const selected = selectSurfaceCandidates({ slots: [remote, phone] }, 1, [], { x: 0.82, y: 0.6 }, 0.18);
  assert.deepEqual(selected.map((item) => item.id), ['phone']);
  assert.equal(hasSurfaceCoverage({ slots: [remote] }, 1, [], { x: 0.82, y: 0.6 }, 0.12), false);
});

test('focused prompt makes click locality stronger than generic salience', () => {
  const prompt = universalLayoutPrompt(1, [], 'tela do celular', { x: 0.82, y: 0.6 }, 0.2);
  assert.match(prompt, /USER CLICK FOCUS/i);
  assert.match(prompt, /strong spatial constraint/i);
  assert.match(prompt, /CONTAINS the clicked point/i);
  assert.match(prompt, /Ignore unrelated large or central surfaces/i);
});

test('focused retry preserves the same spatial constraint', () => {
  const prompt = universalLayoutRetryPrompt(1, [], '', { x: 0.2, y: 0.8 }, 0.25);
  assert.match(prompt, /USER CLICK FOCUS/i);
  assert.match(prompt, /0\.2/);
});

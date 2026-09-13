import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseArtworkTargetPlan,
  summarizeArtworkTargetPlan,
  targetForArtwork,
} from '../src/guided-routing.js';

test('parses the three-line guided destination format used by the Studio', () => {
  const plan = parseArtworkTargetPlan(`Arte 01: Tela do monitor\nArte 02: Tela do celular na vertical\nArte 03: tela do celular na horizontal`, 3);
  assert.equal(plan.explicit, true);
  assert.equal(plan.targets.size, 3);
  assert.equal(targetForArtwork(plan, 0), 'Tela do monitor');
  assert.equal(targetForArtwork(plan, 1), 'Tela do celular na vertical');
  assert.equal(targetForArtwork(plan, 2), 'tela do celular na horizontal');
  assert.equal(summarizeArtworkTargetPlan(plan, 3), '3/3 arte(s) com destino explícito');
});

test('accepts punctuation variants copied from rich text or mobile keyboards', () => {
  const plan = parseArtworkTargetPlan(`Arte 01： monitor\nArte 02 — celular\nArte 03 -> capa da agenda`, 3);
  assert.equal(plan.targets.size, 3);
  assert.equal(targetForArtwork(plan, 0), 'monitor');
  assert.equal(targetForArtwork(plan, 1), 'celular');
  assert.equal(targetForArtwork(plan, 2), 'capa da agenda');
});

test('keeps unmapped artworks pending instead of inventing a destination', () => {
  const plan = parseArtworkTargetPlan(`Arte 01: vaso\nArte 03: agenda`, 3);
  assert.equal(plan.targets.size, 2);
  assert.equal(targetForArtwork(plan, 1), '');
  assert.equal(summarizeArtworkTargetPlan(plan, 3), '2/3 arte(s) com destino explícito');
});

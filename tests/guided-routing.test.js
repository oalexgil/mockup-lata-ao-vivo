import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseArtworkTargetPlan,
  targetForArtwork,
  removeArtworkFromMapping,
  markArtworkReplaced,
  summarizeArtworkTargetPlan,
} from '../src/guided-routing.js';
import { GUIDED_STATUS } from '../src/guided-multi-art.js';

const quad = [
  { x: 0.1, y: 0.1 },
  { x: 0.3, y: 0.1 },
  { x: 0.3, y: 0.3 },
  { x: 0.1, y: 0.3 },
];

const mapping = [
  { id: 'a', quad, artworkIndex: 0, guidedStatus: GUIDED_STATUS.FROZEN },
  { id: 'b', quad, artworkIndex: 1, guidedStatus: GUIDED_STATUS.PREVIEW },
  { id: 'c', quad, artworkIndex: 3, guidedStatus: GUIDED_STATUS.FROZEN },
];

test('parses explicit Portuguese artwork destinations', () => {
  const plan = parseArtworkTargetPlan(`
    Arte 01: como marca no vaso da planta
    Arte 02 no monitor
    Arte 03 → no celular
    04 - na capa da agenda
  `, 5);
  assert.equal(plan.explicit, true);
  assert.equal(targetForArtwork(plan, 0), 'como marca no vaso da planta');
  assert.equal(targetForArtwork(plan, 1), 'no monitor');
  assert.equal(targetForArtwork(plan, 2), 'no celular');
  assert.equal(targetForArtwork(plan, 3), 'na capa da agenda');
  assert.equal(targetForArtwork(plan, 4), '');
  assert.equal(summarizeArtworkTargetPlan(plan, 5), '4/5 arte(s) com destino explícito');
});

test('keeps a plain instruction as guidance for the next search', () => {
  const plan = parseArtworkTargetPlan('Inserir no vaso de planta à esquerda da imagem', 4);
  assert.equal(plan.explicit, false);
  assert.equal(targetForArtwork(plan, 0, { useGeneral: true }), 'Inserir no vaso de planta à esquerda da imagem');
  assert.equal(targetForArtwork(plan, 1), '');
});

test('removing an artwork releases its surface and reindexes later assignments', () => {
  const result = removeArtworkFromMapping(mapping, 1);
  assert.equal(result[1].artworkIndex, null);
  assert.equal(result[1].guidedStatus, GUIDED_STATUS.AVAILABLE);
  assert.equal(result[2].artworkIndex, 2);
  assert.equal(result[2].guidedStatus, GUIDED_STATUS.FROZEN);
});

test('replacing an approved artwork requires a fresh approval without moving the surface', () => {
  const result = markArtworkReplaced(mapping, 0);
  assert.equal(result[0].artworkIndex, 0);
  assert.equal(result[0].guidedStatus, GUIDED_STATUS.PREVIEW);
  assert.equal(result[0].frozen, false);
  assert.equal(result[2].guidedStatus, GUIDED_STATUS.FROZEN);
});

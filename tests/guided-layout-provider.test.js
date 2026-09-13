import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasSurfaceCoverage,
  rejectReservedSurfaces,
  selectSurfaceCandidates,
  universalLayoutPrompt,
  universalLayoutRetryPrompt,
  universalLayoutSchema,
} from '../server/layout-provider.js';

const slot = (id, x, y, width = 0.2, height = 0.2, confidence = 0.9) => ({
  id,
  label: `surface ${id}`,
  confidence,
  quad: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
});

test('single progressive detection keeps candidate reserve for excluded surfaces', () => {
  const schema = universalLayoutSchema(1);
  assert.equal(schema.properties.slots.maxItems, 3);
});

test('reserved surfaces are rejected while distinct alternatives remain eligible', () => {
  const reserved = slot('reserved', 0.1, 0.1, 0.25, 0.25);
  const duplicate = slot('duplicate', 0.11, 0.11, 0.24, 0.24, 0.99);
  const next = slot('next', 0.62, 0.12, 0.22, 0.22, 0.8);
  const filtered = rejectReservedSurfaces([duplicate, next], [reserved]);
  assert.deepEqual(filtered.map((item) => item.id), ['next']);
  const selected = selectSurfaceCandidates({ slots: [duplicate, next] }, 1, [reserved]);
  assert.deepEqual(selected.map((item) => item.id), ['next']);
});

test('coverage is calculated after reserved areas are removed', () => {
  const one = slot('one', 0.1, 0.1);
  const two = slot('two', 0.5, 0.1);
  assert.equal(hasSurfaceCoverage({ slots: [one, two] }, 2, []), true);
  assert.equal(hasSurfaceCoverage({ slots: [one, two] }, 2, [one]), false);
  assert.equal(hasSurfaceCoverage({ slots: [one, two] }, 1, [one]), true);
});

test('guided prompt tells vision to skip already approved geometry without specializing object type', () => {
  const reserved = slot('approved', 0.1, 0.1);
  const prompt = universalLayoutPrompt(1, [reserved]);
  assert.match(prompt, /NEXT usable target/i);
  assert.match(prompt, /already approved or currently occupied/i);
  assert.match(prompt, /Do NOT return them again/i);
  assert.match(prompt, /illustrative, NOT a whitelist/i);
  assert.match(prompt, /do not assume any product category/i);
});

test('retry keeps searching whole composition outside frozen surfaces', () => {
  const prompt = universalLayoutRetryPrompt(2, [slot('approved', 0.1, 0.1)]);
  assert.match(prompt, /WHOLE image/i);
  assert.match(prompt, /reserved area/i);
  assert.match(prompt, /small, tilted, peripheral and partially overlapped/i);
});

test('explicit target intent guides the next surface without hard-coding a product category', () => {
  const prompt = universalLayoutPrompt(1, [], 'usar a superfície menor à direita');
  assert.match(prompt, /USER TARGET INTENT/i);
  assert.match(prompt, /superfície menor à direita/i);
  assert.match(prompt, /highest-priority semantic target/i);
  assert.match(prompt, /real visible surface/i);
});

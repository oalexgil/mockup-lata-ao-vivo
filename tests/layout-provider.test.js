import test from 'node:test';
import assert from 'node:assert/strict';

import {
  distinctSurfaceCandidates,
  hasSurfaceCoverage,
  selectSurfaceCandidates,
  surfaceOverlap,
  universalLayoutPrompt,
  universalLayoutRetryPrompt,
  universalLayoutSchema,
} from '../server/layout-provider.js';

const slot = (id, x, y, width = 0.18, height = 0.18, confidence = 0.9, label = `surface ${id}`) => ({
  id,
  label,
  confidence,
  quad: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
});

test('multi-surface schema keeps extra candidate capacity for recovery', () => {
  const schema = universalLayoutSchema(4);
  assert.equal(schema.properties.slots.minItems, 1);
  assert.equal(schema.properties.slots.maxItems, 6);
});

test('universal prompt inventories the whole composition without specializing to one product type', () => {
  const prompt = universalLayoutPrompt(4);
  assert.match(prompt, /inventory the ENTIRE composition/i);
  assert.match(prompt, /object by object and region by region/i);
  assert.match(prompt, /examples are illustrative, NOT a whitelist/i);
  assert.match(prompt, /do not assume any product category/i);
  assert.match(prompt, /active content area inside the bezel\/frame/i);
  assert.match(prompt, /packaging or rigid products/i);
  assert.match(prompt, /flexible material/i);
  assert.match(prompt, /curved surfaces/i);
  assert.match(prompt, /do not split one continuous surface merely to reach/i);
});

test('retry prompt revisits small, tilted, peripheral and partially overlapped real targets', () => {
  const prompt = universalLayoutRetryPrompt(4);
  assert.match(prompt, /small, tilted, peripheral and partially overlapped objects/i);
  assert.match(prompt, /independent content-bearing faces/i);
  assert.match(prompt, /do not merge separate objects/i);
});

test('overlap filter rejects duplicate mappings of one physical face', () => {
  const original = slot('a', 0.10, 0.10, 0.30, 0.30, 0.98);
  const duplicate = slot('a-copy', 0.11, 0.11, 0.30, 0.30, 0.96);
  const separate = slot('b', 0.55, 0.10, 0.30, 0.30, 0.91);
  assert.ok(surfaceOverlap(original, duplicate) > 0.68);
  const distinct = distinctSurfaceCandidates([duplicate, separate, original]);
  assert.equal(distinct.length, 2);
  assert.ok(distinct.some((candidate) => candidate.id === 'a'));
  assert.ok(distinct.some((candidate) => candidate.id === 'b'));
});

test('coverage can use reserve candidates after duplicate removal', () => {
  const value = {
    slots: [
      slot('one', 0.06, 0.10, 0.22, 0.22, 0.99),
      slot('one-copy', 0.07, 0.11, 0.22, 0.22, 0.97),
      slot('two', 0.36, 0.10, 0.22, 0.22, 0.94),
      slot('three', 0.66, 0.10, 0.22, 0.22, 0.93),
      slot('four', 0.20, 0.58, 0.22, 0.20, 0.91),
      slot('reserve', 0.62, 0.58, 0.22, 0.20, 0.55),
    ],
  };

  assert.equal(hasSurfaceCoverage(value, 4), true);
  const selected = selectSurfaceCandidates(value, 4);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((candidate) => candidate.id)).size, 4);
  assert.equal(selected.some((candidate) => candidate.id === 'one-copy'), false);
});

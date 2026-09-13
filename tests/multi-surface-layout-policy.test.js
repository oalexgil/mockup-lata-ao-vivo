import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUniversalLayoutPrompt,
  buildUniversalLayoutRetryInstruction,
  distinctVisionSlots,
  hasRequestedVisionCoverage,
  layoutVisionResponseFormat,
  usableVisionSlots,
  visionSlotOverlap,
} from '../server/vision-provider.js';

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

test('multi-surface schema allows a small candidate reserve instead of overfitting to the first N detections', () => {
  const format = layoutVisionResponseFormat(4);
  const slots = format.json_schema.properties.slots;
  assert.equal(slots.minItems, 1);
  assert.equal(slots.maxItems, 6);
});

test('layout prompt is universal and performs whole-composition surface inventory', () => {
  const prompt = buildUniversalLayoutPrompt(4);
  assert.match(prompt, /inventory of the entire composition/i);
  assert.match(prompt, /object by object and region by region/i);
  assert.match(prompt, /examples are illustrative, not a whitelist/i);
  assert.match(prompt, /regardless|different sizes|strong perspective/i);
  assert.match(prompt, /active display\/content area INSIDE the bezel or frame/i);
  assert.match(prompt, /flexible material/i);
  assert.match(prompt, /do not split one continuous surface merely to reach/i);
});

test('retry prompt searches peripheral, tilted and partially overlapped targets generically', () => {
  const prompt = buildUniversalLayoutRetryInstruction(4);
  assert.match(prompt, /small, tilted, peripheral and partially overlapped targets/i);
  assert.match(prompt, /independent content-bearing faces/i);
  assert.match(prompt, /do not merge separate objects/i);
});

test('overlap metric and distinct filter reject duplicate mappings of the same physical surface', () => {
  const original = slot('a', 0.1, 0.1, 0.3, 0.3, 0.98);
  const duplicate = slot('a-duplicate', 0.11, 0.11, 0.3, 0.3, 0.96);
  const separate = slot('b', 0.55, 0.1, 0.3, 0.3, 0.9);
  assert.ok(visionSlotOverlap(original, duplicate) > 0.68);
  const distinct = distinctVisionSlots([duplicate, separate, original], 8);
  assert.equal(distinct.length, 2);
  assert.ok(distinct.some((candidate) => candidate.id === 'a'));
  assert.ok(distinct.some((candidate) => candidate.id === 'b'));
});

test('coverage can recover requested surfaces from extra candidates after duplicate removal', () => {
  const input = {
    slots: [
      slot('one', 0.08, 0.10, 0.22, 0.22, 0.98),
      slot('one-duplicate', 0.09, 0.11, 0.22, 0.22, 0.96),
      slot('two', 0.38, 0.12, 0.20, 0.20, 0.94),
      slot('three', 0.68, 0.14, 0.20, 0.20, 0.92),
      slot('four', 0.22, 0.58, 0.22, 0.20, 0.90),
      slot('alternative', 0.62, 0.58, 0.20, 0.20, 0.55),
    ],
  };

  assert.equal(hasRequestedVisionCoverage(input, 4), true);
  const selected = usableVisionSlots(input, 4);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((candidate) => candidate.id)).size, 4);
  assert.equal(selected.some((candidate) => candidate.id === 'one-duplicate'), false);
});

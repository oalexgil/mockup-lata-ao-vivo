import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualSlot,
  autoAssignAssets,
  buildIterationPrompt,
  generationRequest,
  normalizeProviderSlots,
} from '../src/studio-core.js';

test('normalizes provider slots from 0..1 coordinates', () => {
  const slots = normalizeProviderSlots([
    { id: 'screen', label: 'Tela', quad: [{x:.1,y:.2},{x:.9,y:.2},{x:.9,y:.8},{x:.1,y:.8}] },
  ], 1000, 500);
  assert.equal(slots.length, 1);
  assert.deepEqual(slots[0].quad[0], { x: 100, y: 100 });
  assert.deepEqual(slots[0].quad[2], { x: 900, y: 400 });
});

test('assigns multiple brand assets sequentially across slots', () => {
  const slots = [
    { id: '1', assetIndex: null },
    { id: '2', assetIndex: null },
    { id: '3', assetIndex: null },
  ];
  const assigned = autoAssignAssets(slots, 2);
  assert.deepEqual(assigned.map((s) => s.assetIndex), [0, 1, 0]);
});

test('manual slots can be added without replacing existing areas', () => {
  const first = addManualSlot([], 1200, 800);
  const second = addManualSlot(first, 1200, 800);
  assert.equal(second.length, 2);
  assert.notDeepEqual(second[0].quad, second[1].quad);
});

test('iteration prompt preserves the original brief', () => {
  const prompt = buildIterationPrompt('white studio cup', 'make the cup lean more');
  assert.match(prompt, /white studio cup/);
  assert.match(prompt, /make the cup lean more/);
  assert.match(prompt, /Preserve the same product identity/);
});

test('generation request asks provider for mockup slot metadata', () => {
  const request = generationRequest({ prompt: 'poster wall', references: [] });
  assert.equal(request.output.requestMockupSlots, true);
  assert.equal(request.output.maxSlots, 8);
});

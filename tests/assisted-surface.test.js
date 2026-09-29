import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closestQuadCorner,
  distanceToSurface,
  isEditableQuad,
  moveQuadCorner,
  normalizeFocusPoint,
  pointFromClient,
  quadAroundPoint,
  rankSlotsByFocus,
} from '../src/assisted-surface.js';

test('normalizes click coordinates into the canvas', () => {
  assert.deepEqual(pointFromClient(150, 260, { left: 50, top: 60, width: 400, height: 400 }), { x: 0.25, y: 0.5 });
  assert.deepEqual(normalizeFocusPoint({ x: -1, y: 2 }), { x: 0, y: 1 });
});

test('creates a safe manual quad around clicks even at the canvas edge', () => {
  const quad = quadAroundPoint({ x: 0.98, y: 0.04 }, { artAspect: 1.4, canvasAspect: 1.2 });
  assert.equal(quad.length, 4);
  assert.equal(isEditableQuad(quad), true);
  assert.ok(quad.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
});

test('corner editing preserves a valid ordered quadrilateral', () => {
  const quad = quadAroundPoint({ x: 0.5, y: 0.5 });
  const moved = moveQuadCorner(quad, 0, { x: 0.22, y: 0.27 });
  assert.equal(isEditableQuad(moved), true);
  assert.equal(closestQuadCorner(moved, { x: 0.22, y: 0.27 }, 0.02), 0);
  const rejected = moveQuadCorner(moved, 0, { x: 0.9, y: 0.9 });
  assert.deepEqual(rejected, moved);
});

test('focus ranking prefers a surface containing the click over a large remote surface', () => {
  const remote = { id: 'remote', confidence: 0.99, quad: [
    { x: 0.05, y: 0.05 }, { x: 0.45, y: 0.05 }, { x: 0.45, y: 0.45 }, { x: 0.05, y: 0.45 },
  ] };
  const clicked = { id: 'clicked', confidence: 0.75, quad: [
    { x: 0.68, y: 0.55 }, { x: 0.9, y: 0.55 }, { x: 0.9, y: 0.82 }, { x: 0.68, y: 0.82 },
  ] };
  const ranked = rankSlotsByFocus([remote, clicked], { x: 0.8, y: 0.65 }, 0.2);
  assert.deepEqual(ranked.map((slot) => slot.id), ['clicked']);
  assert.equal(distanceToSurface(clicked, { x: 0.8, y: 0.65 }), 0);
});

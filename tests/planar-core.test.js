import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bilinearPoint,
  defaultQuad,
  isUsableQuad,
  nearestCorner,
  quadArea,
  suggestQuadFromBox,
} from '../src/planar-core.js';

test('default quad is centered and usable', () => {
  const quad = defaultQuad(1000, 800, 0.5);
  assert.deepEqual(quad[0], { x: 250, y: 200 });
  assert.deepEqual(quad[2], { x: 750, y: 600 });
  assert.equal(isUsableQuad(quad, 1000, 800), true);
});

test('bilinear mapping keeps corners exact', () => {
  const quad = [
    { x: 10, y: 20 },
    { x: 110, y: 10 },
    { x: 120, y: 90 },
    { x: 0, y: 100 },
  ];
  assert.deepEqual(bilinearPoint(quad, 0, 0), quad[0]);
  assert.deepEqual(bilinearPoint(quad, 1, 0), quad[1]);
  assert.deepEqual(bilinearPoint(quad, 1, 1), quad[2]);
  assert.deepEqual(bilinearPoint(quad, 0, 1), quad[3]);
});

test('detector bounding box becomes ordered four-corner surface', () => {
  const quad = suggestQuadFromBox({ originX: 100, originY: 80, width: 400, height: 300 }, 1000, 800, 0);
  assert.deepEqual(quad, [
    { x: 100, y: 80 },
    { x: 500, y: 80 },
    { x: 500, y: 380 },
    { x: 100, y: 380 },
  ]);
  assert.equal(quadArea(quad), 120000);
});

test('nearest corner only activates inside the configured handle radius', () => {
  const quad = defaultQuad(100, 100, 0.6);
  assert.equal(nearestCorner(quad, { x: 21, y: 19 }, 8), 0);
  assert.equal(nearestCorner(quad, { x: 50, y: 50 }, 8), -1);
});

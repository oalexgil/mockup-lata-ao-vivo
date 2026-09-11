import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approximateQuadAspectRatio,
  artworkFitSummary,
  fidelityApplicationStrategy,
  fitArtworkQuad,
} from '../src/artwork-fit.js';

const wideSurface = [
  { x: 0, y: 0 },
  { x: 1600, y: 0 },
  { x: 1600, y: 900 },
  { x: 0, y: 900 },
];

test('maximum fidelity routes to deterministic rendering while other modes keep direct AI edit', () => {
  assert.equal(fidelityApplicationStrategy({ fidelityMode: 'exact' }), 'deterministic-exact');
  assert.equal(fidelityApplicationStrategy({ fidelityMode: 'balanced' }), 'direct-ai-edit');
  assert.equal(fidelityApplicationStrategy({ fidelityMode: 'integrated' }), 'direct-ai-edit');
});

test('safe artwork fit preserves a square artwork ratio inside a wide display instead of stretching it', () => {
  const fitted = fitArtworkQuad(wideSurface, 1, {
    preserveAspectRatio: true,
    limitDeformation: true,
    safeMargins: true,
  });
  const summary = artworkFitSummary(wideSurface, fitted, 1);

  assert.ok(approximateQuadAspectRatio(wideSurface) > 1.7);
  assert.ok(summary.ratioError < 0.02, `expected square ratio, got ${summary.fittedRatio}`);
  assert.ok(fitted[0].x > 200, 'wide surface should become pillarboxed for square artwork');
  assert.ok(fitted[0].y > 0, 'safe top margin should be retained');
});

test('safe artwork fit preserves a 4:3 editorial piece and keeps every point inside the original surface', () => {
  const fitted = fitArtworkQuad(wideSurface, 4 / 3, {
    preserveAspectRatio: true,
    limitDeformation: true,
    safeMargins: true,
  });
  const summary = artworkFitSummary(wideSurface, fitted, 4 / 3);

  assert.ok(summary.ratioError < 0.02, `expected 4:3 ratio, got ${summary.fittedRatio}`);
  for (const point of fitted) {
    assert.ok(point.x >= 0 && point.x <= 1600);
    assert.ok(point.y >= 0 && point.y <= 900);
  }
});

test('disabling aspect preservation still keeps the configured safe inset', () => {
  const fitted = fitArtworkQuad(wideSurface, 1, {
    preserveAspectRatio: false,
    safeMargins: true,
    limitDeformation: true,
  });
  assert.ok(fitted[0].x > 0 && fitted[0].y > 0);
  assert.ok(approximateQuadAspectRatio(fitted) > 1.7);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTWORK_FIDELITY_POLICY,
  mapArtworksToSlots,
  normalizeRefinementPlan,
  normalizeUniversalSlots,
  quadToPixels,
} from '../src/universal-mockup.js';

test('brand artwork policy locks visual content', () => {
  assert.equal(ARTWORK_FIDELITY_POLICY.immutableContent, true);
  assert.equal(ARTWORK_FIDELITY_POLICY.allowTextRewrite, false);
  assert.equal(ARTWORK_FIDELITY_POLICY.allowColorRewrite, false);
  assert.equal(ARTWORK_FIDELITY_POLICY.allowLogoRedraw, false);
  assert.equal(ARTWORK_FIDELITY_POLICY.allowIllustrationRewrite, false);
});

test('universal slots clamp normalized coordinates and preserve order', () => {
  const slots = normalizeUniversalSlots({
    slots: [{
      id: 'a',
      label: 'screen',
      confidence: 1.2,
      quad: [{ x: -0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 1.4, y: 0.9 }, { x: 0.2, y: 1.3 }],
    }],
  });
  assert.equal(slots.length, 1);
  assert.deepEqual(slots[0].quad, [
    { x: 0, y: 0.1 },
    { x: 0.8, y: 0.1 },
    { x: 1, y: 0.9 },
    { x: 0.2, y: 1 },
  ]);
  assert.equal(slots[0].confidence, 1);
});

test('artworks map one-to-one without mutating source assets', () => {
  const slots = normalizeUniversalSlots({ slots: [
    { quad: [{x:0,y:0},{x:.4,y:0},{x:.4,y:.4},{x:0,y:.4}] },
    { quad: [{x:.5,y:.5},{x:1,y:.5},{x:1,y:1},{x:.5,y:1}] },
  ]});
  const mapped = mapArtworksToSlots(1, slots);
  assert.equal(mapped[0].artworkIndex, 0);
  assert.equal(mapped[1].artworkIndex, null);
  assert.equal(slots[0].artworkIndex, undefined);
});

test('refinement plan is conservative and cannot request content rewrites', () => {
  const plan = normalizeRefinementPlan({
    summary: 'ok',
    slots: [{
      index: 1,
      preserveLight: 2,
      brightness: 5,
      contrast: -1,
      saturation: 9,
      opacity: 0.1,
      blend: 'difference',
    }],
  }, 1);
  assert.equal(plan.artworkFidelityLocked, true);
  assert.equal(plan.slots[0].preserveLight, 1);
  assert.equal(plan.slots[0].brightness, 1.18);
  assert.equal(plan.slots[0].contrast, 0.82);
  assert.equal(plan.slots[0].saturation, 1.12);
  assert.equal(plan.slots[0].opacity, 0.86);
  assert.equal(plan.slots[0].blend, 'source-over');
});

test('normalized quad converts to canvas pixels', () => {
  assert.deepEqual(
    quadToPixels([{x:.1,y:.2},{x:.9,y:.2},{x:.9,y:.8},{x:.1,y:.8}], 1000, 500),
    [{x:100,y:100},{x:900,y:100},{x:900,y:400},{x:100,y:400}],
  );
});

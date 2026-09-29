import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUIDED_STATUS,
  addGuidedSurfaces,
  assignGuidedArtwork,
  autoAssignGuidedArtworks,
  containedArtworkQuad,
  freezeAllPreviews,
  freezeGuidedSurface,
  guidedComplete,
  guidedProgress,
  moveGuidedSurface,
  occupiedQuads,
  remainingArtworkIndices,
  removeGuidedSurface,
  unfreezeGuidedSurface,
} from '../src/guided-multi-art.js';

const surface = (id, x = 0.1) => ({
  id,
  label: `surface ${id}`,
  confidence: 0.9,
  quad: [
    { x, y: 0.1 },
    { x: x + 0.2, y: 0.1 },
    { x: x + 0.2, y: 0.3 },
    { x, y: 0.3 },
  ],
});

test('guided workflow applies, approves and freezes one surface at a time', () => {
  let mapping = addGuidedSurfaces([], [surface('one')]);
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.AVAILABLE);
  mapping = assignGuidedArtwork(mapping, 'one', 0);
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.PREVIEW);
  assert.equal(mapping[0].artworkIndex, 0);
  mapping = freezeGuidedSurface(mapping, 'one');
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.FROZEN);
  assert.equal(mapping[0].frozen, true);
  assert.equal(guidedComplete(mapping, 1), true);
});

test('unfreezing and replacing artwork keeps other approved surfaces frozen', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.5)]);
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'one', 0), 'one');
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'two', 1), 'two');
  mapping = unfreezeGuidedSurface(mapping, 'two');
  mapping = assignGuidedArtwork(mapping, 'two', 2);
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.FROZEN);
  assert.equal(mapping[0].artworkIndex, 0);
  assert.equal(mapping[1].guidedStatus, GUIDED_STATUS.PREVIEW);
  assert.equal(mapping[1].artworkIndex, 2);
});

test('a frozen artwork cannot be silently stolen by another surface', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.5)]);
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'one', 0), 'one');
  mapping = assignGuidedArtwork(mapping, 'two', 0);
  assert.equal(mapping[0].artworkIndex, 0);
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.FROZEN);
  assert.equal(mapping[1].artworkIndex, null);
});

test('areas can be reordered without losing their artwork or approval state', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.5)]);
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'two', 1), 'two');
  mapping = moveGuidedSurface(mapping, 'two', -1);
  assert.deepEqual(mapping.map((slot) => slot.id), ['two', 'one']);
  assert.equal(mapping[0].index, 1);
  assert.equal(mapping[0].guidedStatus, GUIDED_STATUS.FROZEN);
  assert.equal(mapping[0].artworkIndex, 1);
});

test('hybrid auto-assign fills only remaining artworks into available surfaces', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.4), surface('three', 0.7)]);
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'one', 1), 'one');
  mapping = autoAssignGuidedArtworks(mapping, 3);
  assert.equal(mapping.find((slot) => slot.id === 'one').guidedStatus, GUIDED_STATUS.FROZEN);
  assert.deepEqual(remainingArtworkIndices(mapping, 3), []);
  assert.equal(mapping.filter((slot) => slot.guidedStatus === GUIDED_STATUS.PREVIEW).length, 2);
  mapping = freezeAllPreviews(mapping);
  assert.equal(guidedComplete(mapping, 3), true);
});

test('removing a rejected surface releases its artwork and exclusion geometry', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.5)]);
  mapping = assignGuidedArtwork(mapping, 'one', 0);
  mapping = removeGuidedSurface(mapping, 'one');
  assert.deepEqual(remainingArtworkIndices(mapping, 2), [0, 1]);
  assert.equal(occupiedQuads(mapping).length, 1);
});

test('progress reports frozen, preview and remaining work', () => {
  let mapping = addGuidedSurfaces([], [surface('one'), surface('two', 0.5)]);
  mapping = freezeGuidedSurface(assignGuidedArtwork(mapping, 'one', 0), 'one');
  mapping = assignGuidedArtwork(mapping, 'two', 1);
  assert.deepEqual(guidedProgress(mapping, 3), {
    artworkCount: 3,
    surfaceCount: 2,
    frozen: 1,
    previews: 1,
    remaining: 2,
    complete: false,
  });
});

test('contained artwork quad preserves portrait art inside a landscape surface', () => {
  const quad = [
    { x: 0, y: 0 },
    { x: 1600, y: 0 },
    { x: 1600, y: 900 },
    { x: 0, y: 900 },
  ];
  const fitted = containedArtworkQuad(quad, 900, 1600, 1);
  const fittedWidth = fitted[1].x - fitted[0].x;
  const fittedHeight = fitted[3].y - fitted[0].y;
  assert.ok(fittedWidth < 1600);
  assert.equal(Math.round(fittedHeight), 900);
  assert.ok(Math.abs((fittedWidth / fittedHeight) - (900 / 1600)) < 0.001);
});

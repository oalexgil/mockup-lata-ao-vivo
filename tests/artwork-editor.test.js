import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artworkAdjustmentSnapshot,
  artworkFitRect,
  artworkKey,
  defaultArtworkAdjustments,
  effectiveArtworkOpacity,
  getArtworkAdjustments,
  normalizeArtworkAdjustments,
  resetArtworkAdjustments,
  setArtworkAdjustments,
} from '../src/artwork-editor.js';

test('artwork adjustments normalize ranges without mutating defaults', () => {
  const defaults = defaultArtworkAdjustments();
  const normalized = normalizeArtworkAdjustments({ brightness: 9, opacity: -4, fit: 'invalid' });
  assert.equal(normalized.brightness, 1.5);
  assert.equal(normalized.opacity, 0);
  assert.equal(normalized.fit, 'contain');
  assert.equal(defaults.brightness, 1);
  assert.equal(defaults.opacity, 1);
});

test('artwork store is non-destructive and resettable', () => {
  const key = artworkKey({ name: 'brand.png', lastModified: 42, size: 100 }, 0);
  const sameDerivedKey = artworkKey({ name: 'brand.png', lastModified: 42, size: 9999 }, 0);
  assert.equal(key, sameDerivedKey);
  setArtworkAdjustments(key, { contrast: 1.25, safeMargin: 0.12 });
  assert.equal(getArtworkAdjustments(key).contrast, 1.25);
  const snapshot = artworkAdjustmentSnapshot(key);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.safeMargin, 0.12);
  resetArtworkAdjustments(key);
  assert.equal(getArtworkAdjustments(key).contrast, 1);
});

test('effective opacity combines opacity and transparency', () => {
  const value = effectiveArtworkOpacity({ opacity: 0.8, transparency: 0.25 });
  assert.ok(Math.abs(value - 0.6) < Number.EPSILON * 4);
});

test('fit rect preserves source ratio and honors safe margin', () => {
  const rect = artworkFitRect(1000, 500, 1000, 1000, { fit: 'contain', safeMargin: 0.1 });
  assert.equal(rect.width, 800);
  assert.equal(rect.height, 400);
  assert.equal(rect.innerWidth, 800);
  assert.equal(rect.innerHeight, 800);
});

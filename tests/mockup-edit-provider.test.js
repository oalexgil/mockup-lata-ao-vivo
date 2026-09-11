import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMockupEditPrompt,
  mockupEditModel,
  normalizeEditDimensions,
  parseReferenceDataUrl,
} from '../server/mockup-edit-provider.js';

test('direct editor defaults to Cloudflare FLUX.2 klein multi-reference model', () => {
  assert.equal(mockupEditModel({}), '@cf/black-forest-labs/flux-2-klein-4b');
});

test('reference data URL parser accepts png and rejects non-image input', () => {
  const parsed = parseReferenceDataUrl('data:image/png;base64,aGVsbG8=');
  assert.equal(parsed.mime, 'image/png');
  assert.equal(parsed.buffer.toString('utf8'), 'hello');
  assert.throws(() => parseReferenceDataUrl('data:text/plain;base64,aGVsbG8='), /Referência de imagem inválida/);
});

test('output dimensions preserve approximate source aspect ratio and stay in model bounds', () => {
  const wide = normalizeEditDimensions(1600, 900);
  assert.ok(wide.width >= wide.height);
  assert.ok(wide.width <= 1920 && wide.height >= 256);
  assert.ok(Math.abs((wide.width / wide.height) - (16 / 9)) < 0.15);
});

test('root edit prompt distinguishes scene from immutable brand reference', () => {
  const prompt = buildMockupEditPrompt('apply on the front face');
  assert.match(prompt, /Image 0 is the approved mockup scene/);
  assert.match(prompt, /Image 1 is the uploaded artwork\/label/);
  assert.match(prompt, /source of truth for the brand/);
  assert.match(prompt, /do not translate or intentionally rewrite wording/);
  assert.match(prompt, /User placement instruction: apply on the front face/);
});

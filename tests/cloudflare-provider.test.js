import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCloudflarePayload,
  buildReferenceScenePrompt,
  cloudflareConfigured,
  cloudflareModel,
  cloudflareReferenceModel,
  collectSceneReferenceInputs,
  extractCloudflareImage,
  isValidCloudflareModel,
  sanitizeCloudflareRequest,
} from '../server/cloudflare-provider.js';

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';

test('validates Cloudflare Workers AI model ids', () => {
  assert.equal(isValidCloudflareModel('@cf/black-forest-labs/flux-1-schnell'), true);
  assert.equal(isValidCloudflareModel('flux-1-schnell'), false);
  assert.equal(isValidCloudflareModel('../../bad'), false);
});

test('sanitizes prompt, steps and seed metadata', () => {
  const previous = process.env.CLOUDFLARE_IMAGE_STEPS;
  process.env.CLOUDFLARE_IMAGE_STEPS = '99';
  const result = sanitizeCloudflareRequest({ prompt: '  mockup limpo  ', seed: 42 });
  assert.equal(result.prompt, 'mockup limpo');
  assert.equal(result.steps, 8);
  assert.equal(result.seed, 42);
  if (previous === undefined) delete process.env.CLOUDFLARE_IMAGE_STEPS;
  else process.env.CLOUDFLARE_IMAGE_STEPS = previous;
});

test('omits seed from FLUX.1 Schnell REST payload', () => {
  const request = { prompt: 'mockup limpo', steps: 4, seed: 42 };
  const payload = buildCloudflarePayload(request, '@cf/black-forest-labs/flux-1-schnell');
  assert.deepEqual(payload, { prompt: 'mockup limpo', steps: 4 });
  assert.equal('seed' in payload, false);
});

test('detects configuration without exposing secrets', () => {
  assert.equal(cloudflareConfigured({ CLOUDFLARE_ACCOUNT_ID: 'abc', CLOUDFLARE_API_TOKEN: 'token' }), true);
  assert.equal(cloudflareConfigured({ CLOUDFLARE_ACCOUNT_ID: 'abc' }), false);
});

test('falls back to the supported default models for invalid input', () => {
  assert.equal(cloudflareModel({ CLOUDFLARE_IMAGE_MODEL: 'not-a-model' }), '@cf/black-forest-labs/flux-1-schnell');
  assert.equal(cloudflareReferenceModel({ CLOUDFLARE_SCENE_REFERENCE_MODEL: 'not-a-model' }), '@cf/black-forest-labs/flux-2-klein-4b');
});

test('extracts base64 image from Cloudflare response envelope', () => {
  assert.equal(extractCloudflareImage({ result: { image: 'abc123' } }), 'abc123');
  assert.equal(extractCloudflareImage({ image: 'fallback' }), 'fallback');
});

test('collects previous scene and reference roles for FLUX.2 with a four-image cap', () => {
  const inputs = collectSceneReferenceInputs({
    previousImage: ONE_PIXEL_PNG,
    references: [
      { role: 'product', name: 'produto.png', dataUrl: ONE_PIXEL_PNG },
      { role: 'scene', name: 'cena.png', dataUrl: ONE_PIXEL_PNG },
      { role: 'scene', name: 'cena-2.png', dataUrl: ONE_PIXEL_PNG },
      { role: 'scene', name: 'cena-3.png', dataUrl: ONE_PIXEL_PNG },
    ],
  });
  assert.equal(inputs.length, 4);
  assert.deepEqual(inputs.map((input) => input.role), ['previous', 'product', 'scene', 'scene']);
});

test('reference prompt gives product and scene images distinct responsibilities', () => {
  const inputs = collectSceneReferenceInputs({
    references: [
      { role: 'product', name: 'produto.png', dataUrl: ONE_PIXEL_PNG },
      { role: 'scene', name: 'cena.png', dataUrl: ONE_PIXEL_PNG },
    ],
  });
  const prompt = buildReferenceScenePrompt('gere quatro superfícies', inputs);
  assert.match(prompt, /Image 0 is a product\/model\/object reference/i);
  assert.match(prompt, /Image 1 is a scene\/style reference/i);
  assert.match(prompt, /active generation inputs/i);
});

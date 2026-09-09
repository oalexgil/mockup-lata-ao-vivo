import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloudflareConfigured,
  cloudflareModel,
  extractCloudflareImage,
  isValidCloudflareModel,
  sanitizeCloudflareRequest,
} from '../server/cloudflare-provider.js';

test('validates Cloudflare Workers AI model ids', () => {
  assert.equal(isValidCloudflareModel('@cf/black-forest-labs/flux-1-schnell'), true);
  assert.equal(isValidCloudflareModel('flux-1-schnell'), false);
  assert.equal(isValidCloudflareModel('../../bad'), false);
});

test('sanitizes prompt, steps and seed', () => {
  const previous = process.env.CLOUDFLARE_IMAGE_STEPS;
  process.env.CLOUDFLARE_IMAGE_STEPS = '99';
  const result = sanitizeCloudflareRequest({ prompt: '  mockup limpo  ', seed: 42 });
  assert.equal(result.prompt, 'mockup limpo');
  assert.equal(result.steps, 8);
  assert.equal(result.seed, 42);
  if (previous === undefined) delete process.env.CLOUDFLARE_IMAGE_STEPS;
  else process.env.CLOUDFLARE_IMAGE_STEPS = previous;
});

test('detects configuration without exposing secrets', () => {
  assert.equal(cloudflareConfigured({ CLOUDFLARE_ACCOUNT_ID: 'abc', CLOUDFLARE_API_TOKEN: 'token' }), true);
  assert.equal(cloudflareConfigured({ CLOUDFLARE_ACCOUNT_ID: 'abc' }), false);
});

test('falls back to the supported default model for invalid input', () => {
  assert.equal(cloudflareModel({ CLOUDFLARE_IMAGE_MODEL: 'not-a-model' }), '@cf/black-forest-labs/flux-1-schnell');
});

test('extracts base64 image from Cloudflare response envelope', () => {
  assert.equal(extractCloudflareImage({ result: { image: 'abc123' } }), 'abc123');
  assert.equal(extractCloudflareImage({ image: 'fallback' }), 'fallback');
});

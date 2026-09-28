import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pollinationsCanHandle,
  pollinationsConfigured,
  pollinationsModel,
} from '../server/pollinations-provider.js';

test('Pollinations is opt-in through a server-side key', () => {
  assert.equal(pollinationsConfigured({}), false);
  assert.equal(pollinationsConfigured({ POLLINATIONS_API_KEY: 'sk_test' }), true);
});

test('Pollinations beta fallback only handles text-only scene generation', () => {
  assert.equal(pollinationsCanHandle({ prompt: 'clean product scene' }), true);
  assert.equal(pollinationsCanHandle({ references: [{ dataUrl: 'data:image/png;base64,abc' }] }), false);
  assert.equal(pollinationsCanHandle({ previousImage: 'data:image/png;base64,abc' }), false);
});

test('Pollinations model defaults safely and can be overridden', () => {
  assert.equal(pollinationsModel({}), 'flux');
  assert.equal(pollinationsModel({ POLLINATIONS_IMAGE_MODEL: 'zimage' }), 'zimage');
});

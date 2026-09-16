import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractImageResult,
  isSafeImageDataUrl,
  parseSlotResponse,
  sanitizeGenerationRequest,
} from '../server/openai-provider.js';

const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';

test('accepts safe image data URLs and rejects unrelated data', () => {
  assert.equal(isSafeImageDataUrl(tinyPng), true);
  assert.equal(isSafeImageDataUrl('data:text/html;base64,PGgxPg=='), false);
  assert.equal(isSafeImageDataUrl('https://example.com/a.png'), false);
});

test('sanitizes generation requests and caps slot count', () => {
  const request = sanitizeGenerationRequest({
    prompt: '  crie um mockup limpo  ',
    references: [{ role: 'scene', dataUrl: tinyPng }, { role: 'bad', dataUrl: 'nope' }],
    previousImage: tinyPng,
    output: { maxSlots: 99 },
  });
  assert.equal(request.prompt, 'crie um mockup limpo');
  assert.equal(request.references.length, 1);
  assert.equal(request.previousImage, tinyPng);
  assert.equal(request.maxSlots, 12);
});

test('extracts generated image result from Responses output', () => {
  const result = extractImageResult({
    output: [
      { type: 'message', content: [] },
      { type: 'image_generation_call', result: 'abc123' },
    ],
  });
  assert.equal(result, 'abc123');
});

test('parses normalized mockup slots and rejects invalid coordinates', () => {
  const slots = parseSlotResponse(JSON.stringify({ slots: [
    {
      id: 'screen', label: 'Tela', confidence: 0.9,
      quad: [{x:.1,y:.1},{x:.8,y:.1},{x:.8,y:.7},{x:.1,y:.7}],
    },
    {
      id: 'bad', label: 'Fora', confidence: 0.2,
      quad: [{x:-1,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],
    },
  ] }), 8);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, 'screen');
});

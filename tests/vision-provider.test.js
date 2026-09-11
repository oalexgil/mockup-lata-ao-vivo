import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniversalFallbackSlots,
  parseJsonText,
  sanitizeJsonText,
} from '../server/vision-provider.js';

test('vision parser accepts fenced JSON with prose around it', () => {
  const input = `Aqui está o resultado:\n\n\`\`\`json\n{
    "slots": [{
      "id": "1",
      "label": "surface",
      "confidence": 0.92,
      "quad": [
        {"x": 0.2, "y": 0.2},
        {"x": 0.8, "y": 0.2},
        {"x": 0.8, "y": 0.8},
        {"x": 0.2, "y": 0.8}
      ]
    }]
  }\n\`\`\`\nFim.`;
  const parsed = parseJsonText(input);
  assert.equal(parsed.slots.length, 1);
  assert.equal(parsed.slots[0].confidence, 0.92);
});

test('vision parser removes trailing commas and ignores text after first balanced object', () => {
  const input = `analysis: {"slots":[{"id":"1","label":"screen","confidence":0.8,"quad":[{"x":0.1,"y":0.1},{"x":0.9,"y":0.1},{"x":0.9,"y":0.9},{"x":0.1,"y":0.9}],}],} extra {"ignored":true}`;
  const sanitized = sanitizeJsonText(input);
  assert.equal(sanitized.includes('ignored'), false);
  const parsed = parseJsonText(input);
  assert.equal(parsed.slots[0].label, 'screen');
});

test('vision parser normalizes smart double quotes', () => {
  const parsed = parseJsonText('“prefix” {“slots”:[]} suffix');
  assert.deepEqual(parsed, { slots: [] });
});

test('vision parser rejects content without a JSON object', () => {
  assert.throws(
    () => parseJsonText('não foi possível analisar a imagem'),
    /JSON inválido/,
  );
});

test('universal fallback is generic, conservative and review-only', () => {
  const slots = createUniversalFallbackSlots();
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, 'fallback-1');
  assert.equal(slots[0].confidence, 0.1);
  assert.match(slots[0].label, /provisória/i);
  assert.deepEqual(slots[0].quad, [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ]);
});

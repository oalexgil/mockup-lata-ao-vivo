import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniversalFallbackSlots,
  extractStructuredVisionResult,
  hasRequestedVisionCoverage,
  layoutVisionResponseFormat,
  parseJsonText,
  refinementVisionResponseFormat,
  sanitizeJsonText,
  singleApplicationRootPrompt,
  singleApplicationVisionResponseFormat,
  sortVisionSlots,
  usableVisionSlots,
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

test('Cloudflare JSON mode structured response is accepted without text parsing', () => {
  const response = {
    success: true,
    result: {
      response: {
        slots: [{
          id: '1',
          label: 'front panel',
          confidence: 0.94,
          quad: [
            { x: 0.2, y: 0.2 },
            { x: 0.8, y: 0.2 },
            { x: 0.8, y: 0.8 },
            { x: 0.2, y: 0.8 },
          ],
        }],
      },
    },
  };
  const parsed = extractStructuredVisionResult(response);
  assert.equal(parsed.slots[0].label, 'front panel');
  assert.equal(parsed.slots[0].confidence, 0.94);
});

test('layout JSON mode contract requires bounded normalized coordinates', () => {
  const format = layoutVisionResponseFormat();
  assert.equal(format.type, 'json_schema');
  assert.deepEqual(format.json_schema.required, ['slots']);
  const item = format.json_schema.properties.slots.items;
  const quad = item.properties.quad;
  assert.equal(quad.minItems, 4);
  assert.equal(quad.maxItems, 4);
  assert.deepEqual(quad.items.required, ['x', 'y']);
  assert.equal(quad.items.properties.x.minimum, 0);
  assert.equal(quad.items.properties.x.maximum, 1);
  assert.equal(quad.items.properties.y.minimum, 0);
  assert.equal(quad.items.properties.y.maximum, 1);
  assert.equal(item.properties.confidence.minimum, 0);
  assert.equal(item.properties.confidence.maximum, 1);
});

test('multi-art layout schema caps the response at the requested surface count', () => {
  const format = layoutVisionResponseFormat(4);
  const slots = format.json_schema.properties.slots;
  assert.equal(slots.minItems, 1);
  assert.equal(slots.maxItems, 4);
});

test('vision surface gate rejects object interiors and degenerate quads', () => {
  const goodQuad = [
    { x: 0.3, y: 0.25 },
    { x: 0.7, y: 0.25 },
    { x: 0.68, y: 0.75 },
    { x: 0.32, y: 0.75 },
  ];
  const interior = usableVisionSlots({ slots: [{
    id: '1',
    label: 'Cup interior',
    confidence: 0.95,
    quad: goodQuad,
  }] }, 1);
  assert.equal(interior.length, 0);

  const degenerate = usableVisionSlots({ slots: [{
    id: '1',
    label: 'front printable surface',
    confidence: 0.95,
    quad: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
  }] }, 1);
  assert.equal(degenerate.length, 0);

  const valid = usableVisionSlots({ slots: [{
    id: '1',
    label: 'front printable surface',
    confidence: 0.95,
    quad: goodQuad,
  }] }, 1);
  assert.equal(valid.length, 1);
});

test('multi-art coverage rejects the partial one-of-four mapping seen in Studio', () => {
  const oneSurface = {
    slots: [{
      id: 'center',
      label: 'center card',
      confidence: 0.96,
      quad: [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.4 },
        { x: 0.6, y: 0.62 },
        { x: 0.4, y: 0.62 },
      ],
    }],
  };
  assert.equal(hasRequestedVisionCoverage(oneSurface, 4), false);
});

test('multi-art coverage accepts four valid surfaces and sorts them in visual reading order', () => {
  const makeSlot = (id, x, y) => ({
    id,
    label: `panel ${id}`,
    confidence: 0.9,
    quad: [
      { x, y },
      { x: x + 0.18, y },
      { x: x + 0.18, y: y + 0.18 },
      { x, y: y + 0.18 },
    ],
  });
  const input = {
    slots: [
      makeSlot('bottom-right', 0.62, 0.62),
      makeSlot('top-right', 0.62, 0.18),
      makeSlot('bottom-left', 0.18, 0.62),
      makeSlot('top-left', 0.18, 0.18),
    ],
  };
  assert.equal(hasRequestedVisionCoverage(input, 4), true);
  const sorted = sortVisionSlots(usableVisionSlots(input, 4));
  assert.deepEqual(sorted.map((slot) => slot.id), ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
});

test('one-step application JSON contract combines target geometry and safe integration', () => {
  const format = singleApplicationVisionResponseFormat();
  assert.equal(format.type, 'json_schema');
  assert.deepEqual(format.json_schema.required, ['summary', 'target', 'integration']);
  const target = format.json_schema.properties.target;
  assert.deepEqual(target.required, ['id', 'label', 'confidence', 'quad']);
  assert.equal(target.properties.quad.minItems, 4);
  assert.equal(target.properties.quad.maxItems, 4);
  const integration = format.json_schema.properties.integration;
  assert.ok(integration.required.includes('preserveLight'));
  assert.ok(integration.required.includes('brightness'));
  assert.ok(integration.required.includes('opacity'));
  assert.ok(integration.required.includes('blend'));
});

test('rooted application prompt locks brand pixels and delegates only physical integration', () => {
  const prompt = singleApplicationRootPrompt();
  assert.match(prompt, /immutable artwork/i);
  assert.match(prompt, /never rewrite, redraw, recolor/i);
  assert.match(prompt, /browser will render the original uploaded pixels/i);
  assert.match(prompt, /perspective/i);
  assert.match(prompt, /illumination/i);
});

test('refinement JSON mode contract requires brand-safe integration fields', () => {
  const format = refinementVisionResponseFormat();
  const item = format.json_schema.properties.slots.items;
  assert.ok(item.required.includes('brightness'));
  assert.ok(item.required.includes('opacity'));
  assert.ok(item.required.includes('blend'));
  assert.equal(item.properties.blend.type, 'string');
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

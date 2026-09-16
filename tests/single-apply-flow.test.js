import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync(new URL('../studio-universal.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const provider = fs.readFileSync(new URL('../server/mockup-edit-provider.js', import.meta.url), 'utf8');

test('single artwork uses direct AI render endpoint with scene and artwork references', () => {
  assert.match(studio, /Aplicar mockup com IA/);
  assert.match(studio, /fetch\(['"]\/api\/render-mockup['"]/);
  assert.match(studio, /sceneImageDataUrl: sceneReference/);
  assert.match(studio, /artworkImageDataUrl: artworkReference/);
  assert.match(server, /\/api\/render-mockup/);
  assert.match(server, /renderMockupWithAI/);
});

test('single artwork upload starts automatic direct render without requiring a typed prompt', () => {
  assert.match(studio, /expected === 1\) applySingleWithAI\(\)/);
  assert.match(studio, /instruction = String\(\$\(['"]mockupApplyInstruction['"]\)/);
  assert.match(studio, /instruction,/);
});

test('references are resized below Cloudflare multi-reference image limit', () => {
  assert.match(studio, /resizeSourceToDataUrl\(baseCanvas, 480/);
  assert.match(studio, /resizeSourceToDataUrl\(artwork\.image, 480/);
});

test('optional placement instruction remains available and rooted prompt protects brand identity', () => {
  assert.match(studio, /id = ['"]mockupApplyInstruction['"]/);
  assert.match(studio, /Instrução opcional/);
  assert.match(provider, /source of truth for the brand/);
  assert.match(provider, /do not translate or intentionally rewrite wording/);
  assert.match(provider, /perspective, scale, rotation, curvature/);
});

test('advanced deterministic mapping remains available for exact-fidelity fallback', () => {
  assert.match(studio, /Revisar áreas \/ fidelidade exata/);
  assert.match(studio, /fetch\(['"]\/api\/analyze-layout['"]/);
  assert.match(studio, /uploadedFileCount\(\) === 1 \? applySingleWithAI\(\) : analyzeLayout\(\)/);
  assert.match(studio, /warpArtwork\(/);
});

test('direct render is exportable locally without surface validation', () => {
  assert.match(studio, /if \(U\.directRenderReady\)/);
  assert.match(studio, /mockup-vision-ai\.png/);
  assert.match(studio, /toDataURL\(['"]image\/png['"]\)/);
});

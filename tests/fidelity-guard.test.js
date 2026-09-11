import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard = fs.readFileSync(new URL('../studio-fidelity-guard.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

test('exact fidelity intercepts direct render and uses validated deterministic application plan', () => {
  assert.match(guard, /fidelityApplicationStrategy/);
  assert.match(guard, /deterministic-exact/);
  assert.match(guard, /nextFetch\(['"]\/api\/apply-plan['"]/);
  assert.match(guard, /surfaceValidated/);
});

test('exact fidelity uses the original uploaded file and preserves aspect ratio with safe fit geometry', () => {
  assert.match(guard, /brandFiles/);
  assert.match(guard, /fileToDataUrl\(artworkFile\)/);
  assert.match(guard, /fitArtworkQuad\(/);
  assert.match(guard, /artworkOriginalPixelsUsed: true/);
  assert.match(guard, /imageSmoothingQuality = ['"]high['"]/);
});

test('unsafe exact application is blocked instead of silently falling back to generative deformation', () => {
  assert.match(guard, /deterministic-exact-blocked/);
  assert.match(guard, /status: 422/);
  assert.match(guard, /proteg.*arte|proteger.*arte|deforma/i);
});

test('fidelity guard is loaded before the universal renderer', () => {
  const guardIndex = server.indexOf('studio-fidelity-guard.js');
  const universalIndex = server.indexOf('studio-universal.js');
  assert.ok(guardIndex >= 0, 'fidelity guard must be injected');
  assert.ok(universalIndex > guardIndex, 'fidelity guard must wrap fetch before universal renderer boots');
});

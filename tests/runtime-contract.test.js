import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('runtime dependencies are version-pinned', () => {
  assert.match(html, /three@0\.128\.0/);
  assert.match(html, /@mediapipe\/tasks-vision@0\.10\.14/);
});

test('detector keeps Lite2 and Lite0 model fallback', () => {
  assert.match(html, /efficientdet_lite2/);
  assert.match(html, /efficientdet_lite0/);
  const lite2 = html.indexOf('efficientdet_lite2');
  const lite0 = html.indexOf('efficientdet_lite0');
  assert.ok(lite2 >= 0 && lite0 > lite2, 'Lite2 should remain the first model and Lite0 the fallback');
});

test('automatic detection failure preserves manual mode', () => {
  assert.match(html, /setMode\(['"]manual['"]\)/);
  assert.match(html, /detector indisponível[^\n]*modo manual/i);
});

test('four-corner manual fitting remains available', () => {
  assert.match(html, /id=['"]btnCorners['"]/);
  assert.match(html, /S\.corners\.length===4/);
});

test('camera and photo inputs both remain supported', () => {
  assert.match(html, /id=['"]srcCam['"]/);
  assert.match(html, /id=['"]srcPhoto['"]/);
  assert.match(html, /id=['"]photoFile['"]/);
});

test('user output is exported locally as PNG', () => {
  assert.match(html, /toDataURL\(['"]image\/png['"]\)/);
  assert.match(html, /mockup-lata-/);
});

test('runtime does not contain an application upload request', () => {
  assert.doesNotMatch(html, /\bFormData\b/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
});

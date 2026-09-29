import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../photo.html', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../studio-workspace.js', import.meta.url), 'utf8');
const ux = fs.readFileSync(new URL('../studio-ux.js', import.meta.url), 'utf8');

test('scene upload is a first-class source instead of a hidden fallback', () => {
  assert.match(html, /id="sceneSourceUpload"/);
  assert.match(html, />Subir cena pronta</);
  assert.match(html, /id="sceneUploadPanel"/);
  assert.match(html, /id="photoFile"/);
  assert.doesNotMatch(html, /<details[^>]*>\s*<summary[^>]*>Ou usar uma foto existente/);
});

test('scene source switch defaults to upload and can opt into generation', () => {
  assert.match(workspace, /function setSceneSourceMode\(mode = 'upload'/);
  assert.match(workspace, /sceneSourceGenerate/);
  assert.match(workspace, /sceneGeneratePanel/);
  assert.match(workspace, /mockup:soft-reset/);
});

test('scene approval remains outside a hidden source panel', () => {
  assert.match(ux, /sceneSourcePanels/);
  assert.match(ux, /insertAdjacentElement\('afterend', box\)/);
});

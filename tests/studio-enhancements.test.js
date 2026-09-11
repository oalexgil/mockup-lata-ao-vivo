import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancements = fs.readFileSync(new URL('../studio-enhancements.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');

test('studio injects fidelity enhancement module', () => {
  assert.match(server, /studio-enhancements\.js/);
});

test('fidelity UX defaults to maximum preservation', () => {
  assert.match(enhancements, /id="mockupFidelityMode"/);
  assert.match(enhancements, /value="exact">Fidelidade máxima/);
  assert.match(enhancements, /id="preserveAspectRatio"[^>]*checked/);
  assert.match(enhancements, /id="limitDeformation"[^>]*checked/);
  assert.match(enhancements, /id="safeMargins"[^>]*checked/);
});

test('direct mockup requests receive fidelity controls without changing core renderer', () => {
  assert.match(enhancements, /\/api\/render-mockup/);
  assert.match(enhancements, /fidelityMode/);
  assert.match(enhancements, /preserveAspectRatio/);
  assert.match(enhancements, /limitDeformation/);
  assert.match(enhancements, /safeMargins/);
});

test('one-click new mockup performs a soft reset without browser navigation', () => {
  assert.match(enhancements, /id="newMockupBtn"/);
  assert.match(enhancements, /Novo mockup/);
  assert.match(enhancements, /function softResetStudio/);
  assert.match(enhancements, /freshSessionPending = true/);
  assert.match(enhancements, /previousImage: null/);
  assert.match(enhancements, /brandFiles.*dispatchEvent/s);
  assert.doesNotMatch(enhancements, /location\.replace/);
  assert.doesNotMatch(enhancements, /location\.reload/);
});

test('old visual versions stay hidden after a new soft-reset session', () => {
  assert.match(enhancements, /hiddenVersionCount/);
  assert.match(enhancements, /MutationObserver/);
  assert.match(enhancements, /index < hiddenVersionCount/);
});

test('uploaded artworks can be replaced or deleted and the file list is rebuilt', () => {
  assert.match(enhancements, /function replaceBrandFileList/);
  assert.match(enhancements, /new DataTransfer\(\)/);
  assert.match(enhancements, /function deleteBrandFile/);
  assert.match(enhancements, /function replaceBrandFile/);
  assert.match(enhancements, /asset-delete/);
  assert.match(enhancements, /asset-replace/);
});

test('multiple artworks activate automatic multi-art mapping UX', () => {
  assert.match(enhancements, /modo multi-art/);
  assert.match(enhancements, /count > 1/);
  assert.match(enhancements, /desiredSlots/);
  assert.match(enhancements, /arquivos originais/);
  assert.match(enhancements, /mockup:mapping-ready/);
});

test('export UI supports PNG JPEG and enlarged pixel dimensions', () => {
  assert.match(enhancements, /id="mockupExportFormat"/);
  assert.match(enhancements, /value="png">PNG/);
  assert.match(enhancements, /value="jpeg">JPEG/);
  assert.match(enhancements, /id="mockupExportScale"/);
  assert.match(enhancements, /value="2">2× pixels/);
  assert.match(enhancements, /value="4">4× pixels/);
  assert.match(enhancements, /id="mockupJpegQuality"/);
  assert.match(enhancements, /image\/jpeg/);
  assert.match(enhancements, /image\/png/);
});

test('high-resolution export composites base and universal overlay with quality resampling', () => {
  assert.match(enhancements, /function compositeVisibleMockup/);
  assert.match(enhancements, /imageSmoothingQuality = 'high'/);
  assert.match(enhancements, /drawImage\(base/);
  assert.match(enhancements, /drawImage\(overlay/);
  assert.match(enhancements, /maxDimension = 8192/);
});

test('direct AI completion is bridged to final workflow state', () => {
  assert.match(enhancements, /mockup:direct-rendered/);
  assert.match(enhancements, /mockup:ai-finalized/);
});

test('visual polish includes responsive layout and explicit focus states', () => {
  assert.match(enhancements, /grid-template-columns:410px/);
  assert.match(enhancements, /textarea:focus/);
  assert.match(enhancements, /@media\(max-width:900px\)/);
});

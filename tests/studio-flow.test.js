import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveScene,
  autoApplyMessage,
  canApproveScene,
  createFlowState,
  flowStep,
  markAutoApplied,
  reopenScene,
  setArtworkCount,
  setFineTuneOpen,
} from '../src/studio-flow.js';

test('scene must exist before approval', () => {
  const empty = createFlowState();
  assert.equal(canApproveScene(empty), false);
  assert.equal(approveScene(empty).sceneApproved, false);

  const ready = createFlowState({ sceneReady: true });
  assert.equal(canApproveScene(ready), true);
  assert.equal(approveScene(ready).sceneApproved, true);
});

test('reopening scene revokes approval and automatic application', () => {
  const approved = markAutoApplied(setArtworkCount(approveScene({ sceneReady: true }), 1));
  assert.equal(approved.sceneApproved, true);
  assert.equal(approved.autoApplied, true);

  const reopened = reopenScene(approved);
  assert.equal(reopened.sceneApproved, false);
  assert.equal(reopened.autoApplied, false);
  assert.equal(reopened.fineTuneOpen, false);
});

test('automatic application requires approved scene and artwork', () => {
  assert.equal(markAutoApplied({ sceneReady: true, artworkCount: 1 }).autoApplied, false);
  assert.equal(markAutoApplied({ sceneReady: true, sceneApproved: true, artworkCount: 0 }).autoApplied, false);
  assert.equal(markAutoApplied({ sceneReady: true, sceneApproved: true, artworkCount: 2 }).autoApplied, true);
});

test('fine tuning only opens after automatic application', () => {
  const approved = createFlowState({ sceneReady: true, sceneApproved: true, artworkCount: 1 });
  assert.equal(setFineTuneOpen(approved, true).fineTuneOpen, false);

  const applied = markAutoApplied(approved);
  assert.equal(setFineTuneOpen(applied, true).fineTuneOpen, true);
});

test('flow advances through brief, scene, artworks and final mockup', () => {
  assert.equal(flowStep({}), 1);
  assert.equal(flowStep({ sceneReady: true }), 2);
  assert.equal(flowStep({ sceneReady: true, sceneApproved: true }), 3);
  assert.equal(flowStep({ sceneReady: true, sceneApproved: true, artworkCount: 1 }), 4);
});

test('auto apply summary explains mismatch between artworks and slots', () => {
  assert.match(autoApplyMessage(1, 1), /1 arte/);
  assert.match(autoApplyMessage(2, 4), /2 área/);
  assert.match(autoApplyMessage(4, 2), /2 arte/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveScene,
  canApproveScene,
  createFlowState,
  flowStep,
  markAiFinalized,
  markMappingReady,
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

test('reopening scene revokes mapping and AI finalization', () => {
  let state = approveScene({ sceneReady: true });
  state = setArtworkCount(state, 1);
  state = markMappingReady(state, true);
  state = markAiFinalized(state);
  assert.equal(state.aiFinalized, true);

  const reopened = reopenScene(state);
  assert.equal(reopened.sceneApproved, false);
  assert.equal(reopened.mappingReady, false);
  assert.equal(reopened.aiFinalized, false);
  assert.equal(reopened.fineTuneOpen, false);
});

test('mapping requires approved scene and at least one artwork', () => {
  assert.equal(markMappingReady({ sceneReady: true, artworkCount: 1 }, true).mappingReady, false);
  assert.equal(markMappingReady({ sceneReady: true, sceneApproved: true, artworkCount: 0 }, true).mappingReady, false);
  assert.equal(markMappingReady({ sceneReady: true, sceneApproved: true, artworkCount: 2 }, true).mappingReady, true);
});

test('AI finalization requires mapping', () => {
  const approved = createFlowState({ sceneReady: true, sceneApproved: true, artworkCount: 1 });
  assert.equal(markAiFinalized(approved).aiFinalized, false);
  const mapped = markMappingReady(approved, true);
  assert.equal(markAiFinalized(mapped).aiFinalized, true);
});

test('fine tuning only opens after AI finalization', () => {
  const mapped = markMappingReady({ sceneReady: true, sceneApproved: true, artworkCount: 1 }, true);
  assert.equal(setFineTuneOpen(mapped, true).fineTuneOpen, false);
  const finished = markAiFinalized(mapped);
  assert.equal(setFineTuneOpen(finished, true).fineTuneOpen, true);
});

test('flow advances through brief, approval, artwork and mapping', () => {
  assert.equal(flowStep({}), 1);
  assert.equal(flowStep({ sceneReady: true }), 2);
  assert.equal(flowStep({ sceneReady: true, sceneApproved: true }), 3);
  assert.equal(flowStep({ sceneReady: true, sceneApproved: true, artworkCount: 1 }), 4);
  assert.equal(flowStep({ sceneReady: true, sceneApproved: true, artworkCount: 1, mappingReady: true }), 5);
});

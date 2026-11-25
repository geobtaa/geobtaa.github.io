import assert from 'node:assert/strict';
import test from 'node:test';
import { publicationApplied, publicationProgress, publicationBlocksNewRequest, publicationCanResume } from '../src/components/editor/publicationProgress.ts';
const selectedHead = 'a'.repeat(40);
test('a live earlier version or completed merge cannot certify the submitted version', () => {
 for (const action of ['publish', 'unpublish']) {
  const pending = { state: 'merged', action, website: { publication: 'published', requestApplied: false } };
  assert.equal(publicationApplied(pending), false);
  assert.equal(publicationBlocksNewRequest(pending), true);
  assert.equal(publicationProgress(pending), action === 'publish' ? 'Publishing…' : 'Unpublishing…');
  const done = { ...pending, website: { publication: action === 'publish' ? 'published' : 'unpublished', requestApplied: true } };
  assert.equal(publicationApplied(done), true);
  assert.equal(publicationBlocksNewRequest(done), false);
 }
});
test('failed, uncertain and reserved requests keep their revision until explicit recovery', () => {
 for (const status of [undefined, {state:'checking'}, {state:'reserved'}, {state:'conflict'}, {state:'pr-open',checks:'failed',autoMerge:true}, {state:'merged',deployment:{state:'failed'}}]) assert.equal(publicationBlocksNewRequest(status), true);
 assert.equal(publicationCanResume({state:'pr-open',autoMerge:false,autoMergeEnabled:true,selectedHead}), true);
 assert.equal(publicationCanResume({state:'pr-open',autoMerge:false,autoMergeEnabled:true,selectedHead,verificationPending:true}), false);
 assert.equal(publicationCanResume({state:'conflict',autoMergeEnabled:true,selectedHead:'unverified'}), false);
});
test('confirmed failures need attention while ordinary authorized phases share one label', () => {
 assert.equal(publicationProgress({state:'pr-open',autoMerge:true,checks:'failed'}),'Needs attention');
 assert.equal(publicationProgress({state:'conflict',autoMerge:true}),'Needs attention');
 assert.equal(publicationProgress({state:'pr-open',autoMerge:true,reviewDecision:'REVIEW_REQUIRED'}),'Publishing…');
 assert.equal(publicationProgress({state:'merged',deployment:{state:'failed'}}),'Needs attention');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAncestry } from './gitComparison.mjs';
const base = 'a'.repeat(40), head = 'b'.repeat(40), common = 'c'.repeat(40);
test('identical immutable OIDs need no GitHub request', async () => {
  const result = await compareAncestry(() => assert.fail('unnecessary comparison'),base,base);
  assert.deepEqual(result,{status:'identical',merge_base_commit:{sha:base}});
});
test('paginated ancestry preserves ahead, behind and divergent evidence without relying on commits/files', async () => {
  for (const [status,sha] of [['ahead',base],['behind',head],['diverged',common]]) {
    const result = await compareAncestry(async path => {
      assert.equal(path,`/compare/${base}...${head}?per_page=1&page=2`);
      return {status,merge_base_commit:{sha},commits:[]}; // Page 2 can be empty for a one-commit history.
    },base,head);
    assert.equal(result.status,status);assert.equal(result.merge_base_commit.sha,sha);
  }
});
test('missing, ambiguous or inconsistent ancestry fails closed', async () => {
  for (const result of [null,{}, {status:'ahead'}, {status:'ahead',merge_base_commit:{sha:common}}, {status:'behind',merge_base_commit:{sha:common}}, {status:'identical',merge_base_commit:{sha:base}}, {status:'unknown',merge_base_commit:{sha:base}}, {status:'diverged',merge_base_commit:{sha:''}}]) {
    await assert.rejects(compareAncestry(async()=>result,base,head),{status:503});
  }
});
test('unavailable, unauthorized and unrelated comparison failures never become ancestry evidence', async () => {
  for (const status of [401,403,404,409,422,429,503]) await assert.rejects(compareAncestry(async()=>{throw Object.assign(new Error('Unavailable'),{status});},base,head),{status});
  await assert.rejects(compareAncestry(()=>assert.fail('invalid OID must not fetch'),'main',head),{status:503});
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { savePage, parsePage } from './page.mjs';

test('list verification overlaps at most two immutable reads and shares common in-flight evidence', async () => {
  const repo=await draftTestRepository({'src/content/docs/library/main.mdx':'---\ntitle: Main\n---\n\nOriginal.'});
  for(const filename of ['one.mdx','two.mdx','three.mdx']) {
    const saved=await savePage(createDraftStore({request:repo.request}),'library',filename,{title:filename,description:'',body:'Draft.'});
    for(let revision=0;revision<3;revision++) await repo.put(`src/content/docs/library/${filename}`,saved.content+`\nEdit ${revision}.`,{branch:saved.branch});
  }
  const refs=[...repo.refs],seen=new Map(),start=repo.requests.length;let active=0,peak=0;
  const request=async(path,options)=>{
    const immutable=/^\/git\/(?:commits|trees|blobs)\//.test(path)||path.startsWith('/compare/')||options?.body?.includes('query CMSDraft');
    if(!immutable)return repo.request(path,options);
    active++;peak=Math.max(peak,active);seen.set(path,(seen.get(path)||0)+1);
    try{await new Promise(resolve=>setTimeout(resolve,5));return await repo.request(path,options);}finally{active--;}
  };
  const list=await createDraftStore({request}).listContent('library');
  assert.equal(list.entries.length,4);assert.equal(peak,2);
  assert.equal(repo.requests.slice(start).filter(r=>r.body?.includes('query CMSDraftHistory')).length,3,'all three draft histories are still verified');
  for(const [path,count]of seen)if(path.startsWith('/git/'))assert.equal(count,1,`duplicate immutable read: ${path}`);
  assert.deepEqual([...repo.refs],refs);
});

test('concurrent verification still fails closed on incomplete trees and a fresh store sees changed drafts', async () => {
  const repo=await draftTestRepository();
  const saved=await savePage(createDraftStore({request:repo.request}),'library','one.mdx',{title:'One',description:'',body:'First.'});
  const opened=await createDraftStore({request:repo.request}).getContent('library','one.mdx');
  await savePage(createDraftStore({request:repo.request}),'library','one.mdx',{...opened,...parsePage(opened.content),body:'Changed.'});
  assert.notEqual((await createDraftStore({request:repo.request}).getContent('library','one.mdx')).head,saved.head);
  const refs=[...repo.refs];
  await assert.rejects(createDraftStore({request:async(path,options)=>{const result=await repo.request(path,options);return path.startsWith('/git/trees/')?{...result,truncated:true}:result;}}).listContent('library'),/tree is incomplete/);
  assert.deepEqual([...repo.refs],refs);
});

for (const objectType of ['commits', 'trees', 'blobs']) {
  test(`the same store retries failed ${objectType} reads and retains successful shared reads`, async () => {
    const filename = 'retry.mdx', path = `src/content/docs/library/${filename}`;
    const content = '---\ntitle: Retry\n---\n\nKeep this document.';
    const repo = await draftTestRepository({ [path]: content });
    const refs = [...repo.refs];
    const transient = Object.assign(new Error('Temporary GitHub read failure'), { status: 503 });
    let reads = 0;
    const store = createDraftStore({ request: async (path, options) => {
      if (path.startsWith(`/git/${objectType}/`)) {
        reads++;
        // Keep the read in flight long enough for both callers to share it.
        await new Promise(resolve => setTimeout(resolve, 5));
        if (reads === 1) throw transient;
      }
      return repo.request(path, options);
    } });
    const open = () => store.getContent('library', filename);
    const failed = await Promise.allSettled([open(), open()]);
    assert.ok(failed.every(result => result.status === 'rejected' && result.reason === transient));
    assert.equal(reads, 1, 'concurrent callers share the failed read');
    const recovered = await Promise.all([open(), open()]);
    assert.ok(recovered.every(document => document.content === content));
    assert.equal(reads, 2, 'a later request retries once and shares the successful read');
    assert.equal((await open()).content, content);
    assert.equal(reads, 2, 'successful immutable reads remain cached');
    assert.deepEqual([...repo.refs], refs, 'read failures and retries never mutate refs');
  });
}

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

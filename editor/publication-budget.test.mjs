import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore, prepareDraftImage } from './draftStorage.mjs';
import { preparePublicationCandidate } from './publicationCandidate.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';
import { PUBLICATION_REQUEST_LIMIT } from './publicationPR.mjs';
const filename = 'report.mdx', path = `src/content/docs/library/${filename}`, original = '---\ntitle: Report\n---\n\nOriginal.';
async function fixture() {
  const repo = await draftTestRepository({ [path]: original });
  const store = () => createDraftStore({ request: repo.request });
  const opened = await store().getContent('library', filename);
  const saved = await savePage(store(), 'library', filename, { ...opened, ...parsePage(opened.content), body: 'Selected.' });
  return { repo, store, saved };
}
test('normal, repeated and 600-commit submissions have bounded requests and do not fetch history, routes or image bytes on Cloudflare', async t => {
  const { repo, store, saved } = await fixture();
  let head = saved.head;
  for (let i=0;i<600;i++) head=await repo.put(path,saved.content+`\nEdit ${i}`,{branch:saved.branch});
  const before=repo.requests.length, prepared=await store().preparePublication({area:'library',filename,head});
  const prepareCount=repo.requests.length-before;
  const input={area:'library',filename,head,candidate:preparePublicationCandidate(prepared,filename)};
  const start=repo.requests.length;await store().publishContent(input);const createCount=repo.requests.length-start;
  const repeated=repo.requests.length;await store().publishContent(input);const repeatCount=repo.requests.length-repeated;
  const statusStart=repo.requests.length;assert.equal((await store().getPublicationStatus('library',filename)).state,'pr-open');const statusCount=repo.requests.length-statusStart;
  t.diagnostic(JSON.stringify({prepareCount,createCount,repeatCount,statusCount}));
  assert.ok(prepareCount<=4);assert.ok(createCount<=25);assert.ok(repeatCount<=25);assert.ok(statusCount<=10);
  const calls=repo.requests.slice(before);
  assert.equal(calls.some(c=>/CMSDrafts|CMSRoutes|CMSPublish|enablePullRequestAutoMerge/.test(c.body||'')),false);
  assert.equal(calls.some(c=>c.path.includes('/git/trees/')||c.path.includes('/git/blobs/')),false);
  const pr=repo.pulls[0];await store().verifyPublication(pr.head.ref,pr.head.sha); // complete CI still walks and verifies all 601 commits
});
test('candidate content cannot replace a different saved revision or bypass the full required scope contract', async () => {
  const {repo,store,saved}=await fixture();
  const prepared=await store().preparePublication({area:'library',filename,head:saved.head});
  const candidate=preparePublicationCandidate(prepared,filename);candidate.content+='\nUnselected text.';
  await store().publishContent({area:'library',filename,head:saved.head,candidate});
  const pr=repo.pulls[0];await assert.rejects(store().verifyPublication(pr.head.ref,pr.head.sha),/unexpected content/);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`),saved.head);
});
test('unused uploads in a forged candidate fail CI; foreign uploads fail before reservation', async () => {
  const {repo,store,saved}=await fixture();
  const image=await prepareDraftImage({area:'library',documentFilename:filename,filename:'map.gif',mimeType:'image/gif',bytes:new TextEncoder().encode('GIF89a')});
  const uploaded=await savePage(store(),'library',filename,{...saved,...parsePage(saved.content),body:`![Map](@images/${image.path})`,assets:[{filename:'map.gif',mimeType:'image/gif',content:image.content}]});
  const removed=await savePage(store(),'library',filename,{...uploaded,...parsePage(uploaded.content),body:'No map.'});
  const prepared=await store().preparePublication({area:'library',filename,head:removed.head});
  const candidate=preparePublicationCandidate(prepared,filename);candidate.assets=['cms-other/foreign.gif'];
  await assert.rejects(store().publishContent({area:'library',filename,head:removed.head,candidate}),/authorized upload/);
  assert.equal(repo.pulls.length,0);
  candidate.assets=[image.path];await store().publishContent({area:'library',filename,head:removed.head,candidate});
  const pr=repo.pulls[0];await assert.rejects(store().verifyPublication(pr.head.ref,pr.head.sha),/unexpected content or assets/);
});
test('oversized active PR inventory fails before reservation within the request cap', async () => {
  const {repo,store,saved}=await fixture(), refs=[...repo.refs];
  const candidate=preparePublicationCandidate(await store().preparePublication({area:'library',filename,head:saved.head}),filename);
  const calls=[];
  const client=createDraftStore({request:(path,options)=>{calls.push({path,options});if(path.startsWith('/pulls?state=open'))return Array.from({length:100},()=>({head:{ref:'other',repo:{full_name:'other/repo'}}}));return repo.request(path,options);}});
  await assert.rejects(client.publishContent({area:'library',filename,head:saved.head,candidate}),/inventory is too large/);
  assert.deepEqual([...repo.refs],refs);assert.ok(calls.length<PUBLICATION_REQUEST_LIMIT);
});
test('manual PR mode does not require native auto-merge to be enabled', async () => {
  const {repo,saved}=await fixture();
  const client=publicationTestClient({request:async(path,options)=>{const result=await repo.request(path,options);return path===''?{...result,allow_auto_merge:false}:result;}});
  assert.equal((await client.publishContent({area:'library',filename,head:saved.head})).state,'pr-open');
});
test('retained attempt history is batched and remains recoverable without duplicate PRs', async t => {
  const {repo,saved}=await fixture(), client=()=>publicationTestClient({request:repo.request});
  for(let i=0;i<20;i++) {await client().publishContent({area:'library',filename,head:saved.head});repo.pulls.at(-1).state='closed';}
  const before=repo.requests.length;
  const result=await client().publishContent({area:'library',filename,head:saved.head});
  const calls=repo.requests.slice(before), submissionCalls=calls.length-3; // helper includes a separate 3-call prepare invocation
  assert.equal(result.number,21);assert.ok(submissionCalls<=30);
  assert.equal(calls.filter(call=>call.body?.includes('query CMSPublicationHistory')).length,1);
  assert.ok(calls.filter(call=>call.body?.includes('query CMSPublicationPRs')).length<=3);
  const start=repo.requests.length;assert.equal((await client().getPublicationStatus('library',filename)).number,21);
  t.diagnostic(JSON.stringify({retainedAttempts:21,submissionCalls,statusCalls:repo.requests.length-start}));
});
test('an unavailable reservation readback preserves an uncertain attempt for later status and same-revision recovery', async () => {
  const {repo,saved}=await fixture(), client=()=>publicationTestClient({request:repo.request});
  repo.fault='unavailable-after';
  await assert.rejects(client().publishContent({area:'library',filename,head:saved.head}));
  assert.equal(repo.pulls.length,0);
  const refs=[...repo.refs];repo.unavailable=false;
  assert.equal((await client().getPublicationStatus('library',filename)).state,'reserved');
  assert.equal((await client().publishContent({area:'library',filename,head:saved.head})).state,'pr-open');
  assert.deepEqual([...repo.refs],refs);assert.equal(repo.pulls.length,1);
});
test('closing between preparation and creation leaves no reservation and another session can prepare again', async () => {
  const {repo,store,saved}=await fixture(), refs=[...repo.refs];
  const input={area:'library',filename,head:saved.head};
  const prepared=await store().preparePublication(input);
  assert.deepEqual([...repo.refs],refs);assert.equal(repo.pulls.length,0);
  repo.unavailable=true;await assert.rejects(store().preparePublication(input));repo.unavailable=false;
  assert.deepEqual([...repo.refs],refs);
  assert.deepEqual(await store().preparePublication(input),prepared);
  const latest=await repo.put('application.js','Unrelated main advancement');
  const result=await store().publishContent({...input,candidate:preparePublicationCandidate(prepared,filename)});
  assert.equal(result.state,'pr-open');assert.equal(repo.commits.get(repo.pulls[0].head.sha).parents[0].sha,latest);
  await store().verifyPublication(repo.pulls[0].head.ref,repo.pulls[0].head.sha);
});

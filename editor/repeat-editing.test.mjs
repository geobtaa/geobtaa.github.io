import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { draftTestRepository } from './draftTestRepository.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';
import { prepareDraftImage } from './draftStorage.mjs';
const filename='report.mdx',path=`src/content/docs/library/${filename}`,original='---\ntitle: Report\n---\n\nOriginal.';
async function fixture(initial=original, extras={}) {
  const repo=await draftTestRepository({...extras,...(initial?{[path]:initial}:{})}), store=()=>publicationTestClient({request:repo.request});
  const opened=initial?await store().getContent('library',filename):{};
  const save=(file,body,extra={})=>savePage(store(),'library',filename,{...file,...(file.content?parsePage(file.content):{title:'Report',description:''}),body,...extra});
  const saved=await save(opened,'First publication.');
  const submit=async(file)=>{await store().publishContent({area:'library',filename,head:file.head});const pr=repo.pulls.at(-1);await store().verifyPublication(pr.head.ref,pr.head.sha);return pr;};
  const merge=async(pr)=>{const file=repo.filesAt(pr.head.sha).get(path),content=new TextDecoder().decode(repo.objects.get(file.sha));const sha=await repo.put(path,content);for(const [key,value]of repo.filesAt(pr.head.sha))if(key.startsWith('src/assets/images/'))repo.filesAt(sha).set(key,value);pr.state='closed';pr.merged_at='2026-11-19T12:00:00Z';pr.merge_commit_sha=sha;return sha;};
  return {repo,store,save,saved,submit,merge};
}
test('publish, reopen and edit again for existing and new documents without changing the historical publication', async t=>{
 for(const initial of [original,null]){
  const f=await fixture(initial), pr=await f.submit(f.saved);await f.merge(pr);
  const oldSnapshot=f.repo.refs.get(`refs/heads/${pr.head.ref}`),locks=[...f.repo.refs].filter(([n])=>n.startsWith('refs/tags/'));
  const refsBefore=[...f.repo.refs];
  let start=f.repo.requests.length;const reopened=await f.store().getContent('library',filename);const reopenCalls=f.repo.requests.length-start;
  assert.deepEqual([...f.repo.refs],refsBefore,'opening the merged page never changes refs');
  const list=await f.store().listContent('library');assert.equal(list.entries.find(item=>item.name===filename).hasDraft,false);
  assert.deepEqual([...f.repo.refs],refsBefore,'listing the merged page never changes refs');
  assert.equal(reopened.mainChanged,false);assert.equal(reopened.hasDraft,false);assert.equal(reopened.resumeHead,f.saved.head);
  start=f.repo.requests.length;const second=await f.save(reopened,'Second publication.');t.diagnostic(JSON.stringify({initial:!!initial,reopenCalls,restartSaveCalls:f.repo.requests.length-start}));
  assert.notEqual(second.branch,f.saved.branch);assert.equal(second.resumeHead,null);
  assert.equal((await f.store().getContent('library',filename)).head,second.head);
  assert.equal(f.repo.filesAt(`refs/heads/${f.saved.branch}`).get(path).sha,f.saved.sha);
  assert.deepEqual([...f.repo.refs].filter(([n])=>n.startsWith('refs/tags/')),locks);
  assert.equal(f.repo.refs.get(`refs/heads/${pr.head.ref}`),oldSnapshot);
  const next=await f.submit(second);assert.equal(f.repo.pulls.length,2);await f.merge(next);
  const third=await f.save(await f.store().getContent('library',filename),'Third publication.');
  await f.submit(third);assert.equal(f.repo.pulls.length,3);
 }
});
test('newer unpublished edits and uploaded images carry forward after an earlier revision merges',async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);
 const image=await prepareDraftImage({area:'library',documentFilename:filename,filename:'later.gif',mimeType:'image/gif',bytes:new TextEncoder().encode('GIF89a')});
 const newer=await f.save(f.saved,`Keep my later text.\n\n![Later](@images/${image.path})`,{assets:[{filename:'later.gif',mimeType:'image/gif',content:image.content}]});
 await f.merge(pr);
 const reopened=await f.store().getContent('library',filename);
 assert.equal(reopened.preservedEdits,true);assert.match(reopened.content,/Keep my later text/);assert.equal(reopened.resumeHead,newer.head);
 const continued=await f.save(reopened,parsePage(reopened.content).body);
 assert.equal(f.repo.filesAt(continued.head).get(`src/assets/images/${image.path}`).sha,f.repo.filesAt(newer.head).get(`src/assets/images/${image.path}`).sha);
 await f.submit(continued);
});
test('stale pre-merge browser saves and concurrent starts cannot overwrite a reopened or newer draft',async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename),refs=[...f.repo.refs];
 await assert.rejects(f.save(f.saved,'Stale browser text.'),{status:409});assert.deepEqual([...f.repo.refs],refs);
 const results=await Promise.allSettled([f.save(reopened,'Editor A.'),f.save(reopened,'Editor B.')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 await assert.rejects(f.save(reopened,'Late old browser.'),{status:409});
 const current=await f.store().getContent('library',filename);assert.match(current.content,/Editor [AB]/);
});
test('external competing main edits block automatic continuation while unrelated main advances do not',async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);await f.repo.put('application.js','Unrelated change');
 assert.ok((await f.store().getContent('library',filename)).resumeHead);
 await f.repo.put(path,original+'\nCompeting published text.');
 const reopened=await f.store().getContent('library',filename);assert.equal(reopened.mainChanged,true);assert.equal(reopened.resumeHead,undefined);
 const refs=[...f.repo.refs];await assert.rejects(f.save(reopened,'Keep local edits.'),{status:409});assert.deepEqual([...f.repo.refs],refs);
});
test('uncertain atomic continuation response can be read back without losing either draft',async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename);f.repo.fault='after';
 const saved=await f.save(reopened,'Saved after uncertainty.');
 assert.equal((await f.store().getContent('library',filename)).head,saved.head);
 assert.ok(f.repo.commits.has(f.saved.head));
});
test('an incomplete or tampered continuation fails closed in discovery and the independent scope checker', async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);
 const next=await f.save(await f.store().getContent('library',filename),'Second round.');
 const nextPR=await f.submit(next);
 const retirement=f.repo.commits.get(f.repo.refs.get(`refs/heads/${f.saved.branch}`));
 retirement.message=retirement.message.replace(next.head,'0'.repeat(40));
 await assert.rejects(f.store().verifyPublication(nextPR.head.ref,nextPR.head.sha),/preserve its predecessor/);
 await assert.rejects(f.store().getContent('library',filename),/preserve its predecessor/);
});
test('API saves from old pages cannot undo an atomic handoff even when they were prepared before merge', async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename),next=await f.save(reopened,'Keep new working draft.');
 const refs=[...f.repo.refs];
 await assert.rejects(f.store().saveContent({area:'library',filename,sha:f.saved.sha,head:f.saved.head,content:f.saved.content+'\nStale direct save.'}),{status:409});
 assert.deepEqual([...f.repo.refs],refs);assert.equal((await f.store().getContent('library',filename)).head,next.head);
});
test('a merged publication with unchanged document bytes still permits another round and does not reuse its lock',async()=>{
 const f=await fixture(original.replace('title: Report','title: Report\ndraft: false'));const current=await f.store().getContent('library',filename);
 const reset=await f.save(current,'Original.'); // exactly the original main bytes
 assert.equal(reset.sha,f.repo.filesAt('refs/heads/main').get(path).sha,'exercise an actual unchanged-blob merge');
 const pr=await f.submit(reset);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename);assert.ok(reopened.resumeHead);
 const next=await f.save(reopened,'New round after unchanged merge.');await f.submit(next);
 assert.equal(f.repo.pulls.length,2);
 const locks=[...f.repo.refs].filter(([name])=>name.startsWith('refs/tags/cms-publication-locks/'));
 assert.equal(locks.length,2);
});

test('representative repeat save has bounded cold-isolate calls with 168 other documents and two other working drafts',async t=>{
 const extras=Object.fromEntries(Array.from({length:168},(_,i)=>[`src/content/docs/guides/extra-${i}.mdx`,`---\ntitle: Extra ${i}\n---\n\nPublished.`]));
 const f=await fixture(original,extras);
 for(let i=0;i<2;i++)await savePage(f.store(),'library',`other-${i}.mdx`,{title:`Other ${i}`,description:'',body:'Unpublished.'});
 const pr=await f.submit(f.saved);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename),start=f.repo.requests.length;
 // Fresh module caches reproduce cold route discovery; only the transport to
 // the synthetic repository lives in the parent thread. No network or writes
 // outside the in-memory Git model are possible.
 const code=`import {parentPort,workerData} from 'node:worker_threads';
 import {createDraftStore} from ${JSON.stringify(new URL('./draftStorage.mjs',import.meta.url).href)};
 import {savePage,parsePage} from ${JSON.stringify(new URL('./page.mjs',import.meta.url).href)};
 let id=0;const pending=new Map();parentPort.on('message',m=>{const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Object.assign(Error(m.error.message),{status:m.error.status})):p.resolve(m.result)});
 const request=(path,options)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});parentPort.postMessage({id,path,options})});
 try{const file=workerData;const result=await savePage(createDraftStore({request}),'library','report.mdx',{...file,...parsePage(file.content),body:'Cold repeat edit.'});parentPort.postMessage({done:true,result});}catch(e){parentPort.postMessage({done:true,error:{message:e.message,status:e.status}})}finally{parentPort.close()}`;
 const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`),{workerData:reopened});
 const result=await new Promise((resolve,reject)=>{
  worker.on('error',reject);
  worker.on('message',async m=>{if(m.done){m.error?reject(Error(m.error.message)):resolve(m.result);return;}try{worker.postMessage({id:m.id,result:await f.repo.request(m.path,m.options)})}catch(e){worker.postMessage({id:m.id,error:{message:e.message,status:e.status}})}});
 });
 const calls=f.repo.requests.length-start;t.diagnostic(JSON.stringify({coldRepeatSaveCalls:calls,otherPublishedDocuments:168,otherDrafts:2}));
 assert.ok(calls<50,`cold repeat save used ${calls} requests`);assert.equal(result.hasDraft,true);
});
test('unrelated main changes between reopening and saving use the latest baseline without discarding the edit',async()=>{
 const f=await fixture(),pr=await f.submit(f.saved);await f.merge(pr);
 const reopened=await f.store().getContent('library',filename),latest=await f.repo.put('unrelated.js','Another editor published something else');
 const next=await f.save(reopened,'My next edit.');
 assert.equal(f.repo.commits.get(next.head).parents[0].sha,latest);
 await f.submit(next);
});
test('post and program-update adapters preserve continuation tokens through another publication',async()=>{
 const {saveBlog}=await import('./blog.mjs'),{saveProgramUpdate}=await import('./programUpdates.mjs');
 for(const [area,save]of [['posts',saveBlog],['updates',saveProgramUpdate]]){
  const file='2026-11-19-note.mdx',p=`src/content/docs/${area}/${file}`;
  const repo=await draftTestRepository({[p]:'---\ntitle: Note\ndate: 2026-11-19\ndraft: false\n---\n\nOriginal.'}),store=()=>publicationTestClient({request:repo.request});
  const loaded=await store().getContent(area,file);
  const first=await save(store(),file,{...loaded,...parsePage(loaded.content),body:'First round.'});
  await store().publishContent({area,filename:file,head:first.head});
  const pr=repo.pulls[0];await store().verifyPublication(pr.head.ref,pr.head.sha);
  const blob=repo.filesAt(pr.head.sha).get(p),merge=await repo.put(p,new TextDecoder().decode(repo.objects.get(blob.sha)));
  pr.state='closed';pr.merged_at='2026-11-19T12:00:00Z';pr.merge_commit_sha=merge;
  const reopened=await store().getContent(area,file);assert.ok(reopened.resumeHead);
  const next=await save(store(),file,{...reopened,...parsePage(reopened.content),body:'Next round.'});
  await store().publishContent({area,filename:file,head:next.head});
  const second=repo.pulls[1];await store().verifyPublication(second.head.ref,second.head.sha);
  assert.equal(repo.pulls.length,2);
 }
});
test('ten editing rounds keep the hosted save independent of archived draft histories while CI still checks them',async t=>{
 const f=await fixture();let saved=f.saved,maxSaveCalls=0;
 for(let i=0;i<10;i++){
  const pr=await f.submit(saved);await f.merge(pr);
  const reopened=await f.store().getContent('library',filename),start=f.repo.requests.length;
  saved=await f.save(reopened,`Round ${i+2}.`);maxSaveCalls=Math.max(maxSaveCalls,f.repo.requests.length-start);
 }
 t.diagnostic(JSON.stringify({editingRounds:10,maxHostedSaveCalls:maxSaveCalls}));
 assert.ok(maxSaveCalls<45,`hosted save grew to ${maxSaveCalls} requests`);
 // A historical source-tree violation is still a required-CI failure, never a
 // loophole gained by excluding verified retired drafts from hosted route lists.
 const retired=f.repo.refs.get(`refs/heads/${f.saved.branch}`),value=f.repo.commits.get(retired);
 const tree=await f.repo.request('/git/trees',{method:'POST',body:JSON.stringify({base_tree:value.tree.sha,tree:[{path:'unexpected.js',type:'blob',mode:'100644',content:'Forbidden'}]})});
 const changed=await f.repo.request('/git/commits',{method:'POST',body:JSON.stringify({tree:tree.sha,parents:value.parents.map(p=>p.sha),message:value.message})});
 f.repo.refs.set(`refs/heads/${f.saved.branch}`,changed.sha);
 await assert.rejects(f.store().listContent('library'),/preserved draft|outside|continuation/);
});

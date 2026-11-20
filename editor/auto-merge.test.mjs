import assert from 'node:assert/strict';
import test from 'node:test';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';
const area='library', filename='report.mdx', path=`src/content/docs/${area}/${filename}`;
const original='---\ntitle: Report\n---\n\nOriginal.';
async function fixture() {
 const repo=await draftTestRepository({[path]:original,'navigation.groups.json':'[]'}),store=()=>publicationTestClient({request:repo.request});
 const opened=await store().getContent(area,filename);
 const saved=await savePage(store(),area,filename,{...opened,...parsePage(original),body:'Selected work.'});
 const input={area,filename,head:saved.head};
 const result=await store().publishContent(input);
 return {repo,store,saved,input:{...input,snapshotHead:result.snapshotHead},pr:repo.pulls[0]};
}
test('authorization is explicit, bound to a CMS snapshot, idempotent, read back, and cancellable',async t=>{
 const f=await fixture();assert.equal(f.pr.auto_merge,undefined);
 const start=f.repo.requests.length;
 const enabled=await f.store().setPublicationAutoMerge({...f.input,enabled:true});
 assert.equal(enabled.autoMerge,true);assert.equal(enabled.state,'pr-open');
 t.diagnostic(`authorization calls: ${f.repo.requests.length-start}`);assert.ok(f.repo.requests.length-start<=25);
 assert.equal((await f.store().getPublicationStatus(area,filename)).autoMerge,true);
 const writes=()=>f.repo.requests.filter(r=>r.body?.includes('mutation CMSPublicationAuthorization')).length;
 const n=writes();await f.store().setPublicationAutoMerge({...f.input,enabled:true});assert.equal(writes(),n);
 assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:false})).autoMerge,false);
 const mutation=f.repo.requests.find(r=>r.body?.includes('enablePullRequestAutoMerge'));
 const input=JSON.parse(mutation.body).variables.input;assert.equal(input.expectedHeadOid,f.pr.head.sha);assert.equal(input.mergeMethod,'SQUASH');
 await f.store().verifyPublication(f.pr.head.ref,f.pr.head.sha);
});
test('permission, policy, action, revision and snapshot tampering cannot authorize publication',async()=>{
 for(const fault of ['permission','policy','disabled','cleanup','snapshot','head','action','branch','marker']) {
  const f=await fixture();let input={...f.input,enabled:true};
  if(fault==='permission')f.repo.push=false;
  if(fault==='policy')f.repo.protection={};
  if(fault==='disabled')f.repo.allowAutoMerge=false;
  if(fault==='cleanup')f.repo.deleteBranchesOnMerge=true;
  if(fault==='snapshot')input.snapshotHead='0'.repeat(40);
  if(fault==='head')input.head='0'.repeat(40);
  if(fault==='action')input.action='unpublish';
  if(fault==='branch')f.repo.refs.set('refs/heads/'+f.pr.head.ref,'0'.repeat(40));
  if(fault==='marker')f.repo.commits.get(f.pr.head.sha).message='Forged snapshot';
  const refs=[...f.repo.refs];await assert.rejects(f.store().setPublicationAutoMerge(input),undefined,fault);
  assert.deepEqual([...f.repo.refs],refs);assert.equal(f.pr.auto_merge,undefined);
  assert.equal(f.repo.requests.some(r=>r.body?.includes('mutation CMSPublicationAuthorization')),false);
 }
});
test('lost enable/cancel responses recover from readback; rejected authorization preserves the manual request',async()=>{
 const f=await fixture();f.repo.loseAuthorizationResponse=true;
 assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:true})).autoMerge,true);
 f.repo.loseAuthorizationResponse=true;f.repo.allowAutoMerge=false;f.repo.protection={};
 assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:false})).autoMerge,false,'cancellation does not need publishing policy to remain enabled');
 const g=await fixture();g.repo.autoMergeFailure=true;
 await assert.rejects(g.store().setPublicationAutoMerge({...g.input,enabled:true}),{status:403});
 assert.equal(g.repo.pulls.length,1);assert.equal(g.pr.state,'open');assert.equal((await g.store().getContent(area,filename)).head,g.saved.head);
});
test('already-ready publication uses a protected head-pinned squash merge; a changed head cannot race authorization',async()=>{
 const f=await fixture();await f.store().verifyPublication(f.pr.head.ref,f.pr.head.sha);f.pr.mergeState='CLEAN';
 const result=await f.store().setPublicationAutoMerge({...f.input,enabled:true});assert.equal(result.state,'merged');
 assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:false})).state,'merged','cancellation never claims to undo a merge');
 const g=await fixture();g.repo.beforeAuthorization=async()=>{g.pr.head.sha='0'.repeat(40);};
 await assert.rejects(g.store().setPublicationAutoMerge({...g.input,enabled:true}));assert.equal(g.pr.auto_merge,undefined);
});
test('two close submissions: first merge blocks the second, which can cancel, refresh, and explicitly authorize its replacement',async()=>{
 const f=await fixture(), second='second.mdx', secondPath=`src/content/docs/library/${second}`;
 // New-document creation does not advance main, so both snapshots share the same base.
 const saved=await savePage(f.store(),area,second,{title:'Second',description:'',body:'Second selected work.'});
 const secondInput={area,filename:second,head:saved.head};
 const request=await f.store().publishContent(secondInput), pr=f.repo.pulls[1];
 assert.equal(f.repo.commits.get(f.pr.head.sha).parents[0].sha,f.repo.commits.get(pr.head.sha).parents[0].sha);
 await f.store().verifyPublication(f.pr.head.ref,f.pr.head.sha);await f.store().verifyPublication(pr.head.ref,pr.head.sha);
 await f.store().setPublicationAutoMerge({...secondInput,snapshotHead:request.snapshotHead,enabled:true});
 // GitHub merges the first ready request under ordinary protection.
 f.pr.mergeState='CLEAN';await f.store().setPublicationAutoMerge({...f.input,enabled:true});
 const status=await f.store().getPublicationStatus(area,second);assert.equal(status.state,'conflict');assert.equal(status.autoMerge,true);
 await assert.rejects(f.store().setPublicationAutoMerge({...secondInput,snapshotHead:request.snapshotHead,enabled:true}),/website changed/);
 await f.store().setPublicationAutoMerge({...secondInput,snapshotHead:request.snapshotHead,enabled:false});assert.equal(pr.auto_merge,false);
 const refreshed=await f.store().publishContent(secondInput), replacement=f.repo.pulls.at(-1);
 assert.equal(pr.state,'closed');assert.equal(replacement.auto_merge,undefined);
 await assert.rejects(f.store().setPublicationAutoMerge({...secondInput,snapshotHead:request.snapshotHead,enabled:true}),/replaced/);
 await f.store().verifyPublication(replacement.head.ref,replacement.head.sha);replacement.mergeState='CLEAN';
 assert.equal((await f.store().setPublicationAutoMerge({...secondInput,snapshotHead:refreshed.snapshotHead,enabled:true})).state,'merged');
 const files=f.repo.filesAt(f.repo.refs.get('refs/heads/main'));
 assert.match(new TextDecoder().decode(f.repo.objects.get(files.get(path).sha)),/Selected work/);
 assert.match(new TextDecoder().decode(f.repo.objects.get(files.get(secondPath).sha)),/Second selected work/);
});
test('unpublish auto-merge preserves the independent saved draft and uses the existing immutable validation',async()=>{
 const f=await fixture();f.pr.state='closed';
 // A separate unpublish action cannot reuse a publish coordinator: use a fresh document cycle.
 const repo=await draftTestRepository({[path]:original,'navigation.groups.json':'[]'}),store=()=>publicationTestClient({request:repo.request});
 const opened=await store().getContent(area,filename),saved=await savePage(store(),area,filename,{...opened,...parsePage(original),body:'Independent editorial work.'});
 const input={area,filename,head:saved.head,action:'unpublish'};
 const request=await store().publishContent(input),pr=repo.pulls[0];
 await store().verifyPublication(pr.head.ref,pr.head.sha);pr.mergeState='CLEAN';
 assert.equal((await store().setPublicationAutoMerge({...input,snapshotHead:request.snapshotHead,enabled:true})).state,'merged');
 assert.match((await store().getContent(area,filename)).content,/Independent editorial work/);
 const file=repo.filesAt(repo.refs.get('refs/heads/main')).get(path),content=new TextDecoder().decode(repo.objects.get(file.sha));
 assert.match(content,/draft: true/);assert.match(content,/Original/);assert.doesNotMatch(content,/Independent/);
});
test('required reviews and failed checks cannot take the immediate merge path',async()=>{
 for(const review of ['REVIEW_REQUIRED','CHANGES_REQUESTED']) {
  const f=await fixture();f.pr.mergeState='CLEAN';f.pr.reviewDecision=review;
  assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:true})).state,'pr-open');
  assert.equal(f.pr.auto_merge,true);assert.equal(f.pr.merged_at,undefined);
 }
 const f=await fixture();f.pr.mergeState='CLEAN';f.pr.checksFailed=true;
 assert.equal((await f.store().setPublicationAutoMerge({...f.input,enabled:true})).state,'pr-open');
 assert.equal(f.pr.merged_at,undefined);
});
test('uncertain authorization and unavailable readback are recoverable without duplicate requests',async()=>{
 const f=await fixture();let unreadable=false;
 const request=async(path,options)=>{
  if(unreadable && options?.body?.includes('query CMSPublicationPRs'))throw Object.assign(new Error('Readback unavailable'),{status:503});
  const result=await f.repo.request(path,options);
  if(options?.body?.includes('mutation CMSPublicationAuthorization')){unreadable=true;throw Object.assign(new Error('Response lost'),{status:503});}
  return result;
 };
 await assert.rejects(publicationTestClient({request}).setPublicationAutoMerge({...f.input,enabled:true}));
 assert.equal(f.pr.auto_merge,true);
 const writes=f.repo.requests.filter(r=>r.body?.includes('mutation CMSPublicationAuthorization')).length;
 assert.equal((await f.store().getPublicationStatus(area,filename)).autoMerge,true);
 await f.store().setPublicationAutoMerge({...f.input,enabled:true});
 assert.equal(f.repo.pulls.length,1);assert.equal(f.repo.requests.filter(r=>r.body?.includes('mutation CMSPublicationAuthorization')).length,writes);
});
test('a merge winning the cancellation race is reported as merged rather than cancelled',async()=>{
 const f=await fixture();await f.store().setPublicationAutoMerge({...f.input,enabled:true});
 f.repo.beforeAuthorization=async()=>{
  const file=f.repo.filesAt(f.pr.head.sha).get(path),sha=await f.repo.put(path,new TextDecoder().decode(f.repo.objects.get(file.sha)));
  Object.assign(f.pr,{state:'closed',merged_at:'2026-11-20T00:00:00Z',merge_commit_sha:sha,auto_merge:false});
 };
 const result=await f.store().setPublicationAutoMerge({...f.input,enabled:false});
 assert.equal(result.state,'merged');assert.equal(result.mergeHead,f.pr.merge_commit_sha);
});

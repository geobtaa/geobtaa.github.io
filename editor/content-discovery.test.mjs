import assert from 'node:assert/strict';
import test from 'node:test';
import {createDraftStore} from './draftStorage.mjs';
import {draftTestRepository} from './draftTestRepository.mjs';
import {parsePage,savePage} from './page.mjs';
import {publicationTestClient} from './publicationTestHelpers.mjs';
const source='---\ntitle: Page\n---\n\nOriginal.';
test('light discovery lists main and new drafts in two calls, without editing authority or history/asset reads',async()=>{
 const repo=await draftTestRepository({'src/content/docs/library/main.mdx':source});
 const saved=await savePage(createDraftStore({request:repo.request}),'library','new.mdx',{title:'New',description:'',body:'Saved.'});
 for(let i=0;i<60;i++)await repo.put('src/content/docs/library/new.mdx',saved.content+`\nEdit ${i}.`,{branch:saved.branch});
 const start=repo.requests.length,refs=[...repo.refs],list=await createDraftStore({request:repo.request}).discoverContent('library');
 assert.equal(repo.requests.length-start,2);assert.equal(list.entries.length,2);assert.equal(list.complete,true);
 assert.equal(list.entries.find(e=>e.name==='main.mdx').onMain,true);assert.equal(list.entries.find(e=>e.name==='new.mdx').draftHint,'saved');
 for(const row of list.entries)for(const field of ['head','sha','hasDraft','draft','content','route'])assert.equal(Object.hasOwn(row,field),false,field);
 assert.ok(repo.requests.slice(start).every(r=>r.body?.includes('query CMSContent')));assert.deepEqual([...repo.refs],refs);
});
test('nested directories are completely walked at a pinned main OID, including areas containing only new drafts',async()=>{
 const repo=await draftTestRepository({'src/content/docs/library/nested/page.md':source,'src/content/docs/library/_hidden.mdx':source});
 let list=await createDraftStore({request:repo.request}).discoverContent('library');assert.deepEqual(list.entries.map(e=>e.name),['nested/page.md']);
 await savePage(createDraftStore({request:repo.request}),'guides','new.mdx',{title:'New',description:'',body:'Saved.'});
 list=await createDraftStore({request:repo.request}).discoverContent('guides');assert.equal(list.entries[0].onMain,false);
});
test('retained generations are grouped by path; only authoritative opening resolves a continuation',async()=>{
 const path='src/content/docs/library/page.mdx',repo=await draftTestRepository({[path]:source}),client=()=>publicationTestClient({request:repo.request});
 const opened=await client().getContent('library','page.mdx'),saved=await savePage(client(),'library','page.mdx',{...opened,...parsePage(opened.content),body:'Publish me.'});
 await client().publishContent({area:'library',filename:'page.mdx',head:saved.head});const pr=repo.pulls[0],file=repo.filesAt(pr.head.sha).get(path);
 pr.merge_commit_sha=await repo.put(path,new TextDecoder().decode(repo.objects.get(file.sha)));pr.merged_at='2026-11-19T00:00:00Z';pr.state='closed';
 const resumed=await client().getContent('library','page.mdx'),next=await savePage(client(),'library','page.mdx',{...resumed,...parsePage(resumed.content),body:'Next.'});
 repo.pageSize=1;const list=await client().discoverContent('library');assert.equal(list.entries.length,1);assert.equal(list.entries[0].candidateHeads.length,2);
 assert.equal((await client().getContent('library','page.mdx')).head,next.head);
});
test('provisional discovery does not certify a tampered draft or hide malformed inventory',async()=>{
 const repo=await draftTestRepository(),store=()=>createDraftStore({request:repo.request});
 const saved=await savePage(store(),'library','new.mdx',{title:'New',description:'',body:'Saved.'});
 await repo.put('application.js','unrelated change',{branch:saved.branch});
 assert.equal((await store().discoverContent('library')).entries[0].discovery,'provisional');
 await assert.rejects(store().getContent('library','new.mdx'),{status:409});
 const request=async(path,options)=>{const result=await repo.request(path,options);if(options?.body?.includes('query CMSContentDiscovery'))result.data.repository.refs.nodes.push({prefix:'refs/tags/',name:'foreign',target:null});return result;};
 const list=await createDraftStore({request}).discoverContent('library');assert.equal(list.complete,false);assert.ok(list.warnings.length);
});
test('discovery rejects incomplete pagination, permission errors and missing immutable tree fields',async()=>{
 const repo=await draftTestRepository({'src/content/docs/library/page.mdx':source});
 for(const fault of ['cursor','denied','tree']){
  const request=async(path,options)=>{const result=await repo.request(path,options);if(options?.body?.includes('query CMSContentDiscovery')){if(fault==='cursor')result.data.repository.refs.pageInfo={hasNextPage:true,endCursor:null};if(fault==='denied')result.errors=[{type:'FORBIDDEN'}];}if(fault==='tree'&&options?.body?.includes('query CMSContentObjects'))result.data.repository.o0.entries=null;return result;};
  await assert.rejects(createDraftStore({request}).discoverContent('library'),{status:fault==='denied'?403:503});
 }
});

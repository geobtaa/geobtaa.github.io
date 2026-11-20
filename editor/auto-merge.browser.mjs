import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
const options={skip:chrome?false:'Chrome is required.',timeout:45000};
const button=text=>`[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)})`;
function fixture({unchanged=false,initialRequest=false}={}) {return `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import {draftTestRepository} from './draftTestRepository.mjs';
import {createDraftStore} from './draftStorage.mjs';
import {parsePage,savePage} from './page.mjs';
import {preparePublicationCandidate} from './publicationCandidate.mjs';
window.path='src/content/docs/library/report.mdx';
window.repo=await draftTestRepository({[window.path]:'---\\ntitle: Report\\n---\\n\\nOriginal text.','navigation.groups.json':'[]'});
window.store=createDraftStore({request:window.repo.request});window.deployed=false;window.writes=[];window.reads=[];
if(!${unchanged}){const opened=await window.store.getContent('library','report.mdx');await savePage(window.store,'library','report.mdx',{...opened,...parsePage(opened.content),body:'Saved selected work.'});}
window.complete=async()=>{const pr=window.repo.pulls.at(-1);await window.store.verifyPublication(pr.head.ref,pr.head.sha);const file=window.repo.filesAt(pr.head.sha).get(window.path),content=new TextDecoder().decode(window.repo.objects.get(file.sha));const sha=await window.repo.put(window.path,content);Object.assign(pr,{state:'closed',merged_at:'2026-11-20T00:00:00Z',merge_commit_sha:sha,auto_merge:false});};
if(${initialRequest}){const document=await window.store.getContent('library','report.mdx'),input={area:'library',filename:'report.mdx',head:document.head};const prepared=await window.store.preparePublication(input),request=await window.store.publishContent({...input,candidate:preparePublicationCandidate(prepared,'report.mdx')});await window.store.setPublicationAutoMerge({...input,snapshotHead:request.snapshotHead,enabled:true});}
const nativeTimeout=window.setTimeout.bind(window);window.pause=delay=>new Promise(resolve=>nativeTimeout(resolve,delay));
window.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay===20000?60:delay,...args);
window.fetch=async(url,options={})=>{
 const parsed=new URL(String(url),location.origin),path=parsed.pathname;window.reads.push(path);
 try{
  if(path==='/api/session')return Response.json({authenticated:true,login:'editor',workspace:window.store.workspace});
  if(path.startsWith('/api/publication-status/')){const pr=window.repo.pulls.at(-1),status=await window.store.getPublicationStatus('library','report.mdx'),action=status.action || 'publish';return Response.json({autoMergeEnabled:true,mainDraft:window.deployed&&action==='unpublish',unpublishEnabled:true,website:window.websiteUnavailable?{publication:'unavailable'}:{publication:window.deployed&&action==='unpublish'?'unpublished':'published',requestApplied:!!pr?.merged_at&&window.deployed},deployment:{state:window.deploymentFailed?'failed':'pending'}});}
  if(path.startsWith('/api/publish/')){
   if(!options.method)return Response.json(await window.store.getPublicationStatus('library','report.mdx'));
   const input=JSON.parse(options.body);window.writes.push(input);
   const route={area:'library',filename:'report.mdx',...input};
   if(input.initialize)return Response.json(await window.store.initializeUnpublish(route));
   if(Object.hasOwn(input,'autoMerge'))return Response.json(await window.store.setPublicationAutoMerge({...route,enabled:input.autoMerge}));
   return Response.json(await (input.prepare?window.store.preparePublication(route):window.store.publishContent(route)));
  }
  if(path==='/api/content/library')return Response.json(await window.store.discoverContent('library'));
  if(path==='/api/content/library/report.mdx'){const file=await window.store.getContent('library','report.mdx');return Response.json({...file,...parsePage(file.content)});}
  throw new Error('Unexpected API '+path);
 }catch(error){return Response.json({error:error.message},{status:error.status||500});}
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;}
test('explicit auto-publication, cancellation, manual option, outdated recovery and verified deployment preserve the form',options,async()=>{
 await withEditorBrowser(fixture(),async({evaluate,waitFor,send})=>{
  await waitFor('document.querySelector(".publish-document")?.textContent==="Publish when ready"');
  assert.equal(await evaluate('window.writes.length'),0);
  await evaluate('document.querySelector(".publication-history summary").click()');
  await evaluate(`${button('Submit for manual merge')}.click()`);
  await waitFor('window.repo.pulls.length===1 && document.querySelector(".publication-status").dataset.state==="pr-open"');
  assert.equal(await evaluate('window.repo.pulls[0].auto_merge'),undefined,'manual requests never authorize auto-merge');
  await evaluate('document.querySelector(".publish-document").click()');
  await waitFor(`!!${button('Cancel automatic publication')}`);
  assert.equal(await evaluate('window.repo.pulls.length'),1,'same request is reused');
  await evaluate('window.repo.pulls[0].checksFailed=true');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("request failed validation")');
  await evaluate(`${button('Cancel automatic publication')}.focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor('window.repo.pulls[0].auto_merge===false && document.body.textContent.includes("Automatic publication cancelled")');
  await evaluate(`window.repo.pulls[0].checksFailed=false;${button('Publish when ready')}.click()`);await waitFor('window.repo.pulls[0].auto_merge===true');
  await evaluate("window.repo.put('unrelated.txt','Other website change')");
  await waitFor(`!!${button('Update publication request')}`);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/website changed while this request was waiting/);
  await evaluate(`${button('Update publication request')}.click()`);
  await waitFor('window.repo.pulls.length===2 && window.repo.pulls[0].state==="closed"');
  assert.equal(await evaluate('window.repo.pulls[1].auto_merge'),undefined,'replacement needs fresh explicit authorization');
  await waitFor(`!!${button('Publish when ready')}`);await evaluate(`${button('Publish when ready')}.click()`);
  await waitFor('window.repo.pulls[1].auto_merge===true');
  await evaluate('window.complete()');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("not yet confirmed")');
  assert.equal(await evaluate('!!document.querySelector(".publication-history[open]")'),false);
  await evaluate('window.deploymentFailed=true');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("Website update failed")');
  await evaluate(`window.deploymentFailed=false;window.deployed=true;${button('Check again')}.click()`);
  await waitFor('!!document.querySelector(".publication-history") && !document.querySelector(".publication-notice")');
  assert.match(await evaluate('document.querySelector(".publication-history").textContent'),/website update was verified/);
  assert.equal(await evaluate('document.querySelector(".publication-complete").textContent'),'Update deployed');
  assert.equal(await evaluate('document.querySelector(".tiptap").textContent'),'Saved selected work.');
  const count=await evaluate('window.reads.length');await evaluate('window.pause(180)');assert.equal(await evaluate('window.reads.length'),count,'polling stops after verified deployment');
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('unpublish auto-merge is explicitly confirmed, cancellable and never declared deployed before verification',options,async()=>{
 await withEditorBrowser(fixture({unchanged:true}),async({evaluate,waitFor})=>{
  await waitFor(`${button('Unpublish page')}?.disabled===false`);
  await evaluate(`${button('Unpublish page')}.click()`);await waitFor('document.querySelector("dialog")?.open');
  assert.match(await evaluate('document.querySelector("dialog").textContent'),/authorizes GitHub to merge/);
  await evaluate(`${button('Cancel')}.click()`);assert.equal(await evaluate('window.writes.length'),0);
  await evaluate(`${button('Unpublish page')}.click()`);await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`${button('Unpublish when ready')}.click()`);await waitFor('window.repo.pulls[0]?.auto_merge===true');
  assert.equal(await evaluate('window.writes[0].initialize'),true);
  assert.equal(await evaluate('window.writes.at(-1).action'),'unpublish');
  await waitFor(`!!${button('Cancel automatic unpublishing')}`);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  await evaluate('window.complete();window.websiteUnavailable=true');
  await waitFor('document.querySelector(".publication-heading").textContent==="Publication status unavailable"');
  assert.equal(await evaluate('!!document.querySelector(".publication-history")'),false);
  await evaluate(`window.websiteUnavailable=false;window.deployed=true;${button('Check again')}.click()`);
  await waitFor('document.querySelector(".publication-heading").textContent==="Unpublished"');
  assert.match(await evaluate('document.querySelector(".tiptap").textContent'),/Original text/);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('Library progress follows automatic publication through deployment, pauses when hidden, and performs no writes',options,async()=>{
 await withEditorBrowser(fixture({initialRequest:true}),async({evaluate,waitFor,send})=>{
  await waitFor('!!document.querySelector(".project-list button")');
  await evaluate('document.querySelector(".project-list button").scrollIntoView({block:"center"})');
  await waitFor('document.querySelector(".library-publication-progress")?.textContent==="Publishing when checks pass"');
  await evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))");
  await evaluate('window.pause(100)');const hidden=await evaluate('window.reads.length');
  await evaluate('window.pause(180)');assert.equal(await evaluate('window.reads.length'),hidden);
  await evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))");
  await evaluate('window.complete()');await waitFor('document.querySelector(".library-publication-progress").textContent==="Updating website…"');
  await evaluate('window.deployed=true');await waitFor('document.querySelector(".library-publication-progress").textContent==="Update deployed"');
  await waitFor('!document.querySelector(".project-list").textContent.includes("Unpublished changes")');
  for(const width of [1280,390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
  const count=await evaluate('window.reads.length');await evaluate('window.pause(180)');assert.equal(await evaluate('window.reads.length'),count);
  assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library'});
});
test('read-only progress checks are bounded and can be explicitly restarted',options,async()=>{
 const scenario=`import React from 'react';import{createRoot}from'react-dom/client';import{PublicationStatus}from'../src/components/editor/PublicationStatus';window.reads=0;const native=window.setTimeout.bind(window);window.pause=ms=>new Promise(resolve=>native(resolve,ms));window.setTimeout=(fn,ms,...args)=>native(fn,ms>=20000?1:ms,...args);createRoot(document.getElementById('root')).render(React.createElement(PublicationStatus,{path:'test',dirty:false,refreshVersion:0,disabled:false,onRetry:()=>{},load:async()=>{window.reads++;return{state:'pr-open',autoMerge:true,number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',website:{publication:'published'}}}}));`;
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor('window.reads===30');await evaluate('window.pause(150)');assert.equal(await evaluate('window.reads'),30);
  await evaluate(`${button('Check again')}.click()`);await waitFor('window.reads===60');
 });
});

test('a newly merged request never inherits deployment confirmation from a previous request',options,async()=>{
 const scenario=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{PublicationStatus}from'../src/components/editor/PublicationStatus';
 const previous={state:'merged',snapshotHead:'${'a'.repeat(40)}',number:40,url:'https://github.com/geobtaa/geobtaa.github.io/pull/40',website:{publication:'published',requestApplied:true}};
 window.next={...previous,snapshotHead:'${'b'.repeat(40)}',number:41,url:'https://github.com/geobtaa/geobtaa.github.io/pull/41',website:{publication:'published',requestApplied:false}};
 const load=async()=>window.hold?new Promise(resolve=>{window.finish=resolve;}):previous;
 function App(){const[submitted,setSubmitted]=useState();window.submit=()=>{window.hold=true;setSubmitted(window.next);};return React.createElement(PublicationStatus,{path:'test',dirty:false,refreshVersion:0,disabled:false,onRetry:()=>{},load,submitted});}
 createRoot(document.getElementById('root')).render(React.createElement(App));`;
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor('!!document.querySelector(".publication-history")');await evaluate('window.submit()');
  await waitFor('!!window.finish && !!document.querySelector(".publication-notice")');
  assert.equal(await evaluate('!!document.querySelector(".publication-complete")'),false);
  assert.equal(await evaluate('!!document.querySelector(".publication-history")'),false,'old deployment evidence is cleared before the new read completes');
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/not yet confirmed/);
  await evaluate('window.finish(window.next)');
  await waitFor('document.querySelector(".publication-status a").href.endsWith("/41")');
  assert.equal(await evaluate('!!document.querySelector(".publication-history")'),false);
 });
});
test('Library status reads are limited to two visible rows at a time',options,async()=>{
 const scenario=`import React from'react';import{createRoot}from'react-dom/client';import{LibraryPublicationProgress}from'../src/components/editor/LibraryPublicationProgress';import'../src/components/editor/editor.css';window.active=0;window.maximum=0;window.reads=0;window.releases=[];const load=async()=>{window.active++;window.reads++;window.maximum=Math.max(window.maximum,window.active);return new Promise(resolve=>window.releases.push(()=>{window.active--;resolve({state:'none'});}));};createRoot(document.getElementById('root')).render(React.createElement('ul',{},[0,1,2,3].map(i=>React.createElement('li',{key:i},'Document '+i,React.createElement(LibraryPublicationProgress,{path:String(i),load})))));`;
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor('window.releases?.length===2');assert.equal(await evaluate('window.maximum'),2);
  await evaluate('window.releases[0]();window.releases[1]()');await waitFor('window.releases.length===4');
  assert.equal(await evaluate('window.maximum'),2);await evaluate('window.releases[2]();window.releases[3]()');
  await waitFor('window.active===0');assert.equal(await evaluate('window.reads'),4);
 });
});

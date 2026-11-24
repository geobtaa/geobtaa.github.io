import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
const options={skip:chrome?false:'Chrome is required.',timeout:45000};
const button=text=>`[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)})`;
function fixture({unchanged=false,initialRequest=false,publication='published',newPage=false,autoEnabled=true}={}) {return `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import {draftTestRepository} from './draftTestRepository.mjs';
import {createDraftStore} from './draftStorage.mjs';
import {parsePage,savePage} from './page.mjs';
import {preparePublicationCandidate} from './publicationCandidate.mjs';
window.path='src/content/docs/library/report.mdx';
window.repo=await draftTestRepository({...(${newPage}?{}:{[window.path]:${JSON.stringify('---\ntitle: Report\n'+(publication==='unpublished'?'draft: true\n':'')+'---\n\nOriginal text.')}}),'navigation.groups.json':'[]'});
window.store=createDraftStore({request:window.repo.request});window.deployed=false;window.writes=[];window.reads=[];
if(!${unchanged}){const opened=${newPage}?{title:'Report',description:''}:await window.store.getContent('library','report.mdx');await savePage(window.store,'library','report.mdx',{...opened,...(opened.content?parsePage(opened.content):{}),body:'Saved selected work.'});}
window.complete=async()=>{const pr=window.repo.pulls.at(-1);await window.store.verifyPublication(pr.head.ref,pr.head.sha);const file=window.repo.filesAt(pr.head.sha).get(window.path),content=new TextDecoder().decode(window.repo.objects.get(file.sha));const sha=await window.repo.put(window.path,content);Object.assign(pr,{state:'closed',merged_at:'2026-11-20T00:00:00Z',merge_commit_sha:sha,auto_merge:false});};
if(${initialRequest}){const document=await window.store.getContent('library','report.mdx'),input={area:'library',filename:'report.mdx',head:document.head};const prepared=await window.store.preparePublication(input),request=await window.store.publishContent({...input,candidate:preparePublicationCandidate(prepared,'report.mdx')});await window.store.setPublicationAutoMerge({...input,snapshotHead:request.snapshotHead,enabled:true});}
const nativeTimeout=window.setTimeout.bind(window);window.pause=delay=>new Promise(resolve=>nativeTimeout(resolve,delay));
window.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay===20000?60:delay,...args);
window.fetch=async(url,options={})=>{
 const parsed=new URL(String(url),location.origin),path=parsed.pathname;window.reads.push(path);
 try{
  if(path==='/api/session')return Response.json({authenticated:true,login:'editor',workspace:window.store.workspace});
  if(path.startsWith('/api/publication-status/')){const pr=window.repo.pulls.at(-1),status=await window.store.getPublicationStatus('library','report.mdx'),action=status.action || 'publish';return Response.json({autoMergeEnabled:${autoEnabled},mainDraft:${newPage}?null:${publication==='unpublished'}||window.deployed&&action==='unpublish',unpublishEnabled:true,website:window.websiteUnavailable?{publication:'unavailable'}:{publication:window.deployed&&action==='unpublish'?'unpublished':${JSON.stringify(publication)},requestApplied:!!pr?.merged_at&&window.deployed},deployment:{state:window.deploymentFailed?'failed':'pending'}});}
  if(path.startsWith('/api/publish/')){
   if(!options.method)return Response.json(await window.store.getPublicationStatus('library','report.mdx'));
   const input=JSON.parse(options.body);window.writes.push(input);
   const route={area:'library',filename:'report.mdx',...input};
   if(input.initialize)return Response.json(await window.store.initializeUnpublish(route));
   if(Object.hasOwn(input,'autoMerge'))return Response.json(await window.store.setPublicationAutoMerge({...route,enabled:input.autoMerge}));
   return Response.json(await (input.prepare?window.store.preparePublication(route):window.store.publishContent(route)));
  }
  if(path==='/api/content/library')return Response.json(await window.store.discoverContent('library'));
  if(path==='/api/content/library/report.mdx'){if(options.method==='PUT'){const input=JSON.parse(options.body);window.writes.push(input);return Response.json(await savePage(window.store,'library','report.mdx',input));}const file=await window.store.getContent('library','report.mdx');return Response.json({...file,...parsePage(file.content)});}
  throw new Error('Unexpected API '+path);
 }catch(error){return Response.json({error:error.message},{status:error.status||500});}
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;}
test('confirmed publication, cancellation, outdated recovery and verified deployment preserve the form',options,async()=>{
 await withEditorBrowser(fixture(),async({evaluate,waitFor,send})=>{
  // Status reads can render the action before publication becomes available.
  await waitFor('document.querySelector(".publish-document")?.textContent==="Publish" && document.querySelector(".publish-document").disabled===false');
  assert.equal(await evaluate('window.writes.length'),0);
  await evaluate('document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
  assert.equal(await evaluate('window.writes.length'),0,'opening confirmation is read-only');
  await evaluate(`${button('Cancel')}.click()`);assert.equal(await evaluate('window.writes.length'),0);
  await evaluate('document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
  await evaluate('document.querySelector(".confirm-publication").click()');
  await waitFor(`!!${button('Cancel publishing')}`);
  assert.equal(await evaluate('window.repo.pulls.length'),1,'same request is reused');
  await evaluate('window.repo.pulls[0].checksFailed=true');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("Checks failed")');
  await evaluate(`${button('Cancel publishing')}.focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor('window.repo.pulls[0].auto_merge===false && document.body.textContent.includes("Automatic publishing cancelled")');
  await evaluate(`window.repo.pulls[0].checksFailed=false;${button('Publish')}.click()`);await waitFor('document.querySelector("dialog")?.open');await evaluate('document.querySelector(".confirm-publication").click()');await waitFor('window.repo.pulls[0].auto_merge===true');
  await evaluate("window.repo.put('unrelated.txt','Other website change')");
  await waitFor(`!!${button('Update and publish')}`);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/website changed while this action was waiting/);
  await evaluate(`${button('Update and publish')}.click()`);
  await waitFor('document.querySelector("dialog")?.open');
  assert.equal(await evaluate('window.repo.pulls.length'),1,'replacement is not submitted without confirmation');
  await evaluate('document.querySelector(".confirm-publication").click()');
  await waitFor('window.repo.pulls.length===2 && window.repo.pulls[0].state==="closed"');
  await waitFor('window.repo.pulls[1].auto_merge===true');
  await evaluate('window.complete()');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("not yet confirmed")');
  assert.equal(await evaluate('!!document.querySelector(".publication-history[open]")'),false);
  await evaluate('window.deploymentFailed=true');
  await waitFor('document.querySelector(".publication-notice").textContent.includes("website update failed")');
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
  await waitFor(`${button('Unpublish')}?.disabled===false`);
  await evaluate(`${button('Unpublish')}.click()`);await waitFor('document.querySelector("dialog")?.open');
  assert.match(await evaluate('document.querySelector("dialog").textContent'),/This page will be removed from the public website after the required checks finish/);
  await evaluate(`${button('Cancel')}.click()`);assert.equal(await evaluate('window.writes.length'),0);
  await evaluate(`${button('Unpublish')}.click()`);await waitFor('document.querySelector("dialog")?.open');
  await evaluate('document.querySelector(".confirm-publication").click()');await waitFor('window.repo.pulls[0]?.auto_merge===true');
  assert.equal(await evaluate('window.writes[0].initialize'),true);
  assert.equal(await evaluate('window.writes.at(-1).action'),'unpublish');
  await waitFor(`!!${button('Cancel unpublishing')}`);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  await evaluate('window.complete();window.websiteUnavailable=true');
  await waitFor('document.querySelector(".publication-heading").textContent==="Publication status unavailable"');
  assert.equal(await evaluate('document.querySelector(".publication-history")?.textContent.includes("website update was verified") || false'),false);
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
  assert.equal(await evaluate('document.querySelector(".publication-history")?.textContent.includes("website update was verified") || false'),false,'old deployment evidence is cleared before the new read completes');
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/not yet confirmed/);
  await evaluate('window.finish(window.next)');
  await waitFor('document.querySelector(".publication-status a").href.endsWith("/41")');
  assert.equal(await evaluate('document.querySelector(".publication-history")?.textContent.includes("website update was verified") || false'),false);
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
test('Publish confirmations use the requested copy and identify the saved version without writing before consent',options,async()=>{
 for(const scenario of [{newPage:true,publication:'unavailable'},{publication:'unpublished'},{publication:'published'}]) {
  await withEditorBrowser(fixture(scenario),async({evaluate,waitFor,send})=>{
   await waitFor('document.querySelector(".publish-document")?.disabled===false');
   const saved=await evaluate("window.store.getContent('library','report.mdx').then(file=>file.head)");
   await evaluate('document.querySelector(".publish-document").focus();document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
   const published=scenario.publication==='published';
   assert.equal(await evaluate('document.querySelector("dialog h2").textContent'),published?'Publish these changes?':'Publish this page?');
   assert.equal(await evaluate('document.querySelector("#publication-confirmation-description").textContent'),published?'Your saved changes will update the public website after the required checks finish.':'Your saved changes will be published to the public website after the required checks finish.');
   assert.equal(await evaluate('document.querySelector("dialog code").textContent'),saved.slice(0,12));
   assert.deepEqual(await evaluate('[...document.querySelectorAll("dialog button")].map(button=>button.textContent)'),['Cancel','Publish']);
   assert.equal(await evaluate('document.activeElement.textContent'),'Cancel');
   assert.equal(await evaluate('window.writes.length'),0);
   for(const width of [390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth && document.querySelector("dialog").getBoundingClientRect().right<=innerWidth'),true);}
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   await waitFor('!document.querySelector("dialog")');assert.equal(await evaluate('window.writes.length'),0);
   assert.equal(await evaluate('document.activeElement.classList.contains("publish-document")'),true);
   await evaluate('document.querySelector(".publish-document").focus();document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await waitFor('!document.querySelector("dialog")');assert.equal(await evaluate('window.writes.length'),0);
   assert.doesNotMatch(await evaluate('document.body.innerText'),/Submit for publishing|Submit unpublish request|Manual publishing/);
  },{initialSearch:'?area=library&file=report.mdx'});
 }
});
test('unsaved changes must be saved before confirmation and only the identified saved version is published',options,async()=>{
 await withEditorBrowser(fixture(),async({evaluate,waitFor,send})=>{
  await waitFor('document.querySelector(".publish-document")?.disabled===false');
  const old=await evaluate("window.store.getContent('library','report.mdx').then(file=>file.head)");
  await evaluate('document.querySelector(".editor-fields input[required]").focus()');await send('Input.insertText',{text:'Revised '});
  await waitFor('document.querySelector(".publish-document").disabled');
  await evaluate('document.querySelector(".publish-document").click()');assert.equal(await evaluate('!!document.querySelector("dialog")'),false);
  await evaluate('document.querySelector(".top-save").click()');await waitFor('document.querySelector(".publish-document").disabled===false');
  const saved=await evaluate("window.store.getContent('library','report.mdx').then(file=>file.head)");assert.notEqual(saved,old);
  await evaluate('document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
  assert.equal(await evaluate('document.querySelector("dialog code").textContent'),saved.slice(0,12));
  assert.equal(await evaluate('window.repo.pulls.length'),0);
  await evaluate('document.querySelector(".confirm-publication").click()');await waitFor('window.repo.pulls[0]?.auto_merge===true');
  assert.equal(await evaluate('window.writes.at(-1).head'),saved);
  assert.doesNotMatch(await evaluate('document.body.innerText'),/GitHub|\bPR\b|manual merge|merge (this|the) request/);
  await evaluate('document.querySelector(".publication-history summary").click()');
  assert.match(await evaluate('document.querySelector(".publication-history").innerText'),/GitHub/);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('confirmation is invalidated if the local working copy changes while it is open',options,async()=>{
 await withEditorBrowser(fixture(),async({evaluate,waitFor})=>{
  await waitFor('document.querySelector(".publish-document")?.disabled===false');
  await evaluate('document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`const input=document.querySelector('.editor-fields input[required]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'New unsaved title');input.dispatchEvent(new Event('input',{bubbles:true}));`);
  await waitFor('!document.querySelector("dialog") && document.querySelector(".publish-document").disabled');
  assert.equal(await evaluate('window.writes.length'),0);assert.equal(await evaluate('window.repo.pulls.length'),0);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('changes saved by another editor after confirmation opens cannot replace the selected saved version',options,async()=>{
 await withEditorBrowser(fixture(),async({evaluate,waitFor})=>{
  await waitFor('document.querySelector(".publish-document")?.disabled===false');
  const selected=await evaluate("window.store.getContent('library','report.mdx').then(file=>file.head)");
  await evaluate('document.querySelector(".publish-document").click()');await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`(async()=>{const file=await window.store.getContent('library','report.mdx');await window.store.saveContent({area:'library',filename:'report.mdx',sha:file.sha,head:file.head,content:file.content.replace('Saved selected work.','Later editorial work.')});})()`);
  assert.equal(await evaluate('document.querySelector("dialog code").textContent'),selected.slice(0,12));
  await evaluate('document.querySelector(".confirm-publication").click()');await waitFor('window.repo.pulls[0]?.auto_merge===true');
  const result=await evaluate(`(async()=>{const pr=window.repo.pulls[0],file=window.repo.filesAt(pr.head.sha).get(window.path);return {selected:window.writes.at(-1).head,content:new TextDecoder().decode(window.repo.objects.get(file.sha)),saved:(await window.store.getContent('library','report.mdx')).content};})()`);
  assert.equal(result.selected,selected);assert.match(result.content,/Saved selected work/);assert.doesNotMatch(result.content,/Later editorial work/);assert.match(result.saved,/Later editorial work/);
 },{initialSearch:'?area=library&file=report.mdx'});
});

test('disabled automatic publishing has no manual fallback in the normal interface',options,async()=>{
 await withEditorBrowser(fixture({autoEnabled:false}),async({evaluate,waitFor})=>{
  await waitFor('document.querySelector(".publication-status")?.dataset.state==="none"');
  assert.equal(await evaluate('document.querySelector(".publish-document").textContent'),'Publish');
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".unpublish-document").disabled'),true);
  assert.doesNotMatch(await evaluate('document.body.innerText'),/Submit for publishing|Submit unpublish request|Manual publishing/);
  await evaluate('document.querySelector(".publish-document").click();document.querySelector(".unpublish-document").click()');
  assert.equal(await evaluate('!!document.querySelector("dialog")'),false);assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('authorizing an earlier selection clearly identifies it and excludes newer saved work',options,async()=>{
 const scenario=fixture({initialRequest:true}).replace("createRoot(document.getElementById('root'))",`window.repo.pulls[0].auto_merge=false;const selected=await window.store.getContent('library','report.mdx');window.earlierHead=selected.head;await window.store.saveContent({area:'library',filename:'report.mdx',head:selected.head,sha:selected.sha,content:selected.content.replace('Saved selected work.','Newer saved work.')});createRoot(document.getElementById('root'))`);
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor('document.querySelector(".publication-notice")?.innerText.includes("not authorized")');
  await evaluate('[...document.querySelectorAll(".publication-notice button")].find(button=>button.textContent==="Publish").click()');await waitFor('document.querySelector("dialog")?.open');
  assert.equal(await evaluate('document.querySelector("dialog code").textContent===window.earlierHead.slice(0,12)'),true);
  assert.match(await evaluate('document.querySelector("dialog").textContent'),/earlier saved version.*Newer saved changes are not included/);
  await evaluate('document.querySelector(".confirm-publication").click()');await waitFor('window.repo.pulls[0].auto_merge===true');
  assert.equal(await evaluate('window.repo.pulls.length'),1);
  assert.equal(await evaluate('window.writes.at(-1).head===window.earlierHead'),true);
 },{initialSearch:'?area=library&file=report.mdx'});
});

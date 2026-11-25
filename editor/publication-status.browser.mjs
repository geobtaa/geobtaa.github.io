import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
const selected = 'a'.repeat(40), head = 'c'.repeat(40);
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record={filename:'report.mdx',head:'${head}',sha:'${'b'.repeat(40)}',hasDraft:true,baselineExists:true,title:'Newer saved draft',description:'',draft:true,body:'Working draft text.',content:'---\\ntitle: Newer saved draft\\ndraft: true\\n---\\n\\nWorking draft text.'};
window.statusResult=JSON.parse(localStorage.getItem('publication-server-status')||'null')||{state:'pr-open',message:'Publication PR created. Wait for required checks, then merge in GitHub.',selectedHead:'${selected}',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',newerDraft:true,autoMerge:false,website:{publication:'published'}};
window.writes=[];window.loadId=crypto.randomUUID();
window.setStatus=value=>{window.statusResult=value;localStorage.setItem('publication-server-status',JSON.stringify(value))};
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;
 if(options.method&&options.method!=='GET')window.writes.push({path,input:JSON.parse(options.body||'{}')});
 if(path==='/api/session')return Response.json({authenticated:true,login:localStorage.getItem('publication-login')||'first-editor',workspace:'geobtaa/geobtaa.github.io#cms-drafts-v1'});
 if(path==='/api/content/library')return Response.json({branch:'main',entries:[{name:'report.mdx',path:'src/content/docs/library/report.mdx',sha:window.record.sha,hasDraft:true}]});
 if(path==='/api/content/library/report.mdx')return Response.json(window.record);
 if(path.startsWith('/api/publication-status/'))return Response.json({...window.statusResult,autoMergeEnabled:window.autoEnabled!==false});
 if(path.startsWith('/api/publish/')) {
  if(options.method==='POST') {const input=JSON.parse(options.body); if(input.prepare)return Response.json({head:input.head,content:window.record.content,assets:{}});window.statusResult={...window.statusResult,state:'pr-open',selectedHead:input.head,snapshotHead:'${'e'.repeat(40)}',autoMerge:input.autoMerge===true,number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42'};return Response.json(window.statusResult);}
  if(window.failStatus)throw new Error('Status temporarily unavailable');
  return Response.json(window.statusResult);
 }
 if(path==='/api/images')return Response.json({images:[]});
 throw new Error('Unexpected read '+path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 45000 };
const title = 'document.querySelector(".editor-fields input[required]")';
const heading = 'document.querySelector(".publication-heading")?.textContent';
const refresh = `document.querySelector('.publication-history button').click()`;
const setup = value => fixture.replace("createRoot(document.getElementById('root'))", `window.setStatus(${value});createRoot(document.getElementById('root'))`);
test('compact unified status distinguishes drafts and live versions, with secondary technical controls', options, async () => {
 await withEditorBrowser(setup("{state:'none',mainDraft:false,unpublishEnabled:true,website:{publication:'published'}}"),async({evaluate,waitFor,send})=>{
  await waitFor('document.querySelector(".publish-document")?.disabled===false');
  assert.equal(await evaluate(heading),'Draft saved');
  assert.equal(await evaluate('document.querySelector(".top-save").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".publication-history").open'),false);
  assert.equal(await evaluate('document.querySelector(".publication-options")'),null);
  assert.equal(await evaluate('document.querySelector(".unpublish-document").offsetHeight > 0'),true);
  assert.equal(await evaluate('document.querySelectorAll(".navigation-actions > button").length'),2);
  assert.equal(await evaluate('document.querySelectorAll(".save-state").length'),1);
  assert.doesNotMatch(await evaluate('document.body.innerText'),/GitHub|Refresh status|More options|Check again/);
  await evaluate(`${title}.focus();${title}.select()`);await send('Input.insertText',{text:'New local edits'});
  await waitFor(`${heading}==='Unsaved changes'`);
  assert.equal(await evaluate('document.querySelector(".top-save").disabled'),false);
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".unpublish-document").disabled'),true);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('progress, failures, and verified completion preserve controls, newer edits and undo', options, async()=>{
 const initial=`{state:'pr-open',autoMerge:true,selectedHead:'${head}',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',website:{publication:'published'}}`;
 await withEditorBrowser(setup(initial),async({evaluate,waitFor,send})=>{
  await waitFor(`${heading}==='Publishing…'`);
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/You can leave the editor/);
  for(const width of [1280,768,640,501,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   const y=await evaluate('document.querySelector(".document-toolbar").getBoundingClientRect().y');
   for(const state of ["{...window.statusResult,state:'merged',website:{publication:'published',requestApplied:false}}", "{...window.statusResult,state:'merged',website:{publication:'published',requestApplied:true}}"]){
    await evaluate(`window.setStatus(${state});${refresh}`);await waitFor('document.querySelector(".publication-status").dataset.state==="merged"');
    await waitFor(`${heading}===${state.includes('requestApplied:true')?"'Published'":"'Publishing…'"}`);
    assert.equal(await evaluate('document.querySelector(".document-toolbar").getBoundingClientRect().y'),y);
   }
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  await evaluate(`window.originalEditor=document.querySelector('.tiptap');${title}.focus();${title}.select()`);await send('Input.insertText',{text:'Keep my newer edits'});
  await waitFor(`${heading}==='Unsaved changes'`);
  await evaluate(`window.setStatus({...window.statusResult,website:{publication:'unavailable'}});${refresh}`);
  await waitFor('document.querySelector(".publication-notice").textContent.includes("temporarily unavailable")');
  assert.equal(await evaluate(`${title}.value`),'Keep my newer edits');
  assert.equal(await evaluate('document.querySelector(".tiptap")===window.originalEditor'),true);
  assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('reopening under another account discovers authorized publishing without writes',options,async()=>{
 await withEditorBrowser(setup(`{state:'pr-open',autoMerge:true,selectedHead:'${selected}',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',newerDraft:true,website:{publication:'published'}}`),async({evaluate,waitFor,send})=>{
  await waitFor(`${heading}==='Publishing…'`);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/Newer saved changes are not included/);
  const load=await evaluate('window.loadId');
  await evaluate('localStorage.setItem("publication-login","second-editor")');await send('Page.reload');
  await waitFor(`window.loadId!==${JSON.stringify(load)} && ${heading}==='Publishing…'`);
  assert.equal(await evaluate('window.writes.length'),0);
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('temporary request failures preserve background progress without certifying deployment',options,async()=>{
 await withEditorBrowser(setup(`{state:'pr-open',autoMerge:true,selectedHead:'${head}',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',website:{publication:'published'}}`),async({evaluate,waitFor})=>{
  await waitFor(`${heading}==='Publishing…'`);
  await evaluate(`window.failStatus=true;${refresh}`);
  await waitFor('document.querySelector(".publication-notice").textContent.includes("temporarily unavailable")');
  assert.equal(await evaluate(heading),'Publishing…');
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  await evaluate(`window.failStatus=false;window.setStatus({...window.statusResult,checks:'failed'});${refresh}`);
  await waitFor(`${heading}==='Needs attention'`);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/Your draft is safe/);
 },{initialSearch:'?area=library&file=report.mdx'});
});
test('View published page uses only verified public URLs and stays beside Edit / Preview',options,async()=>{
 await withEditorBrowser(setup("{state:'none',website:{publication:'published',liveUrl:'https://gin.btaa.org/custom/published/'}}"),async({evaluate,waitFor})=>{
  await waitFor('!!document.querySelector(".view-live-page")');
  assert.equal(await evaluate('document.querySelector(".view-live-page").href'),'https://gin.btaa.org/custom/published/');
  assert.equal(await evaluate('document.querySelector(".view-live-page").textContent.trim()'),'View published page');
  assert.equal(await evaluate('document.querySelector(".application-header-links > a").textContent.trim()'),'gin.btaa.org');
  assert.equal(await evaluate('document.querySelectorAll(".application-header-links > a svg[aria-hidden=true], .view-live-page svg[aria-hidden=true]").length'),2);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".view-live-page")).borderTopStyle'),'solid');
  assert.equal(await evaluate('document.querySelector(".view-live-page").target'),'_blank');
  assert.equal(await evaluate('!!document.querySelector(".document-toolbar .view-live-page")'),true);
  for(const url of ['https://evil.test/page/','javascript:alert(1)','https://gin.btaa.org@evil.test/','https://gin.btaa.org/page/?draft=1']){
   await evaluate(`window.setStatus({state:'none',website:{publication:'published',liveUrl:${JSON.stringify(url)}}});${refresh}`);
   await waitFor('!document.querySelector(".view-live-page")');
  }
  assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library&file=report.mdx'});
});

test('a verified live earlier blob does not mark a newer main version as published',options,async()=>{
 const scenario=setup(`{state:'none',website:{publication:'published',deployedBlob:'${'d'.repeat(40)}'}}`).replace("window.setStatus({state:'none'", "window.record.hasDraft=false;window.setStatus({state:'none'");
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor(`${heading}==='Draft saved'`);
  assert.match(await evaluate('document.querySelector(".publication-notice").textContent'),/An earlier version is live/);
 },{initialSearch:'?area=library&file=report.mdx'});
});

test('manual refresh acknowledges unchanged results, prevents duplicate clicks and distinguishes verification failures',options,async()=>{
 const scenario=`import React from 'react';import{createRoot}from'react-dom/client';import{PublicationStatus}from'../src/components/editor/PublicationStatus';
 window.reads=0;window.result={state:'none',website:{publication:'published'}};
 const load=async()=>{window.reads++;if(window.reads===1)return window.result;return new Promise((resolve,reject)=>{window.finish=()=>window.fail?reject(Error('Unavailable')):resolve(window.result);});};
 createRoot(document.getElementById('root')).render(React.createElement(PublicationStatus,{path:'test',dirty:false,hasDraft:false,refreshVersion:0,disabled:false,onRetry:()=>{},load}));`;
 await withEditorBrowser(scenario,async({evaluate,waitFor})=>{
  await waitFor('document.querySelector(".publication-heading")?.textContent==="Published"');
  assert.equal(await evaluate('document.querySelector(".publication-refresh-feedback").textContent.trim()'),'');
  await evaluate('document.querySelector(".publication-history").open=true;document.querySelector(".publication-refresh").click()');
  await waitFor('window.reads===2 && document.querySelector(".publication-refresh").disabled');
  assert.equal(await evaluate('document.querySelector(".publication-refresh").textContent'),'Refreshing…');
  await evaluate('document.querySelector(".publication-refresh").click()');assert.equal(await evaluate('window.reads'),2);
  await evaluate('window.finish()');
  await waitFor('document.querySelector(".publication-refresh-feedback").textContent.includes("Status check complete")');
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.equal(await evaluate('document.querySelector(".publication-refresh").disabled'),false);
  await evaluate('window.fail=true;document.querySelector(".publication-refresh").click()');
  await waitFor('window.reads===3');await evaluate('window.finish()');
  await waitFor('document.querySelector(".publication-refresh-feedback").textContent.includes("could not be verified")');
  assert.equal(await evaluate('document.querySelector(".publication-refresh").disabled'),false);
 });
});

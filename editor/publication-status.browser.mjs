import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
const selected = 'a'.repeat(40), head = 'c'.repeat(40);
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record={filename:'report.mdx',head:'${head}',sha:'${'b'.repeat(40)}',hasDraft:true,baselineExists:true,title:'Newer saved draft',description:'',draft:true,body:'Working draft text.',content:'---\\ntitle: Newer saved draft\\ndraft: true\\n---\\n\\nWorking draft text.'};
window.statusResult=JSON.parse(localStorage.getItem('publication-server-status')||'null')||{state:'pr-open',message:'Publication PR created. Wait for required checks, then merge in GitHub.',selectedHead:'${selected}',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42',newerDraft:true,website:{publication:'published'}};
window.writes=[];window.loadId=crypto.randomUUID();
window.setStatus=value=>{window.statusResult=value;localStorage.setItem('publication-server-status',JSON.stringify(value))};
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;
 if(options.method&&options.method!=='GET')window.writes.push({path,input:JSON.parse(options.body||'{}')});
 if(path==='/api/session')return Response.json({authenticated:true,login:localStorage.getItem('publication-login')||'first-editor',workspace:'geobtaa/geobtaa.github.io#cms-drafts-v1'});
 if(path==='/api/content/library')return Response.json({branch:'main',entries:[{name:'report.mdx',path:'src/content/docs/library/report.mdx',sha:window.record.sha,hasDraft:true}]});
 if(path==='/api/content/library/report.mdx')return Response.json(window.record);
 if(path.startsWith('/api/publication-status/'))return Response.json(window.statusResult);
 if(path.startsWith('/api/publish/')) {
  if(options.method==='POST') {const input=JSON.parse(options.body); if(input.prepare)return Response.json({head:input.head,content:window.record.content,assets:{}});return Response.json({...window.statusResult,state:'pr-open',selectedHead:input.head});}
  if(window.failStatus)throw new Error('Status temporarily unavailable');
  return Response.json(window.statusResult);
 }
 if(path==='/api/images')return Response.json({images:[]});
 throw new Error('Unexpected read '+path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 45000 };
const title = 'document.querySelector(".editor-fields input[required]")';
test('document title and publication status remain visible independently of requests',options,async()=>{
  const empty=fixture.replace("createRoot(document.getElementById('root'))",`window.setStatus({state:'none'});
    const gateway=window.fetch;window.statusReads=0;
    window.fetch=async(url,options={})=>{if(String(url).includes('/api/publish/')&&!options.method){window.statusReads++;if(window.statusReads===1)return new Promise(resolve=>{window.finishStatus=()=>resolve(Response.json({state:'none'}));});}return gateway(url,options);};
    createRoot(document.getElementById('root'))`);
  await withEditorBrowser(empty,async({evaluate,waitFor,send})=>{
    await waitFor(`!!${title} && !!window.finishStatus`);
    assert.equal(await evaluate('document.querySelector("h1").textContent'),'Newer saved draft');
    assert.equal(await evaluate('!!document.querySelector(".dashboard-link")'),false);
    assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Checking publication status…');
    assert.equal(await evaluate('document.querySelector(".draft-status").textContent'),'All changes saved');
    assert.equal(await evaluate('document.body.textContent.includes("This creates a GitHub publication request.")'),false);
    await evaluate('window.finishStatus()');
    await evaluate(`${title}.focus();${title}.select()`);await send('Input.insertText',{text:'Actual revised title'});
    await waitFor('document.querySelector("h1").textContent==="Actual revised title"');
    assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Publication status unavailable');
    assert.equal(await evaluate('window.statusReads'),1,'presentation changes add no status requests');
    await evaluate(`${title}.select()`);await send('Input.insertText',{text:'Newer saved draft'});
    await waitFor('document.querySelector(".publish-document").disabled===false');
    await evaluate(`window.setStatus({state:'pr-open',number:42,url:'https://github.com/geobtaa/geobtaa.github.io/pull/42'});document.querySelector('.publish-document').click()`);
    await waitFor('document.querySelector(".publication-status")?.dataset.state==="pr-open"');
    assert.equal(await evaluate('window.writes.length'),2,'prepare and creation remain separate');
  },{initialSearch:'?area=library&file=report.mdx'});
});
test('manual PR status refresh preserves unsaved text, never writes, and recovers after another login/reload', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const {evaluate,waitFor,send}=browser;
    await waitFor(`!!${title} && document.querySelector('.publication-status')?.dataset.state==='pr-open'`);
    assert.equal(await evaluate('document.querySelector(".publication-status strong").textContent'),'Published');
    assert.equal(await evaluate('document.querySelector(".publication-status p[role=status]").textContent'),'Submitted for publishing. Review and merge the request after its checks pass.');
    assert.equal(await evaluate('document.querySelector(".publication-status a").textContent'),'Review publication request #42');
    assert.equal(await evaluate('document.querySelector(".publication-status button").textContent'),'Check again');
    await evaluate(`window.originalEditor=document.querySelector('.tiptap');${title}.focus();${title}.select()`);
    await send('Input.insertText',{text:'Keep my unsaved title'});
    await evaluate(`window.setStatus({...window.statusResult,state:'closed',website:{publication:'unavailable'},message:'Publication PR closed without merging.'});document.querySelector('.publication-status button').click()`);
    await waitFor('document.querySelector(".publication-status").dataset.state==="closed"');
    assert.equal(await evaluate(`${title}.value`),'Keep my unsaved title');
    assert.equal(await evaluate('document.querySelector(".tiptap")===window.originalEditor'),true);
    await evaluate(`window.setStatus({...window.statusResult,state:'merged',message:'PR merged. GitHub Pages handles deployment; deployment is not verified here.'});document.querySelector('.publication-status button').click()`);
    await waitFor('document.querySelector(".publication-status").dataset.state==="merged"');
    assert.equal(await evaluate(`${title}.value`),'Keep my unsaved title');
    assert.match(await evaluate('document.querySelector(".publication-status").textContent'),/Newer edits.*not included/);
    assert.equal(await evaluate('window.writes.length'),0);
    await evaluate(`${title}.focus();${title}.select()`);await send('Input.insertText',{text:'Newer saved draft'});
    await waitFor('document.querySelector(".save-state").textContent==="All changes saved"');
    const load=await evaluate('window.loadId');
    await evaluate('localStorage.setItem("publication-login","second-editor")');await send('Page.reload');
    await waitFor(`window.loadId!==${JSON.stringify(load)} && document.querySelector('.publication-status')?.dataset.state==='merged'`);
    assert.equal(await evaluate('window.writes.length'),0);
    assert.equal(await evaluate('document.querySelector(".publication-status a").href'),'https://github.com/geobtaa/geobtaa.github.io/pull/42');
    await evaluate(`window.setStatus({state:'published',message:'Unverified deployment claim'});document.querySelector('.publication-status button').click()`);
    await waitFor('document.querySelector(".publication-status").dataset.state==="checking"');
    assert.equal(await evaluate('[...document.querySelectorAll(".publication-status a")].some(link=>link.textContent==="View live")'),false);
  },{initialSearch:'?area=library&file=report.mdx'});
});
test('Submit for publishing prepares the saved revision in the browser and retains a PR link if status refresh fails', options, async () => {
  await withEditorBrowser(fixture, async ({evaluate,waitFor}) => {
    await waitFor(`!!${title} && document.querySelector('.publish-document')?.disabled===false`);
    assert.equal(await evaluate('document.querySelector(".publish-document").textContent'),'Submit for publishing');
    await evaluate('window.failStatus=true;document.querySelector(".publish-document").click()');
    await waitFor('window.writes.length===2 && !!document.querySelector(".publication-status a") && document.querySelector(".publish-document").disabled===false');
    const writes=await evaluate('window.writes');
    assert.equal(writes[0].input.prepare,true);
    assert.equal(writes[1].input.head,head);
    assert.match(writes[1].input.candidate.content,/draft: false/);
    assert.deepEqual(writes[1].input.candidate.assets,[]);
    assert.equal(await evaluate('document.querySelector(".publication-status a").href'),'https://github.com/geobtaa/geobtaa.github.io/pull/42');
  },{initialSearch:'?area=library&file=report.mdx'});
});

test('compact header keeps actions stable, formats local save time, and wraps on narrow screens', options, async () => {
  const scenario = fixture.replace("createRoot(document.getElementById('root'))", `window.record.lastSavedAt='2026-11-20T16:42:00Z';window.record.lastSavedBy='Editor';createRoot(document.getElementById('root'))`);
  await withEditorBrowser(scenario, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".publication-status button") && !!document.querySelector(".unpublish-document")');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".navigation-actions button")].map(button=>button.textContent)'), ['Save Draft', 'Submit for publishing', 'Unpublish page']);
    assert.equal(await evaluate('document.querySelectorAll(".save-state").length'), 1);
    assert.equal(await evaluate('document.querySelector(".document-controls")'), null);
    assert.equal(await evaluate('document.querySelector("time").textContent === new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(window.record.lastSavedAt))'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".publication-status")).borderTopWidth'), '0px');
    const positions = await evaluate('[...document.querySelectorAll(".navigation-actions button")].map(button=>{const r=button.getBoundingClientRect();return [r.x,r.y]})');
    await evaluate(`window.setStatus({state:'none',website:{publication:'published'},mainDraft:false,unpublishEnabled:true});document.querySelector('.publication-status button').click()`);
    await waitFor('document.querySelector(".publication-status").dataset.state === "none"');
    assert.equal(await evaluate('!!document.querySelector(".publication-status button")'), false, 'verified status has no permanent refresh button');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".navigation-actions button")].map(button=>{const r=button.getBoundingClientRect();return [r.x,r.y]})'), positions);
    for (const width of [1280, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `no horizontal overflow at ${width}px`);
      assert.equal(await evaluate('document.querySelector(".document-toolbar").getBoundingClientRect().bottom <= document.querySelector("#document-edit").getBoundingClientRect().top'), true);
      assert.equal(await evaluate('[...document.querySelectorAll(".navigation-actions button")].every(button=>{const r=button.getBoundingClientRect();return r.left>=0 && r.right<=window.innerWidth})'), true);
    }
    assert.equal(await evaluate('window.writes.length'), 0);
  }, { initialSearch: '?area=library&file=report.mdx' });
});

test('closed requests keep their actions in keyboard-accessible history without a permanent warning', options, async () => {
  const scenario = fixture.replace("createRoot(document.getElementById('root'))", `window.setStatus({...window.statusResult,state:'closed',checks:'failed',deployment:{state:'failed'}});createRoot(document.getElementById('root'))`);
  await withEditorBrowser(scenario, async ({evaluate,waitFor,send}) => {
    await waitFor('!!document.querySelector(".publication-history")');
    assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'), 'Published');
    assert.equal(await evaluate('!!document.querySelector(".publication-notice")'), false);
    assert.equal(await evaluate('document.querySelector(".publication-history").open'), false);
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(button=>button.textContent==="Check again")'), false);
    await evaluate('document.querySelector(".publication-history summary").focus()');
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await waitFor('document.querySelector(".publication-history").open');
    assert.match(await evaluate('document.querySelector(".publication-history").textContent'), /closed without merging/);
    assert.equal(await evaluate('document.querySelector(".publication-history button").textContent'), 'Update publication request');
    assert.equal(await evaluate('document.querySelector(".publication-history a").href'), 'https://github.com/geobtaa/geobtaa.github.io/pull/42');
    assert.equal(await evaluate('window.writes.length'), 0);
  }, {initialSearch:'?area=library&file=report.mdx'});
});
test('request and website problems share a compact notice and resolved warnings move out of view', options, async () => {
  const scenario = fixture.replace("createRoot(document.getElementById('root'))", `window.setStatus({...window.statusResult,checks:'failed',website:{publication:'unavailable',message:'The website status could not be verified. Your saved work is safe.'}});createRoot(document.getElementById('root'))`);
  await withEditorBrowser(scenario, async ({evaluate,waitFor,send}) => {
    await waitFor('!!document.querySelector(".publication-notice")');
    assert.equal(await evaluate('document.querySelectorAll(".publication-notice").length'), 1);
    assert.match(await evaluate('document.querySelector(".publication-notice").textContent'), /request failed validation/);
    assert.equal(await evaluate('document.querySelector(".publication-notice").textContent.split("website status could not be verified").length'), 2);
    assert.equal(await evaluate('document.querySelector(".publication-notice-actions button").textContent'), 'Check again');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".publication-notice-actions button")).borderTopWidth'), '0px');
    for (const width of [390,320]) {
      await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:true});
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'active notice fits narrow screens');
    }
    await evaluate(`window.setStatus({...window.statusResult,state:'merged',deployment:{state:'failed'},website:{publication:'published',requestApplied:false}});document.querySelector('.publication-notice button').click()`);
    await waitFor('document.querySelector(".publication-notice").textContent.includes("Website update failed")');
    assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'), 'Published');
    assert.doesNotMatch(await evaluate('document.querySelector(".publication-notice").textContent'), /failed validation/);
    await evaluate(`window.setStatus({...window.statusResult,website:{publication:'published',requestApplied:true}});document.querySelector('.publication-notice button').click()`);
    await waitFor('!!document.querySelector(".publication-history") && !document.querySelector(".publication-notice")');
    assert.equal(await evaluate('document.querySelector(".publication-history").open'), false);
    assert.doesNotMatch(await evaluate('document.querySelector(".publication-status").textContent'), /Website update failed|failed validation/);
    assert.equal(await evaluate('!!document.querySelector(".publication-history a")'), true);
    for (const width of [1280,390,320]) {
      await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<500});
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
      assert.equal(await evaluate('document.querySelector(".editor-mode-toggle").getBoundingClientRect().left === document.querySelector("#document-edit").getBoundingClientRect().left'), true);
    }
    assert.equal(await evaluate('window.writes.length'), 0);
  }, {initialSearch:'?area=library&file=report.mdx'});
});

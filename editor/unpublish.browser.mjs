import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
const head = 'a'.repeat(40), blob = 'b'.repeat(40);
const original = '---\ntitle: Main page\npagefind: false\nsidebar:\n  hidden: true\n---\n\nPublic body.';
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.original=${JSON.stringify(original)};
window.record={filename:'page.mdx',sha:'${blob}',head:'${head}',hasDraft:true,baselineExists:true,title:'Saved editorial title',description:'',draft:false,body:'Saved independent editorial work.',content:'---\\ntitle: Saved editorial title\\n---\\n\\nSaved independent editorial work.'};
window.unpublishState={state:'none',mainDraft:false,unpublishEnabled:true,website:{publication:'published'}};
window.writes=[];
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;
 if(path==='/api/session')return Response.json({authenticated:true,login:'tester'});
 if(path==='/api/content/library/page.mdx')return Response.json(window.record);
 if(path.startsWith('/api/publication-status/'))return Response.json(window.unpublishState);
 if(path.startsWith('/api/publish/')){
  if(window.failRequestStatus && !options.method)throw new Error('Temporary request-status failure');
  if(options.method==='POST'){
   const input=JSON.parse(options.body);window.writes.push(input);
   if(input.prepare)return Response.json({head:input.head,content:window.original,assets:{},action:input.action});
   window.unpublishState={...window.unpublishState,state:'pr-open',action:input.action,selectedHead:input.head,number:12,url:'https://github.com/geobtaa/geobtaa.github.io/pull/12'};
  }
  return Response.json(window.unpublishState);
 }
 if(path==='/api/content/library')return Response.json({entries:[]});
 throw new Error('Unexpected route '+path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome is required.', timeout: 30_000 };
const button = text => `[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)})`;
test('Unpublish confirms only main visibility, preserves working content, and never reports success before verified deployment', options, async () => {
 await withEditorBrowser(fixture, async ({evaluate,waitFor}) => {
  await waitFor(`${button('Unpublish page')}?.disabled===false`);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'), 'Published');
  await evaluate(`${button('Unpublish page')}.click()`); await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`${button('Cancel')}.click()`); assert.equal(await evaluate('window.writes.length'),0);
  await evaluate(`${button('Unpublish page')}.click()`); await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`${button('Submit unpublish request')}.click()`);
  await waitFor('window.writes.length===2 && document.querySelector(".publication-status").dataset.state==="pr-open"');
  const writes = await evaluate('window.writes');
  assert.equal(writes[0].action,'unpublish');assert.equal(writes[1].action,'unpublish');
  assert.match(writes[1].candidate.content,/draft: true/);assert.match(writes[1].candidate.content,/Public body/);assert.doesNotMatch(writes[1].candidate.content,/independent editorial/);assert.deepEqual(writes[1].candidate.assets,[]);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.match(await evaluate('document.querySelector(".tiptap").textContent'),/Saved independent editorial work/);
  assert.equal(await evaluate(`${button('Unpublish page')}.disabled`),true);
  await evaluate(`window.failRequestStatus=true;${button('Check status')}.click()`);
  await waitFor('document.querySelector(".publication-status").dataset.state==="checking"');
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".publication-status a").href'),'https://github.com/geobtaa/geobtaa.github.io/pull/12');
  await evaluate('window.failRequestStatus=false');
  await evaluate(`window.unpublishState={...window.unpublishState,state:'merged',deployment:{state:'failed'}};${button('Check status')}.click()`);
  await waitFor('document.querySelector(".publication-status").textContent.includes("Website update failed")');
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  await evaluate(`window.unpublishState={...window.unpublishState,website:{publication:'unpublished',requestApplied:true},mainDraft:true};${button('Check status')}.click()`);
  await waitFor('document.querySelector(".publication-heading").textContent==="Unpublished"');
  assert.match(await evaluate('document.querySelector(".tiptap").textContent'),/Saved independent editorial work/);
  assert.equal(await evaluate('window.writes.length'),2);
 },{initialSearch:'?area=library&file=page.mdx'});
});
test('disabled unpublish and unsaved editorial work cannot submit an unpublish request; refresh retains the action',options,async()=>{
 await withEditorBrowser(fixture.replace('unpublishEnabled:true','unpublishEnabled:false'),async({evaluate,waitFor,send})=>{
  await waitFor(`!!${button('Unpublish page')}`);assert.equal(await evaluate(`${button('Unpublish page')}.disabled`),true);
  await evaluate(`window.unpublishState.unpublishEnabled=true;${button('Check status')}.click()`);await waitFor(`${button('Unpublish page')}.disabled===false`);
  await evaluate('document.querySelector("#document-edit input[required]").focus()');await send('Input.insertText',{text:'Unsaved'});
  await waitFor(`${button('Unpublish page')}.disabled===true`);assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library&file=page.mdx'});
});

test('Refresh request retains the unpublish action and original saved revision', options, async () => {
 const setup = fixture.replace("createRoot(document.getElementById('root'))", `window.unpublishState={...window.unpublishState,state:'conflict',action:'unpublish',selectedHead:'${head}',number:12,url:'https://github.com/geobtaa/geobtaa.github.io/pull/12'};createRoot(document.getElementById('root'))`);
 await withEditorBrowser(setup, async ({evaluate,waitFor}) => {
  await waitFor(`!!${button('Refresh request')}`);
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'), true, 'an active unpublish cannot be silently replaced with publish');
  await evaluate(`${button('Refresh request')}.click()`);
  await waitFor('window.writes.length===2');
  const writes = await evaluate('window.writes');
  assert.equal(writes[0].head,head);assert.equal(writes[0].action,'unpublish');assert.equal(writes[1].action,'unpublish');
 },{initialSearch:'?area=library&file=page.mdx'});
});

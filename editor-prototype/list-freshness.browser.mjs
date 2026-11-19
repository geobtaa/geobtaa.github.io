import assert from 'node:assert/strict';
import test from 'node:test';
import { withEditorBrowser } from './browserHarness.mjs';
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.calls=[];window.rejectList=false;window.extra=false;window.stale=false;
window.record={filename:'one.mdx',title:'One',description:'',body:'Original.',content:'---\\ntitle: One\\n---\\n\\nOriginal.',sha:'original',head:'${'a'.repeat(40)}',draft:false,authors:[],tags:[],cover:null};
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;window.calls.push({path,method:options.method||'GET'});
 if(path==='/api/session')return Response.json({authenticated:true,login:'reader'});
 if(path==='/api/content/library'){
  if(window.rejectList)throw Error('List refresh must not block document opening');
  return Response.json({branch:'main',entries:[{name:'one.mdx',path:'src/content/docs/library/one.mdx',sha:window.record.sha,draft:false,visibilityKnown:true},...(window.extra?[{name:'newly-added.mdx',path:'src/content/docs/library/newly-added.mdx',sha:'new',draft:true,visibilityKnown:true}]:[])]});
 }
 if(path==='/api/content/library/one.mdx'){
  if(options.method==='PUT'){
   if(window.stale)return Response.json({error:'This page has changed in GitHub since you opened it.'},{status:409});
   const input=JSON.parse(options.body);window.record={...window.record,...input,sha:'saved',commitSha:'${'b'.repeat(40)}',head:'${'b'.repeat(40)}',content:'---\\ntitle: '+input.title+'\\n---\\n\\n'+input.body};
  }return Response.json(window.record);
 }
 if(path.startsWith('/api/publish/'))return Response.json({state:'none'});
 throw Error('Unexpected request '+path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('opening/reopening a document skips list reads; return and Save Draft refresh list contents', {timeout:30_000}, async()=>{
 await withEditorBrowser(fixture,async({evaluate,waitFor,send})=>{
  const listCount=()=>evaluate("window.calls.filter(c=>c.path==='/api/content/library').length");
  await waitFor('!!document.querySelector(".project-list button")');assert.equal(await listCount(),1);
  await evaluate('window.rejectList=true;[...document.querySelectorAll(".project-list button")].find(b=>b.querySelector(".content-name").textContent==="one").click()');
  await waitFor('document.querySelector("h1")?.textContent === "Edit Library document"');
  assert.equal(await listCount(),1);
  await evaluate('window.rejectList=false;window.extra=true;document.querySelector(".editor-navigation .back").click()');
  await waitFor('document.querySelectorAll(".project-list button").length===2');assert.equal(await listCount(),2);
  await evaluate('[...document.querySelectorAll(".project-list button")].find(b=>b.querySelector(".content-name").textContent==="one").click()');
  await waitFor('!!document.querySelector(".top-save")');assert.equal(await listCount(),2);
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent==='Title').querySelector('input').focus()");
  await send('Input.insertText',{text:' edited'});
  await evaluate('document.querySelector(".top-save").click()');
  await waitFor('window.record.sha === "saved" && !document.querySelector(".top-save").disabled');
  assert.equal(await listCount(),3);
 },{initialSearch:'?area=library'});
});

test('direct document links do not depend on list availability; stale saves preserve unsaved input', {timeout:30_000},async()=>{
 await withEditorBrowser(fixture,async({evaluate,waitFor,send})=>{
  await waitFor('!!document.querySelector(".top-save")');
  assert.equal(await evaluate("window.calls.some(c=>c.path==='/api/content/library')"),false);
  await evaluate("window.stale=true;[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent==='Title').querySelector('input').focus()");
  await send('Input.insertText',{text:' unsaved'});
  await evaluate('document.querySelector(".top-save").click()');
  await waitFor('!!document.querySelector(".message.error")');
  assert.match(await evaluate("[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent==='Title').querySelector('input').value"),/unsaved/);
  assert.equal(await evaluate("window.calls.some(c=>c.path==='/api/content/library')"),false);
 },{initialSearch:'?area=library&file=one.mdx'});
});

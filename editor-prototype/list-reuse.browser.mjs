import assert from 'node:assert/strict';
import test from 'node:test';
import {chrome,withEditorBrowser} from './browserHarness.mjs';

const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
window.requests=[]; window.holdList=false; window.holdDocument=false; window.denied=false;
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;window.requests.push(path);
 if(path==='/api/session')return Response.json({authenticated:true,login:'test-editor'});
 if(window.denied)return Response.json({error:'Sign in again.'},{status:401});
 const [area,filename]=path.replace('/api/content/','').split('/');
 if(!filename){
  if(window.holdList&&area==='library')return new Promise(resolve=>{window.finishList=(fail=false)=>resolve(fail?Response.json({error:'List unavailable.'},{status:503}):Response.json({branch:'main',discovery:'provisional',entries:[{name:'later.mdx',path:'src/content/docs/library/later.mdx',discovery:'provisional',onMain:false,draftHint:'saved',visibilityKnown:false}]}));});
  return Response.json({branch:'main',discovery:'provisional',entries:[{name:area+'.mdx',path:'src/content/docs/'+area+'/'+area+'.mdx',discovery:'provisional',onMain:true,draftHint:'none-observed',visibilityKnown:false}]});
 }
 const data={filename,sha:'fresh',content:'',title:'Verified '+area,description:'',draft:true,body:'Verified current text.'};
 if(window.holdDocument)return new Promise(resolve=>{window.finishDocument=()=>resolve(Response.json(data));});
 return Response.json(data);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options={skip:chrome?false:'Chrome required.',timeout:30_000};

test('content areas use staff-facing labels and keep account and shared-draft explanations on the dashboard',options,async()=>{
 const rows=[
  {name:'published.mdx',onMain:true,draftHint:'none-observed'},
  {name:'revised.mdx',onMain:true,draftHint:'saved'},
  {name:'new.mdx',onMain:false,draftHint:'saved'},
  {name:'review.mdx',onMain:true,draftHint:'review'},
 ].map(row=>({...row,path:'src/content/docs/library/'+row.name,discovery:'provisional',visibilityKnown:false}));
 const catalogFixture=fixture.replace('if(!filename){',`if(!filename){return Response.json({branch:'main',discovery:'provisional',entries:${JSON.stringify(rows)}});`);
 await withEditorBrowser(catalogFixture,async({evaluate,waitFor})=>{
  const shared='Saved drafts can be viewed and edited by other authorized editors.';
  await waitFor('!!document.querySelector(".dashboard-card")');
  assert.match(await evaluate('document.body.textContent'),/Signed in as test-editor/);
  assert.equal(await evaluate(`document.body.textContent.split(${JSON.stringify(shared)}).length-1`),1);
  await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button=>button.textContent.includes("Library")).click()');
  await waitFor('document.querySelectorAll(".project-list button").length===4');
  const intro="Choose a page to edit, or continue working on a saved draft. Changes won't appear on the public website until they're published.";
  assert.equal(await evaluate('document.querySelector(".list-heading").nextElementSibling.textContent'),intro);
  assert.equal(await evaluate(`document.body.textContent.includes(${JSON.stringify(shared)})`),false);
  assert.doesNotMatch(await evaluate('document.body.textContent'),/Signed in as|On main|New saved draft|Saved work available|Published content comes from/);
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(button=>button.textContent==="Sign out")'),true);
  const badges=await evaluate('[...document.querySelectorAll(".project-list button")].map(button=>({name:button.querySelector(".content-name").textContent,badges:[...button.querySelectorAll(".visibility-badge")].map(badge=>badge.textContent)}))');
  assert.deepEqual(Object.fromEntries(badges.map(row=>[row.name,row.badges])),{new:['New draft'],published:['Published'],review:['Published','Needs review'],revised:['Published','Saved draft']});
  assert.deepEqual(await evaluate('window.requests'),['/api/session','/api/content/library']);
  await evaluate('document.querySelector(".project-list button").click()');
  await waitFor('!!document.querySelector(".editor-workspace")');
  assert.doesNotMatch(await evaluate('document.body.textContent'),/Signed in as|Saved drafts can be viewed and edited/);
 });
});

test('returning to a list shows memory rows during refresh, while opening still waits for authoritative verification',options,async()=>{
 await withEditorBrowser(fixture,async({evaluate,waitFor})=>{
  await waitFor('!!document.querySelector(".project-list button")');
  assert.equal(await evaluate('document.querySelector(".project-list").textContent.includes("Published")'),true);
  await evaluate('document.querySelector(".project-list button").click()');
  await waitFor('!!document.querySelector(".editor-workspace")');
  await evaluate('window.holdList=true;document.querySelector(".editor-navigation .back").click()');
  await waitFor('!!window.finishList && !!document.querySelector(".project-list button")');
  assert.equal(await evaluate('document.querySelector(".project-list button").disabled'),false);
  assert.match(await evaluate('document.body.textContent'),/Refreshing content list/);
  await evaluate('window.holdDocument=true;document.querySelector(".project-list button").click()');
  await waitFor('!!window.finishDocument');
  assert.equal(await evaluate('!!document.querySelector(".editor-workspace")'),false);
  assert.match(await evaluate('document.body.textContent'),/Checking document and saved work/);
  await evaluate('window.finishList()');
  assert.equal(await evaluate('!!document.querySelector(".project-list")'),false,'a late list cannot replace a document');
  await evaluate('window.finishDocument()');
  await waitFor('!!document.querySelector(".editor-workspace")');
  assert.equal(await evaluate('window.requests.filter(path=>path==="/api/content/library/library.mdx").length'),2);
  assert.equal(await evaluate('document.querySelector("form input[required]").value'),'Verified library');
 },{initialSearch:'?area=library'});
});

test('late refreshes cannot leak rows into another area',options,async()=>{
 await withEditorBrowser(fixture,async({evaluate,waitFor})=>{
  await waitFor('!!document.querySelector(".project-list button")');
  await evaluate('document.querySelector(".project-list button").click()');await waitFor('!!document.querySelector(".editor-workspace")');
  await evaluate('window.holdList=true;document.querySelector(".editor-navigation .back").click()');await waitFor('!!window.finishList');
  await evaluate('const select=document.querySelector(".area-selector select");select.value="posts";select.dispatchEvent(new Event("change",{bubbles:true}))');
  await waitFor('document.querySelector(".project-list .content-name")?.textContent==="posts"');
  await evaluate('window.finishList()');
  assert.equal(await evaluate('document.querySelector(".project-list .content-name").textContent'),'posts');
 },{initialSearch:'?area=library'});
});

test('failed refresh leaves explicitly stale rows; authentication loss clears list memory without restoring it on sign-in',options,async()=>{
 await withEditorBrowser(fixture,async({evaluate,waitFor})=>{
  await waitFor('!!document.querySelector(".project-list button")');
  await evaluate('document.querySelector(".project-list button").click()');await waitFor('!!document.querySelector(".editor-workspace")');
  await evaluate('window.holdList=true;document.querySelector(".editor-navigation .back").click()');await waitFor('!!window.finishList');
  await evaluate('window.finishList(true)');await waitFor('document.body.textContent.includes("List unavailable.")');
  assert.match(await evaluate('document.body.textContent'),/list may be out of date/);
  assert.equal(await evaluate('document.querySelectorAll(".project-list button").length'),1);
  await evaluate('window.denied=true;document.querySelector(".project-list button").click()');
  await waitFor(`!!document.querySelector('[aria-label="Sign-in required"]')`);
  await evaluate('window.denied=false;[...document.querySelectorAll("button")].find(button=>button.textContent==="Check sign-in").click()');
  await waitFor(`!document.querySelector('[aria-label="Sign-in required"]')`);
  await evaluate('document.querySelector(".editor-navigation .back").click()');
  await waitFor('!!document.querySelector(".dashboard-card")');
  await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button=>button.textContent.includes("Library")).click()');
  await waitFor('document.body.textContent.includes("Loading content")');
  assert.equal(await evaluate('!!document.querySelector(".project-list")'),false,'reauthentication cannot restore a prior account catalog');
 },{initialSearch:'?area=library'});
});

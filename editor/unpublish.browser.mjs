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
window.unpublishState={state:'none',mainDraft:false,unpublishEnabled:true,autoMergeEnabled:true,autoMerge:false,website:{publication:'published'}};
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
   window.unpublishState={...window.unpublishState,autoMerge:input.autoMerge===true,snapshotHead:'${'e'.repeat(40)}',state:'pr-open',action:input.action,selectedHead:input.head,number:12,url:'https://github.com/geobtaa/geobtaa.github.io/pull/12'};
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
  await waitFor(`${button('Unpublish')}?.disabled===false`);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'), 'Published');
  await evaluate(`${button('Unpublish')}.click()`); await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`${button('Cancel')}.click()`); assert.equal(await evaluate('window.writes.length'),0);
  await evaluate(`${button('Unpublish')}.click()`); await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`document.querySelector('.confirm-publication').click()`);
  await waitFor('window.writes.length===3 && document.querySelector(".publication-status").dataset.state==="pr-open"');
  const writes = await evaluate('window.writes');
  assert.equal(writes[0].action,'unpublish');assert.equal(writes[1].action,'unpublish');
  assert.match(writes[1].candidate.content,/draft: true/);assert.match(writes[1].candidate.content,/Public body/);assert.doesNotMatch(writes[1].candidate.content,/independent editorial/);assert.deepEqual(writes[1].candidate.assets,[]);
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.match(await evaluate('document.querySelector(".tiptap").textContent'),/Saved independent editorial work/);
  assert.equal(await evaluate(`${button('Unpublish')}.disabled`),true);
  await evaluate(`window.failRequestStatus=true;${button('Check again')}.click()`);
  await waitFor('document.querySelector(".publication-status").dataset.state==="checking"');
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true);
  assert.equal(await evaluate('document.querySelector(".publication-status a").href'),'https://github.com/geobtaa/geobtaa.github.io/pull/12');
  await evaluate('window.failRequestStatus=false');
  await evaluate(`window.unpublishState={...window.unpublishState,state:'merged',deployment:{state:'failed'}};${button('Check again')}.click()`);
  await waitFor('document.querySelector(".publication-status").textContent.includes("website update failed")');
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  await evaluate(`window.unpublishState={...window.unpublishState,website:{publication:'unpublished',requestApplied:true},mainDraft:true};${button('Check again')}.click()`);
  await waitFor('document.querySelector(".publication-heading").textContent==="Unpublished"');
  assert.match(await evaluate('document.querySelector(".tiptap").textContent'),/Saved independent editorial work/);
  assert.equal(await evaluate('window.writes.length'),3);
 },{initialSearch:'?area=library&file=page.mdx'});
});
test('disabled unpublish and unsaved editorial work cannot submit an unpublish request; refresh retains the action',options,async()=>{
 await withEditorBrowser(fixture.replace('unpublishEnabled:true','unpublishEnabled:false').replace("state:'none',mainDraft","state:'checking',mainDraft"),async({evaluate,waitFor,send})=>{
  await waitFor(`!!${button('Unpublish')}`);assert.equal(await evaluate(`${button('Unpublish')}.disabled`),true);
  await evaluate(`window.unpublishState.unpublishEnabled=true;window.unpublishState.state='none';${button('Check again')}.click()`);await waitFor(`${button('Unpublish')}.disabled===false`);
  await evaluate('document.querySelector("#document-edit input[required]").focus()');await send('Input.insertText',{text:'Unsaved'});
  await waitFor(`${button('Unpublish')}.disabled===true`);assert.equal(await evaluate('window.writes.length'),0);
 },{initialSearch:'?area=library&file=page.mdx'});
});

test('Update publication request retains the unpublish action and original saved revision', options, async () => {
 const setup = fixture.replace("createRoot(document.getElementById('root'))", `window.unpublishState={...window.unpublishState,state:'conflict',action:'unpublish',selectedHead:'${head}',number:12,url:'https://github.com/geobtaa/geobtaa.github.io/pull/12'};createRoot(document.getElementById('root'))`);
 await withEditorBrowser(setup, async ({evaluate,waitFor}) => {
  await waitFor(`!!${button('Update and unpublish')}`);
  assert.equal(await evaluate('document.querySelector(".publish-document").disabled'), true, 'an active unpublish cannot be silently replaced with publish');
  await evaluate(`${button('Update and unpublish')}.click()`);
  await waitFor('document.querySelector("dialog")?.open');await evaluate("document.querySelector('.confirm-publication').click()");
  await waitFor('window.writes.length===3');
  const writes = await evaluate('window.writes');
  assert.equal(writes[0].head,head);assert.equal(writes[0].action,'unpublish');assert.equal(writes[1].action,'unpublish');
 },{initialSearch:'?area=library&file=page.mdx'});
});

const directFixture = fixture.replace("createRoot(document.getElementById('root'))", `
window.record={...window.record,hasDraft:false,content:window.original,title:'Main page',body:'Public body.'};
window.copyHead='${'e'.repeat(40)}';window.copyPreparations=0;window.copyExists=false;
const gateway=window.fetch;
window.fetch=async(url,options={})=>{
 const path=new URL(String(url),location.origin).pathname;
 if(path.startsWith('/api/publish/')&&options.method==='POST'){
  const input=JSON.parse(options.body);
  if(input.initialize){
   window.writes.push(input);window.copyPreparations++;window.copyExists=true;
   if(window.loseCopyResponse){window.loseCopyResponse=false;throw new Error('Response lost after saving copy');}
   return Response.json({head:window.copyHead,document:{...window.record,head:window.copyHead,hasDraft:true}});
  }
  if(window.failSubmit&&!input.prepare){window.failSubmit=false;window.writes.push(input);throw new Error('Request submission failed');}
 }
 return gateway(url,options);
};
createRoot(document.getElementById('root'))`);
test('unchanged pages unpublish directly only after confirmation and use the returned copy revision',options,async()=>{
 await withEditorBrowser(directFixture,async({evaluate,waitFor})=>{
  await waitFor(`${button('Unpublish')}?.disabled===false`);
  assert.equal(await evaluate('window.writes.length'),0);
  await evaluate(`${button('Unpublish')}.click()`);await waitFor('document.querySelector("dialog")?.open');
  await evaluate(`${button('Cancel')}.click()`);assert.equal(await evaluate('window.copyExists'),false);
  await evaluate(`${button('Unpublish')}.click()`);await waitFor('document.querySelector("dialog")?.open');await evaluate(`document.querySelector('.confirm-publication').click()`);
  await waitFor('window.writes.length===4 && document.querySelector(".publication-status").dataset.state==="pr-open"');
  const writes=await evaluate('window.writes');assert.equal(writes[0].initialize,true);assert.equal(writes[0].expectedSha,blob);
  assert.equal(writes[1].head,'e'.repeat(40));assert.equal(writes[2].head,'e'.repeat(40));
  assert.equal(await evaluate('document.querySelector(".publication-heading").textContent'),'Published');
  assert.equal(await evaluate('document.querySelector("#document-edit input[required]").value'),'Main page');
  assert.equal(await evaluate('window.copyPreparations'),1);
 },{initialSearch:'?area=library&file=page.mdx'});
});
test('a lost internal-copy response retries initialization; a later submission failure keeps the copy and open form',options,async()=>{
 await withEditorBrowser(directFixture,async({evaluate,waitFor})=>{
  await waitFor(`${button('Unpublish')}?.disabled===false`);
  const confirm=async()=>{await evaluate(`${button('Unpublish')}.click()`);await waitFor('document.querySelector("dialog")?.open');await evaluate(`document.querySelector('.confirm-publication').click()`);};
  await evaluate('window.loseCopyResponse=true');await confirm();
  await waitFor('document.querySelector(".message.error")?.textContent.includes("Preparation or submission could not be confirmed")');
  assert.equal(await evaluate('window.copyExists'),true);
  await evaluate('window.failSubmit=true');await confirm();
  await waitFor('document.querySelector(".message.error")?.textContent.includes("Preparation or submission could not be confirmed")');
  assert.equal(await evaluate('document.querySelector(".draft-status").textContent'),'All changes saved');
  assert.equal(await evaluate('document.querySelector("#document-edit input[required]").value'),'Main page');
  await confirm();await waitFor('document.querySelector(".publication-status").dataset.state==="pr-open"');
  assert.equal(await evaluate('window.copyPreparations'),2,'final retry uses the already adopted copy directly');
 },{initialSearch:'?area=library&file=page.mdx'});
});

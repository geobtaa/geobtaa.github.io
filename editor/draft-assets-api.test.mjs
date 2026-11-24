import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTestRepository } from './draftTestRepository.mjs';
import { createEditorServer } from './server.mjs';
import { createGitHubClient } from './github.mjs';
import { onRequest } from '../functions/api/[[path]].js';
const origin = 'https://geobtaa-github-io.pages.dev';
const env = { EDITOR_ORIGIN: origin, GITHUB_CLIENT_ID:'test-client', GITHUB_CLIENT_SECRET:'test-secret', SESSION_SECRET:'session-secret-with-at-least-thirty-two-characters', ALLOWED_GITHUB_USERS:'editor-one,editor-two' };

for (const mode of ['local','hosted']) test(`${mode} API prepares images without commits and saves a document and image together, reopening after another login`, async () => {
  const path='src/content/docs/library/report.mdx', original='---\ntitle: Report\ndescription: Keep\n---\n\nOriginal.';
  const repo=await draftTestRepository({[path]:original}), main=repo.refs.get('refs/heads/main');
  const originalFetch=globalThis.fetch;
  let call, secondLogin, login='editor-one', cookie;
  try {
    if(mode==='local'){
      const server=createEditorServer(createGitHubClient({token:'editor-one',fetchImpl:repo.fetchImpl}));
      call=(method,path,input)=>new Promise(resolve=>{let status;server.emit('request',{method,url:path,headers:{host:'localhost',origin:'http://localhost:4321'},async *[Symbol.asyncIterator](){if(input)yield JSON.stringify(input)}},{writeHead(value){status=value},end(body){resolve({status,body:JSON.parse(body)})}})});
    }else{
      globalThis.fetch=async(input,options)=>{
        if(String(input)==='https://github.com/login/oauth/access_token')return Response.json({access_token:login});
        if(String(input)==='https://api.github.com/user')return Response.json({login});
        return repo.fetchImpl(input,options);
      };
      const signIn=async()=>{
        const start=await onRequest({request:new Request(origin+'/api/auth/login'),env});
        const state=new URL(start.headers.get('location')).searchParams.get('state');
        const cookies=start.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
        const callback=await onRequest({request:new Request(origin+`/api/auth/callback?code=test&state=${state}`,{headers:{Cookie:cookies}}),env});
        assert.equal(callback.status,302);return callback.headers.getSetCookie().find(value=>value.startsWith('editor_session=')).split(';')[0];
      };
      cookie=await signIn();
      call=async(method,path,input)=>{
        const result=await onRequest({request:new Request(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}),env});
        return {status:result.status,body:await result.json()};
      };
      // Store a real second session cookie to exercise account-independent reads.
      secondLogin=async()=>{login='editor-two';cookie=await signIn()};
    }
    const loaded=await call('GET','/api/content/library/report.mdx');assert.equal(loaded.status,200);
    const image=await call('POST','/api/images',{area:'library',documentFilename:'report.mdx',filename:'Map.gif',mimeType:'image/gif',content:Buffer.from('GIF89a').toString('base64')});
    assert.equal(image.status,201);assert.equal(repo.refs.size,1,'image preparation must not commit or create branches');
    // A dismissed upload is preparation only, even if its response arrives late.
    const unused=await call('POST','/api/images',{area:'library',documentFilename:'report.mdx',filename:'Unused.gif',mimeType:'image/gif',content:Buffer.from('GIF89a').toString('base64')});
    assert.equal(unused.status,201);assert.equal(repo.refs.size,1);
    const saved=await call('PUT','/api/content/library/report.mdx',{...loaded.body,body:`![Map](@images/${image.body.path})`,assets:[image.body,unused.body]});
    assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(repo.filesAt(saved.body.head).has(`src/assets/images/${image.body.path}`),true);
    assert.equal(repo.filesAt(saved.body.head).has(`src/assets/images/${unused.body.path}`),false,'unused pending uploads must not enter draft storage');
    assert.equal(repo.refs.get('refs/heads/main'),main);
    if(mode==='hosted')await secondLogin();
    const list=await call('GET','/api/content/library');assert.equal(list.body.entries[0].draftHint,'saved');assert.equal(list.body.entries[0].discovery,'provisional');
    const reopened=await call('GET','/api/content/library/report.mdx');assert.equal(reopened.body.head,saved.body.head);
    const imageList=await call('GET','/api/images?area=library&filename=report.mdx');assert.equal(imageList.body.images.length,1);
    const invalid=await call('POST','/api/images',{filename:'Unscoped.gif',mimeType:'image/gif',content:Buffer.from('GIF89a').toString('base64')});assert.equal(invalid.status,400);
    assert.ok(!repo.requests.some(item=>/pulls|merges|deployments|actions/.test(item.path)));
  }finally{globalThis.fetch=originalFetch}
});

import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, Response as RuntimeResponse } from 'miniflare';
import { draftTestRepository } from './draftTestRepository.mjs';

const origin = 'https://gin-editor.pages.dev';
const env = { EDITOR_ORIGIN: origin, SESSION_SECRET: 'runtime-fixture-session-secret-at-least-32-characters', ALLOWED_GITHUB_USERS: 'runtime-editor', GITHUB_CLIENT_ID: 'fixture', GITHUB_CLIENT_SECRET: 'fixture', CMS_PUBLISH_ENABLED: 'false' };
let script, cookie;
before(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {onRequest} from './functions/api/[[path]].js';
    import {createGitHubClient} from './editor-prototype/github.mjs';
    export default {async fetch(request, env) {
      if (new URL(request.url).pathname === '/__runtime/unsupported') {
        try { await fetch('https://api.github.com/user', {redirect:'error'}); return new Response('unexpected success'); }
        catch(error) { return new Response(error.message, {status:500}); }
      }
      if (new URL(request.url).pathname === '/__runtime/local') {
        try { return Response.json(await createGitHubClient({token:'fixture-token'}).listImages()); }
        catch(error) { return Response.json({error:error.message}, {status:error.status || 500}); }
      }
      return onRequest({request, env});
    }};` }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'], write: false });
  script = result.outputFiles[0].text;
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.SESSION_SECRET)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify({token:'fixture-token',login:'runtime-editor',exp:Date.now()+3_600_000})));
  cookie = `editor_session=${Buffer.from(iv).toString('base64url')}.${Buffer.from(ciphertext).toString('base64url')}`;
});

async function fixture(run) {
  const repo = await draftTestRepository({'src/content/docs/library/runtime.mdx':'---\ntitle: Runtime\n---\n\nOriginal.'});
  const calls = [], scenario = {};
  const runtime = new Miniflare({ modules: true, script, compatibilityDate:'2026-07-30', cf:false, bindings:env,
    // All outbound traffic terminates here. No real GitHub/network access or credentials.
    outboundService: async request => {
      const url = new URL(request.url); calls.push({url:request.url,method:request.method});
      if (scenario.redirect && (url.origin === 'https://api.github.com' || scenario.oauth)) return new RuntimeResponse('Redirect body is not JSON', {status:scenario.redirect, headers:{Location:scenario.location}});
      if (url.origin === 'https://github.com' && url.pathname === '/login/oauth/access_token') return RuntimeResponse.json({access_token:'fixture-token'});
      if (url.origin !== 'https://api.github.com') return new RuntimeResponse('Unexpected outbound target', {status:500});
      if (url.pathname === '/user') return RuntimeResponse.json({login:'runtime-editor'});
      const body = request.method !== 'GET' ? await request.text() : undefined;
      const response = await repo.fetchImpl(request.url, {method:request.method, headers:Object.fromEntries(request.headers), ...(body !== undefined ? {body} : {})});
      if (scenario.redirectAfterAtomic && body?.includes('mutation CMSSaveDraft')) return new RuntimeResponse(null,{status:307,headers:{Location:'https://outside.example/capture'}});
      return new RuntimeResponse(await response.arrayBuffer(), {status:response.status,headers:Object.fromEntries(response.headers)});
    },
  });
  const call = (path, method='GET', input, headers={}) => runtime.dispatchFetch(origin+path, {method,redirect:'manual',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},...(input?{body:JSON.stringify(input)}:{})});
  try { await run({repo,calls,scenario,call}); }
  finally { await runtime.dispose(); }
}

test('workerd reproduces unsupported error redirect mode before any outbound request', () => fixture(async ({call,calls,repo}) => {
  const refs = [...repo.refs];
  const response = await call('/__runtime/unsupported');
  assert.equal(response.status,500);
  assert.match(await response.text(), /Invalid redirect value/);
  assert.equal(calls.length,0);
  assert.deepEqual([...repo.refs],refs);
}));

test('workerd never forwards OAuth code/client credentials through a redirect', () => fixture(async ({call,calls,scenario}) => {
  for (const status of [301,302,303,307,308]) for (const location of ['https://github.com/redirected','https://outside.example/capture']) {
    const login = await call('/api/auth/login');
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const cookies = login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    Object.assign(scenario,{redirect:status,location,oauth:true});calls.length=0;
    const response = await call(`/api/auth/callback?code=fixture&state=${state}`,'GET',undefined,{Cookie:cookies});
    assert.equal(response.status,502);
    assert.equal(response.headers.get('location'),null);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://github.com/login/oauth/access_token');
    assert.equal(calls[0].method,'POST');
  }
}));

test('real Pages image listing, pending upload and atomic Save Draft run in workerd', () => fixture(async ({call,repo,calls}) => {
  const main = repo.refs.get('refs/heads/main');
  assert.equal((await call('/__runtime/local')).status,200);
  let response = await call('/api/images?area=library&filename=runtime.mdx');
  assert.equal(response.status,200,await response.clone().text());
  assert.deepEqual((await response.json()).images,[]);
  const before = calls.length, refs = [...repo.refs];
  response = await call('/api/images','POST',{area:'library',documentFilename:'runtime.mdx',filename:'Map.gif',mimeType:'image/gif',content:Buffer.from('GIF89a').toString('base64')});
  assert.equal(response.status,201); const image = await response.json();
  assert.equal(calls.length,before,'pending upload makes no outbound request');
  assert.deepEqual([...repo.refs],refs,'pending upload cannot commit');
  const opened = await (await call('/api/content/library/runtime.mdx')).json();
  response = await call('/api/content/library/runtime.mdx','PUT',{...opened,body:`![Map](@images/${image.path})`,assets:[image]});
  assert.equal(response.status,200,await response.clone().text());
  const saved = await response.json();
  assert.equal(repo.refs.get('refs/heads/main'),main);
  assert.ok(repo.filesAt(saved.head).has(`src/assets/images/${image.path}`));
  const reopened = await (await call('/api/content/library/runtime.mdx')).json();
  assert.equal(reopened.head,saved.head);
  assert.ok(reopened.content.includes(image.path));
  response = await call('/api/images?area=library&filename=runtime.mdx');
  assert.equal((await response.json()).images.length,1);
}));

test('workerd preserves atomic-save readback when GitHub mutates then returns a redirect', () => fixture(async ({call,repo,calls,scenario}) => {
  const opened = await (await call('/api/content/library/runtime.mdx')).json();
  scenario.redirectAfterAtomic = true;
  const response = await call('/api/content/library/runtime.mdx','PUT',{...opened,body:'Saved once.'});
  assert.equal(response.status,200,await response.clone().text());
  const saved = await response.json();
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`),saved.head);
  assert.equal(repo.requests.filter(r=>r.body?.includes('mutation CMSSaveDraft')).length,1);
  assert.ok(calls.every(c=>new URL(c.url).origin==='https://api.github.com'));
  assert.equal(repo.pulls.length,0);
}));

test('workerd rejects same-host and cross-host GitHub redirects without forwarding credentials or mutating refs', () => fixture(async ({call,repo,calls,scenario}) => {
  const refs = [...repo.refs];
  for (const status of [301,302,303,307,308]) for (const location of ['https://api.github.com/redirected','https://outside.example/capture']) for (const path of ['/api/images','/__runtime/local']) {
    Object.assign(scenario,{redirect:status,location}); calls.length=0;
    const response = await call(path);
    assert.equal(response.status,502);
    assert.match((await response.json()).error,/redirect/i);
    assert.equal(response.headers.get('location'),null);
    assert.equal(calls.length,1,'redirect must never produce a follow-up request');
    assert.equal(new URL(calls[0].url).origin,'https://api.github.com');
    assert.equal(calls[0].method,'GET');
    assert.deepEqual([...repo.refs],refs);
  }
}));

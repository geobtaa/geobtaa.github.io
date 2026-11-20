import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

const canonical = 'https://gin-editor.pages.dev';
const env = { EDITOR_ORIGIN: canonical, GITHUB_CLIENT_ID: 'integration-client', GITHUB_CLIENT_SECRET: 'test-secret', SESSION_SECRET: 'a-separate-session-secret-of-at-least-32-characters', ALLOWED_GITHUB_USERS: 'tester' };
const endpoints = [
  ['GET','/api/auth/login'], ['GET','/api/auth/callback?code=sample&state=sample'],
  ['GET','/api/session'], ['POST','/api/auth/logout'], ['GET','/api/content'],
  ['GET','/api/content/posts'], ['GET','/api/content/posts/example.mdx'],
  ['POST','/api/content/posts'], ['PUT','/api/content/posts/example.mdx'],
  ['GET','/api/images'], ['GET','/api/images/file/image.png'], ['POST','/api/images'],
];

test('all API and OAuth routes reject preview/deployment hosts before GitHub, cookies, body reads or authentication', async () => {
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected upstream request'); };
  try {
    for (const origin of ['https://abc123.gin-editor.pages.dev','https://editor-cms-release.gin-editor.pages.dev','https://gin-editor.pages.dev.evil.example','https://geobtaa-github-io.pages.dev','https://gin.btaa.org','http://gin-editor.pages.dev','https://gin-editor.pages.dev:8443']) {
      for (const [method,path] of endpoints) {
        const response = await onRequest({ env, request: new Request(origin+path,{ method, headers: { Origin: canonical, Host:'gin-editor.pages.dev', Forwarded:'host=gin-editor.pages.dev;proto=https', 'X-Forwarded-Host':'gin-editor.pages.dev', 'X-Forwarded-Proto':'https', Cookie:'editor_session=copied;editor_oauth_state=sample;editor_oauth_verifier=copied', Accept:'text/html' }, ...(['POST','PUT'].includes(method)?{body:'invalid JSON; must never be parsed'}:{}) }) });
        assert.equal(response.status,403,origin+path);
        assert.equal(response.headers.get('location'),null);
        assert.equal(response.headers.get('set-cookie'),null);
        const body=await response.json();assert.equal(body.signInUrl,undefined);
        assert.equal(response.headers.get('cache-control'),'no-store');
      }
    }
    assert.equal(calls,0);
  } finally { globalThis.fetch=previous; }
});

test('missing/malformed origin configuration fails closed, including on OAuth and with otherwise valid secrets', async () => {
  for (const value of [undefined,'','*','null','http://gin-editor.pages.dev',canonical+'/editor/',canonical+'?x=1',canonical+'#x','https://user:password@gin-editor.pages.dev',canonical+',https://other.example', ' '+canonical]) {
    for (const [method,path] of endpoints) {
      const response=await onRequest({env:{...env,EDITOR_ORIGIN:value},request:new Request(canonical+path,{method,headers:{Origin:canonical}})});
      assert.equal(response.status,500,String(value)+path);assert.equal(response.headers.get('set-cookie'),null);
    }
  }
});

test('canonical origin allows OAuth and session reads without trusting forwarded headers; writes still need matching Origin', async () => {
  for (const configured of [canonical,canonical+'/']) {
    const settings={...env,EDITOR_ORIGIN:configured};
    const headers={ Host:'preview.example', Forwarded:'host=evil.example;proto=http','X-Forwarded-Host':'evil.example','X-Forwarded-Proto':'http' };
    const login=await onRequest({env:settings,request:new Request(canonical+'/api/auth/login',{headers})});
    assert.equal(login.status,302);assert.equal(new URL(login.headers.get('location')).searchParams.get('redirect_uri'),canonical+'/api/auth/callback');
    const session=await onRequest({env:settings,request:new Request(canonical+'/api/session',{headers})});
    assert.deepEqual(await session.json(),{authenticated:false});
    for(const origin of [undefined,'https://abc123.gin-editor.pages.dev','null']) {
      const response=await onRequest({env:settings,request:new Request(canonical+'/api/auth/logout',{method:'POST',headers:{...headers,...(origin?{Origin:origin}:{})}})});
      assert.equal(response.status,403);
    }
    const logout=await onRequest({env:settings,request:new Request(canonical+'/api/auth/logout',{method:'POST',headers:{...headers,Origin:canonical}})});
    assert.equal(logout.status,200);
  }
});

test('a separately configured staging origin remains usable without allowing staging previews', async () => {
  const origin='https://geobtaa-github-io.pages.dev';
  assert.equal((await onRequest({env:{...env,EDITOR_ORIGIN:origin},request:new Request(origin+'/api/auth/login')})).status,302);
  assert.equal((await onRequest({env:{...env,EDITOR_ORIGIN:origin},request:new Request('https://abc123.geobtaa-github-io.pages.dev/api/auth/login')})).status,403);
});

test('a real canonical-origin session cannot authenticate on deployment aliases, even with copied cookies and canonical Origin', async () => {
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=async input=>{calls++;const url=String(input);if(url==='https://github.com/login/oauth/access_token')return Response.json({access_token:'server-only-token'});if(url.endsWith('/user'))return Response.json({login:'tester'});return Response.json({permissions:{push:true}})};
  try {
    const returnTo='/?area=projects&file=nested%2Fexample.mdx#body';
    const login=await onRequest({env,request:new Request(canonical+'/api/auth/login?returnTo='+encodeURIComponent(returnTo))});
    const state=new URL(login.headers.get('location')).searchParams.get('state');
    const cookies=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    const callback=await onRequest({env,request:new Request(canonical+`/api/auth/callback?code=test&state=${state}`,{headers:{Cookie:cookies,'X-Forwarded-Host':'evil.example'}})});
    assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),canonical+returnTo);
    const cookie=callback.headers.getSetCookie().find(value=>value.startsWith('editor_session=')).split(';')[0];
    const session=await onRequest({env,request:new Request(canonical+'/api/session',{headers:{Cookie:cookie}})});
    assert.equal((await session.json()).login,'tester');
    const before=calls;
    for(const [method,path] of endpoints){const response=await onRequest({env,request:new Request('https://abc123.gin-editor.pages.dev'+path,{method,headers:{Cookie:cookie,Origin:canonical,'X-Forwarded-Host':'gin-editor.pages.dev'}})});assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null)}
    assert.equal(calls,before);
  }finally{globalThis.fetch=previous}
});

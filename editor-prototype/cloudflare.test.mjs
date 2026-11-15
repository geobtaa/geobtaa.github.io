import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

const env = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'a-test-session-secret-with-at-least-32-characters',
  ALLOWED_GITHUB_USERS: 'editor-user',
};

test('OAuth failures are caught by the gateway and offer a new sign-in attempt', async () => {
  for (const path of ['/api/auth/login', '/api/auth/callback?code=test&state=expired']) {
    const response = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev' + path), env: {} });
    assert.ok(response.status >= 400);
    assert.match((await response.json()).signInUrl, /^\/api\/auth\/login/);
  }
});

test('hosted OAuth uses state, PKCE, an encrypted HttpOnly session, and repository authorization', async () => {
  const login = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev/api/auth/login'), env });
  assert.equal(login.status, 302);
  const authorize = new URL(login.headers.get('location'));
  assert.equal(authorize.hostname, 'github.com');
  assert.equal(authorize.searchParams.get('scope'), 'public_repo');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  const loginCookies = login.headers.getSetCookie();
  assert.ok(loginCookies.every((value) => value.includes('HttpOnly') && value.includes('Secure')));
  const cookieHeader = loginCookies.map((value) => value.split(';')[0]).join('; ');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'github-user-token' });
    if (url.endsWith('/user')) return Response.json({ login: 'editor-user' });
    if (url.includes('/repos/geobtaa/geobtaa.github.io')) return Response.json({ permissions: { push: true } });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const callbackUrl = new URL('https://geobtaa-editor-staging.pages.dev/api/auth/callback');
    callbackUrl.searchParams.set('code', 'authorization-code');
    callbackUrl.searchParams.set('state', authorize.searchParams.get('state'));
    const callback = await onRequest({ request: new Request(callbackUrl, { headers: { Cookie: cookieHeader } }), env });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), 'https://geobtaa-editor-staging.pages.dev/editor/');
    const sessionCookie = callback.headers.getSetCookie().find((value) => value.startsWith('editor_session='));
    assert.match(sessionCookie, /HttpOnly; Secure; SameSite=Strict/);
    assert.ok(!sessionCookie.includes('github-user-token'));

    const session = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev/api/session', { headers: { Cookie: sessionCookie.split(';')[0] } }), env });
    assert.deepEqual(await session.json(), { authenticated: true, login: 'editor-user', workspace: 'geobtaa/geobtaa.github.io#custom-cms' });
    const headers = { Cookie: sessionCookie.split(';')[0], Origin: 'https://geobtaa-editor-staging.pages.dev' };
    for (const path of ['/api/session', '/api/content', '/api/images', '/api/images/file/map.png']) {
      const denied = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev' + path, { headers: { Cookie: sessionCookie.split(';')[0] } }), env: { ...env, ALLOWED_GITHUB_USERS: 'another-user' } });
      assert.equal(denied.status, 403, path);
      assert.equal((await denied.json()).code, 'access_denied');
    }
    for (const [path, method] of [['/api/content/posts/new.mdx', 'PUT'], ['/api/content/posts', 'POST'], ['/api/images', 'POST']]) {
      const denied = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev' + path, { method, headers, body: '{}' }), env: { ...env, ALLOWED_GITHUB_USERS: 'another-user' } });
      assert.equal(denied.status, 403);
      assert.match(denied.headers.get('set-cookie'), /editor_session=;.*Max-Age=0/);
    }
    const permitted = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev/api/session', { headers }), env: { ...env, ALLOWED_GITHUB_USERS: ' Other, EDITOR-USER ' } });
    assert.equal(permitted.status, 200);
    assert.equal((await permitted.json()).authenticated, true);
    const now = Date.now;
    try {
      Date.now = () => now() + 9 * 60 * 60 * 1000;
      const expired = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev/api/content/posts', { headers }), env });
      assert.equal(expired.status, 401);
      assert.match((await expired.json()).signInUrl, /^\/api\/auth\/login/);
      const status = await onRequest({ request: new Request('https://geobtaa-editor-staging.pages.dev/api/session', { headers }), env });
      assert.deepEqual(await status.json(), { authenticated: false });
    } finally { Date.now = now; }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sign-in preserves editor deep links and rejects external or non-editor return destinations', async () => {
  const origin = 'https://geobtaa-editor-staging.pages.dev';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'test-token' });
    if (url.endsWith('/user')) return Response.json({ login: 'editor-user' });
    return Response.json({ permissions: { push: true } });
  };
  try {
    for (const [requested, expected] of [['/editor/?area=posts&file=nested%2Fentry.mdx', '/editor/?area=posts&file=nested%2Fentry.mdx'], ['https://outside.example/editor/', '/editor/'], ['//outside.example/editor/', '/editor/'], ['/api/content/posts', '/editor/']]) {
      const login = await onRequest({ request: new Request(`${origin}/api/auth/login?returnTo=${encodeURIComponent(requested)}`), env });
      const state = new URL(login.headers.get('location')).searchParams.get('state');
      const cookies = login.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
      const callback = await onRequest({ request: new Request(`${origin}/api/auth/callback?code=test&state=${state}`, { headers: { Cookie: cookies } }), env });
      assert.equal(callback.status, 302);
      assert.equal(callback.headers.get('location'), origin + expected);
      assert.ok(callback.headers.getSetCookie().some(cookie => cookie.startsWith('editor_oauth_return=') && cookie.includes('Max-Age=0')));
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('callback denial, missing verifier, malformed cookies and upstream failures produce actionable responses', async () => {
  const origin = 'https://geobtaa-editor-staging.pages.dev';
  const previousFetch = globalThis.fetch;
  const start = async () => {
    const response = await onRequest({ request: new Request(`${origin}/api/auth/login?returnTo=${encodeURIComponent('/editor/?area=posts&file=entry.mdx')}`), env });
    return { state: new URL(response.headers.get('location')).searchParams.get('state'), cookies: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  };
  try {
    for (const scenario of ['denied', 'verifier', 'cookies', 'network', 'json', 'token', 'user', 'repository']) {
      const { state, cookies } = await start();
      let exchanges = 0;
      globalThis.fetch = async input => {
        const url = String(input);
        if (url.includes('/access_token')) {
          exchanges++;
          if (scenario === 'network') throw new TypeError('Network unavailable');
          if (scenario === 'json') return new Response('not JSON', { status: 200 });
          if (scenario === 'token') return Response.json({ error: 'bad_verification_code', error_description: 'untrusted detail <script>token</script>' });
          return Response.json({ access_token: 'test-token' });
        }
        if (url.endsWith('/user')) return scenario === 'user' ? Response.json({ message: 'Bad credentials' }, { status: 401 }) : Response.json({ login: 'editor-user' });
        return scenario === 'repository' ? Response.json({ message: 'No access' }, { status: 403 }) : Response.json({ permissions: { push: true } });
      };
      const cookie = scenario === 'verifier' ? cookies.split('; ').filter(value => !value.startsWith('editor_oauth_verifier=')).join('; ') : scenario === 'cookies' ? 'editor_oauth_state=%zz' : cookies;
      const response = await onRequest({ request: new Request(`${origin}/api/auth/callback?state=${state}&${scenario === 'denied' ? 'error=access_denied' : 'code=test'}`, { headers: { Cookie: cookie } }), env });
      assert.ok(response.status >= 400, scenario);
      const body = await response.json();
      assert.match(body.signInUrl, /^\/api\/auth\/login\?returnTo=/);
      assert.equal(JSON.stringify(body).includes('untrusted detail'), false);
      for (const name of ['editor_oauth_state', 'editor_oauth_verifier', 'editor_oauth_return']) assert.ok(response.headers.getSetCookie().some(value => value.startsWith(`${name}=`) && value.includes('Max-Age=0')));
      if (['denied', 'verifier', 'cookies'].includes(scenario)) assert.equal(exchanges, 0);
    }
    const response = await onRequest({ request: new Request(`${origin}/api/auth/login`, { headers: { Accept: 'text/html', Cookie: 'unrelated=%zz' } }), env: {} });
    assert.equal(response.status, 500);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /<a href="\/api\/auth\/login[^\"]*">Start sign-in again<\/a>/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  } finally { globalThis.fetch = previousFetch; }
});

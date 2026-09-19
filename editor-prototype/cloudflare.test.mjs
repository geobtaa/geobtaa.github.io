import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

const env = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'a-test-session-secret-with-at-least-32-characters',
  ALLOWED_GITHUB_USERS: 'editor-user',
};

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
    assert.deepEqual(await session.json(), { authenticated: true, login: 'editor-user' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

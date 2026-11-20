import { createDraftStore } from '../../editor/draftStorage.mjs';
import { parsePage, savePage } from '../../editor/page.mjs';
import { contentVisibility } from '../../editor/content.mjs';
import { saveBlog } from '../../editor/blog.mjs';
import { parseProgramUpdate, saveProgramUpdate } from '../../editor/programUpdates.mjs';
import { CONTENT_AREAS, contentArea, validateContentPath } from '../../editor/contentAreas.mjs';
import { imageContentType, validateImagePath, validateImageUpload } from '../../editor/imageAssets.mjs';
const SESSION_COOKIE = 'editor_session';
const STATE_COOKIE = 'editor_oauth_state';
const VERIFIER_COOKIE = 'editor_oauth_verifier';
const RETURN_COOKIE = 'editor_oauth_return';

function editorReturnPath(value, origin) {
  try {
    const url = new URL(value || '/editor/', origin);
    if (url.origin === origin && ['/', '/editor/'].includes(url.pathname) && !url.username && !url.password) return url.pathname + url.search + url.hash;
  } catch { /* Use the dashboard for invalid or external destinations. */ }
  return '/editor/';
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
class GitHubConflictError extends Error {}

// Pages passes the actual request URL. Never reconstruct this origin from
// Host, Forwarded, X-Forwarded-Host, Origin, or Referer client headers.
function canonicalEditorOrigin(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (value !== url.origin && value !== `${url.origin}/`) return null;
    return url.origin;
  } catch { return null; }
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').filter(Boolean).map((part) => {
    const [name, ...value] = part.trim().split('=');
    try { return [name, decodeURIComponent(value.join('='))]; }
    catch { return [name, '']; }
  }));
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function base64url(bytes) { return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromBase64url(value) { return base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')); }
function randomValue(size = 32) { const bytes = new Uint8Array(size); crypto.getRandomValues(bytes); return base64url(bytes); }

async function sessionKey(secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function sealSession(session, secret) {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sessionKey(secret), plaintext));
  return `${base64url(iv)}.${base64url(ciphertext)}`;
}

async function openSession(value, secret) {
  try {
    const [iv, ciphertext] = value.split('.').map(fromBase64url);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await sessionKey(secret), ciphertext);
    const session = JSON.parse(new TextDecoder().decode(plaintext));
    if (typeof session.token !== 'string' || !session.token || typeof session.login !== 'string' || !session.login || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch { return null; }
}

function cookie(name, value, options = '') {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; ${options}`;
}

async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options, redirect: 'manual',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geobtaa-project-editor-staging',
      ...options.headers,
    },
  });
  if (response.status >= 300 && response.status < 400) throw new HttpError(502, 'GitHub returned an unexpected redirect. No redirect was followed; verify the saved draft before retrying a write.');
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new HttpError(response.status, detail.message || `GitHub request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

function repoSettings(env) {
  return { owner: env.GITHUB_OWNER || 'geobtaa', repo: env.GITHUB_REPO || 'geobtaa.github.io' };
}
function createGitHubClient(env, token) {
  const { owner, repo } = repoSettings(env);
  return createDraftStore({ owner, repo, request: (path, options) => githubRequest(token, path === '/graphql' ? path : `/repos/${owner}/${repo}${path}`, options) });
}

async function login(request, env) {
  validateOAuthConfig(env);
  const url = new URL(request.url);
  const state = randomValue();
  const verifier = randomValue(48);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${url.origin}/api/auth/callback`, scope: 'public_repo', state, code_challenge: challenge, code_challenge_method: 'S256', allow_signup: 'false' }).toString();
  const headers = new Headers({ Location: authorize.toString(), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(STATE_COOKIE, state, 'SameSite=Lax; Max-Age=600'));
  headers.append('Set-Cookie', cookie(VERIFIER_COOKIE, verifier, 'SameSite=Lax; Max-Age=600'));
  headers.append('Set-Cookie', cookie(RETURN_COOKIE, editorReturnPath(url.searchParams.get('returnTo'), url.origin), 'SameSite=Lax; Max-Age=600'));
  return new Response(null, { status: 302, headers });
}

async function callback(request, env) {
  validateOAuthConfig(env);
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  if (!cookies[STATE_COOKIE] || !cookies[VERIFIER_COOKIE] || url.searchParams.get('state') !== cookies[STATE_COOKIE]) throw new HttpError(400, 'Invalid or expired OAuth state. Start sign-in again.');
  if (url.searchParams.has('error')) throw new HttpError(401, 'GitHub sign-in was cancelled or refused. Start sign-in again.');
  if (!url.searchParams.get('code')) throw new HttpError(400, 'GitHub did not return a sign-in code. Start sign-in again.');
  let tokenResponse, tokenData;
  try {
    tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', redirect: 'manual', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${url.origin}/api/auth/callback`, code_verifier: cookies[VERIFIER_COOKIE] }),
    });
    if (tokenResponse.status >= 300 && tokenResponse.status < 400) throw new HttpError(502, 'GitHub sign-in returned an unexpected redirect.');
    tokenData = await tokenResponse.json();
  } catch { throw new HttpError(502, 'GitHub sign-in could not be reached or returned an unreadable response. Start sign-in again.'); }
  if (!tokenResponse.ok || typeof tokenData?.access_token !== 'string' || !tokenData.access_token) throw new HttpError(tokenResponse.status >= 500 ? 502 : 401, 'GitHub could not complete sign-in. The code may have expired. Start sign-in again; contact the site administrator if this continues.');
  const { owner, repo } = repoSettings(env);
  let user, repository;
  try {
    user = await githubRequest(tokenData.access_token, '/user');
    repository = await githubRequest(tokenData.access_token, `/repos/${owner}/${repo}`);
  } catch (error) {
    if (error.status === 401 || error.status === 403) throw new HttpError(error.status, 'GitHub could not authorize this sign-in. Sign in with an authorized account or contact the site administrator.');
    throw new HttpError(502, 'GitHub account or repository access could not be verified. Start sign-in again.');
  }
  if (!repository?.permissions?.push || !allowedUser(user?.login, env)) throw new HttpError(403, 'This GitHub account is not allowed to edit this repository. Sign in with an authorized account or contact the site administrator.');
  const session = await sealSession({ token: tokenData.access_token, login: user.login, exp: Date.now() + 8 * 60 * 60 * 1000 }, env.SESSION_SECRET);
  const headers = new Headers({ Location: url.origin + editorReturnPath(cookies[RETURN_COOKIE], url.origin), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, session, 'SameSite=Strict; Max-Age=28800'));
  headers.append('Set-Cookie', cookie(STATE_COOKIE, '', 'SameSite=Lax; Max-Age=0'));
  headers.append('Set-Cookie', cookie(VERIFIER_COOKIE, '', 'SameSite=Lax; Max-Age=0'));
  headers.append('Set-Cookie', cookie(RETURN_COOKIE, '', 'SameSite=Lax; Max-Age=0'));
  return new Response(null, { status: 302, headers });
}

async function authenticatedSession(request, env) {
  const value = parseCookies(request)[SESSION_COOKIE];
  if (!value) throw new HttpError(401, 'Sign in with GitHub to continue.');
  const session = await openSession(value, env.SESSION_SECRET);
  if (!session) throw new HttpError(401, 'Your editor session has expired. Sign in again.');
  if (!allowedUser(session.login, env)) throw Object.assign(new HttpError(403, 'This account is no longer authorized to use the editor. Sign in with an authorized account or contact the site administrator.'), { code: 'access_denied' });
  return session;
}

function validateOAuthConfig(env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) throw new HttpError(500, 'GitHub sign-in is not configured correctly. Contact the site administrator.');
}
function allowedUser(login, env) {
  const allowed = (env.ALLOWED_GITHUB_USERS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return typeof login === 'string' && !!login && (!allowed.length || allowed.includes(login.toLowerCase()));
}
function clearOAuthCookies(response) {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, RETURN_COOKIE]) response.headers.append('Set-Cookie', cookie(name, '', 'SameSite=Lax; Max-Age=0'));
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function contentRoute(pathname) {
  const match = pathname.match(/^\/api\/content\/([^/]+)(?:\/(.+))?$/);
  if (!match || !contentArea(match[1])) return null;
  return { area: match[1], filename: match[2] ? validateContentPath(match[2]) : null };
}

async function contentApi(request, env, pathname) {
  const session = await authenticatedSession(request, env);
  const github = createGitHubClient(env, session.token);
  if (pathname.startsWith('/api/publication-status/')) {
    const route = contentRoute(pathname.replace('/api/publication-status/', '/api/content/'));
    if (!route?.filename) throw new HttpError(400, 'A saved document is required.');
    if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    const params = new URL(request.url).searchParams;
    const publicationRequest = { state: 'merged', mergeHead: params.get('mergeHead'), snapshotHead: params.get('snapshotHead') };
    return json(await github.getWebsiteInfo(route.area, route.filename, { unpublishEnabled: env.CMS_PUBLISH_ENABLED === 'true' ? env.CMS_UNPUBLISH_ENABLED : undefined, publicationRequest }));
  }
  if (pathname.startsWith('/api/publish/')) {
    const statusRoute = contentRoute(pathname.replace('/api/publish/', '/api/content/'));
    if (!statusRoute?.filename) throw new HttpError(400, 'A saved document is required.');
    if (request.method === 'GET') return json(await github.getPublicationStatus(statusRoute.area, statusRoute.filename));
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    if (env.CMS_PUBLISH_ENABLED !== 'true') throw new HttpError(403, 'Publish is disabled until repository protection and required checks are configured.');
    const route = contentRoute(pathname.replace('/api/publish/', '/api/content/'));
    if (!route?.filename) throw new HttpError(400, 'A saved document is required.');
    const input = await request.json();
      if (input.action === 'unpublish') await github.assertUnpublishEnabled(env.CMS_UNPUBLISH_ENABLED);
    return json(await (input.prepare === true ? github.preparePublication({ ...route, head: input.head, action: input.action }) : github.publishContent({ ...route, head: input.head, action: input.action, candidate: input.candidate })));
  }
  if (request.method === 'GET' && pathname === '/api/content') return json({ areas: CONTENT_AREAS });
  const route = contentRoute(pathname);
  if (!route) throw new HttpError(404, 'Not found.');
  const { area, filename } = route;
  if (area === 'posts' && request.method === 'POST' && !filename) return json(await saveBlog(github, null, await request.json()), 201);
  if (area === 'updates' && request.method === 'POST' && !filename) return json(await saveProgramUpdate(github, null, await request.json()), 201);
  if (request.method === 'GET' && !filename) return json(await github.discoverContent(area));
  if (!filename) throw new HttpError(400, 'Content filename is required.');
  if (request.method === 'GET') {
    const file = await github.getContent(area, filename);
    return json({ ...file, ...(area === 'updates' ? parseProgramUpdate(file.content) : parsePage(file.content)), ...contentVisibility(file.content) });
  }
  if (request.method === 'PUT') {
    const input = await request.json();
    if (area === 'posts') return json(await saveBlog(github, filename, input));
    if (area === 'updates') return json(await saveProgramUpdate(github, filename, input));
    return json(await savePage(github, area, filename, input));
  }
  throw new HttpError(405, 'Method not allowed.');
}

async function imageApi(request, env, pathname) {
  const session = await authenticatedSession(request, env);
  const github = createGitHubClient(env, session.token);
  if (request.method === 'GET' && pathname === '/api/images') return json(await github.listImages({ area: new URL(request.url).searchParams.get('area'), filename: new URL(request.url).searchParams.get('filename') }));
  if (request.method === 'GET' && pathname.startsWith('/api/images/file/')) {
    const path = validateImagePath(pathname.slice('/api/images/file/'.length));
    const image = await github.getImage(path);
    return new Response(image.bytes, { headers: { 'Content-Type': imageContentType(path), 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (request.method === 'POST' && pathname === '/api/images') {
    const input = await request.json();
    const bytes = base64ToBytes(String(input.content || ''));
    const filename = validateImageUpload({ filename: input.filename, mimeType: input.mimeType, bytes });
    return json(await github.uploadImage({ area: input.area, documentFilename: input.documentFilename, filename, mimeType: input.mimeType, bytes }), 201);
  }
  throw new HttpError(404, 'Not found.');
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const editorOrigin = canonicalEditorOrigin(env.EDITOR_ORIGIN);
  // Return before OAuth error handling as well: a rejected host must receive
  // neither sign-in links nor cookie changes, even with copied credentials.
  if (!editorOrigin) return json({ error: 'EDITOR_ORIGIN must be configured as a single HTTPS origin.' }, 500);
  if (url.origin !== editorOrigin) return json({ error: 'The CMS API is unavailable on this deployment origin.' }, 403);
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Invalid request origin.');
    if (request.method === 'GET' && url.pathname === '/api/auth/login') return await login(request, env);
    if (request.method === 'GET' && url.pathname === '/api/auth/callback') return await callback(request, env);
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 'SameSite=Strict; Max-Age=0') });
    }
    if (request.method === 'GET' && url.pathname === '/api/session') {
      let session;
      try { session = await authenticatedSession(request, env); }
      catch (error) {
        if (error.status !== 401) throw error;
        return json({ authenticated: false }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 'SameSite=Strict; Max-Age=0') });
      }
      const { owner, repo } = repoSettings(env);
      return json(session ? { authenticated: true, login: session.login, workspace: `${owner}/${repo}#cms-drafts-v1` } : { authenticated: false });
    }
    if (url.pathname === '/api/images' || url.pathname.startsWith('/api/images/file/')) return await imageApi(request, env, url.pathname);
    return await contentApi(request, env, url.pathname);
  } catch (error) {
    const status = error instanceof GitHubConflictError ? 409 : (error.status || 500);
    const oauth = ['/api/auth/login', '/api/auth/callback'].includes(url.pathname);
    const returnTo = editorReturnPath(parseCookies(request)[RETURN_COOKIE] || url.searchParams.get('returnTo'), url.origin);
    const signInUrl = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
    const message = oauth && !error.status ? 'GitHub sign-in could not be completed. Start sign-in again; contact the site administrator if this continues.' : error.message || 'Unexpected server error.';
    const data = { error: message, ...(error.code ? { code: error.code } : {}), ...((oauth || status === 401 || error.code === 'access_denied') ? { signInUrl } : {}), ...(error.suggestedFilename ? { suggestedFilename: error.suggestedFilename } : {}), ...(error.creationState ? { creationState: error.creationState } : {}) };
    const response = oauth && request.headers.get('Accept')?.includes('text/html')
      ? new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GitHub sign-in unsuccessful</title><h1>GitHub sign-in unsuccessful</h1><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(signInUrl)}">Start sign-in again</a></p><p><a href="${escapeHtml(returnTo)}">Return to the editor</a>. Keep your original editing tab open.</p></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'" } })
      : json(data, status);
    if (oauth) clearOAuthCookies(response);
    if (status === 401 || error.code === 'access_denied') response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 'SameSite=Strict; Max-Age=0'));
    return response;
  }
}

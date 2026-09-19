import { newProject, parseContent, serializeContent } from '../../editor-prototype/content.mjs';
import { CONTENT_AREAS, contentArea, contentDirectory, encodeContentPath, validateContentPath } from '../../editor-prototype/contentAreas.mjs';
const SESSION_COOKIE = 'editor_session';
const STATE_COOKIE = 'editor_oauth_state';
const VERIFIER_COOKIE = 'editor_oauth_verifier';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
class GitHubConflictError extends Error {}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').filter(Boolean).map((part) => {
    const [name, ...value] = part.trim().split('=');
    return [name, decodeURIComponent(value.join('='))];
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
    if (!session.token || !session.login || session.exp < Date.now()) return null;
    return session;
  } catch { return null; }
}

function cookie(name, value, options = '') {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; ${options}`;
}

async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geobtaa-project-editor-staging',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new HttpError(response.status, detail.message || `GitHub request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

function repoSettings(env) {
  return {
    owner: env.GITHUB_OWNER || 'geobtaa',
    repo: env.GITHUB_REPO || 'geobtaa.github.io',
    branch: 'custom-cms',
    baseBranch: 'main',
  };
}

function createGitHubClient(env, token) {
  const { owner, repo, branch, baseBranch } = repoSettings(env);
  const api = `/repos/${owner}/${repo}`;
  const request = (path, options) => githubRequest(token, `${api}${path}`, options);
  async function branchExists() {
    try { await request(`/git/ref/heads/${encodeURIComponent(branch)}`); return true; }
    catch (error) { if (error.status === 404) return false; throw error; }
  }
  async function readRef() { return (await branchExists()) ? branch : baseBranch; }
  async function ensureBranch() {
    if (await branchExists()) return;
    const base = await request(`/git/ref/heads/${encodeURIComponent(baseBranch)}`);
    try {
      await request('/git/refs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
    } catch (error) {
      if (error.status !== 422 || !(await branchExists())) throw error;
    }
  }
  async function listDirectory(directory, ref, relative = '') {
    const path = relative ? `${directory}/${relative}` : directory;
    const files = await request(`/contents/${encodeContentPath(path)}?ref=${encodeURIComponent(ref)}`);
    const output = [];
    for (const file of files) {
      const name = relative ? `${relative}/${file.name}` : file.name;
      if (file.type === 'dir') output.push(...await listDirectory(directory, ref, name));
      else if (/\.mdx?$/.test(file.name)) output.push({ name, path: file.path, sha: file.sha });
    }
    return output;
  }
  return {
    async listContent(area) {
      const ref = await readRef();
      return { branch: ref, entries: await listDirectory(contentDirectory(area), ref) };
    },
    async getContent(area, filename) {
      const ref = await readRef();
      const file = await request(`/contents/${encodeContentPath(`${contentDirectory(area)}/${filename}`)}?ref=${encodeURIComponent(ref)}`);
      return { filename, sha: file.sha, content: new TextDecoder().decode(base64ToBytes(file.content.replace(/\s/g, ''))), branch: ref };
    },
    async saveContent({ area, filename, content, sha, publish }) {
      await ensureBranch();
      try {
        const result = await request(`/contents/${encodeContentPath(`${contentDirectory(area)}/${filename}`)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: area === 'projects' ? `${publish ? 'Publish' : 'Save draft'} project: ${filename}` : `Update ${area}: ${filename}`, content: bytesToBase64(new TextEncoder().encode(content)), branch, ...(sha ? { sha } : {}) }),
        });
        return { sha: result.content.sha, commitSha: result.commit.sha, branch };
      } catch (error) {
        if (sha && (error.status === 409 || error.status === 422)) throw new GitHubConflictError('This page has changed in GitHub since you opened it. Reload the latest version before saving.');
        throw error;
      }
    },
  };
}

async function login(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) throw new HttpError(500, 'OAuth secrets are not configured.');
  const url = new URL(request.url);
  const state = randomValue();
  const verifier = randomValue(48);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${url.origin}/api/auth/callback`, scope: 'public_repo', state, code_challenge: challenge, code_challenge_method: 'S256', allow_signup: 'false' }).toString();
  const headers = new Headers({ Location: authorize.toString(), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(STATE_COOKIE, state, 'SameSite=Lax; Max-Age=600'));
  headers.append('Set-Cookie', cookie(VERIFIER_COOKIE, verifier, 'SameSite=Lax; Max-Age=600'));
  return new Response(null, { status: 302, headers });
}

async function callback(request, env) {
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  if (!url.searchParams.get('code') || !cookies[STATE_COOKIE] || url.searchParams.get('state') !== cookies[STATE_COOKIE]) throw new HttpError(400, 'Invalid or expired OAuth state. Start sign-in again.');
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${url.origin}/api/auth/callback`, code_verifier: cookies[VERIFIER_COOKIE] }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new HttpError(401, tokenData.error_description || 'GitHub sign-in failed.');
  const user = await githubRequest(tokenData.access_token, '/user');
  const { owner, repo } = repoSettings(env);
  const repository = await githubRequest(tokenData.access_token, `/repos/${owner}/${repo}`);
  const allowed = (env.ALLOWED_GITHUB_USERS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!repository.permissions?.push || (allowed.length && !allowed.includes(user.login.toLowerCase()))) throw new HttpError(403, 'This GitHub account is not allowed to edit this repository.');
  const session = await sealSession({ token: tokenData.access_token, login: user.login, exp: Date.now() + 8 * 60 * 60 * 1000 }, env.SESSION_SECRET);
  const headers = new Headers({ Location: `${url.origin}/editor/`, 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, session, 'SameSite=Strict; Max-Age=28800'));
  headers.append('Set-Cookie', cookie(STATE_COOKIE, '', 'SameSite=Lax; Max-Age=0'));
  headers.append('Set-Cookie', cookie(VERIFIER_COOKIE, '', 'SameSite=Lax; Max-Age=0'));
  return new Response(null, { status: 302, headers });
}

async function authenticatedSession(request, env) {
  const value = parseCookies(request)[SESSION_COOKIE];
  if (!value) throw new HttpError(401, 'Sign in with GitHub to continue.');
  const session = await openSession(value, env.SESSION_SECRET);
  if (!session) throw new HttpError(401, 'Your editor session has expired. Sign in again.');
  return session;
}

function contentRoute(pathname) {
  const match = pathname.match(/^\/api\/content\/([^/]+)(?:\/(.+))?$/);
  if (!match || !contentArea(match[1])) return null;
  return { area: match[1], filename: match[2] ? validateContentPath(match[2]) : null };
}

async function contentApi(request, env, pathname) {
  const session = await authenticatedSession(request, env);
  const github = createGitHubClient(env, session.token);
  if (request.method === 'GET' && pathname === '/api/content') return json({ areas: CONTENT_AREAS });
  const route = contentRoute(pathname);
  if (!route) throw new HttpError(404, 'Not found.');
  const { area, filename } = route;
  if (request.method === 'GET' && !filename) return json(await github.listContent(area));
  if (!filename) throw new HttpError(400, 'Content filename is required.');
  if (request.method === 'GET') {
    const file = await github.getContent(area, filename);
    return json({ ...file, ...parseContent(file.content) });
  }
  if (request.method === 'PUT') {
    const input = await request.json();
    const config = contentArea(area);
    if (!input.title?.trim() || (config.description && !input.description?.trim())) throw new HttpError(400, `Title${config.description ? ' and description are' : ' is'} required.`);
    if (!input.sha && !config.create) throw new HttpError(400, 'New files are not enabled for this content directory.');
    const entry = { title: input.title.trim(), description: input.description?.trim() ?? '', draft: config.publishing ? !input.publish : false, body: input.body ?? '' };
    const content = input.sha ? serializeContent(input.originalContent, entry, { description: config.description, draft: config.publishing }) : newProject(entry);
    const saved = await github.saveContent({ area, filename, content, sha: input.sha, publish: config.publishing && Boolean(input.publish) });
    return json({ ...saved, content, ...parseContent(content) });
  }
  throw new HttpError(405, 'Method not allowed.');
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Invalid request origin.');
    if (request.method === 'GET' && url.pathname === '/api/auth/login') return login(request, env);
    if (request.method === 'GET' && url.pathname === '/api/auth/callback') return callback(request, env);
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 'SameSite=Strict; Max-Age=0') });
    }
    if (request.method === 'GET' && url.pathname === '/api/session') {
      const session = await openSession(parseCookies(request)[SESSION_COOKIE] || '', env.SESSION_SECRET);
      return json(session ? { authenticated: true, login: session.login } : { authenticated: false });
    }
    return await contentApi(request, env, url.pathname);
  } catch (error) {
    const status = error instanceof GitHubConflictError ? 409 : (error.status || 500);
    return json({ error: error.message || 'Unexpected server error.' }, status);
  }
}

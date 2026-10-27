import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'yaml';
import { CONTENT_AREAS } from './contentAreas.mjs';
import { createEditorServer } from './server.mjs';
import { createGitHubClient } from './github.mjs';
import { onRequest } from '../functions/api/[[path]].js';
const origin = 'https://geobtaa-editor-staging.pages.dev';
const env = { GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: 'session-key-with-at-least-32-characters', ALLOWED_GITHUB_USERS: 'editor-user' };
const original = '---\ntitle: Original\ndescription: ""\ndate: 2025-12-31T23:00:00.000-06:00\nyear: 2025\nauthors: [{name: Staff, title: Editor}]\ntags: [Maps]\nsidebar: {order: 2, badge: New}\ncustom: preserve\n---\n\n<CenterLayout>Protected MDX.</CenterLayout>\n';
const data = source => parse(source.match(/^---\n([\s\S]*?)\n---/)[1]);
function repository() {
  let sequence = 0;
  const files = new Map(Object.keys(CONTENT_AREAS).filter(area => area !== 'posts').map(area => [`${area}/existing.mdx`, { content: original, sha: `loaded-${area}` }]));
  const fetchImpl = async (input, options = {}) => {
    const path = new URL(String(input)).pathname.replace('/repos/geobtaa/geobtaa.github.io', '');
    if (path.startsWith('/git/ref/heads/')) return Response.json({ object: { sha: 'head' } });
    const match = path.match(/^\/contents\/src\/content\/docs\/(.+)$/);
    if (!match) throw new Error(`Unexpected request: ${path}`);
    const key = decodeURIComponent(match[1]);
    const file = files.get(key);
    if (!options.method || options.method === 'GET') return file ? Response.json({ sha: file.sha, content: Buffer.from(file.content).toString('base64') }) : Response.json({ message: 'Not found' }, { status: 404 });
    const payload = JSON.parse(options.body);
    if (file && file.sha !== payload.sha) return Response.json({ message: 'SHA mismatch' }, { status: 409 });
    const saved = { content: Buffer.from(payload.content, 'base64').toString(), sha: `saved-${++sequence}` };
    files.set(key, saved);
    return Response.json({ content: { sha: saved.sha }, commit: { sha: `commit-${sequence}` } });
  };
  return { files, fetchImpl };
}
async function login() {
  const start = await onRequest({ request: new Request(`${origin}/api/auth/login`), env });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = start.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const response = await onRequest({ request: new Request(`${origin}/api/auth/callback?code=test&state=${state}`, { headers: { Cookie: cookie } }), env });
  assert.equal(response.status, 302);
  return response.headers.getSetCookie().find(value => value.startsWith('editor_session=')).split(';')[0];
}
for (const mode of ['local', 'hosted']) {
  test(`${mode} API edits metadata in every enabled non-blog area and preserves authoritative content`, async () => {
    const repo = repository();
    const previousFetch = globalThis.fetch;
    let call;
    try {
      if (mode === 'local') {
        const server = createEditorServer(createGitHubClient({ token: 'test', fetchImpl: repo.fetchImpl }));
        call = (method, path, input) => new Promise(resolve => {
          let status;
          server.emit('request', { method, url: path, headers: { host: 'localhost', origin: 'http://localhost:4321' }, async *[Symbol.asyncIterator]() { if (input) yield JSON.stringify(input); } }, { writeHead(value) { status = value; }, end(body) { resolve({ status, body: JSON.parse(body) }); } });
        });
      } else {
        globalThis.fetch = async (input, options) => {
          const url = String(input);
          if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'test-token' });
          if (url === 'https://api.github.com/user') return Response.json({ login: 'editor-user' });
          if (url === 'https://api.github.com/repos/geobtaa/geobtaa.github.io') return Response.json({ permissions: { push: true } });
          return repo.fetchImpl(input, options);
        };
        const cookie = await login();
        call = async (method, path, input) => {
          const response = await onRequest({ request: new Request(origin + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) }), env });
          return { status: response.status, body: await response.json() };
        };
      }
      for (const area of Object.keys(CONTENT_AREAS).filter(area => area !== 'posts')) {
        const path = `/api/content/${area}/existing.mdx`;
        const loaded = await call('GET', path);
        assert.equal(loaded.status, 200);
        assert.equal(loaded.body.date, '2025-12-31');
        assert.equal(loaded.body.metadata.year, 2025);
        const input = { ...loaded.body, title: `Revised ${area}`, draft: true, date: '2026-03-01', tags: ['Changed'], metadata: { ...loaded.body.metadata, year: 2026, sidebar: { ...loaded.body.metadata.sidebar, label: area } }, originalContent: 'untrusted' };
        const saved = await call('PUT', path, input);
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        const actual = data(repo.files.get(`${area}/existing.mdx`).content);
        assert.equal(actual.year, 2026); assert.equal(actual.draft, true);
        assert.equal(actual.date, '2026-03-01T23:00:00.000-06:00');
        assert.equal(actual.custom, 'preserve'); assert.equal(actual.sidebar.badge, 'New');
        assert.equal(actual.authors[0].title, 'Editor');
        assert.equal(saved.body.body, loaded.body.body);
        assert.equal((await call('GET', path)).body.metadata.sidebar.label, area);
        assert.equal((await call('PUT', path, input)).status, 409, 'stale writes are rejected');
        assert.equal((await call('PUT', path, { ...saved.body, metadata: { year: 1700 } })).status, 400);
        const created = await call('PUT', `/api/content/${area}/new.mdx`, { title: 'New page', description: '', draft: true, body: 'New body.', metadata: { sidebar: { hidden: true } } });
        assert.equal(created.status, 200, JSON.stringify(created.body));
        assert.equal(created.body.draft, true);
        assert.equal(created.body.sidebarHidden, true);
        assert.equal(data(created.body.content).date, undefined, 'dates are not added automatically');
      }
    } finally { globalThis.fetch = previousFetch; }
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditorServer } from './server.mjs';
import { createGitHubClient } from './github.mjs';
import { newBlog, parseBlog } from './blog.mjs';
import { onRequest } from '../functions/api/[[path]].js';

const origin = 'https://geobtaa-editor-staging.pages.dev';
const env = { GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: 'session-key-with-at-least-32-characters', ALLOWED_GITHUB_USERS: 'editor-user' };
const original = newBlog({ title: 'Old post', date: '2026-10-24', draft: false, authors: [{ name: 'Staff', title: 'Editor' }], tags: ['Maps'], cover: { image: '@images/map.png', alt: 'Map', caption: 'Keep this' }, body: "import CenterLayout from '@components/CenterLayout.astro';\n\n<CenterLayout>\nUntouched.\n</CenterLayout>\n\nAfter.\n" });

function repository() {
  let head = 'head-1';
  let counter = 1;
  let pending;
  const files = new Map([['existing.md', { content: original, sha: 'blob-1' }]]);
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || 'GET';
    const path = url.pathname.replace('/repos/geobtaa/geobtaa.github.io', '');
    const payload = options.body ? JSON.parse(options.body) : null;
    if (path.startsWith('/git/ref/heads/')) return Response.json({ object: { sha: head } });
    if (path.startsWith('/git/blobs/')) {
      const file = [...files.values()].find((item) => item.sha === path.slice('/git/blobs/'.length));
      return file ? Response.json({ content: Buffer.from(file.content).toString('base64') }) : Response.json({ message: 'Not found' }, { status: 404 });
    }
    if (path === `/git/commits/${head}`) return Response.json({ tree: { sha: 'base-tree' } });
    if (path === '/git/trees/base-tree') return Response.json({ tree: [...files.keys()].map((name) => ({ path: `src/content/docs/posts/${name}`, type: 'blob' })) });
    if (path === '/git/trees' && method === 'POST') {
      assert.equal(payload.base_tree, 'base-tree');
      const item = payload.tree[0];
      pending = { filename: item.path.replace('src/content/docs/posts/', ''), content: item.content, sha: `blob-${++counter}` };
      return Response.json({ sha: 'new-tree', tree: [{ path: item.path, sha: pending.sha }] });
    }
    if (path === '/git/commits' && method === 'POST') {
      assert.deepEqual(payload.parents, [head]);
      return Response.json({ sha: `commit-${counter}` });
    }
    if (path.startsWith('/git/refs/heads/') && method === 'PATCH') {
      assert.equal(payload.force, false);
      assert.ok(!files.has(pending.filename));
      files.set(pending.filename, { content: pending.content, sha: pending.sha });
      head = payload.sha;
      return Response.json({});
    }
    if (path.startsWith('/contents/src/content/docs/posts')) {
      const filename = decodeURIComponent(path.replace('/contents/src/content/docs/posts', '').replace(/^\//, ''));
      if (!filename) return Response.json([...files].map(([name, file]) => ({ name, path: `src/content/docs/posts/${name}`, type: 'file', sha: file.sha })));
      const file = files.get(filename);
      if (method === 'GET') return file ? Response.json({ sha: file.sha, content: Buffer.from(file.content).toString('base64') }) : Response.json({ message: 'Not found' }, { status: 404 });
      assert.equal(method, 'PUT');
      if (file?.sha !== payload.sha) return Response.json({ message: 'SHA mismatch' }, { status: 409 });
      const saved = { sha: `blob-${++counter}`, content: Buffer.from(payload.content, 'base64').toString('utf8') };
      files.set(filename, saved);
      return Response.json({ content: { sha: saved.sha }, commit: { sha: `commit-${counter}` } });
    }
    throw new Error(`Unexpected ${method} ${url}`);
  };
  return { fetchImpl, files };
}

function localRequest(server, method, path, input) {
  return new Promise((resolve) => {
    let status;
    const request = { method, url: path, headers: { host: 'localhost', origin: 'http://localhost:4321' }, async *[Symbol.asyncIterator]() { if (input) yield JSON.stringify(input); } };
    server.emit('request', request, { writeHead(code) { status = code; }, end(body) { resolve({ status, body: JSON.parse(body) }); } });
  });
}

async function sessionCookie() {
  const login = await onRequest({ request: new Request(`${origin}/api/auth/login`), env });
  const authorize = new URL(login.headers.get('location'));
  const cookies = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const callback = await onRequest({ request: new Request(`${origin}/api/auth/callback?code=test&state=${authorize.searchParams.get('state')}`, { headers: { Cookie: cookies } }), env });
  assert.equal(callback.status, 302);
  return callback.headers.getSetCookie().find((value) => value.startsWith('editor_session=')).split(';')[0];
}

for (const mode of ['local', 'hosted']) {
  test(`${mode} API creates, lists, reloads, edits, protects collisions, and preserves post URLs`, async () => {
    const repo = repository();
    const savedFetch = globalThis.fetch;
    let call;
    let server;
    if (mode === 'local') {
      server = createEditorServer(createGitHubClient({ token: 'test', fetchImpl: repo.fetchImpl }));
      call = (method, path, input) => localRequest(server, method, path, input);
    } else {
      globalThis.fetch = async (input, options) => {
        const url = String(input);
        if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'test-token' });
        if (url === 'https://api.github.com/user') return Response.json({ login: 'editor-user' });
        if (url === 'https://api.github.com/repos/geobtaa/geobtaa.github.io') return Response.json({ permissions: { push: true } });
        return repo.fetchImpl(input, options);
      };
      const cookie = await sessionCookie();
      call = async (method, path, input) => {
        const response = await onRequest({ request: new Request(`${origin}${path}`, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) }), env });
        return { status: response.status, body: await response.json() };
      };
    }
    try {
      const loaded = await call('GET', '/api/content/posts/existing.md');
      assert.equal(loaded.status, 200);
      assert.equal(loaded.body.date, '2026-10-24');
      const edited = await call('PUT', '/api/content/posts/existing.md', { ...loaded.body, title: 'Changed title', date: '2026-11-01', body: `${loaded.body.body}Extra paragraph.\n` });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.filename, 'existing.md');
      assert.deepEqual(edited.body.cover, loaded.body.cover);
      assert.deepEqual(edited.body.authors, loaded.body.authors);
      assert.ok(edited.body.body.includes('<CenterLayout>\nUntouched.\n</CenterLayout>'));
      assert.equal((await call('PUT', '/api/content/posts/existing.md', loaded.body)).status, 409);
      const minimal = { title: 'A new post', date: '2026-10-24', body: 'New body.' };
      const created = await call('POST', '/api/content/posts', minimal);
      assert.equal(created.status, 201);
      assert.equal(created.body.filename, 'a-new-post.mdx');
      assert.equal(created.body.draft, true);
      const collision = await call('POST', '/api/content/posts', minimal);
      assert.equal(collision.status, 409);
      assert.equal(collision.body.suggestedFilename, 'a-new-post-2.mdx');
      assert.equal((await call('POST', '/api/content/posts', { ...minimal, suggestedFilename: collision.body.suggestedFilename })).status, 201);
      const listing = (await call('GET', '/api/content/posts')).body.entries;
      assert.equal(listing.length, 3);
      assert.ok(listing.every((item) => item.visibilityKnown === true));
      assert.equal(listing.find((item) => item.name === 'existing.md').draft, false);
      assert.equal(listing.find((item) => item.name === 'a-new-post.mdx').draft, true);
      const reloaded = await call('GET', '/api/content/posts/a-new-post.mdx');
      assert.equal(reloaded.body.title, minimal.title);
      assert.equal((await call('PUT', '/api/content/posts/a-new-post.mdx', { ...reloaded.body, title: 'Renamed', date: '2027-01-01', draft: false })).status, 200);
      assert.equal(parseBlog(repo.files.get('a-new-post.mdx').content).title, 'Renamed');
      assert.equal(repo.files.has('renamed.mdx'), false);
      assert.equal((await call('PUT', '/api/content/posts/a-new-post.mdx', { title: 'Overwrite attempt' })).status, 400);
      assert.equal((await call('POST', '/api/content/posts', { title: '' })).status, 400);
      assert.equal((await call('GET', '/api/content/updates')).status, 404);
    } finally {
      globalThis.fetch = savedFetch;
      server?.close();
    }
  });
}

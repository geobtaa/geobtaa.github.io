import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHeaderValue } from 'node:http';
import { createEditorServer } from './server.mjs';
import { createGitHubClient } from './github.mjs';
import { onRequest } from '../functions/api/[[path]].js';
import { draftTestRepository } from './draftTestRepository.mjs';
import { preparePublicationCandidate } from './publicationCandidate.mjs';

const origin = 'https://gin-editor.pages.dev';
const page = '/api/content/library/report.mdx';
const publication = '/api/publish/library/report.mdx';
const original = '---\ntitle: Report\ndescription: Original\ncustom: preserve\n---\n\nOriginal body.';
const gif = Buffer.from('GIF89a');
const flags = ['CMS_PUBLISH_ENABLED', 'CMS_AUTO_MERGE_ENABLED', 'CMS_UNPUBLISH_ENABLED'];

// Use the existing in-memory GitHub transport and the real OAuth callback.
// Only HTTP transport/authentication differ; all domain code stays in the path.
async function exercise(mode, run) {
  const repo = await draftTestRepository({
    'src/content/docs/library/report.mdx': original,
    'src/assets/images/map.gif': gif,
    'navigation.groups.json': '[]',
    'editor/publication-capabilities.json': JSON.stringify({ version: 2, actions: ['publish', 'unpublish'] }),
  });
  const env = { EDITOR_ORIGIN: origin, GITHUB_CLIENT_ID: 'client', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: 'api-parity-test-secret-at-least-thirty-two-characters', ALLOWED_GITHUB_USERS: 'editor' };
  const priorFetch = globalThis.fetch;
  const priorFlags = Object.fromEntries(flags.map(key => [key, process.env[key]]));
  const setFlags = values => {
    for (const key of flags) {
      if (values[key] === undefined) { delete env[key]; delete process.env[key]; }
      else { env[key] = values[key]; process.env[key] = values[key]; }
    }
  };
  setFlags({});
  try {
    let call;
    if (mode === 'local') {
      const server = createEditorServer(createGitHubClient({ token: 'mock-token', fetchImpl: repo.fetchImpl }));
      call = (method, path, input, options = {}) => new Promise((resolve, reject) => {
        const chunks = options.chunks ?? (options.raw !== undefined ? [Buffer.from(options.raw)] : input !== undefined ? [Buffer.from(JSON.stringify(input))] : []);
        let status, headers;
        const listener = server.listeners('request')[0];
        // Node IncomingMessage yields Buffers, not pre-decoded strings.
        Promise.resolve(listener({ method, url: path, headers: { host: 'localhost', ...(options.origin === null ? {} : { origin: options.origin || 'http://localhost:4321' }) },
          async *[Symbol.asyncIterator]() { yield* chunks; },
        }, { writeHead(value, fields) { status = value; headers = fields; }, end(body) {
          const bytes = Buffer.isBuffer(body) || body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(body || '');
          resolve({ status, headers: new Headers(Object.fromEntries(Object.entries(headers).filter(([,value]) => value !== undefined))), bytes,
            body: headers['Content-Type']?.startsWith('application/json') ? JSON.parse(bytes.toString()) : null });
        } })).catch(reject);
      });
    } else {
      globalThis.fetch = async (url, options) => {
        if (String(url) === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'mock-token' });
        if (String(url) === 'https://api.github.com/user') return Response.json({ login: 'editor' });
        return repo.fetchImpl(url, options);
      };
      const start = await onRequest({ request: new Request(origin + '/api/auth/login'), env });
      const state = new URL(start.headers.get('location')).searchParams.get('state');
      const callback = await onRequest({ request: new Request(origin + `/api/auth/callback?code=mock&state=${state}`, { headers: { Cookie: start.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') } }), env });
      assert.equal(callback.status, 302);
      const cookie = callback.headers.getSetCookie().find(value => value.startsWith('editor_session=')).split(';')[0];
      call = async (method, path, input, options = {}) => {
        const headers = { Cookie: options.cookie ?? cookie, ...(options.origin === null ? {} : { Origin: options.origin || origin }), 'Content-Type': 'application/json' };
        let body = options.raw !== undefined ? options.raw : input !== undefined ? JSON.stringify(input) : undefined;
        if (options.chunks) body = new ReadableStream({ start(controller) { for (const chunk of options.chunks) controller.enqueue(chunk); controller.close(); } });
        const response = await onRequest({ request: new Request(origin + path, { method, headers, ...(body !== undefined ? { body, duplex: 'half' } : {}) }), env });
        const bytes = Buffer.from(await response.arrayBuffer());
        return { status: response.status, headers: response.headers, bytes, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(bytes.toString()) : null };
      };
    }
    await run({ call, repo, setFlags });
  } finally {
    globalThis.fetch = priorFetch;
    for (const key of flags) {
      if (priorFlags[key] === undefined) delete process.env[key]; else process.env[key] = priorFlags[key];
    }
  }
}

for (const mode of ['local', 'hosted']) {
  test(`${mode} contract: catalog, provisional list, document and binary image responses`, () => exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    const session = await call('GET', '/api/session');
    assert.equal(session.status, 200); assert.equal(session.body.authenticated, true);
    assert.equal(session.body.workspace, 'geobtaa/geobtaa.github.io#cms-drafts-v1');
    const catalog = await call('GET', '/api/content');
    assert.equal(catalog.status, 200); assert.ok(catalog.body.areas.library);
    const list = await call('GET', '/api/content/library');
    assert.equal(list.status, 200); assert.equal(list.body.discovery, 'provisional');
    assert.equal(list.body.entries[0].name, 'report.mdx');
    const loaded = await call('GET', page);
    assert.equal(loaded.status, 200); assert.equal(loaded.body.title, 'Report');
    assert.equal(loaded.body.content, original); assert.equal(loaded.body.hasDraft, false);
    assert.equal(loaded.headers.get('cache-control'), 'no-store');
    const images = await call('GET', '/api/images?area=library&filename=report.mdx');
    assert.equal(images.status, 200); assert.equal(images.body.images[0].name, 'map.gif');
    const image = await call('GET', '/api/images/file/map.gif');
    assert.equal(image.status, 200); assert.deepEqual(image.bytes, gif);
    assert.equal(image.headers.get('content-type'), 'image/gif');
    assert.equal(image.headers.get('cache-control'), 'private, max-age=300');
    for (const path of ['/api/content/unknown', '/api/content/library/missing.mdx', '/api/images/file/missing.gif']) assert.equal((await call('GET', path)).status, 404);
    assert.deepEqual([...repo.refs], refs);
  }));

  test(`${mode} contract: authoritative document saves, stale revisions, validation and upload ownership`, () => exercise(mode, async ({ call, repo }) => {
    const loaded = (await call('GET', page)).body;
    const refs = [...repo.refs];
    const prepared = await call('POST', '/api/images', { area: 'library', documentFilename: 'report.mdx', filename: 'Map.gif', mimeType: 'image/gif', content: gif.toString('base64') });
    assert.equal(prepared.status, 201); assert.ok(prepared.body.path.startsWith('cms-'));
    for (const [input, expected] of [
      [{ mimeType: 'text/plain', content: gif.toString('base64') }, 400],
      [{ mimeType: 'image/png', content: gif.toString('base64') }, 400],
      [{ mimeType: 'image/gif', content: '' }, 400],
      [{ mimeType: 'image/gif', content: Buffer.concat([gif, Buffer.alloc(5 * 1024 * 1024)]).toString('base64') }, 413],
    ]) assert.equal((await call('POST', '/api/images', { area: 'library', documentFilename: 'report.mdx', filename: 'map.gif', ...input })).status, expected);
    assert.deepEqual([...repo.refs], refs, 'preparation creates no refs');
    const invalid = await call('POST', '/api/images', { filename: 'map.gif', mimeType: 'image/gif', content: gif.toString('base64') });
    assert.equal(invalid.status, 400);
    const saved = await call('PUT', page, { ...loaded, title: 'Changed', originalContent: 'untrusted browser content', body: `Updated.\n\n![Map](@images/${prepared.body.path})`, assets: [prepared.body] });
    assert.equal(saved.status, 200); assert.equal(saved.body.title, 'Changed');
    assert.match(saved.body.content, /custom: preserve/); assert.equal(saved.body.hasDraft, true);
    assert.match(saved.body.commitSha, /^[a-f0-9]{40}$/);
    assert.equal(repo.filesAt(saved.body.head).has('src/assets/images/' + prepared.body.path), true);
    assert.equal((await call('PUT', page, { ...loaded, title: 'Stale' })).status, 409);
    assert.equal((await call('PUT', page, { ...saved.body, body: 'Executable {process.env.SECRET}.' })).status, 400);
    assert.equal((await call('GET', page)).body.head, saved.body.head);
    const other = await call('PUT', '/api/content/library/other.mdx', { title: 'Other', body: `![Foreign](@images/${prepared.body.path})` });
    assert.equal(other.status, 400, 'one document cannot reference another draft upload');
  }));

  test(`${mode} contract: article creation identities are replayed without duplicate documents`, () => exercise(mode, async ({ call, repo }) => {
    for (const area of ['posts', 'updates']) {
      const input = { title: 'New article', body: 'Article body.', date: '2026-11-23', draft: true, authors: [], tags: [], creationId: `parity-${area}-creation-12345`, creationFilename: 'new-article.mdx' };
      const first = await call('POST', `/api/content/${area}`, input);
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(first.body.filename, input.creationFilename);
      const refs = [...repo.refs];
      const retry = await call('POST', `/api/content/${area}`, { ...input, title: 'Later title', creationRetry: true });
      assert.equal(retry.status, 201); assert.equal(retry.body.replayed, true);
      assert.equal(retry.body.commitSha, first.body.commitSha);
      assert.deepEqual([...repo.refs], refs);
    }
  }));

  test(`${mode} contract: publication flags, read-only preparation, explicit authorization and cancellation`, () => exercise(mode, async ({ call, repo, setFlags }) => {
    const loaded = (await call('GET', page)).body;
    const saved = (await call('PUT', page, { ...loaded, body: 'Saved body.' })).body;
    assert.equal((await call('POST', publication, { head: saved.head, prepare: true })).status, 403);
    assert.equal((await call('GET', publication)).status, 200);
    setFlags({ CMS_PUBLISH_ENABLED: 'true' });
    assert.equal((await call('POST', publication, { head: saved.head, action: 'unpublish', prepare: true })).status, 403);
    assert.equal((await call('POST', publication, { head: saved.head, autoMerge: 'true' })).status, 400);
    assert.equal((await call('POST', publication, { head: saved.head, autoMerge: true })).status, 403);
    assert.equal((await call('POST', publication, { action: 'publish', initialize: true })).status, 400);
    const refs = [...repo.refs];
    const prepare = await call('POST', publication, { head: saved.head, prepare: true });
    assert.equal(prepare.status, 200); assert.deepEqual([...repo.refs], refs);
    const candidate = preparePublicationCandidate(prepare.body, 'report.mdx');
    const submit = await call('POST', publication, { head: saved.head, candidate });
    assert.equal(submit.status, 200); assert.equal(submit.body.state, 'pr-open');
    setFlags({ CMS_PUBLISH_ENABLED: 'true', CMS_AUTO_MERGE_ENABLED: 'true' });
    const identity = { head: saved.head, snapshotHead: submit.body.snapshotHead, action: 'publish' };
    assert.equal((await call('POST', publication, { ...identity, autoMerge: true })).status, 200);
    assert.equal(repo.pulls[0].auto_merge, true);
    setFlags({});
    assert.equal((await call('POST', publication, { ...identity, autoMerge: false })).status, 200);
    assert.equal(repo.pulls[0].auto_merge, false);
    assert.equal(repo.pulls.length, 1, 'all publication operations are fixture-only');
  }));

  test(`${mode} contract: unpublish initialization ignores browser content and checks its independent flag`, () => exercise(mode, async ({ call, repo, setFlags }) => {
    const loaded = (await call('GET', page)).body;
    setFlags({ CMS_PUBLISH_ENABLED: 'true' });
    const input = { action: 'unpublish', initialize: true, expectedSha: loaded.sha, expectedHead: loaded.head, content: 'untrusted browser text' };
    assert.equal((await call('POST', publication, input)).status, 403);
    setFlags({ CMS_PUBLISH_ENABLED: 'true', CMS_UNPUBLISH_ENABLED: 'true' });
    const initialized = await call('POST', publication, input);
    assert.equal(initialized.status, 200); assert.equal(initialized.body.document.content, original);
    const refs = [...repo.refs];
    assert.equal((await call('POST', publication, input)).body.head, initialized.body.head);
    assert.deepEqual([...repo.refs], refs);
    const status = await call('GET', '/api/publication-status/library/report.mdx');
    assert.equal(status.status, 200); assert.equal(status.body.autoMergeEnabled, false);
    assert.equal(status.body.unpublishEnabled, true); assert.equal(status.body.website.publication, 'unavailable');
    assert.equal(repo.pulls.length, 0);
  }));

  test(`${mode} contract: disallowed origins and revoked write permission cannot save`, () => exercise(mode, async ({ call, repo }) => {
    const loaded = (await call('GET', page)).body;
    const refs = [...repo.refs];
    assert.equal((await call('PUT', page, loaded, { origin: 'https://untrusted.example' })).status, 403);
    repo.push = false;
    const denied = await call('PUT', page, { ...loaded, body: 'Must not save.' });
    assert.equal(denied.status, 403); assert.equal(denied.body.code, 'access_denied');
    assert.deepEqual([...repo.refs], refs);
  }));
}

// Regression contracts for the corrected HTTP boundaries. Both implementations
// must satisfy the same expectations after their intentional security gates.
test('both handlers preserve UTF-8 split across incoming chunks', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const loaded = (await call('GET', page)).body;
    const text = 'Café — 東京';
    const bytes = Buffer.from(JSON.stringify({ ...loaded, title: text }));
    const split = bytes.indexOf(Buffer.from('é')) + 1;
    const saved = await call('PUT', page, undefined, { chunks: [bytes.subarray(0, split), bytes.subarray(split)] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.title, text);
    const stored = new TextDecoder().decode(repo.objects.get(repo.filesAt(saved.body.head).get('src/content/docs/library/report.mdx').sha));
    assert.equal(stored.includes(text), true, 'reproduction checks stored bytes, not only the response');
  });
});

test('known resources consistently reject unsupported methods with 405 and Allow', async () => {
  const cases = [
    ['POST', '/api/content', 'GET'],
    ['DELETE', page, 'GET, PUT'],
    ['POST', '/api/publication-status/library/report.mdx', 'GET'],
    ['DELETE', publication, 'GET, POST'],
    ['DELETE', '/api/images', 'GET, POST'],
    ['POST', '/api/images/file/map.gif', 'GET'],
    ['PUT', '/api/content/posts', 'GET, POST'],
    ['POST', '/api/content/library', 'GET'],
  ];
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    for (const [method, path, allow] of cases) {
      const result = await call(method, path, {});
      assert.equal(result.status, 405, `${mode} ${method} ${path}`);
      assert.equal(result.headers.get('allow'), allow);
    }
    assert.deepEqual([...repo.refs], refs);
  });
});

test('malformed JSON, non-object bodies and malformed path encoding return 400 without writes', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    for (const path of [page, '/api/content/posts', '/api/content/updates', '/api/images', publication]) {
      const method = path === page ? 'PUT' : 'POST';
      for (const raw of ['{invalid', '', 'null', '[]', '"text"', '42', 'true']) {
        const result = await call(method, path, undefined, { raw });
        assert.equal(result.status, 400, `${mode} ${path} ${raw}`);
      }
    }
    for (const path of ['/api/content/library/bad%ZZ.mdx', '/api/images/file/bad%ZZ.gif', '/api/publish/library/bad%ZZ.mdx', '/api/publication-status/library/bad%ZZ.mdx']) {
      assert.equal((await call('GET', path)).status, 400, path);
    }
    assert.deepEqual([...repo.refs], refs);
  });
});

test('both handlers reject malformed base64 with 400 and retain valid encoding support', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    const input = { area: 'library', documentFilename: 'report.mdx', filename: 'map.gif', mimeType: 'image/gif' };
    for (const content of [gif.toString('base64') + '!!', 'a', 'R0lG=ODlh', 'R0lGODlh_', 'data:image/gif;base64,R0lGODlh', null, 123, [], {}]) {
      const result = await call('POST', '/api/images', { ...input, content });
      assert.equal(result.status, 400, `${mode} invalid base64 ${JSON.stringify(content)}`);
    }
    // Optional padding and whitespace are already accepted by the shared decoder.
    for (const content of ['R0lGODlh', ' R0lG\nODlh\t', 'R0lGODlhIQ==', 'R0lGODlhIQ']) {
      const result = await call('POST', '/api/images', { ...input, content });
      assert.equal(result.status, 201, `${mode} valid base64 ${content}`);
    }
    assert.deepEqual([...repo.refs], refs);
  });
});

test('genuine internal syntax, URI and type errors remain server errors after valid input parsing', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const loaded = (await call('GET', page)).body, refs = [...repo.refs];
    for (const ErrorType of [SyntaxError, URIError, TypeError]) {
      repo.request = async () => { throw new ErrorType('Simulated internal failure'); };
      const result = await call('PUT', page, { ...loaded, body: 'Valid input.' });
      assert.equal(result.status, 500, `${mode} ${ErrorType.name}`);
    }
    assert.deepEqual([...repo.refs], refs);
  });
});

test('review reproduction: local envelope cap has no matching hosted handler-level guard', async () => {
  const raw = ' '.repeat(28_000_001) + '{}';
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    const result = await call('POST', '/api/images', undefined, { raw });
    assert.equal(result.status, mode === 'local' ? 413 : 400);
    assert.deepEqual([...repo.refs], refs);
  });
});


test('intentional difference: local CLI requests may omit Origin; hosted mutations may not', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const loaded = (await call('GET', page)).body;
    const refs = [...repo.refs];
    const result = await call('PUT', page, { ...loaded, body: 'Originless local edit.' }, { origin: null });
    assert.equal(result.status, mode === 'local' ? 200 : 403);
    if (mode === 'hosted') assert.deepEqual([...repo.refs], refs);
    else assert.notDeepEqual([...repo.refs], refs);
  });
});

test('intentional difference: hosted sessions expire at eight hours without sliding renewal; local session remains synthetic', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs], now = Date.now, start = now();
    try {
      Date.now = () => start + 7 * 60 * 60 * 1000;
      const active = await call('GET', '/api/session');
      assert.equal(active.body.authenticated, true);
      assert.equal(active.headers.get('set-cookie'), null, 'session reads do not extend expiry');
      Date.now = () => start + 9 * 60 * 60 * 1000;
      const expired = await call('GET', '/api/session');
      assert.equal(expired.status, 200);
      assert.equal(expired.body.authenticated, mode === 'local');
      const document = await call('GET', page);
      assert.equal(document.status, mode === 'local' ? 200 : 401);
      if (mode === 'hosted') {
        assert.match(expired.headers.get('set-cookie'), /Max-Age=0/);
        assert.match(document.body.signInUrl, /^\/api\/auth\/login/);
      }
      assert.deepEqual([...repo.refs], refs);
    } finally { Date.now = now; }
  });
});

test('intentional difference: hosted logout clears cookies; local logout does not revoke the configured token', async () => {
  for (const mode of ['local', 'hosted']) await exercise(mode, async ({ call, repo }) => {
    const refs = [...repo.refs];
    const logout = await call('POST', '/api/auth/logout');
    assert.equal(logout.status, 200); assert.deepEqual(logout.body, { ok: true });
    const session = await call('GET', '/api/session', undefined, { cookie: '' });
    assert.equal(session.body.authenticated, mode === 'local');
    assert.deepEqual([...repo.refs], refs);
    if (mode === 'hosted') assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    else assert.equal(logout.headers.get('set-cookie'), null);
  });
});

test('local OPTIONS safely handles absent and allowed origins while rejecting disallowed origins', async () => {
  const server = createEditorServer({});
  const listener = server.listeners('request')[0];
  for (const origin of [undefined, 'http://localhost:4321', 'https://untrusted.example']) {
    let status, headers, ended = false;
    await Promise.resolve(listener({ method: 'OPTIONS', headers: origin ? { origin } : {} }, {
      writeHead(value, fields) {
        for (const [name, value] of Object.entries(fields)) validateHeaderValue(name, value);
        status = value; headers = fields;
      },
      end() { ended = true; },
    }));
    assert.equal(ended, true);
    assert.equal(status, origin === 'https://untrusted.example' ? 403 : 204);
    assert.equal(headers['Access-Control-Allow-Origin'], origin === 'http://localhost:4321' ? origin : undefined);
  }
});

test('real local HTTP server returns valid preflight, method and JSON responses', async () => {
  const repo = await draftTestRepository({ 'src/content/docs/library/report.mdx': original });
  const server = createEditorServer(createGitHubClient({ token: 'mock-token', fetchImpl: repo.fetchImpl }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const origin of [null, 'http://localhost:4321', 'https://untrusted.example']) {
      const response = await fetch(base + '/api/content', { method: 'OPTIONS', headers: origin ? { Origin: origin } : {} });
      assert.equal(response.status, origin === 'https://untrusted.example' ? 403 : 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin === 'http://localhost:4321' ? origin : null);
      await response.text();
    }
    assert.equal(repo.requests.length, 0, 'preflights never reach GitHub');
    const method = await fetch(base + '/api/content', { method: 'POST' });
    assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'GET');
    await method.text();
    const malformed = await fetch(base + page, { method: 'PUT', body: '{invalid' });
    assert.equal(malformed.status, 400); await malformed.text();
    const loaded = await (await fetch(base + page)).json();
    const saved = await fetch(base + page, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...loaded, title: 'Café — 東京' }) });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).title, 'Café — 東京');
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

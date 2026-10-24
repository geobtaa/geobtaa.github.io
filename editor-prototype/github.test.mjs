import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubClient, GitHubConflictError } from './github.mjs';
import { newProject, parseContent, parseProject, serializeContent, serializeProject } from './content.mjs';

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('sends the loaded SHA and reports a stale-SHA conflict', async () => {
  const requests = [];
  const client = createGitHubClient({ token: 'server-only', fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes('/git/ref/heads/')) return response(200, { object: { sha: 'branch-sha' } });
    return response(409, { message: 'sha does not match' });
  }});
  await assert.rejects(
    client.saveProject({ filename: 'test.mdx', content: 'body', sha: 'loaded-sha', publish: false }),
    (error) => error instanceof GitHubConflictError && /changed in GitHub/.test(error.message),
  );
  const payload = JSON.parse(requests.at(-1).options.body);
  assert.equal(payload.sha, 'loaded-sha');
  assert.equal(payload.branch, 'custom-cms');
});

test('draft, reload, publish, create, and stale-SHA workflow', async () => {
  let branchExists = false;
  let counter = 1;
  const mainFiles = new Map([['existing.mdx', { sha: 'sha-1', content: newProject({ title: 'Existing', description: 'Description', draft: false, body: 'Original body.' }) }]]);
  let branchFiles = new Map();
  const commits = [];
  const fakeFetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/git/ref/heads/custom-cms')) return branchExists ? response(200, { object: { sha: 'branch-head' } }) : response(404, { message: 'Not Found' });
    if (pathname.endsWith('/git/ref/heads/main')) return response(200, { object: { sha: 'main-head' } });
    if (pathname.endsWith('/git/refs') && method === 'POST') { branchExists = true; branchFiles = new Map(mainFiles); return response(201, { object: { sha: 'branch-head' } }); }
    const contentsAt = pathname.indexOf('/contents/src/content/docs/projects');
    if (contentsAt !== -1) {
      const filename = decodeURIComponent(pathname.slice(contentsAt + '/contents/src/content/docs/projects'.length).replace(/^\//, ''));
      const files = branchExists ? branchFiles : mainFiles;
      if (!filename && method === 'GET') return response(200, [...files].map(([name, file]) => ({ name, path: `src/content/docs/projects/${name}`, type: 'file', sha: file.sha })));
      if (method === 'GET') {
        const file = files.get(filename);
        return file ? response(200, { name: filename, sha: file.sha, content: Buffer.from(file.content).toString('base64') }) : response(404, { message: 'Not Found' });
      }
      const payload = JSON.parse(options.body);
      const current = branchFiles.get(filename);
      if (current && payload.sha !== current.sha) return response(409, { message: 'sha does not match' });
      const sha = `sha-${++counter}`;
      const content = Buffer.from(payload.content, 'base64').toString('utf8');
      branchFiles.set(filename, { sha, content }); commits.push(payload.message);
      return response(200, { content: { sha }, commit: { sha: `commit-${counter}` } });
    }
    return response(500, { message: `Unhandled ${method} ${pathname}` });
  };
  const client = createGitHubClient({ token: 'server-only', fetchImpl: fakeFetch });

  const initial = await client.getProject('existing.mdx');
  const edited = serializeProject(initial.content, { ...parseProject(initial.content), draft: true, body: 'Several changed words.' });
  const draft = await client.saveProject({ filename: 'existing.mdx', content: edited, sha: initial.sha, publish: false });
  const reloaded = await client.getProject('existing.mdx');
  assert.equal(reloaded.sha, draft.sha);
  assert.deepEqual(parseProject(reloaded.content), { title: 'Existing', description: 'Description', draft: true, body: 'Several changed words.' });

  const publishedContent = serializeProject(reloaded.content, { ...parseProject(reloaded.content), draft: false });
  await client.saveProject({ filename: 'existing.mdx', content: publishedContent, sha: reloaded.sha, publish: true });
  assert.equal(parseProject((await client.getProject('existing.mdx')).content).draft, false);

  const createdContent = newProject({ title: 'New Project', description: 'New description', draft: true, body: 'New body.' });
  const created = await client.saveProject({ filename: 'new-project.mdx', content: createdContent, publish: false });
  assert.equal(parseProject((await client.getProject('new-project.mdx')).content).body, 'New body.');

  branchFiles.set('new-project.mdx', { sha: 'external-sha', content: createdContent });
  await assert.rejects(client.saveProject({ filename: 'new-project.mdx', content: createdContent, sha: created.sha, publish: true }), GitHubConflictError);
  assert.deepEqual(commits.slice(0, 3), ['Save draft project: existing.mdx', 'Publish project: existing.mdx', 'Save draft project: new-project.mdx']);
});

test('an enabled non-Project entry saves and reloads in its own directory', async () => {
  let stored = { sha: 'library-sha-1', content: '---\ntitle: Report\ndescription: Summary\nyear: 2025\n---\n\nOriginal.' };
  const requests = [];
  const client = createGitHubClient({ token: 'server-only', fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });
    const method = options.method || 'GET';
    if (url.includes('/git/ref/heads/custom-cms')) return response(200, { object: { sha: 'branch-sha' } });
    if (url.includes('/contents/src/content/docs/library/report.mdx')) {
      if (method === 'GET') return response(200, { sha: stored.sha, content: Buffer.from(stored.content).toString('base64') });
      const input = JSON.parse(options.body);
      assert.equal(input.sha, stored.sha);
      stored = { sha: 'library-sha-2', content: Buffer.from(input.content, 'base64').toString('utf8') };
      return response(200, { content: { sha: stored.sha }, commit: { sha: 'library-commit' } });
    }
    return response(500, { message: `Unhandled ${method} ${url}` });
  }});

  const loaded = await client.getContent('library', 'report.mdx');
  const edited = serializeContent(loaded.content, { ...parseContent(loaded.content), body: 'Edited.' }, { description: true });
  const saved = await client.saveContent({ area: 'library', filename: 'report.mdx', content: edited, sha: loaded.sha, publish: false });
  const reloaded = await client.getContent('library', 'report.mdx');
  assert.equal(saved.sha, 'library-sha-2');
  assert.equal(parseContent(reloaded.content).body, 'Edited.');
  const write = requests.find((item) => item.options.method === 'PUT');
  assert.equal(JSON.parse(write.options.body).message, 'Update library: report.mdx');
});

test('uploads an image as a new custom-cms GitHub file without a replacement SHA', async () => {
  const requests = [];
  const client = createGitHubClient({ token: 'server-only', fetchImpl: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes('/git/ref/heads/custom-cms')) return response(200, { object: { sha: 'branch-sha' } });
    if (url.includes('/contents/src/assets/images/new-map.png') && options.method === 'PUT') return response(200, { content: { sha: 'image-sha' }, commit: { sha: 'image-commit' } });
    return response(500, { message: `Unhandled ${options.method || 'GET'} ${url}` });
  }});
  const result = await client.uploadImage({ filename: 'new-map.png', bytes: Uint8Array.from([1, 2, 3]) });
  assert.deepEqual(result, { path: 'new-map.png', sha: 'image-sha', commitSha: 'image-commit', branch: 'custom-cms' });
  const write = requests.find((item) => item.options.method === 'PUT');
  const payload = JSON.parse(write.options.body);
  assert.equal(payload.branch, 'custom-cms');
  assert.equal(payload.sha, undefined);
  assert.equal(Buffer.from(payload.content, 'base64').toString('hex'), '010203');
});

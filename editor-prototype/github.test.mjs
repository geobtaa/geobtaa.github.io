import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubClient, GitHubConflictError } from './github.mjs';
import { newProject, parseProject, serializeProject } from './content.mjs';

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
  assert.equal(payload.branch, 'editor-prototype');
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
    if (pathname.endsWith('/git/ref/heads/editor-prototype')) return branchExists ? response(200, { object: { sha: 'branch-head' } }) : response(404, { message: 'Not Found' });
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

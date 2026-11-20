import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore, prepareDraftImage } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';
const area = 'library', filename = 'old.mdx', path = 'src/content/docs/library/old.mdx';
const original = '---\r\ntitle: Older page\r\npagefind: false # Keep this\r\nsidebar:\r\n  hidden: true\r\ncustom: preserve\r\n---\r\n\r\nOriginal **body**.\r\n';
async function fixture() {
 const repo = await draftTestRepository({ [path]: original, 'navigation.groups.json': '[]' });
 const store = () => createDraftStore({ request: repo.request });
 const opened = await store().getContent(area, filename);
 const input = { area, filename, expectedSha: opened.sha, expectedHead: opened.head };
 return { repo, store, opened, input };
}
test('confirmed initialization copies exact saved bytes, is retryable, and uses the existing immutable unpublish workflow', async t => {
 const f = await fixture(); const main = f.repo.refs.get('refs/heads/main');
 const start = f.repo.requests.length;
 const prepared = await f.store().initializeUnpublish(f.input);
 const count = f.repo.requests.length - start; t.diagnostic(`initializer GitHub calls: ${count}`); assert.ok(count < 47);
 assert.equal(prepared.document.content, original); assert.equal(prepared.document.hasDraft, true);
 assert.equal(f.repo.refs.get('refs/heads/main'), main); assert.equal(f.repo.pulls.length, 0);
 const refs = [...f.repo.refs]; const commits = f.repo.commits.size;
 const retried = await f.store().initializeUnpublish(f.input);
 assert.equal(retried.head, prepared.head); assert.deepEqual([...f.repo.refs], refs); assert.equal(f.repo.commits.size, commits);
 const client = () => publicationTestClient({ request: f.repo.request });
 await client().publishContent({ area, filename, head: prepared.head, action: 'unpublish' });
 const request = f.repo.pulls[0]; await client().verifyPublication(request.head.ref, request.head.sha);
 const recovered = await f.store().initializeUnpublish(f.input);
 assert.equal(recovered.head, prepared.head);
 await client().publishContent({ area, filename, head: recovered.head, action: 'unpublish' });
 assert.equal(f.repo.pulls.length, 1);
});
test('changed main, another editor, authorization, and navigation blockers stop without overwriting or creating a request', async () => {
 const changed = await fixture(); await changed.repo.put(path, original + 'Changed.'); const refs = [...changed.repo.refs];
 await assert.rejects(changed.store().initializeUnpublish(changed.input), { status: 409 }); assert.deepEqual([...changed.repo.refs], refs);
 const other = await fixture();
 const saved = await savePage(other.store(), area, filename, { ...other.opened, ...parsePage(original), body: 'Other editor work.' });
 const before = [...other.repo.refs]; await assert.rejects(other.store().initializeUnpublish(other.input), /another editor/);
 assert.deepEqual([...other.repo.refs], before); assert.match((await other.store().getContent(area, filename)).content, /Other editor work/);
 assert.equal(other.repo.refs.get(`refs/heads/${saved.branch}`), saved.head);
 for (const blocked of ['permission', 'policy', 'navigation']) {
  const f = await fixture();
  if (blocked === 'permission') f.repo.push = false;
  if (blocked === 'policy') f.repo.protection = {};
  if (blocked === 'navigation') await f.repo.put('navigation.groups.json', JSON.stringify([{ sidebar: [{ kind: 'link', label: 'Old page', link: '/library/old/' }] }]));
  const refs = [...f.repo.refs]; await assert.rejects(f.store().initializeUnpublish(f.input)); assert.deepEqual([...f.repo.refs], refs); assert.equal(f.repo.pulls.length, 0);
 }
});
test('concurrent initialization and an uncertain atomic response preserve one copy', async () => {
 const f = await fixture();
 const results = await Promise.allSettled([f.store().initializeUnpublish(f.input), f.store().initializeUnpublish(f.input)]);
 assert.ok(results.some(result => result.status === 'fulfilled'));
 const retry = await f.store().initializeUnpublish(f.input);
 const branches = [...f.repo.refs].filter(([name]) => name.startsWith('refs/heads/cms/drafts/'));
 assert.equal(branches.length, 1); assert.equal(branches[0][1], retry.head);
 const g = await fixture(); g.repo.fault = 'after';
 const saved = await g.store().initializeUnpublish(g.input);
 assert.equal(saved.document.content, original); assert.equal((await g.store().initializeUnpublish(g.input)).head, saved.head);
});
test('initializer carries preserved editorial work into a successor without serializing it or losing uploads', async () => {
 const f = await fixture(), client = () => publicationTestClient({ request: f.repo.request });
 const saved = await savePage(client(), area, filename, { ...f.opened, ...parsePage(original), body: 'First version.' });
 await client().publishContent({ area, filename, head: saved.head });
 const pr = f.repo.pulls[0];
 const image = await prepareDraftImage({ area, documentFilename: filename, filename: 'later.gif', mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') });
 const later = await savePage(client(), area, filename, { ...saved, ...parsePage(saved.content), body: `Later saved work.\n\n![Map](@images/${image.path})`, assets: [{ filename: 'later.gif', mimeType: 'image/gif', content: image.content }] });
 const file = f.repo.filesAt(pr.head.sha).get(path), content = new TextDecoder().decode(f.repo.objects.get(file.sha));
 const sha = await f.repo.put(path, content); Object.assign(pr, { state: 'closed', merged_at: '2026-11-20T12:00:00Z', merge_commit_sha: sha });
 const reopened = await client().getContent(area, filename); assert.equal(reopened.hasDraft, false); assert.equal(reopened.preservedEdits, true);
 const input = { area, filename, expectedSha: reopened.sha, expectedHead: reopened.head, resumeHead: reopened.resumeHead };
 const prepared = await client().initializeUnpublish(input);
 assert.equal(f.repo.filesAt(prepared.head).get(`src/assets/images/${image.path}`).sha, f.repo.filesAt(later.head).get(`src/assets/images/${image.path}`).sha);
 assert.equal(prepared.document.content, reopened.content); assert.match(prepared.document.content, /Later saved work/);
 const refs = [...f.repo.refs];
 assert.equal((await client().initializeUnpublish(input)).head, prepared.head); assert.deepEqual([...f.repo.refs], refs);
 await client().publishContent({ area, filename, head: prepared.head, action: 'unpublish' });
 await client().verifyPublication(f.repo.pulls[1].head.ref, f.repo.pulls[1].head.sha);
 await savePage(client(), area, filename, { ...prepared.document, ...parsePage(prepared.document.content), body: 'Newer editorial work.' });
 const newer = [...f.repo.refs];
 await assert.rejects(client().initializeUnpublish(input), /another editor/); assert.deepEqual([...f.repo.refs], newer);
});

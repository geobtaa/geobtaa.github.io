import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTestRepository } from './draftTestRepository.mjs';
import { createDraftStore, prepareDraftImage } from './draftStorage.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';
import { patchFrontmatter } from './pageMetadata.mjs';
import { publicationContent, publicationAction } from './publicationAction.mjs';
import { draftLinkDestination, documentDraftRoutes, sidebarBlockers } from './publicationRoutes.mjs';
import { buildDeploymentMarker } from '../scripts/write-cms-deployment.mjs';
const area = 'library', filename = 'report.mdx', path = `src/content/docs/${area}/${filename}`;
const original = '---\r\ntitle: Report\r\npagefind: false\r\nsidebar:\r\n  hidden: true\r\ncustom: Keep\r\n---\r\n\r\nOriginal.\r\n';
async function fixture() {
 const repo = await draftTestRepository({ [path]: original, 'navigation.groups.json': '[]' });
 const store = () => publicationTestClient({ request: repo.request });
 const file = await store().getContent(area, filename);
 const saved = await savePage(store(), area, filename, { ...file, ...parsePage(file.content), body: 'Independent editorial work.' });
 const submit = (action, head = saved.head) => store().publishContent({ area, filename, head, action });
 const content = head => new TextDecoder().decode(repo.objects.get(repo.filesAt(head).get(path).sha));
 return { repo, store, saved, submit, content };
}
test('unpublish changes only main draft metadata, preserves editorial drafts, and republish carries saved work forward', async () => {
 const f = await fixture();
 const result = await f.submit('unpublish'); assert.equal(result.action, 'unpublish');
 const pr = f.repo.pulls[0];
 assert.equal(f.content(pr.head.sha), patchFrontmatter(original, { draft: true }));
 assert.equal(f.content(f.saved.head), f.saved.content);
 assert.equal(f.repo.refs.get(`refs/heads/${f.saved.branch}`), f.saved.head);
 await f.store().verifyPublication(pr.head.ref, pr.head.sha);
 await assert.rejects(f.submit('publish'), /owns this publication/);
 const image = await prepareDraftImage({ area, documentFilename: filename, filename: 'later.gif', mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') });
 const newer = await savePage(f.store(), area, filename, { ...f.saved, ...parsePage(f.saved.content), body: `Even newer saved work.\n\n![Later](@images/${image.path})`, assets: [{ filename: 'later.gif', mimeType: 'image/gif', content: image.content }] });
 assert.equal(f.repo.filesAt(pr.head.sha).has(`src/assets/images/${image.path}`), false);
 const merged = await f.repo.put(path, f.content(pr.head.sha));
 Object.assign(pr, { state: 'closed', merged_at: '2026-11-20T12:00:00Z', merge_commit_sha: merged });
 const reopened = await f.store().getContent(area, filename);
 assert.equal(reopened.preservedEdits, true); assert.match(reopened.content, /Even newer saved work/);
 assert.equal(parsePage(reopened.content).draft, true); assert.equal(reopened.resumeHead, newer.head);
 const resumed = await savePage(f.store(), area, filename, { ...reopened, ...parsePage(reopened.content) });
 const carriedStatus = await f.store().getPublicationStatus(area, filename);
 assert.equal(carriedStatus.state, 'merged'); assert.equal(carriedStatus.action, 'unpublish');
 assert.equal(carriedStatus.selectedHead, f.saved.head); assert.equal(carriedStatus.newerDraft, true);
 await f.submit('publish', resumed.head);
 const next = f.repo.pulls.at(-1); await f.store().verifyPublication(next.head.ref, next.head.sha);
 assert.equal(f.repo.filesAt(next.head.sha).get(`src/assets/images/${image.path}`).sha, f.repo.filesAt(newer.head).get(`src/assets/images/${image.path}`).sha);
 assert.match(f.content(next.head.sha), /Even newer saved work/); assert.equal(parsePage(f.content(next.head.sha)).draft, false);
 assert.match(f.content(next.head.sha), /pagefind: false/); assert.match(f.content(next.head.sha), /hidden: true/);
 const secondMerge = await f.repo.put(path, f.content(next.head.sha));
 for (const [asset, value] of f.repo.filesAt(next.head.sha)) if (asset.startsWith('src/assets/images/')) f.repo.filesAt(secondMerge).set(asset, value);
 Object.assign(next, { state: 'closed', merged_at: '2026-11-20T13:00:00Z', merge_commit_sha: secondMerge });
 const reopenedAgain = await f.store().getContent(area, filename);
 const third = await savePage(f.store(), area, filename, { ...reopenedAgain, ...parsePage(reopenedAgain.content) });
 await f.submit('unpublish', third.head);
 const thirdPR = f.repo.pulls.at(-1); await f.store().verifyPublication(thirdPR.head.ref, thirdPR.head.sha);
 assert.equal(f.repo.pulls.length, 3); assert.equal(parsePage(f.content(thirdPR.head.sha)).draft, true);
 assert.match(f.content(thirdPR.head.sha), /Even newer saved work/);
});
test('unpublish scope, action identity, sidebar blockers, stale target and unrelated-main refresh stay fail closed', async () => {
 const f = await fixture(); await f.submit('unpublish');
 await f.repo.put('unrelated.txt', 'new main');
 assert.equal((await f.store().getPublicationStatus(area, filename)).state, 'conflict');
 await f.submit('unpublish'); assert.equal(f.repo.pulls.length, 2); assert.equal(f.repo.pulls[0].state, 'closed');
 await f.store().verifyPublication(f.repo.pulls[1].head.ref, f.repo.pulls[1].head.sha);
 await f.repo.put(path, original + 'Changed main'); await assert.rejects(f.submit('unpublish'), /changed/);
 const g = await fixture(); await g.repo.put('navigation.groups.json', JSON.stringify([{ sidebar: [{ kind: 'group', items: [{ kind: 'link', label: 'Report', link: '/library/report/#section' }] }] }]));
 await assert.rejects(g.submit('unpublish'), /explicit navigation entry Report/); assert.equal(g.repo.pulls.length, 0);
 const h = await fixture();
 const prepared = await h.store().preparePublication({ area, filename, head: h.saved.head, action: 'unpublish' });
 await assert.rejects(createDraftStore({ request: h.repo.request }).publishContent({ area, filename, head: h.saved.head, action: 'unpublish', candidate: { content: prepared.content + 'Smuggled edit', assets: [] } }), /only the current main/);
 await h.submit('unpublish'); const pr = h.repo.pulls[0];
 const value = h.repo.commits.get(pr.head.sha); value.message = value.message.replace(',"action":"unpublish"', '');
 await assert.rejects(h.store().verifyPublication(pr.head.ref, pr.head.sha), /unexpected|identity|action/);
});
test('frontmatter action round trips preserve unrelated settings, CRLF, body, and reject invalid actions', () => {
 const hidden = publicationContent({ action: 'unpublish', original, saved: 'ignored' });
 assert.equal(hidden, patchFrontmatter(original, { draft: true }));
 assert.equal(publicationContent({ action: 'publish', saved: hidden }), patchFrontmatter(hidden, { draft: false }));
 assert.throws(() => publicationAction('delete')); assert.throws(() => publicationContent({ action: 'unpublish' }));
});
test('draft link route resolution is exact and does not excuse other link policy failures', () => {
 const routes = documentDraftRoutes([{ filename: 'guides/nested/index.md', content: '---\ntitle: Hidden\nslug: custom/space%20here\ndraft: true\n---\n' }]);
 assert.deepEqual([...routes], ['custom/space here']);
 assert.equal(draftLinkDestination('/custom/space%20here/#section'), [...routes][0]);
 assert.equal(draftLinkDestination('/cafe%CC%81/'), 'café');
 assert.equal(draftLinkDestination('/a%2Fb/'), 'a%2Fb');
 for (const url of ['/guides/nested/', '/guides/nested#part', '/guides/nested/?x=1', '/guides//nested/']) assert.equal(draftLinkDestination(url), 'guides/nested');
 for (const url of ['../guides/nested/', '//evil.test/guides/nested', 'https://evil.test/guides/nested', '/%zz', '/guides/nested/#%zz', '/guides/nested/?x=%zz', '/%C0%AF', '/a/../guides/nested', '/a/%2e%2e/guides/nested', '/a\\b', '#section', '?x=1', '/wrong path/']) assert.equal(draftLinkDestination(url), null, url);
 assert.equal(draftLinkDestination('/guides/nested-more/'), 'guides/nested-more');
 assert.deepEqual(sidebarBlockers([{ sidebar: [{ kind: 'autogenerate', directory: 'guides' }, { kind: 'link', link: '/guides/nested/', label: 'Hidden' }] }], 'guides/nested'), ['Hidden']);
 assert.throws(() => sidebarBlockers([{ sidebar: [{ slug: 'guides/nested' }] }], 'guides/nested'));
});
test('marker explicitly records draft exclusion and rejects unexpected rendered output', async () => {
 const options = { sha: 'a'.repeat(40), runId: 1, runAttempt: 1, repository: 'geobtaa/geobtaa.github.io', files: [{ path, mode: '100644', type: 'blob', sha: 'b'.repeat(40) }], readSource: async () => patchFrontmatter(original, { draft: true }) };
 const marker = await buildDeploymentMarker({ ...options, readOutput: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } });
 assert.equal(marker.version, 2); assert.deepEqual(marker.documents[path], { draft: true, blob: 'b'.repeat(40), route: 'library/report' });
 await assert.rejects(buildDeploymentMarker({ ...options, readOutput: async () => Buffer.from('unexpected') }), /unexpectedly rendered/);
 await assert.rejects(buildDeploymentMarker({ ...options, readOutput: async () => { throw new Error('Read failed'); } }), /Read failed/);
});

test('visible link warnings are exact, deduplicated, and never suppress links to other pages or assets', async () => {
 const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
 const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
 const { pathToFileURL } = await import('node:url'); const { draftLinkWarnings } = await import('../scripts/draft-link-warnings.mjs');
 const directory = await mkdtemp(join(tmpdir(), 'draft-warning-routes-'));
 try {
  await mkdir(join(directory, 'src/content/docs/guides/nested'), { recursive: true });
  await mkdir(join(directory, 'src/pages'), { recursive: true });
  await writeFile(join(directory, 'src/content/docs/guides/nested/index.md'), '---\ntitle: Hidden\ndraft: true\nslug: guides/custom-alias\n---\n');
  const warnings = [];
  const exclude = await draftLinkWarnings({ root: pathToFileURL(directory + '/'), groups: [], warn: value => warnings.push(value) });
  for (const link of ['/guides/custom-alias/', '/guides/custom-alias/#section', '/guides/custom-alias/?x=1']) assert.equal(exclude({ file: '/source.md', link }), true);
  exclude({ file: '/source.md', link: '/guides/custom-alias/' });
  assert.equal(warnings.length, 3); assert.match(warnings[0], /source.md.*custom-alias/);
  for (const link of ['/guides/nested/', '/guides/custom-alias-more/', '/guides/custom-alias/file.png', '/other-page/#bad-anchor', '/guides/custom-alias/#%zz', '../custom-alias/']) assert.equal(exclude({ file: '/source.md', link }), false, link);
  await writeFile(join(directory, 'src/pages/other.astro'), 'Custom page');
  await writeFile(join(directory, 'src/content/docs/guides/nested/index.md'), '---\ntitle: Hidden\ndraft: true\nslug: other\n---\n');
  await assert.rejects(draftLinkWarnings({ root: pathToFileURL(directory + '/'), groups: [] }), /custom page/);
 } finally { await rm(directory, { recursive: true, force: true }); }
});

import { publicationTestClient } from './publicationTestHelpers.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareDraftImage } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';
const filename = 'report.mdx', path = `src/content/docs/library/${filename}`;
const original = '---\ntitle: Report\n---\n\nOriginal.\n';
async function fixture({ initial = original, body = 'Selected revision.' } = {}) {
  const repo = await draftTestRepository(initial ? { [path]: initial } : {});
  const store = () => publicationTestClient({ request: repo.request });
  const file = initial ? await store().getContent('library', filename) : {};
  const saved = await savePage(store(), 'library', filename, { ...file, ...(initial ? parsePage(file.content) : { title: 'Report', description: '' }), body });
  const publish = (head = saved.head) => store().publishContent({ area: 'library', filename, head });
  return { repo, store, saved, publish };
}
test('publication is a one-document snapshot on fresh main, not a draft merge, with a manual-merge PR', async () => {
  const { repo, saved, publish } = await fixture();
  const main = await repo.put('application.js', 'New application on main');
  const result = await publish();
  assert.equal(result.state, 'pr-open');
  const pr = repo.pulls[0], commit = repo.commits.get(pr.head.sha);
  assert.deepEqual(commit.parents, [{ sha: main }]);
  assert.notEqual(commit.parents[0].sha, saved.head);
  assert.equal(repo.refs.get('refs/heads/main'), main);
  assert.equal(repo.filesAt(pr.head.sha).get('application.js').sha, repo.filesAt(main).get('application.js').sha);
  const doc = new TextDecoder().decode(repo.objects.get(repo.filesAt(pr.head.sha).get(path).sha));
  assert.match(doc, /draft: false/);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), saved.head);
  assert.match(commit.message, /\[CF-Pages-Skip\]/);
  assert.match(commit.message, /^\[CF-Pages-Skip\] Publish: Report\n/);
  const request = JSON.parse(repo.requests.find(call => call.path === '/pulls' && call.method === 'POST').body);
  assert.equal(request.title, 'Publish: Report');
  assert.equal(request.body, `Publishes saved changes to this page through the CMS.\n\nPage: [library/report.mdx](https://github.com/geobtaa/geobtaa.github.io/blob/${pr.head.sha}/${path})`);
  assert.equal(repo.pulls[0].auto_merge, undefined);
  assert.equal(repo.requests.some(call => call.body?.includes('enablePullRequestAutoMerge')), false);
  await publicationTestClient({ request: repo.request }).verifyPublication(pr.head.ref, pr.head.sha);
});
test('publication names the selected page even when a newer draft has a different title', async () => {
  const { repo, store, saved, publish } = await fixture({ initial: '---\ntitle: |\n  Annual\n  report\n---\n\nOriginal.\n' });
  await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), title: 'Future report' });
  await publish();
  const request = JSON.parse(repo.requests.find(call => call.path === '/pulls' && call.method === 'POST').body);
  assert.equal(request.title, 'Publish: Annual report');
});
test('duplicate, concurrent and closed/merged publication requests reuse exactly one PR', async () => {
  const { repo, publish } = await fixture();
  const results = await Promise.all([publish(), publish()]);
  assert.equal(results[0].number, results[1].number);
  assert.equal(repo.pulls.length, 1);
  repo.pulls[0].state = 'closed'; repo.pulls[0].merged_at = '2026-11-18T00:00:00Z';
  await repo.put(path, original + 'Published externally.');
  assert.equal((await publish()).state, 'merged');
  assert.equal(repo.pulls.length, 1);
});
test('a competing publication revision is blocked without changing either saved draft', async () => {
  const { repo, store, saved, publish } = await fixture();
  await publish();
  const second = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: 'Newer edits.' });
  await assert.rejects(publish(second.head), { status: 409 });
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), second.head);
  assert.equal(repo.pulls.length, 1);
  assert.equal((await publish()).number, 1);
});
test('publication rejects changed main, invalid revision, route collisions, and protected MDX changes', async () => {
  const a = await fixture(); await a.repo.put(path, original + 'Concurrent main revision.');
  await assert.rejects(a.publish(), { status: 409 }); assert.equal(a.repo.pulls.length, 0);
  await assert.rejects(a.publish('bogus'), { status: 400 });
  const b = await fixture(); await b.repo.put('src/content/docs/library/report.md', original);
  await b.publish();
  await assert.rejects(b.store().verifyPublication(b.repo.pulls[0].head.ref, b.repo.pulls[0].head.sha), /claimed|route|URL/);
  const c = await fixture();
  const head = await c.repo.put(path, original + '<script>danger()</script>\n', { branch: c.saved.branch });
  await c.publish(head);
  await assert.rejects(c.store().verifyPublication(c.repo.pulls[0].head.ref, c.repo.pulls[0].head.sha), /unsupported|read-only|MDX/);
});
test('new documents publish; only referenced verified image assets enter the snapshot', async () => {
  const { repo, store, saved, publish } = await fixture({ initial: null });
  const bytes = new TextEncoder().encode('GIF89a');
  const image = await prepareDraftImage({ area: 'library', documentFilename: filename, filename: 'map.gif', mimeType: 'image/gif', bytes });
  const next = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: `![Map](@images/${image.path})`, assets: [{ filename: 'map.gif', mimeType: 'image/gif', content: image.content }] });
  await publish(next.head);
  assert.equal(repo.filesAt(repo.pulls[0].head.sha).has(`src/assets/images/${image.path}`), true);
  assert.equal(repo.filesAt('refs/heads/main').has(path), false);
  const unused = await fixture({ initial: null });
  const upload = await savePage(unused.store(), 'library', filename, { ...unused.saved, ...parsePage(unused.saved.content), body: `![Map](@images/${image.path})`, assets: [{ filename: 'map.gif', mimeType: 'image/gif', content: image.content }] });
  const removed = await savePage(unused.store(), 'library', filename, { ...upload, ...parsePage(upload.content), body: 'No image.' });
  await unused.publish(removed.head);
  assert.equal(unused.repo.filesAt(unused.repo.pulls[0].head.sha).has(`src/assets/images/${image.path}`), false);
});
test('scope validation rejects added files, image tampering, and externally advanced immutable snapshot heads', async () => {
  for (const extra of ['application.js', 'src/assets/images/unauthorized.gif', 'src/content/docs/library/other.mdx']) {
    const { repo, store, publish } = await fixture(); await publish();
    const pr = repo.pulls[0];
    const changed = await repo.put(extra, 'Unauthorized', { branch: pr.head.ref });
    await assert.rejects(store().verifyPublication(pr.head.ref, changed), { status: 409 });
    await assert.rejects(publish(), { status: 409 });
  }
});
test('uncertain ref responses retain recoverable snapshots and drafts without requesting auto-merge', async () => {
  const { repo, saved, publish } = await fixture(); repo.fault = 'after'; repo.autoMergeFailure = true;
  const response = await publish();
  assert.equal(response.state, 'pr-open');
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), saved.head);
  repo.autoMergeFailure = false;
  assert.equal((await publish()).state, 'pr-open'); assert.equal(repo.pulls.length, 1);
});

test('an older selected revision publishes without including or overwriting a newer working revision', async () => {
  const { repo, store, saved, publish } = await fixture();
  const newer = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: 'Keep this newer draft.' });
  await publish();
  const snapshot = repo.filesAt(repo.pulls[0].head.sha).get(path);
  assert.match(new TextDecoder().decode(repo.objects.get(snapshot.sha)), /Selected revision/);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), newer.head);
});
test('auto-merge is never requested when required protection is absent or not strict', async () => {
  for (const protection of [{}, { required_status_checks: { strict: false, contexts: ['validate', 'cms-publication-scope'] } }]) {
    const { repo, publish } = await fixture(); repo.protection = protection;
    await assert.rejects(publish(), /policy blocked/);
    assert.equal(repo.requests.some(item => item.body?.includes('mutation CMSPublish')), false);
  }
});
test('a lost PR creation response recovers its existing PR without making a duplicate', async () => {
  const { repo, saved } = await fixture();
  let lost = false;
  const store = publicationTestClient({ request: async (path, options) => {
    const result = await repo.request(path, options);
    if (path === '/pulls' && !lost) { lost = true; throw new Error('Connection lost after PR created'); }
    return result;
  } });
  assert.equal((await store.publishContent({ area: 'library', filename, head: saved.head })).state, 'pr-open');
  assert.equal(repo.pulls.length, 1);
});
test('the scope checker compares the entire actual snapshot tree, not metadata alone', async () => {
  const { repo, store, publish } = await fixture(); await publish();
  const pr = repo.pulls[0], commit = repo.commits.get(pr.head.sha);
  const tree = await repo.request('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree: [{ path: 'application.js', mode: '100644', type: 'blob', content: 'Injected' }] }) });
  const injected = await repo.request('/git/commits', { method: 'POST', body: JSON.stringify({ tree: tree.sha, parents: commit.parents.map(parent => parent.sha), message: commit.message }) });
  await assert.rejects(store().verifyPublication(pr.head.ref, injected.sha), /unexpected content or assets/);
});
test('main moving during snapshot creation stops before creating a PR', async () => {
  const { repo, saved } = await fixture(); let moved = false;
  const store = publicationTestClient({ request: async (path, options) => {
    const result = await repo.request(path, options);
    if (path === '/git/commits' && !moved) { moved = true; await repo.put('unrelated.js', 'Concurrent main update'); }
    return result;
  } });
  await assert.rejects(store.publishContent({ area: 'library', filename, head: saved.head }), { status: 409 });
  assert.equal(repo.pulls.length, 0);
});

test('required CI rejects unverified image dependencies and protected frontmatter in candidate PRs', async () => {
  for (const content of [original + '![Missing](@images/missing.gif)\n', original + '![Unknown](./unverified.gif)\n', original.replace('title: Report', 'title: Report\nhead:\n  - tag: script\n    content: alert(1)')]) {
    const { repo, saved, publish } = await fixture();
    const head = await repo.put(path, content, { branch: saved.branch });
    await publish(head);
    const pr = repo.pulls[0];
    await assert.rejects(publicationTestClient({ request: repo.request }).verifyPublication(pr.head.ref, pr.head.sha), /image|frontmatter/);
    assert.equal(repo.pulls.length, 1);
    assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), head);
  }
});

test('concurrent requests for different revisions elect only one snapshot and PR', async () => {
  const { repo, store, saved, publish } = await fixture();
  const next = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: 'Other revision.' });
  const results = await Promise.allSettled([publish(), publish(next.head)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.find(item => item.status === 'rejected').reason.status, 409);
  assert.equal(repo.pulls.length, 1);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), next.head);
});
test('a new production asset at the same immutable path cannot be overwritten by publication', async () => {
  const { repo, store, saved, publish } = await fixture();
  const image = await prepareDraftImage({ area: 'library', documentFilename: filename, filename: 'map.gif', mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') });
  const next = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: `![Map](@images/${image.path})`, assets: [{ filename: 'map.gif', mimeType: 'image/gif', content: image.content }] });
  await repo.put(`src/assets/images/${image.path}`, 'Different production bytes');
  await assert.rejects(publish(next.head), /production image conflicts/);
  assert.equal(repo.pulls.length, 0);
});

test('unrelated main changes replace the immutable attempt and retire the earlier PR without changing the selected revision', async () => {
  const { repo, store, saved, publish } = await fixture(); await publish();
  const first = structuredClone(repo.pulls[0]), oldHead = repo.refs.get(`refs/heads/${first.head.ref}`);
  const newer = await savePage(store(), 'library', filename, { ...saved, ...parsePage(saved.content), body: 'Unsaved by publication, newer working revision.' });
  const main = await repo.put('unrelated.js', 'Latest main');
  assert.equal((await publish()).state, 'pr-open');
  assert.equal(repo.pulls[0].state, 'closed'); assert.equal(repo.pulls.length, 2);
  const second = repo.pulls[1];
  assert.deepEqual(repo.commits.get(second.head.sha).parents, [{ sha: main }]);
  assert.equal(repo.refs.get(`refs/heads/${first.head.ref}`), oldHead);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), newer.head);
  assert.equal((await publish()).number, second.number);
  assert.equal(repo.pulls.length, 2);
  await assert.rejects(store().verifyPublication(first.head.ref, first.head.sha), /current main|superseded/);
});
test('same-document changes never retire a PR or rebuild a different revision', async () => {
  const { repo, publish } = await fixture(); await publish();
  await repo.put(path, original + 'Competing main edit.');
  await assert.rejects(publish(), /public document changed/);
  assert.equal(repo.pulls[0].state, 'open'); assert.equal(repo.pulls.length, 1);
});
test('closed attempts and abandoned reservations recover using retained locks, including concurrent retries', async () => {
  const { repo, saved, publish } = await fixture(); await publish();
  const locks = [...repo.refs].filter(([name]) => name.startsWith('refs/tags/'));
  repo.pulls[0].state = 'closed';
  const responses = await Promise.all([publish(), publish()]);
  assert.equal(responses[0].number, responses[1].number); assert.equal(repo.pulls.length, 2);
  assert.deepEqual([...repo.refs].filter(([name]) => name.startsWith('refs/tags/')), locks);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), saved.head);
  const other = await fixture(); let rejectPR = true;
  const store = () => publicationTestClient({ request: (path, options) => { if (path === '/pulls' && rejectPR) throw new Error('Connection failed before PR creation'); return other.repo.request(path, options); } });
  await assert.rejects(store().publishContent({ area: 'library', filename, head: other.saved.head }));
  rejectPR = false;
  assert.equal((await store().publishContent({ area: 'library', filename, head: other.saved.head })).state, 'pr-open');
  assert.equal(other.repo.pulls.length, 1);
});
test('uncertain retirement blocks replacement; a merge winning the close race is terminal', async () => {
  for (const merge of [false, true]) {
    const { repo, saved, publish } = await fixture(); await publish(); await repo.put('unrelated.js', 'New main');
    const store = publicationTestClient({ request: async (path, options) => {
      if (options?.method === 'PATCH') {
        if (merge) { repo.pulls[0].merged_at = '2026-11-17T00:00:00Z'; repo.pulls[0].state = 'closed'; }
        throw new Error('Close response lost');
      }
      return repo.request(path, options);
    } });
    if (merge) assert.equal((await store.publishContent({ area: 'library', filename, head: saved.head })).state, 'merged');
    else await assert.rejects(store.publishContent({ area: 'library', filename, head: saved.head }), /confirm retirement/);
    assert.equal(repo.pulls.length, 1);
  }
});
test('closed historical merge prevents another attempt even after main advances', async () => {
  const { repo, publish } = await fixture(); await publish(); repo.pulls[0].state = 'closed';
  await publish();
  repo.pulls[0].merged_at = '2026-11-17T00:00:00Z';
  await repo.put('another-file.js', 'New main');
  assert.equal((await publish()).state, 'merged'); assert.equal(repo.pulls.length, 2);
});
test('missing legacy coordinator, corrupt lock, and rewritten history fail closed', async () => {
  const { repo, saved, publish } = await fixture(); await publish();
  const stateRef = [...repo.refs.keys()].find(name => name.startsWith('refs/heads/cms/publication-state/'));
  const lock = [...repo.refs.keys()].find(name => name.startsWith('refs/tags/cms-publication-locks/'));
  const stateHead = repo.refs.get(stateRef);
  repo.refs.delete(stateRef);
  await assert.rejects(publish(), /legacy publication lock|another publication PR/i);
  repo.refs.set(stateRef, stateHead); repo.refs.set(lock, saved.head);
  await assert.rejects(publish(), /lock identity mismatch/);
});

test('a lost replacement reservation response recovers one new manual publication attempt', async () => {
  const { repo, saved, publish } = await fixture(); repo.autoMergeFailure = true;
  assert.equal((await publish()).state, 'pr-open');
  await repo.put('unrelated.js', 'Unrelated current main');
  repo.fault = 'after';
  assert.equal((await publish()).state, 'pr-open');
  assert.equal(repo.pulls.length, 2); assert.equal(repo.pulls[0].state, 'closed');
  repo.autoMergeFailure = false;
  assert.equal((await publish()).number, 2); assert.equal(repo.pulls.length, 2);
  assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), saved.head);
});
test('removed coordinator history cannot reset publication identity or hide an earlier attempt', async () => {
  const { repo, publish } = await fixture(); await publish(); repo.pulls[0].state = 'closed'; await publish();
  const stateRef = [...repo.refs.keys()].find(name => name.startsWith('refs/heads/cms/publication-state/'));
  const commit = repo.commits.get(repo.refs.get(stateRef));
  const marker = 'CMS-Publication-State-v1: ';
  const state = JSON.parse(commit.message.split(marker)[1]);
  state.attempts.shift(); state.attempts[0].attempt = 1;
  commit.message = commit.message.split(marker)[0] + marker + JSON.stringify(state);
  await assert.rejects(publish(), /history was rewritten/);
  assert.equal(repo.pulls.length, 2);
});

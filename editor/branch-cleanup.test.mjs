import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { createDraftStore, prepareDraftImage } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';

const area = 'library', filename = 'report.mdx', path = `src/content/docs/${area}/${filename}`;
const original = '---\ntitle: Report\ndraft: false\n---\n\nOriginal.';
const now = Date.parse('2026-11-25T12:00:00Z');
async function fixture(initial = original) {
  const repo = await draftTestRepository({ ...(initial ? { [path]: initial } : {}), 'navigation.groups.json': '[]' });
  let deployedHead = null;
  const runUrl = 'https://github.com/geobtaa/geobtaa.github.io/actions/runs/123';
  const request = async (url, options) => {
    if (url === '/actions/runs/123') return { repository: { full_name: 'geobtaa/geobtaa.github.io' }, path: '.github/workflows/astro.yml', head_sha: deployedHead, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, html_url: runUrl };
    if (url.startsWith('/deployments?')) return [{ id: 1, sha: deployedHead, environment: 'github-pages' }];
    if (url.startsWith('/deployments/1/statuses')) return [{ state: 'success', log_url: runUrl, environment_url: 'https://gin.btaa.org/' }];
    return repo.request(url, options);
  };
  const fetchPublic = async () => {
    if (!deployedHead) return new Response('', { status: 404 });
    const file = repo.filesAt(deployedHead).get(path), content = new TextDecoder().decode(repo.objects.get(file.sha));
    return Response.json({ version: 2, repository: 'geobtaa/geobtaa.github.io', environment: 'github-pages', workflow: '.github/workflows/astro.yml', sha: deployedHead, runId: 123, runAttempt: 1, documents: { [path]: { blob: file.sha, route: 'library/report', ...(parsePage(content).draft ? { draft: true } : {}) } } });
  };
  const store = () => publicationTestClient({ request, fetchPublic });
  const save = (file, body, extra = {}) => savePage(store(), area, filename, { ...file, ...(file.content ? parsePage(file.content) : { title: 'Report', description: '' }), body, ...extra });
  const saved = await save(initial ? await store().getContent(area, filename) : {}, 'Selected text.');
  const publish = async (file = saved, action = 'publish') => {
    await store().publishContent({ area, filename, head: file.head, action });
    const pr = repo.pulls.at(-1);
    await store().verifyPublication(pr.head.ref, pr.head.sha);
    return pr;
  };
  const merge = async pr => {
    const file = repo.filesAt(pr.head.sha).get(path);
    const sha = await repo.put(path, new TextDecoder().decode(repo.objects.get(file.sha)));
    for (const [key, value] of repo.filesAt(pr.head.sha)) if (key.startsWith('src/assets/images/')) repo.filesAt(sha).set(key, value);
    Object.assign(pr, { state: 'closed', merged_at: '2026-11-23T12:00:00Z', merge_commit_sha: sha });
    deployedHead = sha;
  };
  const cleanup = (options = {}) => createDraftStore({ request, fetchPublic }).cleanupPublishedDrafts({ area, filename, now, dryRun: false, ...options });
  return { repo, store, save, saved, publish, merge, cleanup, request, fetchPublic, setDeployment: head => { deployedHead = head; } };
}

test('dry run reports the complete chain; cleanup permits fresh editing and another publication', async () => {
  for (const initial of [original, null]) {
    const f = await fixture(initial), first = await f.publish(); await f.merge(first);
    const reopened = await f.store().getContent(area, filename);
    const second = await f.save(reopened, 'Second cycle.');
    const last = await f.publish(second); await f.merge(last);
    const before = [...f.repo.refs];
    const report = await f.cleanup({ dryRun: true });
    assert.equal(report.state, 'eligible');
    assert.equal(report.refs.filter(ref => ref.startsWith('refs/heads/')).length, 6);
    assert.deepEqual([...f.repo.refs], before);
    const main = f.repo.refs.get('refs/heads/main');
    assert.equal((await f.cleanup()).state, 'deleted');
    assert.equal(f.repo.refs.get('refs/heads/main'), main);
    assert.equal([...f.repo.refs.keys()].some(ref => ref.startsWith('refs/heads/cms/')), false);
    assert.equal([...f.repo.refs.keys()].some(ref => ref.startsWith('refs/tags/cms-publication-locks/')), false);
    assert.equal((await f.cleanup()).state, 'kept');
    const page = await f.store().getContent(area, filename);
    assert.equal(page.hasDraft, false); assert.equal(page.resumeHead, undefined);
    assert.equal((await f.store().listContent(area)).entries.find(item => item.name === filename).hasDraft, false);
    const next = await f.save(page, 'Third cycle after cleanup.');
    await f.publish(next);
    assert.equal(f.repo.pulls.length, 3);
  }
});

test('open, closed-unmerged and reserved requests never authorize cleanup', async () => {
  for (const state of ['open', 'closed', 'reserved']) {
    const f = await fixture(); const pr = await f.publish();
    if (state === 'closed') pr.state = 'closed';
    if (state === 'reserved') f.repo.pulls.length = 0;
    const before = [...f.repo.refs];
    assert.equal((await f.cleanup()).state, 'kept');
    assert.deepEqual([...f.repo.refs], before);
  }
});

test('cleanup needs no administration permission and only deletes verified CMS references', async () => {
  const f = await fixture(), pr = await f.publish(); await f.merge(pr);
  const store = createDraftStore({ fetchPublic: f.fetchPublic, request: (url, options) => {
    assert.equal(url.includes('/protection') || url.startsWith('/rules/'), false, 'GITHUB_TOKEN has no administration permission');
    return f.request(url, options);
  } });
  assert.equal((await store.cleanupPublishedDrafts({ area, filename, dryRun: false, now })).state, 'deleted');
  const mutation = JSON.parse(f.repo.requests.at(-1).body);
  assert.ok(mutation.variables.input.refUpdates.every(update => /^refs\/(?:heads\/cms\/(?:drafts|publish|publication-state)\/|tags\/cms-publication-locks\/)/.test(update.name) && update.afterOid === '0'.repeat(40) && update.force === false));
});

test('newer text and unpublished uploads survive an earlier revision merging', async () => {
  for (const newer of ['text', 'upload']) {
    const f = await fixture(), pr = await f.publish();
    if (newer === 'text') await f.save(f.saved, 'Keep this newer work.');
    else {
      const image = await prepareDraftImage({ area, documentFilename: filename, filename: 'map.gif', mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') });
      const uploaded = await f.save(f.saved, `![Map](@images/${image.path})`, { assets: [{ filename: 'map.gif', mimeType: 'image/gif', content: image.content }] });
      await f.save(uploaded, parsePage(f.saved.content).body); // unused upload still needs preservation
    }
    await f.merge(pr);
    const before = [...f.repo.refs];
    assert.equal((await f.cleanup()).state, 'kept');
    assert.deepEqual([...f.repo.refs], before);
  }
});

test('recovery window and externally changed main preserve every branch', async () => {
  for (const reason of ['recent', 'invalid date', 'main changed']) {
    const f = await fixture(), pr = await f.publish(); await f.merge(pr);
    if (reason === 'recent') pr.merged_at = new Date(now - 3_600_000).toISOString();
    if (reason === 'invalid date') pr.merged_at = 'unknown';
    if (reason === 'main changed') await f.repo.put(path, original + '\nOther published edits.');
    const before = [...f.repo.refs];
    assert.equal((await f.cleanup()).state, 'kept');
    assert.deepEqual([...f.repo.refs], before);
  }
});

test('pending or older production deployments keep publication status and recovery branches', async () => {
  for (const missing of [true, false]) {
    const f = await fixture(), oldMain = f.repo.refs.get('refs/heads/main');
    const pr = await f.publish(); await f.merge(pr);
    f.setDeployment(missing ? null : oldMain);
    const before = [...f.repo.refs];
    const result = await f.cleanup();
    assert.equal(result.state, 'kept');
    assert.match(result.reason, /live website/);
    assert.deepEqual([...f.repo.refs], before);
    assert.equal((await f.store().getPublicationStatus(area, filename)).state, 'merged');
  }
});

test('a concurrent save or continuation rejects the entire deletion transaction', async () => {
  for (const continuation of [true, false]) {
    const f = await fixture(), pr = await f.publish(); await f.merge(pr);
    const reopened = await f.store().getContent(area, filename);
    f.repo.beforeMutation = async () => {
      if (continuation) await f.save(reopened, 'Concurrent new cycle.');
      else await f.repo.put(path, f.saved.content + '\nConcurrent saved work.', { branch: f.saved.branch });
    };
    await assert.rejects(f.cleanup(), { status: 409 });
    assert.ok(f.repo.refs.has(`refs/heads/${pr.head.ref}`));
    assert.ok([...f.repo.refs.keys()].some(ref => ref.startsWith('refs/heads/cms/publication-state/')));
    assert.match((await f.store().getContent(area, filename)).content, /Concurrent/);
  }
});

test('lost deletion response is recoverable; stale browser saves cannot recreate an old continuation', async () => {
  const f = await fixture(), pr = await f.publish(); await f.merge(pr);
  const reopened = await f.store().getContent(area, filename);
  f.repo.fault = 'after';
  assert.equal((await f.cleanup()).state, 'deleted');
  assert.equal((await f.cleanup()).state, 'kept');
  const refs = [...f.repo.refs];
  await assert.rejects(f.save(reopened, 'Unsaved browser text.'), { status: 409 });
  await assert.rejects(f.save(f.saved, 'Stale pre-merge save.'), { status: 409 });
  assert.deepEqual([...f.repo.refs], refs);
  assert.equal((await f.store().getContent(area, filename)).hasDraft, false);
});

test('unavailable deletion readback can be retried without deleting another page', async () => {
  const f = await fixture(), pr = await f.publish(); await f.merge(pr);
  const other = await savePage(f.store(), area, 'other.mdx', { title: 'Other', description: '', body: 'Unpublished.' });
  f.repo.fault = 'unavailable-after';
  await assert.rejects(f.cleanup(), /Network unavailable/);
  f.repo.unavailable = false;
  assert.equal((await f.cleanup()).state, 'kept');
  assert.equal(f.repo.refs.get(`refs/heads/${other.branch}`), other.head);
});

test('superseded closed attempts are removed together but an open historical PR blocks cleanup', async () => {
  for (const reopen of [false, true]) {
    const f = await fixture(), old = await f.publish();
    await f.repo.put('other.txt', 'Unrelated main advance');
    const current = await f.publish(); await f.merge(current);
    assert.equal(old.state, 'closed');
    if (reopen) old.state = 'open';
    const before = [...f.repo.refs];
    const result = await f.cleanup();
    assert.equal(result.state, reopen ? 'kept' : 'deleted');
    if (reopen) assert.deepEqual([...f.repo.refs], before);
    else assert.equal(f.repo.refs.has(`refs/heads/${old.head.ref}`), false);
  }
});

test('missing, unreadable or changed evidence never causes partial deletion', async () => {
  for (const fault of ['snapshot', 'lock', 'coordinator', 'PR', 'network']) {
    const f = await fixture(), pr = await f.publish(); await f.merge(pr);
    if (fault === 'snapshot') await f.repo.put('injected.txt', 'Changed', { branch: pr.head.ref });
    if (fault === 'lock' || fault === 'coordinator') {
      const prefix = fault === 'lock' ? 'refs/tags/cms-publication-locks/' : 'refs/heads/cms/publication-state/';
      f.repo.refs.delete([...f.repo.refs.keys()].find(ref => ref.startsWith(prefix)));
    }
    if (fault === 'PR') f.repo.pulls.length = 0;
    if (fault === 'network') f.repo.unavailable = true;
    const before = [...f.repo.refs];
    const [result] = await Promise.allSettled([f.cleanup()]);
    if (result.status === 'fulfilled') assert.equal(result.value.state, 'kept');
    else assert.ok(result.reason instanceof Error);
    assert.deepEqual([...f.repo.refs], before);
  }
});

test('unpublish cleanup preserves editorial work and permits later republishing', async () => {
  for (const newer of [false, true]) {
    const f = await fixture();
    // Unpublish copies the website, while a separately saved edit must survive.
    const page = await f.save(f.saved, newer ? 'Unpublished editorial work.' : 'Original.');
    const pr = await f.publish(page, 'unpublish'); await f.merge(pr);
    assert.equal((await f.cleanup()).state, newer ? 'kept' : 'deleted');
    if (!newer) {
      const reopened = await f.store().getContent(area, filename);
      const next = await f.save(reopened, 'Republished text.');
      await f.publish(next);
    } else assert.match((await f.store().getContent(area, filename)).content, /Unpublished editorial work/);
  }
});

test('maintenance workflow uses trusted main, daily scheduling and manual dry run by default', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/cms-branch-cleanup.yml', import.meta.url), 'utf8'));
  assert.ok(workflow.on.schedule.length);
  assert.equal(workflow.on.workflow_dispatch.inputs.dry_run.default, true);
  assert.equal(workflow.on.pull_request, undefined);
  assert.equal(workflow.permissions.contents, 'write');
  const checkout = workflow.jobs.cleanup.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, 'main');
  assert.equal(checkout.with['persist-credentials'], false);
});

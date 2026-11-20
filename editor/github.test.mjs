import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubClient } from './github.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { draftBranch } from './draftStorage.mjs';
import { parsePage, savePage } from './page.mjs';
import { saveBlog } from './blog.mjs';

const original = '---\ntitle: Existing\ndescription: Keep\ncustom: preserved\n---\n\nOriginal body.';
const path = 'src/content/docs/library/existing.mdx';
const client = (repo, token = 'editor-one') => createGitHubClient({ token, fetchImpl: repo.fetchImpl });
const edit = (loaded, body) => ({ ...parsePage(loaded.content), ...loaded, body });

test('main is the content baseline regardless of the application-host branch; repeated saves and another account resume one shared draft', async () => {
  const repo = await draftTestRepository({ [path]: original });
  await repo.put(path, original.replace('Original body.', 'Staging-only content.'), { branch: 'main' });
  repo.refs.set('refs/heads/custom-cms', repo.refs.get('refs/heads/main'));
  await repo.put(path, original);
  const main = repo.refs.get('refs/heads/main'), staging = repo.refs.get('refs/heads/custom-cms');
  const first = client(repo), loaded = await first.getContent('library', 'existing.mdx');
  assert.equal(loaded.branch, 'main'); assert.equal(loaded.content, original);
  const saved = await savePage(first, 'library', loaded.filename, { ...edit(loaded, 'Draft one.'), draft: true });
  assert.equal(saved.draft, false); assert.doesNotMatch(saved.content, /^draft:/m, 'absent metadata remains absent');
  const second = client(repo, 'editor-two');
  const listing = await second.listContent('library');
  assert.equal(listing.entries.length, 1); assert.equal(listing.entries[0].hasDraft, true);
  const reopened = await second.getContent('library', loaded.filename);
  assert.equal(reopened.content, saved.content); assert.equal(reopened.head, saved.head);
  const savedAgain = await savePage(second, 'library', loaded.filename, edit(reopened, 'Draft two.'));
  assert.equal(savedAgain.branch, await draftBranch('library', loaded.filename));
  assert.notEqual(savedAgain.head, saved.head);
  assert.equal(repo.refs.get('refs/heads/main'), main); assert.equal(repo.refs.get('refs/heads/custom-cms'), staging);
  const files = repo.filesAt(savedAgain.head), baseline = repo.filesAt(main);
  assert.deepEqual([...files.keys()], [...baseline.keys()]);
  assert.match(savedAgain.content, /custom: preserved/);
  assert.ok(repo.requests.filter(item => item.path === '/graphql' && item.body.includes('mutation')).every(item => JSON.parse(item.body).variables.input.refUpdates.every(update => update.force === false && update.name.startsWith('refs/heads/cms/drafts/'))));
  assert.ok(!repo.requests.some(item => /pulls|merges|deployments|actions/.test(item.path)));
  assert.ok(repo.requests.filter(item => item.path === '/git/commits').every(item => JSON.parse(item.body).message.startsWith('[CF-Pages-Skip]')));
});

test('same-document stale saves and competing branch-head updates cannot overwrite another editor, even with an unchanged blob', async () => {
  const repo = await draftTestRepository({ [path]: original }), first = client(repo), second = client(repo);
  const loaded = await first.getContent('library', 'existing.mdx');
  const saved = await savePage(first, 'library', loaded.filename, edit(loaded, 'First edit.'));
  await assert.rejects(savePage(second, 'library', loaded.filename, edit(loaded, 'Stale edit.')), { status: 409 });
  repo.beforeMutation = async () => { await savePage(second, 'library', saved.filename, edit(saved, 'Concurrent winner.')); };
  await assert.rejects(savePage(first, 'library', saved.filename, edit(saved, 'Concurrent loser.')), { status: 409 });
  assert.match((await first.getContent('library', saved.filename)).content, /Concurrent winner/);
  const latest = await first.getContent('library', saved.filename);
  await savePage(second, 'library', latest.filename, edit(latest, 'Concurrent winner.'));
  await assert.rejects(savePage(first, 'library', latest.filename, edit(latest, 'Same blob, stale head.')), { status: 409 });
});

test('new documents start from fresh main, remain drafts, and are discovered across all branches and pages', async () => {
  const repo = await draftTestRepository({ [path]: original }), first = client(repo);
  const created = await savePage(first, 'guides', 'new.mdx', { title: 'New', description: '', body: 'New draft.', draft: false });
  const second = await saveBlog(first, null, { title: 'Article', body: 'An article.', draft: false });
  repo.pageSize = 1;
  const fresh = client(repo, 'another-account');
  assert.equal((await fresh.listContent('guides')).entries[0].name, 'new.mdx');
  assert.equal((await fresh.listContent('posts')).entries[0].name, 'article.mdx');
  assert.equal(created.draft, true); assert.equal(second.draft, true);
  assert.equal(repo.filesAt('refs/heads/main').has('src/content/docs/guides/new.mdx'), false);
  assert.ok(repo.requests.some(item => item.body?.includes('"after":"1"')));
});

test('creation retries after a lost response recover the original shared document, never a suffixed duplicate', async () => {
  const repo = await draftTestRepository(), first = client(repo);
  const input = { title: 'My article', body: 'Original.', creationId: 'creation-attempt-1234', creationFilename: 'my-article.mdx' };
  repo.fault = 'unavailable-after';
  await assert.rejects(saveBlog(first, null, input), { creationState: 'uncertain' });
  repo.unavailable = false;
  const retry = await saveBlog(client(repo, 'other-account'), null, { ...input, body: 'Later text stays in browser.', creationRetry: true });
  assert.equal(retry.replayed, true); assert.equal(retry.body, 'Original.');
  assert.equal((await client(repo).listContent('posts')).entries.length, 1);
});

test('atomic route claims reject concurrent .md/.mdx/index aliases on separate document branches', async () => {
  const repo = await draftTestRepository(), first = client(repo), second = client(repo);
  repo.beforeMutation = async () => { await savePage(second, 'guides', 'same/index.md', { title: 'Winner', description: '', body: 'Winner.' }); };
  await assert.rejects(savePage(first, 'guides', 'same.mdx', { title: 'Loser', description: '', body: 'Loser.' }), { status: 409 });
  assert.equal(repo.refs.has(`refs/heads/${await draftBranch('guides', 'same.mdx')}`), false);
  assert.equal((await first.listContent('guides')).entries.length, 1);
});

test('draft discovery fails closed for foreign scope, altered identities, incomplete trees, and detached bases', async () => {
  for (const fault of ['scope','identity','tree','base']) {
    const repo = await draftTestRepository({ [path]: original }), store = client(repo);
    const loaded = await store.getContent('library', 'existing.mdx');
    const saved = await savePage(store, 'library', loaded.filename, edit(loaded, 'Draft.'));
    if (fault === 'scope') await repo.put('package.json', '{}', { branch: saved.branch });
    if (fault === 'identity') repo.commits.get(saved.head).message = repo.commits.get(saved.head).message.replace('library/existing.mdx', 'guides/other.mdx');
    if (fault === 'tree') {
      const request = repo.request; repo.request = async (...args) => { const result = await request(...args); return args[0].startsWith('/git/trees/') ? { ...result, truncated: true } : result; };
    }
    if (fault === 'base') { const parent = repo.commits.get(saved.head).parents[0].sha; repo.refs.set('refs/heads/main', saved.head); repo.commits.get(saved.head).parents = []; assert.ok(parent); }
    const fresh = client(repo);
    await assert.rejects(fresh.listContent('library'), error => [409,503].includes(error.status), fault);
  }
});

test('main edits block further draft saves while keeping the shared draft readable for reconciliation', async () => {
  const repo = await draftTestRepository({ [path]: original }), store = client(repo);
  const loaded = await store.getContent('library', 'existing.mdx');
  const saved = await savePage(store, 'library', loaded.filename, edit(loaded, 'Draft.'));
  await repo.put(path, original.replace('Original body.', 'New main version.'));
  const reopened = await store.getContent('library', loaded.filename);
  assert.equal(reopened.mainChanged, true); assert.match(reopened.content, /Draft\./);
  await assert.rejects(savePage(store, 'library', loaded.filename, edit(saved, 'Do not overwrite main.')), { status: 409 });
});

test('Save Draft includes only associated referenced uploads, never overwrites images, and images reopen from a different account', async () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
  const repo = await draftTestRepository({ [path]: original, 'src/assets/images/main.png': png }), store = client(repo);
  const image = await store.uploadImage({ area: 'library', documentFilename: 'existing.mdx', filename: 'Map.png', mimeType: 'image/png', bytes: png });
  assert.equal([...repo.refs].length, 1, 'upload preparation makes no Git mutation');
  const unused = await store.uploadImage({ area: 'library', documentFilename: 'existing.mdx', filename: 'Unused.png', mimeType: 'image/png', bytes: png });
  const loaded = await store.getContent('library', 'existing.mdx');
  const saved = await savePage(store, 'library', loaded.filename, { ...edit(loaded, `![Map](@images/${image.path})`), assets: [image, unused] });
  const files = repo.filesAt(saved.head);
  assert.equal(files.has(`src/assets/images/${image.path}`), true); assert.equal(files.has(`src/assets/images/${unused.path}`), false);
  assert.equal(repo.filesAt('refs/heads/main').has(`src/assets/images/${image.path}`), false);
  const another = client(repo, 'editor-two');
  assert.deepEqual((await another.getImage(image.path)).bytes, png);
  assert.equal((await another.listImages({ area: 'library', filename: loaded.filename })).images.length, 2);
  const wrongDocument = await savePage(store, 'guides', 'different.mdx', { title: 'Different', description: '', body: 'Different.' });
  await assert.rejects(savePage(store, 'guides', wrongDocument.filename, { ...edit(wrongDocument, `![Map](@images/${image.path})`), assets: [image] }), { status: 400 });
  const secondSave = await savePage(another, 'library', loaded.filename, edit(saved, saved.body + '\nMore text.'));
  assert.equal(repo.filesAt(secondSave.head).get(`src/assets/images/${image.path}`).sha, files.get(`src/assets/images/${image.path}`).sha);
});

test('new documents can save associated cover images atomically after their first draft save', async () => {
  const repo = await draftTestRepository(), store = client(repo);
  const saved = await saveBlog(store, null, { title: 'With cover', body: 'Draft.' });
  const image = await store.uploadImage({ area: 'posts', documentFilename: saved.filename, filename: 'Cover.gif', mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') });
  const next = await saveBlog(store, saved.filename, { ...saved, cover: { image: '@images/' + image.path, alt: 'Cover' }, assets: [image] });
  assert.equal(repo.filesAt(next.head).has(`src/assets/images/${image.path}`), true);
  assert.equal((await store.getContent('posts', saved.filename)).head, next.head);
});

test('invalid uploads, missing revision heads, revoked access, and noncanonical paths cannot move any draft ref', async () => {
  const repo = await draftTestRepository({ [path]: original }), store = client(repo);
  const loaded = await store.getContent('library', 'existing.mdx');
  await assert.rejects(savePage(store, 'library', loaded.filename, { ...edit(loaded, 'Missing head.'), head: undefined }), { status: 409 });
  await assert.rejects(store.getContent('library', 'nested%2Fentry.mdx'), { status: 400 });
  await assert.rejects(store.uploadImage({ area: 'library', documentFilename: loaded.filename, filename: 'Bad.png', mimeType: 'image/png', bytes: new Uint8Array([1,2,3]) }), { status: 400 });
  repo.push = false;
  await assert.rejects(savePage(store, 'library', loaded.filename, edit(loaded, 'Revoked.')), { status: 403 });
  assert.equal(repo.refs.size, 1);
});

test('an unrelated main change can precede the first save without importing application-host content', async () => {
  const repo=await draftTestRepository({[path]:original}), store=client(repo);
  const loaded=await store.getContent('library','existing.mdx');
  await repo.put('README.md','Unrelated main edit.');
  const saved=await savePage(store,'library',loaded.filename,edit(loaded,'Working draft.'));
  assert.equal(repo.filesAt(saved.head).get('README.md').sha,repo.filesAt('refs/heads/main').get('README.md').sha);
});

test('creation replay returns its original immutable revision when another editor has since saved changes', async () => {
  const repo=await draftTestRepository(), store=client(repo);
  const input={title:'Article',body:'Original creation.',creationId:'replay-attempt-1234',creationFilename:'article.mdx'};
  const first=await saveBlog(store,null,input);
  const changed=await saveBlog(client(repo,'second-editor'),first.filename,{...first,body:'Another editor saved this.'});
  const replay=await saveBlog(store,null,{...input,creationRetry:true});
  assert.equal(replay.head,first.head);assert.equal(replay.body,'Original creation.');
  await assert.rejects(saveBlog(store,replay.filename,{...replay,body:'Stale edits must not overwrite the other editor.'}),{status:409});
  assert.equal((await store.getContent('posts',first.filename)).head,changed.head);
});

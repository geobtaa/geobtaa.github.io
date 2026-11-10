import assert from 'node:assert/strict';
import test from 'node:test';
import { editorUrl, parseEditorRoute, routeKey } from '../src/components/editor-prototype/editorNavigation.ts';
import { parseRecovery, recoveryFields, recoveryKey, readRecoveryCopies, removeRecovery, restoreRecovery } from '../src/components/editor-prototype/editorRecovery.ts';

class Storage {
  data = new Map(); get length() { return this.data.size; } key(index) { return [...this.data.keys()][index] || null; }
  getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, value); } removeItem(key) { this.data.delete(key); }
}
const route = { area: 'updates', filename: '2026-11.mdx' };
const base = { filename: route.filename, sha: 'base-sha', content: 'Authoritative source', title: 'Update', description: '', body: 'Original body', draft: true, date: '2026-11-10', authors: [{ name: 'Staff', title: 'Keep extra data' }], tags: ['Program Updates'], cover: { image: '@images/map.png', alt: 'Map' }, metadata: { sidebar: { hidden: true, attrs: { class: 'keep' } } }, conversion: null };
const copy = (id = 'copy-1', overrides = {}) => ({ version: 1, id, revision: 'revision-1', route, baseSha: base.sha, savedAt: '2026-11-10T15:00:00Z', fields: recoveryFields({ ...base, title: 'Unsaved title', body: '<CmsChipList items="[]" />\n\nUnsaved body.' }), ...overrides });

test('editor URLs round-trip dashboard, lists, nested documents and independent new drafts', () => {
  for (const entry of [{ area: null }, { area: 'posts' }, { area: 'library', filename: 'nested/file-name.md' }, { area: 'updates', draftId: 'local-draft-1' }]) {
    const url = new URL(editorUrl(entry, 'https://editor.example/editor/?keep=1#body'), 'https://editor.example');
    assert.deepEqual(parseEditorRoute(url.href), entry);
    assert.equal(url.searchParams.get('keep'), '1');
  }
  assert.notEqual(routeKey({ area: 'posts', draftId: 'one' }), routeKey({ area: 'posts', draftId: 'two' }));
  for (const query of ['?area=disabled', '?file=one.mdx', '?area=posts&file=', '?area=posts&file=../secret.mdx', '?area=posts&file=%252e%252e/secret.mdx', '?area=posts&new=../bad', '?area=posts&file=a.mdx&new=one', '?area=posts&area=updates']) assert.throws(() => parseEditorRoute('https://editor.example/editor/' + query), /invalid/);
});

test('recovery preserves all editable metadata and content, never credentials or server-only state', () => {
  const fields = recoveryFields({ ...base, token: 'Never store this', commitSha: 'server-only' });
  assert.equal(fields.token, undefined); assert.equal(fields.content, undefined); assert.equal(fields.sha, undefined);
  const record = copy();
  assert.deepEqual(parseRecovery(JSON.stringify(record)), record);
  const restored = restoreRecovery(base, route, record);
  assert.equal(restored.body, record.fields.body); assert.equal(restored.title, record.fields.title);
  assert.deepEqual(restored.authors, base.authors); assert.deepEqual(restored.cover, base.cover); assert.deepEqual(restored.metadata, base.metadata);
  assert.equal(restored.sha, base.sha); assert.equal(restored.content, base.content);
  assert.throws(() => restoreRecovery({ ...base, sha: 'newer' }, route, record), /version has changed/);
  assert.throws(() => restoreRecovery(base, { area: 'posts', filename: route.filename }, record), /version has changed/);
});

test('recovery storage isolates accounts/workspaces, retains concurrent copies, and conditionally deletes only the reviewed revision', () => {
  const storage = new Storage(); const a = copy(); const b = copy('copy-2', { savedAt: '2026-11-10T16:00:00Z' });
  storage.setItem(recoveryKey('user-one/repo-one', a.id), JSON.stringify(a)); storage.setItem(recoveryKey('user-one/repo-one', b.id), JSON.stringify(b));
  storage.setItem(recoveryKey('user-two/repo-one', a.id), JSON.stringify(a)); storage.setItem(recoveryKey('user-one/repo-two', a.id), JSON.stringify(a));
  assert.deepEqual(readRecoveryCopies(storage, 'user-one/repo-one', route).copies.map(copy => copy.id), ['copy-2', 'copy-1']);
  const newer = { ...a, revision: 'changed-in-another-tab' }; storage.setItem(recoveryKey('user-one/repo-one', a.id), JSON.stringify(newer));
  assert.equal(removeRecovery(storage, 'user-one/repo-one', a), false);
  assert.equal(removeRecovery(storage, 'user-one/repo-one', b), true);
  assert.equal(readRecoveryCopies(storage, 'user-two/repo-one').copies.length, 1);
  assert.deepEqual(readRecoveryCopies(storage, 'user-one/repo-one').copies, [newer]);
});

test('corrupt and malformed recovery records remain untouched and cannot replace authoritative fields', () => {
  const storage = new Storage(); storage.setItem(recoveryKey('scope', 'bad'), '{');
  assert.equal(readRecoveryCopies(storage, 'scope').unreadable, true);
  assert.equal(storage.getItem(recoveryKey('scope', 'bad')), '{');
  for (const record of [copy('one', { version: 2 }), copy('one', { baseSha: null }), copy('one', { fields: { ...copy().fields, sha: 'fake' } }), copy('one', { fields: { ...copy().fields, metadata: { head: 'not a list' } } }), copy('one', { route: { area: 'posts', filename: '../secret.mdx' } })]) assert.equal(parseRecovery(JSON.stringify(record)), null);
  const draftRoute = { area: 'posts', draftId: 'never-saved' };
  const draft = copy('draft', { route: draftRoute, baseSha: null, fields: recoveryFields({ ...base, filename: '', sha: undefined }) });
  assert.ok(parseRecovery(JSON.stringify(draft)));
  assert.equal(restoreRecovery({ ...base, filename: '', sha: undefined }, draftRoute, draft).sha, undefined);
});

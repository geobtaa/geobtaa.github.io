// A continuation preserves the old branch with an immutable retirement commit.
// Resolve metadata in one paginated inventory rather than one fetch per cycle.
import { draftBranch, draftMetadata } from './draftIdentity.mjs';
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
export async function draftHeads({ request, owner, repo }) {
  const heads = []; let after = null;
  do {
    const result = await request('/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      query: 'query CMSDrafts($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo){refs(refPrefix:"refs/heads/cms/drafts/",first:100,after:$after){nodes{name prefix target{oid ...on Commit{message tree{oid} parents(first:2){nodes{oid message tree{oid} parents(first:2){nodes{oid}}}} author{name date}}}} pageInfo{hasNextPage endCursor}}}}',
      variables: { owner, repo, after },
    }) });
    const page = result.data?.repository?.refs;
    if (result.errors?.length || !Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw fail('Draft discovery is unavailable. Nothing was saved.', 503);
    for (const item of page.nodes) {
      if (item?.prefix !== 'refs/heads/cms/drafts/' || typeof item.name !== 'string' || !item.name || !/^[a-f0-9]{40}$/.test(item.target?.oid || '')) throw fail('Invalid draft discovery result.', 503);
      const target = item.target;
      const parent = target.parents?.nodes?.[0];
      const before = parent?.message && parent.tree?.oid && parent.parents?.nodes ? { sha: parent.oid, message: parent.message, tree: { sha: parent.tree.oid }, parents: parent.parents.nodes.map(p => ({ sha: p.oid })) } : null;
      heads.push({ before, branch: (item.prefix + item.name).slice('refs/heads/'.length), head: target.oid, value: typeof target.message === 'string' && target.parents?.nodes && target.tree?.oid ? { sha: target.oid, message: target.message, tree: { sha: target.tree.oid }, parents: target.parents.nodes.map(p => ({ sha: p.oid })), author: target.author } : null });
    }
    if (!page.pageInfo.hasNextPage) break;
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after || heads.length >= 5000) throw fail('Draft discovery is incomplete. A maintainer must inspect the branch inventory.', 503);
    after = page.pageInfo.endCursor;
  } while (true);
  return heads;
}
export async function selectDraft(area, filename, heads, commit) {
  const legacy = await draftBranch(area, filename);
  const entries = heads.filter(h => h.branch === legacy || h.branch.startsWith(`${legacy}-cycle-`));
  if (!entries.length) return null;
  const byBranch = new Map();
  for (const entry of entries) {
    entry.value ||= await commit(entry.head);
    entry.meta = draftMetadata(entry.value);
    if (await draftBranch(area, filename, entry.meta) !== entry.branch) throw fail('A saved draft continuation has an invalid identity.');
    byBranch.set(entry.branch, entry);
  }
  let current = byBranch.get(legacy); const visited = new Set();
  while (current) {
    if (visited.has(current.branch)) throw fail('A saved draft continuation has a cycle. Ask a maintainer; your edits are preserved.');
    visited.add(current.branch);
    if (!current.meta.retiredTo) break;
    const before = current.before || await commit(current.value.parents?.[0]?.sha);
    if (current.value.tree.sha !== before.tree?.sha || JSON.stringify(current.meta) !== JSON.stringify({ ...draftMetadata(before), retiredTo: current.meta.retiredTo })) throw fail('A preserved draft was changed outside the editor. Your work is retained.');
    const next = byBranch.get(current.meta.retiredTo.branch);
    if (!next || next.meta.previousBranch !== current.branch || next.meta.previousHead !== current.value.parents?.[0]?.sha || current.value.parents?.length !== 1) throw fail('The saved draft continuation is incomplete. Refresh before editing; your drafts are preserved.');
    current = next;
  }
  if (!current || visited.size !== entries.length) throw fail('Competing saved draft continuations require maintainer review. No draft was replaced.');
  return current;
}
export async function activeDraft(area, filename, { request, owner, repo, ref, commit }) {
  const branch = await draftBranch(area, filename), head = await ref(`heads/${branch}`);
  if (!head) return null;
  const value = await commit(head);
  if (!draftMetadata(value).retiredTo) return { branch, head, value };
  return selectDraft(area, filename, await draftHeads({ request, owner, repo }), commit);
}

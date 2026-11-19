import { publicationBaseKey } from './draftIdentity.mjs';
import { activeDraft } from './draftCycles.mjs';
// Lightweight proposal submission only. The required trusted-base CI checker
// remains the authority for complete draft, MDX, route, image and tree validation.
import { readPublicationState } from './publicationCoordinator.mjs';
import { verifyPublicationPolicy } from './publicationPolicy.mjs';
import { validateImagePath, IMAGE_DIRECTORY } from './imageAssets.mjs';
const ZERO = '0'.repeat(40), SHA = /^[a-f0-9]{40}$/;
export const PUBLICATION_REQUEST_LIMIT = 40;
const fail = (status, message) => Object.assign(new Error(message), { status });
const write = data => ({ method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
const retry = () => fail(503, 'Publication could not be confirmed within this request. The saved draft is intact. Refresh PR status, then retry the same saved revision.');
export function createPublicationPRClient({ request, owner, repo, documentPath, draftBranch, digest }) {
  // Each public operation gets its own budget and immutable-object cache.
  function operation() {
    let count = 0;
    const commits = new Map();
    const ask = (path, options) => { if (++count > PUBLICATION_REQUEST_LIMIT) throw retry(); return request(path, options); };
    const reserve = () => { if (count > PUBLICATION_REQUEST_LIMIT - 8) throw retry(); };
    const commit = async sha => { if (!commits.has(sha)) commits.set(sha, await ask(`/git/commits/${sha}`)); return commits.get(sha); };
    const ref = async name => {
      try { const value = await ask(`/git/ref/${name.split('/').map(encodeURIComponent).join('/')}`); if (!SHA.test(value.object?.sha || '')) throw retry(); return value.object.sha; }
      catch (error) { if (error.status === 404) return null; throw error; }
    };
    async function query(query) {
      const result = await ask('/graphql', write({ query, variables: { owner, repo } }));
      if (result.errors?.length || !result.data?.repository) throw fail(503, 'GitHub publication data is incomplete. Nothing can be confirmed; the draft is intact.');
      return result.data.repository;
    }
    async function files(specs, text = false) {
      const found = [];
      for (let offset = 0; offset < specs.length; offset += 24) {
        const batch = specs.slice(offset, offset + 24);
        const fields = batch.map(({ head, path }, i) => `b${i}: object(expression:${JSON.stringify(`${head}:${path}`)}){...on Blob{oid ${text ? 'text isTruncated' : ''}}}`).join('\n');
        const data = await query(`query CMSPublicationFiles($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){${fields}}}`);
        for (const [i] of batch.entries()) {
          const value = data[`b${i}`];
          if (value !== null && (!SHA.test(value?.oid || '') || text && (value.isTruncated !== false || typeof value.text !== 'string'))) throw retry();
          found.push(value);
        }
      }
      return found;
    }
    async function selected(area, filename, head) {
      const path = documentPath(area, filename), identity = (await digest(path)).slice(0, 32);
      if (!SHA.test(head || '')) throw fail(400, 'Select a saved document revision.');
      const value = await commit(head), lines = value.message?.split('\n').filter(line => line.startsWith('CMS-Draft-v1: '));
      let meta;
      try { if (lines?.length !== 1) throw new Error(); meta = JSON.parse(lines[0].slice('CMS-Draft-v1: '.length)); } catch { throw fail(409, 'Invalid saved draft identity.'); }
      if (![1, 2].includes(meta.version) || meta.path !== path || !SHA.test(meta.base || '') || !(meta.baseBlob === null || SHA.test(meta.baseBlob || '')) || !meta.assets || typeof meta.assets !== 'object' || Array.isArray(meta.assets) || value.parents?.length !== 1) throw fail(409, 'Invalid saved draft identity.');
      const assets = Object.entries(meta.assets);
      if (assets.length > 100) throw fail(413, 'This draft has too many retained assets for bounded PR submission. Ask a maintainer; the draft is preserved.');
      for (const [asset, sha] of assets) if (validateImagePath(asset) !== asset || !asset.startsWith(`cms-${identity}/`) || !SHA.test(sha)) throw fail(409, 'Invalid draft asset identity.');
      const branch = await draftBranch(area, filename, meta);
      const current = await ref(`heads/${branch}`);
      if (!current) throw fail(409, 'The saved draft is unavailable.');
      if (head !== current) {
        const relation = await ask(`/compare/${head}...${current}`);
        if (!['ahead', 'identical'].includes(relation.status) || relation.merge_base_commit?.sha !== head) throw fail(409, 'The selected revision is not part of this working draft.');
      }
      return { area, filename, path, branch, identity, meta, head, value };
    }
    async function stateAt(head, path) {
      // Batch history, but verify every parent and append-only transition using
      // the exact same verifier as independent CI. Never infer trust from a name.
      const data = await query(`query CMSPublicationHistory($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){object(oid:${JSON.stringify(head)}){...on Commit{history(first:100){nodes{oid message tree{oid} parents(first:2){nodes{oid}}}}}}}}`);
      const nodes = data.object?.history?.nodes;
      if (!Array.isArray(nodes) || JSON.stringify(nodes).length > 250_000) throw fail(503, 'Publication history is too large or incomplete for hosted submission. Ask a maintainer; retained attempts are unchanged.');
      for (const value of nodes) {
        if (!SHA.test(value.oid || '') || !Array.isArray(value.parents?.nodes)) throw retry();
        commits.set(value.oid, { sha: value.oid, message: value.message, tree: { sha: value.tree?.oid }, parents: value.parents.nodes.map(parent => ({ sha: parent.oid })) });
      }
      return readPublicationState(head, path, commit);
    }
    async function pullRequests(attempts) {
      const output = [];
      for (let offset = 0; offset < attempts.length; offset += 16) {
        const fields = attempts.slice(offset, offset + 16).map((item, i) => `p${i}:pullRequests(headRefName:${JSON.stringify(item.branch)},baseRefName:"main",first:2,states:[OPEN,CLOSED,MERGED]){nodes{number id url state mergedAt headRefName headRefOid baseRefName headRepository{nameWithOwner} mergeCommit{oid} mergeable}}`).join('\n');
        const data = await query(`query CMSPublicationPRs($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){${fields}}}`);
        for (const [i, attempt] of attempts.slice(offset, offset + 16).entries()) {
          const nodes = data[`p${i}`]?.nodes;
          if (!Array.isArray(nodes) || nodes.length > 1) throw fail(503, 'Publication PR identity is uncertain. Ask a maintainer; no replacement was created.');
          const value = nodes[0];
          if (!value) { output.push(null); continue; }
          const pr = { number: value.number, node_id: value.id, html_url: value.url, state: value.state === 'OPEN' ? 'open' : 'closed', merged_at: value.mergedAt, merge_commit_sha: value.mergeCommit?.oid, mergeable: value.mergeable === 'CONFLICTING' ? false : null, head: { ref: value.headRefName, sha: value.headRefOid, repo: { full_name: value.headRepository?.nameWithOwner } }, base: { ref: value.baseRefName } };
          verifyPR(pr, attempt); output.push(pr);
        }
      }
      return output;
    }
    function verifyPR(pr, attempt) {
      if (!Number.isInteger(pr.number) || pr.head?.ref !== attempt.branch || pr.head?.sha !== attempt.head || pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== `${owner}/${repo}`) throw fail(409, 'Unexpected publication PR identity. Ask a maintainer.');
      const expected = `https://github.com/${owner}/${repo}/pull/${pr.number}`;
      if (pr.html_url !== expected) throw fail(409, 'Unexpected publication PR URL.');
    }
    async function coordinator(draft) {
      const branch = `cms/publication-state/${draft.identity}-${publicationBaseKey(draft.meta)}`, lock = `refs/tags/cms-publication-locks/${draft.identity}-${publicationBaseKey(draft.meta)}`;
      const head = await ref(`heads/${branch}`), state = head ? await stateAt(head, draft.path) : null;
      if (state && state.attempts.some(a => a.branch !== `cms/publish/${draft.identity}-${state.selectedHead}-${a.base}-${a.attempt}`)) throw fail(409, 'Publication attempt identity mismatch. Ask a maintainer.');
      const held = await ref(lock.slice(5));
      if (state ? held !== state.attempts[0].head : held) throw fail(409, 'Publication lock identity mismatch or legacy publication lock without coordinator. Ask a maintainer; do not delete it.');
      return { branch, lock, head, state };
    }
    return { ask, reserve, commit, ref, files, selected, coordinator, pullRequests, verifyPR };
  }
  const response = (pr, head) => ({ state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'pr-open', number: pr.number, url: pr.html_url, selectedHead: head,
    message: pr.merged_at ? 'PR merged. GitHub Pages handles deployment; deployment is not verified here.' : pr.state === 'closed' ? 'Publication PR closed without merging.' : 'Publication PR created. Wait for validate and cms-publication-scope to pass, then merge it in GitHub.' });
  return {
    async preparePublication({ area, filename, head }) {
      const op = operation(), draft = await op.selected(area, filename, head);
      const [file] = await op.files([{ head, path: draft.path }], true);
      if (!file || file.text.length > 1_000_000) throw fail(413, 'Document unavailable or too large for hosted PR preparation. The draft is intact.');
      return { head, content: file.text, assets: draft.meta.assets };
    },
    async publishContent({ area, filename, head, candidate }) {
      const op = operation(), repository = await op.ask('');
      if (!repository.permissions?.push || !repository.node_id) throw fail(403, 'Repository write permission could not be verified. Sign in again.');
      const draft = await op.selected(area, filename, head), held = await op.coordinator(draft);
      if (held.state && held.state.selectedHead !== head) throw fail(409, 'Another saved revision owns this publication. Its draft and PR are preserved.');
      const previous = held.state ? await op.pullRequests(held.state.attempts) : [];
      const merged = previous.find(pr => pr?.merged_at);
      if (merged) return response(merged, head);
      const mainHead = await op.ref('heads/main');
      if (!mainHead) throw retry();
      const main = await op.commit(mainHead);
      const [published] = await op.files([{ head: mainHead, path: draft.path }]);
      if ((published?.oid || null) !== draft.meta.baseBlob) throw fail(409, 'The public document changed since this draft began. Keep your edits and ask a maintainer to reconcile.');
      await verifyPublicationPolicy(op.ask, { manual: true });
      // Bound inventory before all writes; never treat an incomplete page as free.
      for (let page = 1; ; page++) {
        const prs = await op.ask(`/pulls?state=open&base=main&per_page=100&page=${page}`);
        if (!Array.isArray(prs)) throw retry();
        if (prs.some(pr => pr.head?.repo?.full_name === `${owner}/${repo}` && pr.head.ref.startsWith(`cms/publish/${draft.identity}-`) && !held.state?.attempts.some(a => a.branch === pr.head.ref))) throw fail(409, 'Another publication PR requires maintainer reconciliation.');
        if (prs.length < 100) break;
        if (page >= 3) throw fail(503, 'Active PR inventory is too large for hosted submission. Ask a maintainer; nothing was reserved.');
      }
      let attempt = held.state?.attempts.at(-1), pr = previous.at(-1), stateHead = held.head;
      if (attempt && await op.ref(`heads/${attempt.branch}`) !== attempt.head) throw fail(409, 'Immutable publication snapshot was changed or removed. Ask a maintainer.');
      if (attempt) {
        const value = await op.commit(attempt.head);
        const marker = `CMS-Publication-v1: ${JSON.stringify({ area, filename, selectedHead: head, attempt: attempt.attempt })}`;
        if (value.parents?.length !== 1 || value.parents[0].sha !== attempt.base || value.message?.split('\n').filter(line => line.startsWith('CMS-Publication-v1: ')).join('') !== marker) throw fail(409, 'Publication snapshot identity mismatch. Ask a maintainer.');
      }
      const replace = !attempt || attempt.base !== mainHead || pr?.state === 'closed';
      if (replace) {
        if (!candidate || typeof candidate.content !== 'string' || candidate.content.length > 1_000_000 || !Array.isArray(candidate.assets) || candidate.assets.length > 100 || new Set(candidate.assets).size !== candidate.assets.length) throw fail(400, 'Prepare the selected saved revision before creating its PR.');
        const assets = candidate.assets.map(asset => {
          if (typeof asset !== 'string' || !Object.hasOwn(draft.meta.assets, asset)) throw fail(400, 'An image is not an authorized upload for this document.');
          return { path: `${IMAGE_DIRECTORY}/${asset}`, sha: draft.meta.assets[asset], mode: '100644', type: 'blob' };
        });
        const found = assets.length ? await op.files(assets.flatMap(asset => [{ head, path: asset.path }, { head: mainHead, path: asset.path }])) : [];
        const entries = [{ path: draft.path, mode: '100644', type: 'blob', content: candidate.content }];
        for (const [i, asset] of assets.entries()) {
          if (found[i * 2]?.oid !== asset.sha) throw fail(409, 'A selected image does not match the saved revision.');
          const published = found[i * 2 + 1];
          if (published && published.oid !== asset.sha) throw fail(409, 'A production image conflicts with this revision.');
          if (!published) entries.push(asset);
        }
        if (pr?.state === 'open') {
          op.reserve();
          try { await op.ask(`/pulls/${pr.number}`, { ...write({ state: 'closed' }), method: 'PATCH' }); } catch { /* uncertain closure requires readback */ }
          pr = await op.ask(`/pulls/${pr.number}`);
          op.verifyPR(pr, attempt);
          if (pr.merged_at) return response(pr, head);
          if (pr.state !== 'closed') throw fail(409, 'Could not confirm retirement of the earlier PR. No replacement was created.');
        }
        const ordinal = (attempt?.attempt || 0) + 1;
        if (ordinal > 100) throw fail(409, 'Publication retry limit reached. Ask a maintainer.');
        const branch = `cms/publish/${draft.identity}-${head}-${mainHead}-${ordinal}`;
        op.reserve();
        const tree = await op.ask('/git/trees', write({ base_tree: main.tree.sha, tree: entries }));
        if (!SHA.test(tree.sha || '')) throw retry();
        const next = await op.ask('/git/commits', write({ tree: tree.sha, parents: [mainHead], message: `[CF-Pages-Skip] Publish: ${filename}\n\nCMS-Publication-v1: ${JSON.stringify({ area, filename, selectedHead: head, attempt: ordinal })}` }));
        if (!SHA.test(next.sha || '')) throw retry();
        attempt = { branch, head: next.sha, base: mainHead, attempt: ordinal };
        const state = { path: draft.path, selectedHead: head, attempts: [...(held.state?.attempts || []), attempt] };
        const nextState = await op.ask('/git/commits', write({ tree: main.tree.sha, parents: [stateHead || mainHead], message: `[CF-Pages-Skip] Publication coordinator\n\nCMS-Publication-State-v1: ${JSON.stringify(state)}` }));
        if (!SHA.test(nextState.sha || '')) throw retry();
        if (await op.ref('heads/main') !== mainHead) throw fail(409, 'Main changed during preparation. Retry this same saved revision.');
        const updates = [{ name: `refs/heads/${branch}`, beforeOid: ZERO, afterOid: next.sha }, { name: `refs/heads/${held.branch}`, beforeOid: stateHead || ZERO, afterOid: nextState.sha }, ...(!stateHead ? [{ name: held.lock, beforeOid: ZERO, afterOid: next.sha }] : [])];
        try {
          const result = await op.ask('/graphql', write({ query: 'mutation CMSSaveDraft($input:UpdateRefsInput!){updateRefs(input:$input){clientMutationId}}', variables: { input: { repositoryId: repository.node_id, refUpdates: updates.map(item => ({ ...item, force: false })) } } }));
          if (result.errors?.length || !result.data?.updateRefs) throw retry();
        } catch {
          const actual = await op.coordinator(draft);
          if (!actual.state) throw retry();
          if (actual.state.selectedHead !== head) throw fail(409, 'Another saved revision won the publication reservation.');
          attempt = actual.state.attempts.at(-1); stateHead = actual.head;
        }
        stateHead ||= nextState.sha;
        if (await op.ref(`heads/${held.branch}`) === nextState.sha) stateHead = nextState.sha;
        [pr] = await op.pullRequests([attempt]);
      }
      if (await op.ref('heads/main') !== attempt.base || await op.ref(`heads/${held.branch}`) !== stateHead || await op.ref(`heads/${attempt.branch}`) !== attempt.head) throw fail(409, 'Publication changed concurrently. Retry the same saved revision.');
      if (!pr) {
        op.reserve();
        try { pr = await op.ask('/pulls', write({ title: `Publish ${filename}`, head: attempt.branch, base: 'main', body: `Selected CMS saved revision ${head}; attempt ${attempt.attempt}. This is a proposal, not a validation result. Wait for validate and cms-publication-scope, review the diff, then merge in GitHub. Do not use Update branch; recreate through the CMS if main advances.` })); }
        catch (error) { [pr] = await op.pullRequests([attempt]); if (!pr) throw error; }
      }
      op.verifyPR(pr, attempt);
      return response(pr, head);
    },
    async getPublicationStatus(area, filename, knownDraft = null) {
      const op = operation();
      try {
        // Internal callers may reuse an already inspected immutable draft. The
        // HTTP status endpoint never accepts this object from the browser.
        let draft;
        if (knownDraft) {
          const path = documentPath(area, filename), branch = await draftBranch(area, filename, knownDraft.meta);
          if (knownDraft.meta.path !== path || knownDraft.branch !== branch || await op.ref(`heads/${branch}`) !== knownDraft.head) throw retry();
          draft = { ...knownDraft, path, identity: (await digest(path)).slice(0, 32) };
        } else {
          const current = await activeDraft(area, filename, { request: op.ask, owner, repo, ref: op.ref, commit: op.commit });
          if (!current) return { state: 'none' };
          draft = await op.selected(area, filename, current.head);
        }
        const head = draft.head, held = await op.coordinator(draft);
        if (!held.state) return { state: 'none' };
        const prs = await op.pullRequests(held.state.attempts), pr = prs.find(pr => pr?.merged_at) || prs.at(-1);
        const index = prs.findIndex(pr => pr?.merged_at);
        const attempt = held.state.attempts[index < 0 ? held.state.attempts.length - 1 : index];
        const extra = { selectedHead: held.state.selectedHead, newerDraft: head !== held.state.selectedHead, snapshotHead: attempt.head, baseHead: attempt.base, mergeHead: pr?.merge_commit_sha };
        if (await op.ref(`heads/${held.branch}`) !== held.head) throw retry();
        if (!pr) return { state: 'reserved', message: 'Snapshot reserved; retry PR creation for this saved revision.', ...extra };
        const result = response(pr, held.state.selectedHead);
        if (result.state === 'pr-open' && pr.mergeable === false) return { ...result, ...extra, state: 'conflict', message: 'PR has conflicts. If main advanced, recreate this saved revision through the CMS.' };
        return { ...result, ...extra };
      } catch (error) {
        if ([401, 403].includes(error.status)) throw error;
        return { state: 'checking', message: `PR status could not be verified: ${error.message}` };
      }
    },
  };
}

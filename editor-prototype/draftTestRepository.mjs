import { gitBlobShaBytes, encodeBytes } from './draftStorage.mjs';
import { blobQueryResponse } from './githubTestHelpers.mjs';

// Immutable Git graph, independent refs, atomic compare-and-swap, and injected
// failures. Shared by storage, both API adapters, and browser integration tests.
export async function draftTestRepository(initial = {}) {
  let sequence = 0;
  const objects = new Map(), trees = new Map(), commits = new Map(), refs = new Map(), requests = [];
  const id = () => crypto.randomUUID().replaceAll('-', '') + (++sequence).toString(16).padStart(8, '0');
  const makeBlob = async (content, sha) => {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    sha ||= await gitBlobShaBytes(bytes);
    objects.set(sha, bytes); return sha;
  };
  async function makeCommit(files, parent, message = '', author = 'Editor One') {
    const tree = id(); trees.set(tree, new Map(files));
    const sha = id(); commits.set(sha, { sha, tree: { sha: tree }, parents: parent ? [{ sha: parent }] : [], message, author: { name: author, date: '2026-11-16T12:00:00Z' } });
    return sha;
  }
  const initialFiles = new Map();
  for (const [path, value] of Object.entries(initial)) {
    const content = typeof value === 'string' || value instanceof Uint8Array ? value : value.content;
    initialFiles.set(path, { path, mode: '100644', type: 'blob', sha: await makeBlob(content, value.sha) });
  }
  refs.set('refs/heads/main', await makeCommit(initialFiles));
  const filesAt = ref => trees.get(commits.get(refs.get(ref) || ref).tree.sha);
  const repository = { pulls: [], autoMergeFailure: false, objects, trees, commits, refs, requests, fault: '', unavailable: false, pageSize: 100, beforeMutation: null, push: true,
    filesAt,
    compatFiles(prefix) {
      const branchFor = path => [...refs].find(([name, head]) => name.startsWith('refs/heads/cms/drafts/') && commits.get(head).message.includes(`"path":${JSON.stringify(path)}`))?.[0] || 'refs/heads/main';
      return {
        get size() { return new Set([...refs].filter(([ref]) => ref.startsWith('refs/heads/')).flatMap(([, head]) => [...filesAt(head).keys()].filter(path => path.startsWith(prefix)))).size; },
        get(name) { const path = prefix + name, file = filesAt(refs.get(branchFor(path))).get(path); return file && { sha: file.sha, content: new TextDecoder().decode(objects.get(file.sha)) }; },
        has(name) { return !!this.get(name); },
        set(name, file) {
          const path = prefix + name, branch = branchFor(path), parent = refs.get(branch), files = new Map(filesAt(parent));
          objects.set(file.sha, new TextEncoder().encode(file.content));
          files.set(path, { path, mode: '100644', type: 'blob', sha: file.sha });
          const tree = id(), head = id(); trees.set(tree, files); commits.set(head, { ...commits.get(parent), sha: head, tree: { sha: tree }, parents: [{ sha: parent }] }); refs.set(branch, head);
          return this;
        },
      };
    },
    async put(path, content, { branch = 'main', mode = '100644', sha } = {}) {
      const name = `refs/heads/${branch}`, parent = refs.get(name), files = new Map(filesAt(parent));
      files.set(path, { path, type: 'blob', mode, sha: await makeBlob(content, sha) });
      const head = await makeCommit(files, parent, commits.get(parent).message); refs.set(name, head); return head;
    },
    request: async (path, options = {}) => {
      requests.push({ path, ...options });
      if (repository.unavailable) throw new TypeError('Network unavailable');
      const input = options.body ? JSON.parse(options.body) : {};
      const url = new URL(path || '/', 'https://github.test');
      const fail = status => { throw Object.assign(new Error('GitHub conflict or missing object'), { status }); };
      if (path === '/branches/main/protection') return repository.protection || { required_status_checks: { strict: true, checks: ['validate', 'cms-publication-scope'].map(context => ({ context, app_id: 15368 })) }, enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 0, require_code_owner_reviews: false, dismiss_stale_reviews: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false }, restrictions: null };
      if (path === '/rules/branches/main') return repository.rules || [];
      if (path === '') return { allow_auto_merge: true, allow_squash_merge: true, node_id: 'repo-id', permissions: { push: repository.push } };
      if (url.pathname.endsWith('/check-runs')) return { total_count: 0, check_runs: [] };
      if (/^\/pulls\/\d+$/.test(url.pathname)) {
        const pr = repository.pulls.find(pr => pr.number === Number(url.pathname.split('/').at(-1)));
        if (!pr) fail(404);
        if (options.method === 'PATCH' && !pr.merged_at) pr.state = input.state;
        return structuredClone(pr);
      }
      if (url.pathname === '/pulls') {
        if (options.method === 'POST') {
          if (repository.pulls.some(pr => pr.head.ref === input.head)) fail(422);
          const pr = { number: repository.pulls.length + 1, node_id: `pr-${repository.pulls.length + 1}`, state: 'open', html_url: `https://github.com/geobtaa/geobtaa.github.io/pull/${repository.pulls.length + 1}`, base: { ref: input.base }, head: { ref: input.head, sha: refs.get(`refs/heads/${input.head}`), repo: { full_name: 'geobtaa/geobtaa.github.io' } } };
          repository.pulls.push(pr); return pr;
        }
        return repository.pulls.filter(pr => url.searchParams.has('head') ? `geobtaa:${pr.head.ref}` === url.searchParams.get('head') : pr.state === 'open').slice((Number(url.searchParams.get('page') || 1) - 1) * 100, Number(url.searchParams.get('page') || 1) * 100);
      }
      if (path === '/graphql') {
        if (input.query.includes('query CMSPublicationHistory') || input.query.includes('query CMSDraftHistory')) {
          if (Number(input.query.match(/history\(first:(\d+)/)[1]) > 100) throw new Error('GitHub GraphQL first limit is 100');
          const sha = input.variables.head || JSON.parse(input.query.match(/object\(oid:("[a-f0-9]+")/)[1]), nodes = []; let current = sha;
          while (current && nodes.length < 100) {
            const value = commits.get(current); if (!value) break;
            nodes.push({ oid: current, message: value.message, tree: { oid: value.tree.sha }, parents: { nodes: value.parents.slice(0, 2).map(parent => ({ oid: parent.sha })) }, author: value.author });
            current = value.parents[0]?.sha;
          }
          return { data: { repository: { object: { oid: sha, history: { nodes } } } } };
        }
        if (input.query.includes('query CMSPublicationPRs')) {
          const found = {};
          for (const [, alias, name] of input.query.matchAll(/(p\d+):pullRequests\(headRefName:("[^"\n]+")/g)) {
            const branch = JSON.parse(name);
            found[alias] = { nodes: repository.pulls.filter(pr => pr.head.ref === branch).map(pr => ({ number: pr.number, id: pr.node_id, url: pr.html_url, state: pr.merged_at ? 'MERGED' : pr.state.toUpperCase(), mergedAt: pr.merged_at || null, mergeCommit: pr.merge_commit_sha ? { oid: pr.merge_commit_sha } : null, headRefName: pr.head.ref, headRefOid: pr.head.sha, baseRefName: pr.base.ref, headRepository: { nameWithOwner: pr.head.repo.full_name }, mergeable: pr.mergeable === false ? 'CONFLICTING' : 'UNKNOWN' })) };
          }
          return { data: { repository: found } };
        }
        if (input.query.includes('query CMSPublicationFiles')) {
          const found = {};
          for (const [, alias, encoded] of input.query.matchAll(/(b\d+): object\(expression:("(?:[^"\\]|\\.)*")/g)) {
            const expression = JSON.parse(encoded), colon = expression.indexOf(':'), head = expression.slice(0, colon), path = expression.slice(colon + 1);
            const file = filesAt(head).get(path), bytes = file && objects.get(file.sha);
            found[alias] = file ? { oid: file.sha, text: new TextDecoder().decode(bytes), isTruncated: false } : null;
          }
          return { data: { repository: found } };
        }
        if (input.query.includes('mutation CMSPublish')) {
          if (repository.autoMergeFailure) return { errors: [{ message: 'Required policy prevents auto-merge' }] };
          const pr = repository.pulls.find(pr => pr.node_id === input.variables.input.pullRequestId);
          if (input.variables.input.expectedHeadOid !== pr.head.sha) fail(409);
          pr.auto_merge = true;
          return { data: { enablePullRequestAutoMerge: { pullRequest: { id: pr.node_id } } } };
        }

        if (input.query.includes('query CMSDrafts')) {
          const nodes = [...refs].filter(([name]) => name.startsWith('refs/heads/cms/drafts/')).map(([name, oid]) => ({ name: name.slice('refs/heads/cms/drafts/'.length), prefix: 'refs/heads/cms/drafts/', target: { oid, message: commits.get(oid).message, tree: { oid: commits.get(oid).tree.sha }, parents: { nodes: commits.get(oid).parents.map(p => ({ oid: p.sha, message: commits.get(p.sha).message, tree: { oid: commits.get(p.sha).tree.sha }, parents: { nodes: commits.get(p.sha).parents.map(pp => ({ oid: pp.sha })) } })) }, author: commits.get(oid).author } }));
          const start = Number(input.variables.after || 0), end = start + repository.pageSize;
          return { data: { repository: { refs: { nodes: nodes.slice(start, end), pageInfo: { hasNextPage: end < nodes.length, endCursor: String(end) } } } } };
        }
        if (input.query.includes('mutation CMSSaveDraft')) {
          if (repository.beforeMutation) { const action = repository.beforeMutation; repository.beforeMutation = null; await action(); }
          const updates = input.variables.input.refUpdates;
          if (updates.some(update => (refs.get(update.name) || '0'.repeat(40)) !== update.beforeOid || update.force !== false)) return { errors: [{ message: 'beforeOid does not match', type: 'UNPROCESSABLE' }] };
          if (repository.fault === 'before') { repository.fault = ''; throw new TypeError('Connection lost before update'); }
          for (const update of updates) refs.set(update.name, update.afterOid);
          const fault = repository.fault; repository.fault = '';
          if (fault === 'unavailable-after') { repository.unavailable = true; throw new TypeError('Connection lost after update'); }
          if (fault === 'after') throw new TypeError('Connection lost after update');
          if (fault === 'malformed') return {};
          return { data: { updateRefs: { clientMutationId: null } } };
        }
        return blobQueryResponse(input, [...objects].map(([sha, bytes]) => ({ sha, content: new TextDecoder().decode(bytes) })));
      }
      if (url.pathname.startsWith('/git/ref/')) { const name = `refs/${decodeURIComponent(url.pathname.slice('/git/ref/'.length))}`; if (!refs.has(name)) fail(404); return { ref: name, object: { sha: refs.get(name) } }; }
      if (url.pathname.startsWith('/git/commits/')) return commits.get(url.pathname.split('/').at(-1)) || fail(404);
      if (url.pathname.startsWith('/git/trees/')) return { truncated: false, tree: [...trees.get(url.pathname.split('/').at(-1)).values()] };
      if (url.pathname.startsWith('/git/blobs/')) { const bytes = objects.get(url.pathname.split('/').at(-1)); return bytes ? { content: encodeBytes(bytes), encoding: 'base64' } : fail(404); }
      if (path === '/git/blobs') return { sha: await makeBlob(Uint8Array.from(atob(input.content), char => char.charCodeAt(0))) };
      if (path === '/git/trees') {
        const files = new Map(trees.get(input.base_tree));
        for (const item of input.tree) files.set(item.path, { ...item, sha: item.sha || await makeBlob(item.content) });
        const sha = id(); trees.set(sha, files); return { sha, tree: [...files.values()] };
      }
      if (path === '/git/commits') { const sha = await makeCommit(trees.get(input.tree), input.parents[0], input.message); commits.get(sha).tree = { sha: input.tree }; return { sha }; }
      if (url.pathname.startsWith('/compare/')) {
        const [base, head] = url.pathname.slice('/compare/'.length).split('...');
        const visit = [head], seen = new Set();
        while (visit.length) { const sha = visit.pop(); if (sha === base) return { status: head === base ? 'identical' : 'ahead', merge_base_commit: { sha: base } }; if (seen.has(sha)) continue; seen.add(sha); visit.push(...(commits.get(sha)?.parents || []).map(parent => parent.sha)); }
        return { status: 'diverged', merge_base_commit: { sha: '0'.repeat(40) } };
      }
      throw new Error(`Unexpected GitHub operation: ${path}`);
    },
  };
  repository.fetchImpl = async (input, options) => {
    const url = new URL(String(input));
    const path = url.pathname === '/graphql' ? '/graphql' : url.pathname.replace('/repos/geobtaa/geobtaa.github.io', '') + url.search;
    try { return Response.json(await repository.request(path, options)); }
    catch (error) { if (error.status) return Response.json({ message: error.message }, { status: error.status }); throw error; }
  };
  return repository;
}

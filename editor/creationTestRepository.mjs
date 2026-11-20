import { gitBlobSha } from './articleCreation.mjs';
import { blobQueryResponse } from './githubTestHelpers.mjs';

// A small immutable Git object store shared by API and real-browser tests.
export function creationTestRepository({ state = { head: 'root', sequence: 0, trees: { initial: {} }, commits: { root: { tree: 'initial', parents: [], message: '', changed: [] } } }, persist = () => {} } = {}) {
  const requests = [];
  const repo = { state, requests, fault: '', unavailable: false, shallow: false, request: async (path, options = {}) => {
    requests.push({ path, ...options });
    if (repo.unavailable) throw new TypeError('Network unavailable');
    const url = new URL(path, 'https://github.test');
    const input = options.body ? JSON.parse(options.body) : {};
    const fail = status => { throw Object.assign(new Error('GitHub conflict'), { status }); };
    if (url.pathname.startsWith('/git/ref/heads/')) return { object: { sha: state.head } };
    if (url.pathname.startsWith('/git/commits/')) {
      const commit = state.commits[url.pathname.split('/').at(-1)];
      return { tree: { sha: commit.tree } };
    }
    if (url.pathname.startsWith('/git/trees/')) {
      const files = state.trees[url.pathname.split('/').at(-1)];
      return { truncated: false, tree: Object.entries(files).map(([path, file]) => ({ path, sha: file.sha, type: 'blob' })) };
    }
    if (path === '/graphql') return blobQueryResponse(input, Object.values(state.trees).flatMap(files => Object.values(files)));
    if (url.pathname === '/commits') {
      const history = [];
      for (let ref = url.searchParams.get('sha'); ref; ref = state.commits[ref].parents[0]) {
        const commit = state.commits[ref];
        if (commit.changed.includes(url.searchParams.get('path'))) history.push({ sha: ref, commit: { message: commit.message } });
      }
      const page = Number(url.searchParams.get('page') || 1);
      return history.slice((page - 1) * 100, page * 100);
    }
    if (url.pathname.startsWith('/contents/')) {
      const files = state.trees[state.commits[url.searchParams.get('ref') || state.head].tree];
      const path = decodeURIComponent(url.pathname.slice('/contents/'.length));
      const file = files[path];
      if (file) return { sha: file.sha, content: btoa(String.fromCharCode(...new TextEncoder().encode(file.content))), encoding: 'base64' };
      return Object.entries(files).filter(([name]) => name.startsWith(`${path}/`)).map(([name, file]) => ({ name: name.slice(path.length + 1), path: name, sha: file.sha, type: 'file' }));
    }
    if (path === '/git/trees') {
      const files = { ...state.trees[input.base_tree] };
      for (const item of input.tree) files[item.path] = { content: item.content, sha: await gitBlobSha(item.content) };
      const sha = `tree-${++state.sequence}`;
      state.trees[sha] = files; persist(state);
      return { sha, tree: repo.shallow ? [{ path: 'src', type: 'tree' }] : input.tree.map(item => ({ path: item.path, sha: files[item.path].sha, type: 'blob' })) };
    }
    if (path === '/git/commits') {
      const sha = `commit-${++state.sequence}`;
      const before = state.trees[state.commits[input.parents[0]].tree];
      state.commits[sha] = { tree: input.tree, parents: input.parents, message: input.message, changed: Object.keys(state.trees[input.tree]).filter(path => before[path]?.sha !== state.trees[input.tree][path].sha) };
      persist(state); return { sha };
    }
    if (url.pathname.startsWith('/git/refs/heads/')) {
      if (input.force !== false || state.commits[input.sha].parents[0] !== state.head) fail(422);
      if (repo.fault === 'before') { repo.fault = ''; throw new TypeError('Connection lost before branch update'); }
      state.head = input.sha; persist(state);
      const fault = repo.fault; repo.fault = '';
      if (fault === 'unavailable-after') { repo.unavailable = true; throw new TypeError('Connection lost after branch update'); }
      if (fault === 'after') throw new TypeError('Connection lost after branch update');
      if (fault === 'malformed') return {};
      return { object: { sha: input.sha } };
    }
    if (url.pathname.startsWith('/compare/')) {
      const [base, head] = url.pathname.slice('/compare/'.length).split('...');
      for (let ref = head; ref; ref = state.commits[ref].parents[0]) if (ref === base) return { status: head === base ? 'identical' : 'ahead', merge_base_commit: { sha: base } };
      return { status: 'diverged', merge_base_commit: { sha: 'root' } };
    }
    throw new Error(`Unexpected GitHub operation: ${path}`);
  } };
  return repo;
}

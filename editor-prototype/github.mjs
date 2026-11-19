import { createDraftStore } from './draftStorage.mjs';

export class GitHubConflictError extends Error {}

export function createGitHubClient({ token, owner = 'geobtaa', repo = 'geobtaa.github.io', fetchImpl = fetch }) {
  if (!token) throw new Error('GITHUB_TOKEN is required. Put it in .env.local; never expose it to the browser.');
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const request = async (path, options = {}) => {
    const response = await fetchImpl(path === '/graphql' ? 'https://api.github.com/graphql' : `${api}${path}`, {
      ...options, redirect: 'error', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'geobtaa-editor', ...options.headers },
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw Object.assign(new Error(detail.message || `GitHub request failed (${response.status}).`), { status: response.status });
    }
    return response.status === 204 ? null : response.json();
  };
  const store = createDraftStore({ request, owner, repo });
  return { ...store, async listProjects() { const result = await store.listContent('projects'); return { ...result, projects: result.entries }; }, getProject: filename => store.getContent('projects', filename), saveProject: input => store.saveContent({ area: 'projects', ...input }) };
}

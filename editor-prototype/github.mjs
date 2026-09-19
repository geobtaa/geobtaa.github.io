import { contentDirectory, encodeContentPath } from './contentAreas.mjs';
import { IMAGE_DIRECTORY } from './imageAssets.mjs';

export class GitHubConflictError extends Error {}

export function createGitHubClient({
  token,
  owner = 'geobtaa',
  repo = 'geobtaa.github.io',
  branch = 'custom-cms',
  baseBranch = 'main',
  fetchImpl = fetch,
}) {
  if (!token) throw new Error('GITHUB_TOKEN is required. Put it in .env.local; never expose it to the browser.');
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'geobtaa-project-editor-prototype',
  };

  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, headers: { ...headers, ...options.headers } });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(detail.message || `GitHub request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async function requestRaw(url) {
    const response = await fetchImpl(url, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(detail.message || `GitHub request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async function branchExists() {
    try {
      await request(`${api}/git/ref/heads/${encodeURIComponent(branch)}`);
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  async function readRef() {
    return (await branchExists()) ? branch : baseBranch;
  }

  async function ensureBranch() {
    if (await branchExists()) return;
    const base = await request(`${api}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
    try {
      await request(`${api}/git/refs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
      });
    } catch (error) {
      if (error.status !== 422 || !(await branchExists())) throw error;
    }
  }

  async function listDirectory(directory, ref, relative = '', pattern = /\.mdx?$/) {
    const path = relative ? `${directory}/${relative}` : directory;
    const files = await request(`${api}/contents/${encodeContentPath(path)}?ref=${encodeURIComponent(ref)}`);
    const output = [];
    for (const file of files) {
      const name = relative ? `${relative}/${file.name}` : file.name;
      if (file.type === 'dir') output.push(...await listDirectory(directory, ref, name, pattern));
      else if (pattern.test(file.name)) output.push({ name, path: file.path, sha: file.sha, size: file.size });
    }
    return output;
  }

  return {
    async listContent(area = 'projects') {
      const ref = await readRef();
      return { branch: ref, entries: await listDirectory(contentDirectory(area), ref) };
    },

    async getContent(area, filename) {
      const ref = await readRef();
      const file = await request(`${api}/contents/${encodeContentPath(`${contentDirectory(area)}/${filename}`)}?ref=${encodeURIComponent(ref)}`);
      return {
        filename,
        sha: file.sha,
        content: Buffer.from(file.content, 'base64').toString('utf8'),
        branch: ref,
      };
    },

    async saveContent({ area, filename, content, sha, publish }) {
      await ensureBranch();
      const payload = {
        message: area === 'projects' ? `${publish ? 'Publish' : 'Save draft'} project: ${filename}` : `Update ${area}: ${filename}`,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      };
      try {
        const result = await request(`${api}/contents/${encodeContentPath(`${contentDirectory(area)}/${filename}`)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return { sha: result.content.sha, commitSha: result.commit.sha, branch };
      } catch (error) {
        if (sha && (error.status === 409 || error.status === 422)) {
          throw new GitHubConflictError('This page has changed in GitHub since you opened it. Reload the latest version before saving.');
        }
        throw error;
      }
    },
    async listProjects() {
      const result = await this.listContent('projects');
      return { branch: result.branch, projects: result.entries };
    },
    getProject(filename) { return this.getContent('projects', filename); },
    saveProject(input) { return this.saveContent({ area: 'projects', ...input }); },
    async listImages() {
      const ref = await readRef();
      return { branch: ref, images: await listDirectory(IMAGE_DIRECTORY, ref, '', /\.(?:png|jpe?g|gif|webp)$/i) };
    },
    async getImage(path) {
      const ref = await readRef();
      const content = await requestRaw(`${api}/contents/${encodeContentPath(`${IMAGE_DIRECTORY}/${path}`)}?ref=${encodeURIComponent(ref)}`);
      return { path, content, branch: ref };
    },
    async uploadImage({ filename, bytes }) {
      await ensureBranch();
      try {
        const result = await request(`${api}/contents/${encodeContentPath(`${IMAGE_DIRECTORY}/${filename}`)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Upload editor image: ${filename}`, content: Buffer.from(bytes).toString('base64'), branch }),
        });
        return { path: filename, sha: result.content.sha, commitSha: result.commit.sha, branch };
      } catch (error) {
        if (error.status === 409 || error.status === 422) throw new GitHubConflictError('An image with this filename already exists. Rename the file and try again.');
        throw error;
      }
    },
  };
}

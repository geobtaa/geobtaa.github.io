import { slug as githubSlug } from 'github-slugger';
import { postSlug } from './blog.mjs';

const PREFIX = 'src/content/docs/posts/';
const extensions = /\.(?:markdown|mdown|mkdn|mkd|mdwn|md|mdx)$/i;
const write = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export function routeForPost(filename) {
  return filename.replace(extensions, '').split('/').map((part) => githubSlug(part)).join('/').replace(/\/index$/, '');
}

export function availablePostFilename(title, paths) {
  const routes = new Set(paths.filter((path) => extensions.test(path)).map(routeForPost));
  // `index` would refer to /posts/ rather than a post route.
  routes.add('index');
  const base = postSlug(title);
  let candidate = base;
  for (let suffix = 2; routes.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  return `${candidate}.mdx`;
}

// New posts are committed against one tree snapshot with a fast-forward-only
// branch update. A competing save cannot overwrite a file or an equivalent route.
export async function createBlogCommit({ request, ensureBranch, branch, title, suggestedFilename, content }) {
  await ensureBranch();
  const head = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const parent = head.object.sha;
  const commit = await request(`/git/commits/${parent}`);
  const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw Object.assign(new Error('The repository listing is incomplete. No post was created.'), { status: 503 });
  const paths = tree.tree.filter((item) => item.path.startsWith(PREFIX)).map((item) => item.path.slice(PREFIX.length));
  const filename = availablePostFilename(title, paths);
  const requested = suggestedFilename || `${postSlug(title)}.mdx`;
  if (requested !== filename) throw Object.assign(new Error(`That post URL is already in use. Create as ${filename.replace(/\.mdx$/, '')} instead?`), { status: 409, suggestedFilename: filename });
  const nextTree = await request('/git/trees', write('POST', { base_tree: commit.tree.sha, tree: [{ path: `${PREFIX}${filename}`, mode: '100644', type: 'blob', content }] }));
  const nextCommit = await request('/git/commits', write('POST', { message: `Create blog post: ${filename}`, tree: nextTree.sha, parents: [parent] }));
  try {
    await request(`/git/refs/heads/${encodeURIComponent(branch)}`, write('PATCH', { sha: nextCommit.sha, force: false }));
  } catch (error) {
    if (error.status === 409 || error.status === 422) throw Object.assign(new Error('Staging changed while creating this post. Your work is still here. Save again to check for an available URL.'), { status: 409 });
    throw error;
  }
  const blob = nextTree.tree?.find((item) => item.path === `${PREFIX}${filename}`);
  // GitHub returns tree entries; read the saved blob only if the response omits it.
  const sha = blob?.sha || (await request(`/contents/${PREFIX}${filename}?ref=${nextCommit.sha}`)).sha;
  return { filename, sha, commitSha: nextCommit.sha, branch };
}

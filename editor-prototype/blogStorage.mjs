import { postSlug } from './blog.mjs';
import { CONTENT_ROOT, contentDirectory, validateContentPath } from './contentAreas.mjs';
import { DOC_EXTENSIONS, routeFromFilename, documentRoute, documentSlug, isRoutedDocument, staticPageRoute, routeConflictMessage } from './contentRoutes.mjs';

const extensions = DOC_EXTENSIONS;
const write = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export function routeForPost(filename) {
  return routeFromFilename(filename);
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

// Article naming uses the same snapshot and commit safeguards as other pages.
export async function createBlogCommit({ request, ensureBranch, branch, title, suggestedFilename, content, area = 'posts', owner, repo }) {
  if (!['posts', 'updates'].includes(area)) throw new Error('Unsupported article content area.');
  return createContentCommit({ request, ensureBranch, branch, title, suggestedFilename, content, area, owner, repo, article: true });
}

// Git blob SHAs are immutable. Reuse only parsed slug metadata, with a bounded
// cache; every creation still checks a fresh, complete branch tree snapshot.
const slugCache = new Map();
async function snapshotRoutes(tree, request, owner, repo) {
  const claims = new Map();
  const documents = tree.filter(item => isRoutedDocument(item.path));
  if (documents.some(item => !item.sha || item.type !== 'blob')) throw new Error('A document blob is missing from the repository snapshot.');
  const missing = [...new Set(documents.map(item => item.sha))].filter(sha => !slugCache.has(sha));
  const slugs = new Map(documents.filter(item => slugCache.has(item.sha)).map(item => [item.sha, slugCache.get(item.sha)]));
  // Batch immutable blobs through GraphQL rather than spending one hosted
  // subrequest per document. No expressions based on branch names are used.
  for (let start = 0; start < missing.length; start += 32) {
    const batch = missing.slice(start, start + 32);
    const fields = batch.map((sha, index) => `b${index}: object(oid: ${JSON.stringify(sha)}) { ... on Blob { oid text isTruncated } }`).join('\n');
    const result = await request('/graphql', write('POST', {
      query: `query CMSRoutes($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`,
      variables: { owner, repo },
    }));
    if (result.errors?.length) throw new Error('The repository route query failed.');
    for (const [index, sha] of batch.entries()) {
      const blob = result.data?.repository?.[`b${index}`];
      if (blob?.oid !== sha || blob.isTruncated !== false || typeof blob.text !== 'string') throw new Error('A document blob could not be read.');
      const slug = documentSlug(blob.text);
      slugs.set(sha, slug);
      if (slugCache.size >= 512) slugCache.delete(slugCache.keys().next().value);
      slugCache.set(sha, slug);
    }
  }
  for (const item of documents) claims.set(documentRoute(item.path.slice(CONTENT_ROOT.length + 1), slugs.get(item.sha)), item.path);
  for (const item of tree) {
    const route = staticPageRoute(item.path);
    if (route !== null) claims.set(route, item.path);
  }
  return claims;
}

export async function createContentCommit({ request, ensureBranch, branch, filename, title, suggestedFilename, content, area, article = false, owner = 'geobtaa', repo = 'geobtaa.github.io' }) {
  const prefix = `${contentDirectory(area)}/`;
  const itemLabel = article ? area === 'updates' ? 'program update' : 'blog post' : 'page';
  if (!article) {
    filename = validateContentPath(filename);
    if (filename.split('/').at(-1).startsWith('_')) throw Object.assign(new Error('Starlight ignores document filenames starting with an underscore.'), { status: 400 });
  }
  await ensureBranch();
  const head = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const parent = head.object.sha;
  const commit = await request(`/git/commits/${parent}`);
  const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw Object.assign(new Error(`The repository listing is incomplete. No ${itemLabel} was created.`), { status: 503 });
  let claims;
  try { claims = await snapshotRoutes(tree.tree, request, owner, repo); }
  catch { throw Object.assign(new Error('The repository routes could not be verified. Nothing was saved to GitHub. Try again after the repository can be read.'), { status: 503 }); }
  const paths = new Set(tree.tree.map(item => item.path));
  const slug = documentSlug(content);
  if (slug !== null && claims.has(documentRoute('', slug))) throw Object.assign(new Error(routeConflictMessage(documentRoute('', slug), claims.get(documentRoute('', slug)))), { status: 409 });
  if (article) {
    const base = postSlug(title);
    filename = `${base}.mdx`;
    for (let suffix = 2; (base === 'index' && filename === 'index.mdx') || paths.has(`${prefix}${filename}`) || claims.has(documentRoute(`${area}/${filename}`, slug)); suffix++) filename = `${base}-${suffix}.mdx`;
    const requested = suggestedFilename || `${base}.mdx`;
    if (requested !== filename) throw Object.assign(new Error(`That ${itemLabel} URL is already in use. Create as ${filename.replace(/\.mdx$/, '')} instead?`), { status: 409, suggestedFilename: filename });
  }
  const route = documentRoute(`${area}/${filename}`, slug);
  const claimedBy = claims.get(route) || (paths.has(`${prefix}${filename}`) ? `${prefix}${filename}` : null);
  if (claimedBy) throw Object.assign(new Error(routeConflictMessage(route, claimedBy)), { status: 409 });
  const nextTree = await request('/git/trees', write('POST', { base_tree: commit.tree.sha, tree: [{ path: `${prefix}${filename}`, mode: '100644', type: 'blob', content }] }));
  const nextCommit = await request('/git/commits', write('POST', { message: `Create ${itemLabel}: ${filename}`, tree: nextTree.sha, parents: [parent] }));
  try {
    await request(`/git/refs/heads/${encodeURIComponent(branch)}`, write('PATCH', { sha: nextCommit.sha, force: false }));
  } catch (error) {
    if (error.status === 409 || error.status === 422) throw Object.assign(new Error(`Staging changed while creating this ${itemLabel}. Your work is still here. Save again to check for an available URL.`), { status: 409 });
    throw error;
  }
  const blob = nextTree.tree?.find((item) => item.path === `${prefix}${filename}`);
  // GitHub returns tree entries; read the saved blob only if the response omits it.
  const sha = blob?.sha || (await request(`/contents/${prefix}${filename}?ref=${nextCommit.sha}`)).sha;
  return { filename, sha, commitSha: nextCommit.sha, branch };
}

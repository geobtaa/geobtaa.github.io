import { postSlug } from './blog.mjs';
import { CONTENT_ROOT, contentDirectory, validateContentPath } from './contentAreas.mjs';
import { DOC_EXTENSIONS, routeFromFilename, documentRoute, documentSlug, isRoutedDocument, staticPageRoute, routeConflictMessage } from './contentRoutes.mjs';
import { validateCreationAttempt, findArticleCreation, uncertainCreation, gitBlobSha } from './articleCreation.mjs';

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
export async function createBlogCommit({ request, ensureBranch, branch, title, suggestedFilename, content, area = 'posts', owner, repo, creationId, creationFilename, creationRetry = false }) {
  if (!['posts', 'updates'].includes(area)) throw new Error('Unsupported article content area.');
  validateCreationAttempt(creationId, creationFilename);
  return createContentCommit({ request, ensureBranch, branch, title, suggestedFilename, content, area, owner, repo, creationId, creationFilename, creationRetry, article: true });
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

export async function createContentCommit({ request, ensureBranch, branch, filename, title, suggestedFilename, content, area, article = false, owner = 'geobtaa', repo = 'geobtaa.github.io', creationId, creationFilename, creationRetry = false }) {
  const prefix = `${contentDirectory(area)}/`;
  const itemLabel = article ? area === 'updates' ? 'program update' : 'blog post' : 'page';
  if (!article) {
    filename = validateContentPath(filename);
    if (filename.split('/').at(-1).startsWith('_')) throw Object.assign(new Error('Starlight ignores document filenames starting with an underscore.'), { status: 400 });
  }
  await ensureBranch();
  const head = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const parent = head.object.sha;
  const priorCreation = async ref => findArticleCreation({ request, ref, prefix, filename: creationFilename, id: creationId, branch });
  if (creationId) {
    try { const previous = await priorCreation(parent); if (previous) return previous; }
    catch (error) { if (error.status === 401) throw Object.assign(error, { creationState: 'uncertain' }); throw uncertainCreation(); }
  }
  const commit = await request(`/git/commits/${parent}`);
  const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw Object.assign(new Error(`The repository listing is incomplete. No ${itemLabel} was created.`), { status: 503 });
  let claims;
  try { claims = await snapshotRoutes(tree.tree, request, owner, repo); }
  catch (error) { if (error.status === 401) throw error; throw Object.assign(new Error('The repository routes could not be verified. Nothing was saved to GitHub. Try again after the repository can be read.'), { status: 503 }); }
  const paths = new Set(tree.tree.map(item => item.path));
  const slug = documentSlug(content);
  if (slug !== null && claims.has(documentRoute('', slug))) throw Object.assign(new Error(routeConflictMessage(documentRoute('', slug), claims.get(documentRoute('', slug)))), { status: 409 });
  if (article) {
    const base = postSlug(title);
    filename = `${base}.mdx`;
    for (let suffix = 2; (base === 'index' && filename === 'index.mdx') || paths.has(`${prefix}${filename}`) || claims.has(documentRoute(`${area}/${filename}`, slug)); suffix++) filename = `${base}-${suffix}.mdx`;
    const requested = creationFilename || suggestedFilename || `${base}.mdx`;
    if (creationId && requested !== 'index.mdx' && !paths.has(`${prefix}${requested}`) && !claims.has(documentRoute(`${area}/${requested}`, slug))) filename = requested;
    if (requested !== filename) {
      if (creationId && creationRetry) throw uncertainCreation();
      throw Object.assign(new Error(`That ${itemLabel} URL is already in use. Create as ${filename.replace(/\.mdx$/, '')} instead?`), { status: 409, suggestedFilename: filename, creationState: 'not-created' });
    }
  }
  const route = documentRoute(`${area}/${filename}`, slug);
  const claimedBy = claims.get(route) || (paths.has(`${prefix}${filename}`) ? `${prefix}${filename}` : null);
  if (claimedBy) throw Object.assign(new Error(routeConflictMessage(route, claimedBy)), { status: 409, creationState: 'not-created' });
  const nextTree = await request('/git/trees', write('POST', { base_tree: commit.tree.sha, tree: [{ path: `${prefix}${filename}`, mode: '100644', type: 'blob', content }] }));
  if (typeof nextTree.sha !== 'string' || !nextTree.sha) throw new Error('GitHub did not return the new tree. No branch update was attempted.');
  const nextCommit = await request('/git/commits', write('POST', { message: `Create ${itemLabel}: ${filename}${creationId ? `\n\nCMS-Creation: ${creationId}` : ''}`, tree: nextTree.sha, parents: [parent] }));
  if (typeof nextCommit.sha !== 'string' || !nextCommit.sha) throw new Error('GitHub did not return the new commit. No branch update was attempted.');
  // Compute the fallback before updating the branch. A successful creation must
  // not depend on a subsequent Contents API read to obtain its revision.
  const sha = nextTree.tree?.find(item => item.path === `${prefix}${filename}`)?.sha || await gitBlobSha(content);
  const saved = { filename, sha, commitSha: nextCommit.sha, branch };
  try {
    const updated = await request(`/git/refs/heads/${encodeURIComponent(branch)}`, write('PATCH', { sha: nextCommit.sha, force: false }));
    if (updated?.object?.sha !== nextCommit.sha) throw new Error('GitHub returned an ambiguous branch update.');
  } catch (error) {
    try {
      const latest = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
      if (latest?.object?.sha === nextCommit.sha) return saved;
      if (creationId) { const previous = await priorCreation(latest.object.sha); if (previous) return previous; }
      const comparison = await request(`/compare/${encodeURIComponent(nextCommit.sha)}...${encodeURIComponent(latest.object.sha)}`);
      if (['ahead', 'identical'].includes(comparison.status) && comparison.merge_base_commit?.sha === nextCommit.sha) return saved;
    } catch (checkError) { if (checkError.status === 401) throw Object.assign(checkError, { creationState: 'uncertain' }); }
    if (error.status === 401) throw Object.assign(error, { creationState: 'uncertain' });
    if (!creationId && (error.status === 409 || error.status === 422)) throw Object.assign(new Error(`Staging changed while creating this ${itemLabel}. Your work is still here. Save again to check for an available URL.`), { status: 409 });
    throw uncertainCreation();
  }
  return saved;
}

import { contentDirectory, CONTENT_ROOT, validateContentPath } from './contentAreas.mjs';
import { documentRoute, documentSlug, routeConflictMessage } from './contentRoutes.mjs';
import { snapshotRoutes, availablePostFilename } from './blogStorage.mjs';
import { contentVisibility, parseContent, withContentVisibility } from './content.mjs';
import { postSlug } from './blog.mjs';
import { validateCreationAttempt, gitBlobSha, uncertainCreation } from './articleCreation.mjs';
import { validateImageUpload, validateImagePath, imageContentType, IMAGE_DIRECTORY } from './imageAssets.mjs';
import { imageReferences } from './publicationCandidate.mjs';
import { parse } from 'yaml';
import { readPublicationState } from './publicationCoordinator.mjs';
import { createPublicationPRClient } from './publicationPR.mjs';
import { validateDocument } from './validateDocument.mjs';
import { PAGE_METADATA_FIELDS, validatePageMetadata, patchFrontmatter } from './pageMetadata.mjs';

const ZERO = '0'.repeat(40);
const MARKER = 'CMS-Draft-v1: ';
const write = (data) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const failure = (status, message) => Object.assign(new Error(message), { status });
export const draftConflict = () => failure(409, 'This page has changed in GitHub since you opened it. Someone saved a newer draft or the main version changed. Your unsaved edits are still here; download or copy them before reopening the latest draft.');
export function decodeBytes(value) {
  try { return Uint8Array.from(atob(value.replace(/\s/g, '')), char => char.charCodeAt(0)); }
  catch { throw failure(400, 'Image or blob content is not valid base64.'); }
}
export function encodeBytes(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function documentPath(area, filename) {
  const canonical = validateContentPath(filename);
  // Decode once at the HTTP boundary; aliases must not create another identity.
  if (canonical !== filename || canonical.split('/').at(-1).startsWith('_')) throw failure(400, 'Use a canonical, routed document filename.');
  return `${contentDirectory(area)}/${canonical}`;
}
export async function draftBranch(area, filename) {
  const path = documentPath(area, filename);
  return `cms/drafts/${area}/${postSlug(filename.replace(/\.mdx?$/, '')).slice(0, 40)}-${(await digest(path)).slice(0, 32)}`;
}
export async function prepareDraftImage({ area, documentFilename, filename, mimeType, bytes }) {
  const path = documentPath(area, documentFilename);
  const safe = validateImageUpload({ filename, mimeType, bytes });
  const name = safe.replace(/\.[^.]+$/, '');
  return { path: `cms-${(await digest(path)).slice(0, 32)}/${name}-${await digest(bytes)}.${safe.split('.').at(-1)}`, mimeType, content: encodeBytes(bytes), filename: safe };
}
function metadata(commit) {
  const lines = commit.message?.split('\n').filter(line => line.startsWith(MARKER));
  if (lines?.length !== 1) throw failure(409, 'A draft branch has unrecognized metadata. A maintainer must inspect it.');
  try { return JSON.parse(lines[0].slice(MARKER.length)); } catch { throw failure(409, 'Invalid draft identity metadata.'); }
}

// Shared by the local gateway and Cloudflare. No application-host branch is used.
export function createDraftStore({ request, owner = 'geobtaa', repo = 'geobtaa.github.io' }) {
  const commits = new Map(), trees = new Map(), blobs = new Map();
  const once = async (cache, key, read) => { if (!cache.has(key)) cache.set(key, await read()); return cache.get(key); };
  const commit = sha => once(commits, sha, () => request(`/git/commits/${sha}`));
  const tree = sha => once(trees, sha, async () => {
    const result = await request(`/git/trees/${sha}?recursive=1`);
    if (result.truncated !== false || !Array.isArray(result.tree)) throw failure(503, 'The repository tree is incomplete. Nothing was saved.');
    return new Map(result.tree.filter(item => item.type !== 'tree').map(item => [item.path, item]));
  });
  const snapshot = async head => tree((await commit(head)).tree.sha);
  const blob = sha => once(blobs, sha, async () => {
    const result = await request(`/git/blobs/${sha}`);
    if (result.encoding !== 'base64' || typeof result.content !== 'string') throw failure(503, 'The repository blob could not be read.');
    return decodeBytes(result.content);
  });
  const text = async item => {
    if (!item || item.type !== 'blob' || item.mode !== '100644') throw failure(409, 'The document must be a regular repository file.');
    return new TextDecoder('utf-8', { fatal: true }).decode(await blob(item.sha));
  };
  async function preloadText(items) {
    const missing = [...new Set(items.filter(item => !blobs.has(item.sha)).map(item => item.sha))];
    for (let start = 0; start < missing.length; start += 32) {
      const batch = missing.slice(start, start + 32);
      const fields = batch.map((sha, index) => `b${index}: object(oid: ${JSON.stringify(sha)}){...on Blob{oid text isTruncated}}`).join(' ');
      const result = await request('/graphql', write({ query: `query CMSDraftText($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){${fields}}}`, variables: { owner, repo } }));
      if (result.errors?.length) throw failure(503, 'Document metadata could not be read.');
      for (const [index, sha] of batch.entries()) {
        const value = result.data?.repository?.[`b${index}`];
        if (value?.oid !== sha || value.isTruncated !== false || typeof value.text !== 'string') throw failure(503, 'Document metadata is incomplete.');
        blobs.set(sha, new TextEncoder().encode(value.text));
      }
    }
  }
  const ref = async name => {
    try { const result = await request(`/git/ref/${name.split('/').map(encodeURIComponent).join('/')}`); if (!result.object?.sha) throw failure(503, 'Unreadable repository reference.'); return result.object.sha; }
    catch (error) { if (error.status === 404) return null; throw error; }
  };
  const main = async () => { const head = await ref('heads/main'); if (!head) throw failure(503, 'The main content baseline is unavailable.'); return { head, files: await snapshot(head) }; };
  async function refs() {
    const found = []; let after = null;
    do {
      const result = await request('/graphql', write({ query: 'query CMSDrafts($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo){refs(refPrefix:"refs/heads/cms/drafts/",first:100,after:$after){nodes{name prefix target{oid}} pageInfo{hasNextPage endCursor}}}}', variables: { owner, repo, after } }));
      const page = result.data?.repository?.refs;
      if (result.errors?.length || !Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw failure(503, 'Draft discovery is unavailable. Nothing was saved.');
      found.push(...page.nodes);
      if (!page.pageInfo.hasNextPage) break;
      if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after || found.length >= 5000) throw failure(503, 'Draft discovery is incomplete. A maintainer must inspect the branch inventory.');
      after = page.pageInfo.endCursor;
    } while (true);
    return found;
  }
  async function inspect(branch, head, baseline) {
    const latest = await commit(head), meta = metadata(latest);
    const parts = typeof meta.path === 'string' && meta.path.startsWith(`${CONTENT_ROOT}/`) ? meta.path.slice(CONTENT_ROOT.length + 1).split('/') : [];
    const area = parts.shift(), filename = parts.join('/');
    if (!area || !filename || await draftBranch(area, filename) !== branch || meta.version !== 1 || typeof meta.base !== 'string' || !/^[a-f0-9]{40,64}$/.test(meta.base) || !meta.assets || typeof meta.assets !== 'object' || Array.isArray(meta.assets)) throw failure(409, 'Draft branch identity does not match its document.');
    const baseFiles = await snapshot(meta.base);
    const baseDocument = baseFiles.get(meta.path);
    if (baseDocument && (baseDocument.type !== 'blob' || baseDocument.mode !== '100644')) throw failure(409, 'The original draft document is not a regular file.');
    if ((baseFiles.get(meta.path)?.sha || null) !== meta.baseBlob) throw failure(409, 'The draft base document does not match its recorded revision.');
    const comparison = await request(`/compare/${meta.base}...${baseline.head}`);
    if (!['ahead', 'identical'].includes(comparison.status) || comparison.merge_base_commit?.sha !== meta.base) throw failure(409, 'The draft base is not an ancestor of main.');
    let cursor = head, steps = 0;
    while (cursor !== meta.base) {
      if (++steps > 1000) throw failure(503, 'Draft history exceeds the verification limit. A maintainer must inspect it.');
      const current = await commit(cursor), identity = metadata(current);
      if (current.parents?.length !== 1 || ['path','base','baseBlob','creationId'].some(key => identity[key] !== meta[key])) throw failure(409, 'Draft ancestry or identity was changed outside the editor.');
      cursor = current.parents[0].sha;
    }
    const files = await snapshot(head);
    const changes = new Set([...files.keys(), ...baseFiles.keys()]);
    for (const path of changes) {
      const before = baseFiles.get(path), after = files.get(path);
      if (before?.sha === after?.sha && before?.mode === after?.mode) continue;
      if (!after || after.type !== 'blob' || after.mode !== '100644') throw failure(409, 'A draft contains a deletion or non-file change.');
      if (path === meta.path) continue;
      const relative = path.slice(IMAGE_DIRECTORY.length + 1);
      if (!path.startsWith(`${IMAGE_DIRECTORY}/`) || before || meta.assets[relative] !== after.sha) throw failure(409, 'A draft contains changes outside its document and verified new uploads.');
      const bytes = await blob(after.sha);
      const upload = await prepareDraftImage({ area, documentFilename: filename, filename: relative.split('/').at(-1).replace(/-[a-f0-9]{64}(?=\.)/, ''), mimeType: imageContentType(relative), bytes });
      if (upload.path !== relative) throw failure(409, 'A draft upload does not match its content digest or document.');
    }
    for (const [path, sha] of Object.entries(meta.assets)) if (files.get(`${IMAGE_DIRECTORY}/${path}`)?.sha !== sha || baseFiles.has(`${IMAGE_DIRECTORY}/${path}`)) throw failure(409, 'Invalid draft asset manifest.');
    return { branch, head, meta, area, filename, files, content: await text(files.get(meta.path)), mainChanged: (baseline.files.get(meta.path)?.sha || null) !== meta.baseBlob, lastSavedBy: latest.author?.name, lastSavedAt: latest.author?.date };
  }
  async function discover(baseline) {
    const output = [];
    // Sequential verification bounds hosted subrequests and memory. Never hide an
    // unreadable branch and then treat its route as free.
    for (const item of await refs()) {
      if (item?.prefix !== 'refs/heads/cms/drafts/' || typeof item.name !== 'string' || !item.name || typeof item.target?.oid !== 'string' || !item.target.oid) throw failure(503, 'Invalid draft discovery result.');
      // GraphQL names are relative to the queried refPrefix, not refs/heads/.
      const branch = (item.prefix + item.name).slice('refs/heads/'.length);
      output.push(await inspect(branch, item.target.oid, baseline));
    }
    return output;
  }
  const record = draft => ({ filename: draft.filename, sha: draft.files.get(draft.meta.path).sha, content: draft.content, branch: draft.branch, head: draft.head, hasDraft: true, baselineExists: draft.meta.baseBlob !== null, mainChanged: draft.mainChanged, lastSavedBy: draft.lastSavedBy, lastSavedAt: draft.lastSavedAt });
  async function getContent(area, filename) {
    const path = documentPath(area, filename), branch = await draftBranch(area, filename), baseline = await main(), head = await ref(`heads/${branch}`);
    if (head) return record(await inspect(branch, head, baseline));
    const file = baseline.files.get(path);
    if (!file) throw failure(404, 'This document is not present on main or in a saved draft.');
    return { filename, sha: file.sha, content: await text(file), branch: 'main', head: baseline.head, hasDraft: false, baselineExists: true };
  }
  async function authorize() {
    const repository = await request('');
    if (!repository.permissions?.push || !repository.node_id) throw Object.assign(failure(403, 'Repository write permission could not be verified. Sign in again with an authorized account.'), { code: 'access_denied' });
    return repository.node_id;
  }
  async function atomic(updates, repositoryId) {
    const result = await request('/graphql', write({ query: 'mutation CMSSaveDraft($input:UpdateRefsInput!){updateRefs(input:$input){clientMutationId}}', variables: { input: { repositoryId, refUpdates: updates.map(update => ({ ...update, force: false })) } } }));
    if (result.errors?.length) {
      if (result.errors.some(error => ['FORBIDDEN','UNAUTHORIZED'].includes(error.type))) throw failure(403, 'GitHub denied this draft save. Verify your repository access.');
      if (result.errors.some(error => ['UNPROCESSABLE', 'CONFLICT'].includes(error.type))) throw draftConflict();
      throw failure(503, 'GitHub could not confirm the atomic draft save. Your edits remain here. Reopen the shared draft to check before retrying.');
    }
    if (!result.data?.updateRefs) throw failure(503, 'The draft save response could not be confirmed.');
  }
  async function replay(draft, baseline) {
    let head = draft.head;
    while ((await commit(head)).parents[0].sha !== draft.meta.base) head = (await commit(head)).parents[0].sha;
    const original = await inspect(draft.branch, head, baseline);
    return { ...record(original), commitSha: head, replayed: true };
  }
  async function saveContent({ area, filename, content, sha, head: expectedHead, assets = [], creationId }) {
    const path = documentPath(area, filename), branch = await draftBranch(area, filename);
    const repositoryId = await authorize();
    const baseline = await main(), current = await ref(`heads/${branch}`);
    let draft = current ? await inspect(branch, current, baseline) : null;
    if (draft && creationId && draft.meta.creationId === creationId && !sha) return replay(draft, baseline);
    if (draft?.mainChanged) throw failure(409, 'The main document changed since this draft began. Save Draft is blocked to protect published content. Keep or download your edits; repeat editing currently requires an ordinary GitHub PR based on current main. Do not delete drafts or locks to retry.');
    const parent = current || baseline.head, files = draft?.files || baseline.files;
    if (sha) {
      if (!expectedHead || files.get(path)?.sha !== sha || (current && expectedHead !== parent)) throw draftConflict();
      if (!current && expectedHead !== baseline.head) {
        const comparison = await request(`/compare/${encodeURIComponent(expectedHead)}...${baseline.head}`);
        if (!['ahead', 'identical'].includes(comparison.status) || comparison.merge_base_commit?.sha !== expectedHead) throw draftConflict();
      }
    } else if (files.has(path) || draft || expectedHead) throw draftConflict();
    const meta = draft ? { ...draft.meta, assets: { ...draft.meta.assets } } : { version: 1, path, base: baseline.head, baseBlob: baseline.files.get(path)?.sha || null, creationId: creationId || null, assets: {} };
    const original = files.has(path) ? await text(files.get(path)) : null;
    // Defense in depth: the serializer's absence/presence handling must survive
    // direct store use too. Do not let draft saves change visibility or slugs.
    if (original && (contentVisibility(original).draft !== contentVisibility(content).draft || documentSlug(original) !== documentSlug(content))) throw failure(400, 'Save Draft cannot change publication metadata or the document URL.');
    if (!original && contentVisibility(content).draft !== true) throw failure(400, 'New documents must be saved as drafts.');
    const drafts = await discover(baseline);
    const claims = await snapshotRoutes([...baseline.files.values()], request, owner, repo);
    for (const other of drafts) if (other.meta.path !== path) claims.set(documentRoute(`${other.area}/${other.filename}`, documentSlug(other.content)), other.meta.path);
    const route = documentRoute(`${area}/${filename}`, documentSlug(content));
    if (claims.has(route) && claims.get(route) !== path) throw Object.assign(failure(409, routeConflictMessage(route, claims.get(route))), { creationState: 'not-created' });
    const entries = [{ path, mode: '100644', type: 'blob', content }];
    if (!Array.isArray(assets) || assets.length > 20) throw failure(400, 'Save at most 20 pending images at a time.');
    if (assets.reduce((sum, asset) => sum + (typeof asset?.content === 'string' ? asset.content.length : 0), 0) > 20_000_000) throw failure(413, 'Pending images exceed the 15 MB save limit. Save fewer images at a time.');
    const references = imageReferences(content, filename);
    for (const asset of assets) {
      if (!asset || !['filename', 'mimeType', 'content'].every(key => typeof asset[key] === 'string')) throw failure(400, 'Invalid pending image upload.');
      const bytes = decodeBytes(String(asset.content || ''));
      const prepared = await prepareDraftImage({ area, documentFilename: filename, filename: asset.filename, mimeType: asset.mimeType, bytes });
      if (!references.has(prepared.path)) continue; // Unused pending uploads never enter Git.
      const assetPath = `${IMAGE_DIRECTORY}/${prepared.path}`;
      const old = files.get(assetPath), published = baseline.files.get(assetPath);
      const blobSha = await gitBlobShaBytes(bytes);
      if ((old && old.sha !== blobSha) || (published && published.sha !== blobSha)) throw failure(409, 'An immutable image filename has different bytes in the repository.');
      if (!old) {
        const uploaded = await request('/git/blobs', write({ content: prepared.content, encoding: 'base64' }));
        if (uploaded.sha !== blobSha) throw failure(503, 'GitHub did not confirm the uploaded image digest.');
        entries.push({ path: assetPath, mode: '100644', type: 'blob', sha: blobSha });
      }
      if (!baseline.files.has(assetPath)) meta.assets[prepared.path] = blobSha;
    }
    // Newly referenced CMS uploads must belong to this draft, rather than a
    // different document's working branch or an arbitrary browser manifest.
    for (const asset of references) if (asset.startsWith('cms-') && !baseline.files.has(`${IMAGE_DIRECTORY}/${asset}`) && !meta.assets[asset]) throw failure(400, 'An image is not saved with this document. Reattach its pending upload before saving.');
    const nextTree = await request('/git/trees', write({ base_tree: (await commit(parent)).tree.sha, tree: entries }));
    if (!nextTree.sha) throw failure(503, 'GitHub did not confirm the draft tree.');
    const next = await request('/git/commits', write({ message: `[CF-Pages-Skip] Save draft: ${filename}\n\n${MARKER}${JSON.stringify(meta)}`, tree: nextTree.sha, parents: [parent] }));
    if (!next.sha) throw failure(503, 'GitHub did not confirm the draft commit.');
    const saved = { filename, sha: await gitBlobSha(content), content, branch, head: next.sha, commitSha: next.sha, hasDraft: true, baselineExists: meta.baseBlob !== null, lastSavedBy: next.author?.name, lastSavedAt: next.author?.date };
    const updates = [{ name: `refs/heads/${branch}`, beforeOid: current || ZERO, afterOid: next.sha }];
    // Reserve new routes across .md/.mdx, aliases and index equivalents. The
    // immutable tag and working branch are created in ONE atomic transaction.
    if (!original) updates.push({ name: `refs/tags/cms-draft-routes/${await digest(route)}`, beforeOid: ZERO, afterOid: next.sha });
    try { await atomic(updates, repositoryId); }
    catch (error) {
      const actual = await ref(`heads/${branch}`).catch(() => null);
      if (actual === next.sha) return saved;
      if (creationId && actual) {
        const winner = await inspect(branch, actual, baseline);
        if (winner.meta.creationId === creationId) return replay(winner, baseline);
      }
      if (creationId && error.status !== 409 && error.status !== 403) throw uncertainCreation();
      throw error;
    }
    return saved;
  }
  // Publication reads immutable saved objects. It never advances the working ref.
  async function publicationPlan(area, filename, selectedHead, baseline = null, { historical = false } = {}) {
    const path = documentPath(area, filename), branch = await draftBranch(area, filename);
    if (!/^[a-f0-9]{40}$/.test(selectedHead || '')) throw failure(400, 'Select a saved document revision before publishing.');
    baseline ||= await main();
    const current = await ref(`heads/${branch}`);
    if (!current) throw failure(409, 'The saved draft is unavailable.');
    const relation = await request(`/compare/${selectedHead}...${current}`);
    if (!['ahead', 'identical'].includes(relation.status) || relation.merge_base_commit?.sha !== selectedHead) throw failure(409, 'The selected revision is not part of this working draft.');
    const draft = await inspect(branch, selectedHead, baseline);
    if (draft.mainChanged) throw failure(409, 'The public document changed since this draft began. A maintainer must reconcile the versions before publishing.');
    const original = baseline.files.has(path) ? await text(baseline.files.get(path)) : '';
    const content = patchFrontmatter(draft.content, { draft: false });
    if (typeof parseContent(content).title !== 'string' || !parseContent(content).title.trim()) throw failure(400, 'A publication requires a title.');
    if (documentSlug(content) !== documentSlug(original || draft.content)) throw failure(409, 'Publication cannot change the document URL.');
    // Unknown/frontmatter execution hooks are preserved from main, never authorized
    // by a draft's commit message. Supported metadata retains its usual validation.
    const data = source => source ? parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]) : {};
    const before = data(original), after = data(content);
    const editable = new Set(['title', 'description', 'date', 'excerpt', 'authors', 'tags', 'cover', 'draft', ...PAGE_METADATA_FIELDS.filter(key => key !== 'head')]);
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (!editable.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw failure(400, 'Publication cannot change protected frontmatter. Use a reviewed source PR.');
    validatePageMetadata(Object.fromEntries(PAGE_METADATA_FIELDS.filter(key => key in after).map(key => [key, after[key]])), before);
    await validateDocument(content, { filename, originalBody: original ? parseContent(original).body : '' });
    const claims = await snapshotRoutes([...baseline.files.values()].filter(file => file.path !== path), request, owner, repo);
    for (const other of historical ? [] : await discover(baseline)) if (other.meta.path !== path) {
      const route = documentRoute(`${other.area}/${other.filename}`, documentSlug(other.content));
      if (route === documentRoute(`${area}/${filename}`, documentSlug(content))) throw failure(409, 'Another draft claims this publication route.');
    }
    const route = documentRoute(`${area}/${filename}`, documentSlug(content));
    if (claims.has(route) && claims.get(route) !== path) throw failure(409, routeConflictMessage(route, claims.get(route)));
    const entries = [{ path, mode: '100644', type: 'blob', content }];
    const unknown = new Set(), previousImages = new Set();
    imageReferences(original || draft.content, filename, previousImages);
    const references = imageReferences(content, filename, unknown);
    for (const source of unknown) {
      if (previousImages.has(source) && original) continue;
      if (/^https:\/\//i.test(source)) continue;
      if (/^\/[A-Za-z0-9_./-]+$/.test(source) && !source.includes('..') && baseline.files.get(`public${source}`)?.type === 'blob') continue;
      throw failure(400, 'A new image reference cannot be verified on main. Use a document upload or a supported HTTPS URL.');
    }
    for (const asset of references) {
      const assetPath = `${IMAGE_DIRECTORY}/${asset}`, published = baseline.files.get(assetPath);
      if (published) {
        if (published.type !== 'blob' || published.mode !== '100644' || (draft.meta.assets[asset] && published.sha !== draft.meta.assets[asset])) throw failure(409, 'A production image conflicts with this revision.');
      } else {
        if (!draft.meta.assets[asset]) throw failure(409, 'A referenced image is not an authorized upload for this document.');
        entries.push({ path: assetPath, mode: '100644', type: 'blob', sha: draft.meta.assets[asset] });
      }
    }
    const identity = (await digest(path)).slice(0, 32);
    return { area, filename, path, selectedHead, baseline, entries, identity, branch: `cms/publish/${identity}-${selectedHead}`, lock: `refs/tags/cms-publication-locks/${identity}-${draft.meta.baseBlob || 'new'}` };
  }
  async function verifyPublication(branch, head) {
    const value = await commit(head);
    const lines = value.message?.split('\n').filter(line => line.startsWith('CMS-Publication-v1: '));
    if (lines?.length !== 1 || value.parents?.length !== 1) throw failure(409, 'Invalid publication snapshot identity.');
    let meta;
    try { meta = JSON.parse(lines[0].slice('CMS-Publication-v1: '.length)); } catch { throw failure(409, 'Invalid publication metadata.'); }
    const baseline = await main();
    if (value.parents[0].sha !== baseline.head) throw failure(409, 'Publication must be rebuilt and reviewed against current main.');
    const plan = await publicationPlan(meta.area, meta.filename, meta.selectedHead, baseline);
    if (branch !== `${plan.branch}-${baseline.head}-${meta.attempt}` || !Number.isSafeInteger(meta.attempt) || meta.attempt < 1) throw failure(409, 'Publication branch identity mismatch.');
    const files = await snapshot(head), expected = new Map(baseline.files);
    for (const entry of plan.entries) expected.set(entry.path, { ...entry, sha: entry.sha || await gitBlobSha(entry.content) });
    if (files.size !== expected.size || [...expected].some(([path, file]) => { const actual = files.get(path); return !actual || actual.sha !== file.sha || actual.mode !== file.mode || actual.type !== file.type; })) throw failure(409, 'Publication diff contains unexpected content or assets.');
    const stateHead = await ref(`heads/cms/publication-state/${plan.identity}-${(await inspect(await draftBranch(meta.area, meta.filename), meta.selectedHead, baseline)).meta.baseBlob || 'new'}`);
    if (!stateHead) throw failure(409, 'Publication coordinator is missing.');
    const state = await readPublicationState(stateHead, plan.path, commit);
    if (await ref(`tags/cms-publication-locks/${plan.identity}-${(await inspect(await draftBranch(meta.area, meta.filename), meta.selectedHead, baseline)).meta.baseBlob || 'new'}`) !== state.attempts[0].head) throw failure(409, 'Publication lock identity mismatch.');
    const active = state.attempts.at(-1);
    if (state.selectedHead !== meta.selectedHead || active?.head !== head || active?.branch !== branch) throw failure(409, 'This publication attempt was superseded.');
    return plan;
  }
  return {
    publicationPlan, verifyPublication,
    ...createPublicationPRClient({ request, owner, repo, documentPath, draftBranch, digest }),
    drafts: true, workspace: `${owner}/${repo}#cms-drafts-v1`, getContent, saveContent,
    async listContent(area) {
      const prefix = `${contentDirectory(area)}/`, baseline = await main(), drafts = await discover(baseline);
      const entries = new Map([...baseline.files].filter(([path]) => path.startsWith(prefix) && /\.mdx?$/.test(path) && !path.split('/').at(-1).startsWith('_')).map(([path, file]) => [path, { name: path.slice(prefix.length), path, sha: file.sha, baselineExists: true, hasDraft: false }]));
      for (const draft of drafts.filter(item => item.area === area)) entries.set(draft.meta.path, { name: draft.filename, path: draft.meta.path, ...record(draft) });
      await preloadText([...entries.values()].filter(item => !item.content).map(item => baseline.files.get(item.path)));
      const visible = await withContentVisibility([...entries.values()], async item => item.content ?? text(baseline.files.get(item.path)));
      return { branch: 'main', entries: visible.map(({ content, ...item }) => item) };
    },
    async createBlog(input) {
      const area = input.area || 'posts';
      validateCreationAttempt(input.creationId, input.creationFilename);
      const filename = input.creationFilename || input.suggestedFilename || `${postSlug(input.title)}.mdx`;
      try {
        if (filename === 'index.mdx') throw failure(409, 'Choose an article filename other than index.');
        return await saveContent({ area, filename, content: input.content, assets: input.assets, creationId: input.creationId });
      }
      catch (error) {
        if (error.status === 409 && !input.creationRetry) {
          const list = await this.listContent(area);
          const suggestedFilename = availablePostFilename(input.title, [...list.entries.map(item => item.name), filename]);
          throw Object.assign(error, { suggestedFilename, creationState: 'not-created' });
        }
        throw error;
      }
    },
    async listImages({ area, filename } = {}) {
      const baseline = await main(); let files = baseline.files;
      if (area && filename) { const branch = await draftBranch(area, filename), head = await ref(`heads/${branch}`); if (head) files = (await inspect(branch, head, baseline)).files; }
      return { images: [...files].filter(([path]) => path.startsWith(`${IMAGE_DIRECTORY}/`) && /\.(png|jpe?g|gif|webp)$/i.test(path)).map(([path, file]) => ({ path, name: path.slice(IMAGE_DIRECTORY.length + 1), sha: file.sha })) };
    },
    async getImage(path) {
      path = validateImagePath(path); const baseline = await main(); let item = baseline.files.get(`${IMAGE_DIRECTORY}/${path}`);
      if (!item) for (const draft of await discover(baseline)) if (draft.meta.assets[path]) { item = draft.files.get(`${IMAGE_DIRECTORY}/${path}`); break; }
      if (!item) throw failure(404, 'Image not found on main or in a verified draft.');
      const bytes = await blob(item.sha); return { bytes, content: bytes };
    },
    uploadImage: prepareDraftImage,
  };
}
export async function gitBlobShaBytes(bytes) {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`), value = new Uint8Array(header.length + bytes.length);
  value.set(header); value.set(bytes, header.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', value))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

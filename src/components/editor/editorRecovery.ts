import type { Project } from './editorTypes.ts';
import { validEditorRoute, routeKey, type EditorRoute } from './editorNavigation.ts';
import { validCreationId, validCreationFilename } from '../../../editor/articleCreation.mjs';

export type RecoveryFields = Pick<Project, 'filename' | 'title' | 'description' | 'body' | 'draft' | 'date' | 'excerpt' | 'authors' | 'tags' | 'cover' | 'metadata' | 'protectedRemovals' | 'convertProgramUpdate' | 'creationAttempt' | 'assets'>;
export type RecoveryCopy = { version: 1; id: string; revision: string; route: EditorRoute; baseSha: string | null; baseResumeHead?: string | null; savedAt: string; fields: RecoveryFields };
const PREFIX = 'geobtaa-editor-recovery:v1:';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function recoveryFields(project: Project): RecoveryFields {
  return { ...(project.protectedRemovals?.length ? { protectedRemovals: project.protectedRemovals } : {}), filename: project.filename, title: project.title, description: project.description, body: project.body, draft: project.draft, date: project.date || '', excerpt: project.excerpt || '', authors: project.authors || [], tags: project.tags || [], cover: project.cover || null, metadata: project.metadata || {}, convertProgramUpdate: project.convertProgramUpdate === true, ...(project.assets?.length ? { assets: project.assets } : {}), ...(project.creationAttempt ? { creationAttempt: project.creationAttempt } : {}) };
}
function validFields(value: unknown): value is RecoveryFields {
  const allowed = new Set(['filename', 'title', 'description', 'body', 'draft', 'date', 'excerpt', 'authors', 'tags', 'cover', 'metadata', 'protectedRemovals', 'convertProgramUpdate', 'creationAttempt', 'assets']);
  if (!object(value) || !['filename', 'title', 'description', 'body', 'date', 'excerpt'].every(key => typeof value[key] === 'string') || typeof value.draft !== 'boolean' || typeof value.convertProgramUpdate !== 'boolean') return false;
  if (Object.keys(value).some(key => !allowed.has(key))) return false;
  if (value.protectedRemovals !== undefined && (!Array.isArray(value.protectedRemovals) || value.protectedRemovals.length > 1024 || value.protectedRemovals.some(source => typeof source !== 'string') || value.protectedRemovals.join('').length > 1_000_000)) return false;
  if (value.assets !== undefined && (!Array.isArray(value.assets) || value.assets.length > 20 || value.assets.some(asset => !object(asset) || !['filename', 'path', 'mimeType', 'content'].every(key => typeof asset[key] === 'string')))) return false;
  if (value.creationAttempt !== undefined && (!object(value.creationAttempt) || !validCreationId(value.creationAttempt.id) || !validCreationFilename(value.creationAttempt.filename))) return false;
  if (!Array.isArray(value.authors) || !value.authors.every(author => typeof author === 'string' || (object(author) && typeof author.name === 'string'))) return false;
  if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) return false;
  if (value.cover !== null && (!object(value.cover) || typeof value.cover.alt !== 'string')) return false;
  if (!object(value.metadata)) return false;
  const metadata = value.metadata;
  if (metadata.members != null && (!Array.isArray(metadata.members) || !metadata.members.every(member => typeof member === 'string'))) return false;
  if (metadata.head != null && (!Array.isArray(metadata.head) || !metadata.head.every(head => object(head) && typeof head.tag === 'string' && (head.attrs == null || object(head.attrs))))) return false;
  if (metadata.sidebar != null && !object(metadata.sidebar)) return false;
  if (metadata.banner != null && (!object(metadata.banner) || typeof metadata.banner.content !== 'string')) return false;
  return true;
}
export function recoveryPrefix(scope: string) { return PREFIX + encodeURIComponent(scope) + ':'; }
// Call with records already filtered to the signed-in account and workspace.
// A route identifies a saved document or a specific never-saved draft, not a title.
export function groupRecoveryCopies(copies: RecoveryCopy[]) {
  const groups = new Map<string, RecoveryCopy[]>();
  for (const copy of copies) {
    const key = routeKey(copy.route);
    const versions = groups.get(key) || [];
    versions.push(copy); groups.set(key, versions);
  }
  return [...groups.entries()].map(([key, versions]) => {
    versions.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt) || a.id.localeCompare(b.id));
    const latest = versions[0];
    const needsChoice = versions.some(copy => copy.baseSha !== latest.baseSha || copy.baseResumeHead !== latest.baseResumeHead || JSON.stringify(copy.fields) !== JSON.stringify(latest.fields));
    return { key, latest, versions, needsChoice };
  }).sort((a, b) => Date.parse(b.latest.savedAt) - Date.parse(a.latest.savedAt));
}
export function recoveryKey(scope: string, id: string) { return recoveryPrefix(scope) + id; }
export function parseRecovery(source: string): RecoveryCopy | null {
  try {
    const copy = JSON.parse(source);
    if (!object(copy) || copy.version !== 1 || typeof copy.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(copy.id) || typeof copy.revision !== 'string' || typeof copy.savedAt !== 'string' || !Number.isFinite(Date.parse(copy.savedAt))) return null;
    if (!object(copy.route) || !validEditorRoute(copy.route as EditorRoute) || !copy.route.area || (!copy.route.filename && !copy.route.draftId) || !validFields(copy.fields)) return null;
    if (copy.baseResumeHead != null && (typeof copy.baseResumeHead !== 'string' || !/^[a-f0-9]{40}$/.test(copy.baseResumeHead))) return null;
    if (copy.route.filename ? typeof copy.baseSha !== 'string' || !copy.baseSha || copy.fields.filename !== copy.route.filename : copy.baseSha !== null) return null;
    return copy as RecoveryCopy;
  } catch { return null; }
}
// A file is user-selected recovery data, never an authoritative revision or a
// destination to navigate to. Saved pages must match exactly. A never-saved
// backup may be loaded into a blank new page in the same content area.
export const MAX_RECOVERY_FILE_BYTES = 150 * 1024 * 1024;
export function parseRecoveryFile(source: string, route: EditorRoute): RecoveryCopy {
  if (source.length > MAX_RECOVERY_FILE_BYTES) throw new Error('This backup file is too large to restore in the editor. Keep the file and ask a maintainer for help.');
  const copy = parseRecovery(source);
  if (!copy || copy.fields.metadata?.year != null && !['string', 'number'].includes(typeof copy.fields.metadata.year)) throw new Error('This is not a valid editor backup file. Choose the original .json file downloaded from the editor.');
  if (routeKey(route) === routeKey(copy.route)) return copy;
  if (route.area && route.area === copy.route.area && route.draftId && !route.filename && copy.route.draftId && !copy.route.filename && copy.baseSha === null) return { ...copy, route: { ...route } };
  throw new Error(`This backup is for ${copy.route.area}/${copy.route.filename || 'a new page'}. Open that page, or a new page in that content area for an unsaved backup, before restoring it.`);
}
export function readRecoveryCopies(storage: Storage, scope: string, route?: EditorRoute) {
  const copies: RecoveryCopy[] = [];
  let unreadable = false;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(recoveryPrefix(scope))) continue;
    const copy = parseRecovery(storage.getItem(key) || '');
    if (!copy || key !== recoveryKey(scope, copy.id)) { unreadable = true; continue; }
    if (!route || routeKey(route) === routeKey(copy.route)) copies.push(copy);
  }
  return { copies: copies.sort((a, b) => b.savedAt.localeCompare(a.savedAt)), unreadable };
}
export function removeRecovery(storage: Storage, scope: string, copy: RecoveryCopy) {
  const key = recoveryKey(scope, copy.id);
  const latest = parseRecovery(storage.getItem(key) || '');
  if (!latest || latest.revision !== copy.revision) return false;
  storage.removeItem(key); return true;
}
export function recoveryMatches(base: Project, copy: RecoveryCopy) {
  if (base.resumeHead && !copy.baseResumeHead) return !!base.resumeSourceSha && copy.baseSha === base.resumeSourceSha;
  return (base.sha || null) === copy.baseSha && (base.resumeHead || null) === (copy.baseResumeHead || null);
}
export function restoreRecovery(base: Project, route: EditorRoute, copy: RecoveryCopy): Project {
  if (routeKey(route) !== routeKey(copy.route) || !recoveryMatches(base, copy)) throw new Error('The saved version has changed in GitHub. Download a backup to compare your unsaved changes with the latest version.');
  return { ...base, ...copy.fields, filename: base.sha ? base.filename : copy.fields.filename, sha: base.sha, ...(base.resumeHead ? { draft: base.draft } : {}), content: base.content, conversion: base.conversion };
}
export function downloadRecovery(copy: RecoveryCopy) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `unsaved-changes-backup-${copy.savedAt.replace(/[^0-9]/g, '')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

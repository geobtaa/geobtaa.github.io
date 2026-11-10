import type { Project } from './editorTypes.ts';
import { validEditorRoute, routeKey, type EditorRoute } from './editorNavigation.ts';

export type RecoveryFields = Pick<Project, 'filename' | 'title' | 'description' | 'body' | 'draft' | 'date' | 'excerpt' | 'authors' | 'tags' | 'cover' | 'metadata' | 'convertProgramUpdate'>;
export type RecoveryCopy = { version: 1; id: string; revision: string; route: EditorRoute; baseSha: string | null; savedAt: string; fields: RecoveryFields };
const PREFIX = 'geobtaa-editor-recovery:v1:';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function recoveryFields(project: Project): RecoveryFields {
  return { filename: project.filename, title: project.title, description: project.description, body: project.body, draft: project.draft, date: project.date || '', excerpt: project.excerpt || '', authors: project.authors || [], tags: project.tags || [], cover: project.cover || null, metadata: project.metadata || {}, convertProgramUpdate: project.convertProgramUpdate === true };
}
function validFields(value: unknown): value is RecoveryFields {
  const allowed = new Set(['filename', 'title', 'description', 'body', 'draft', 'date', 'excerpt', 'authors', 'tags', 'cover', 'metadata', 'convertProgramUpdate']);
  if (!object(value) || !['filename', 'title', 'description', 'body', 'date', 'excerpt'].every(key => typeof value[key] === 'string') || typeof value.draft !== 'boolean' || typeof value.convertProgramUpdate !== 'boolean') return false;
  if (Object.keys(value).some(key => !allowed.has(key))) return false;
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
export function recoveryKey(scope: string, id: string) { return recoveryPrefix(scope) + id; }
export function parseRecovery(source: string): RecoveryCopy | null {
  try {
    const copy = JSON.parse(source);
    if (!object(copy) || copy.version !== 1 || typeof copy.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(copy.id) || typeof copy.revision !== 'string' || typeof copy.savedAt !== 'string' || !Number.isFinite(Date.parse(copy.savedAt))) return null;
    if (!object(copy.route) || !validEditorRoute(copy.route as EditorRoute) || !copy.route.area || (!copy.route.filename && !copy.route.draftId) || !validFields(copy.fields)) return null;
    if (copy.route.filename ? typeof copy.baseSha !== 'string' || !copy.baseSha || copy.fields.filename !== copy.route.filename : copy.baseSha !== null) return null;
    return copy as RecoveryCopy;
  } catch { return null; }
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
export function restoreRecovery(base: Project, route: EditorRoute, copy: RecoveryCopy): Project {
  if (routeKey(route) !== routeKey(copy.route) || (base.sha || null) !== copy.baseSha) throw new Error('The repository version has changed. Download the recovery copy to compare it with the latest version.');
  return { ...base, ...copy.fields, filename: base.sha ? base.filename : copy.fields.filename, sha: base.sha, content: base.content, conversion: base.conversion };
}
export function downloadRecovery(copy: RecoveryCopy) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `editor-recovery-${copy.savedAt.replace(/[^0-9]/g, '')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

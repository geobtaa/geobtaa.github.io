import { contentDirectory, validateContentPath } from './contentAreas.mjs';
import { postSlug } from './blog.mjs';
const MARKER = 'CMS-Draft-v1: ';
const failure = (status, message) => Object.assign(new Error(message), { status });
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function documentPath(area, filename) {
  const canonical = validateContentPath(filename);
  // Decode once at the HTTP boundary; aliases must not create another identity.
  if (canonical !== filename || canonical.split('/').at(-1).startsWith('_')) throw failure(400, 'Use a canonical, routed document filename.');
  return `${contentDirectory(area)}/${canonical}`;
}
export async function draftBranch(area, filename, meta = null) {
  const path = documentPath(area, filename);
  const legacy = `cms/drafts/${area}/${postSlug(filename.replace(/\.mdx?$/, '')).slice(0, 40)}-${(await digest(path)).slice(0, 32)}`;
  if (meta?.version === 2) {
    if (!/^[a-f0-9]{40}$/.test(meta.previousHead || '') || !/^[a-f0-9]{40}$/.test(meta.baseBlob || '') || typeof meta.previousBranch !== 'string') throw failure(409, 'Invalid saved draft continuation.');
    return `${legacy}-cycle-${(await digest(`${meta.previousHead}:${meta.baseBlob}`)).slice(0, 32)}`;
  }
  return legacy;
}
export function draftMetadata(commit) {
  const lines = commit.message?.split('\n').filter(line => line.startsWith(MARKER));
  if (lines?.length !== 1) throw failure(409, 'A draft branch has unrecognized metadata. A maintainer must inspect it.');
  try { return JSON.parse(lines[0].slice(MARKER.length)); } catch { throw failure(409, 'Invalid draft identity metadata.'); }
}


// Separate repeated editing cycles even when a merge leaves identical document bytes.
export function publicationBaseKey(meta) {
  return meta.version === 2 ? `${meta.baseBlob}-${meta.previousHead}` : meta.baseBlob || 'new';
}

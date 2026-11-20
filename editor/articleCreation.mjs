export const validCreationId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(value);
export const validCreationFilename = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,90}\.mdx$/.test(value);
export function validateCreationAttempt(id, filename) {
  if (id === undefined && filename === undefined) return;
  if (!validCreationId(id) || !validCreationFilename(filename)) throw Object.assign(new Error('Invalid article creation identifier or filename.'), { status: 400 });
}

// Look only at history for the fixed target filename and an immutable branch
// snapshot. Never assume that matching content means this request created it.
export async function findArticleCreation({ request, ref, prefix, filename, id, branch }) {
  if (!id) return null;
  for (let page = 1; page <= 10; page++) {
    const history = await request(`/commits?sha=${encodeURIComponent(ref)}&path=${encodeURIComponent(prefix + filename)}&per_page=100&page=${page}`);
    if (!Array.isArray(history)) throw new Error('Article creation history could not be read.');
    const created = history.find(item => item.commit?.message?.split('\n').includes(`CMS-Creation: ${id}`));
    if (created) {
      if (typeof created.sha !== 'string' || !created.sha) throw new Error('The creation commit is unreadable.');
      const file = await request(`/contents/${prefix}${filename}?ref=${encodeURIComponent(created.sha)}`);
      if (!file.sha || file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('The created article could not be read.');
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), char => char.charCodeAt(0));
      return { filename, sha: file.sha, commitSha: created.sha, branch, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes), replayed: true };
    }
    if (history.length < 100) return null;
  }
  throw new Error('Too much article history to verify this creation safely.');
}

export const uncertainCreation = () => Object.assign(new Error('Document creation could not be confirmed. Your edits are still here. Retry safely to check the original creation; do not create a duplicate document.'), { status: 503, creationState: 'uncertain' });

export async function gitBlobSha(content) {
  const bytes = new TextEncoder().encode(content);
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const input = new Uint8Array(header.length + bytes.length);
  input.set(header); input.set(bytes, header.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', input))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

import { newContent, contentVisibility } from './content.mjs';
import { parseBlog, serializeBlog } from './blog.mjs';
import { parsePageMetadata, patchFrontmatter } from './pageMetadata.mjs';
import { contentArea } from './contentAreas.mjs';
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

export function parsePage(content) {
  return { ...parseBlog(content), ...parsePageMetadata(content) };
}
export function serializePage(original, input) {
  const existing = parsePage(original);
  if (typeof input.description !== 'string') throw invalid('Description must be text.');
  // Other page types may omit or remove dates; blog dates retain their rules.
  const base = input.date === '' && existing.date ? patchFrontmatter(original, { date: undefined }) : original;
  return serializeBlog(base, input);
}
export function newPage(area, input) {
  const config = contentArea(area);
  const base = newContent({ title: input.title, description: input.description ?? '', draft: input.draft ?? false, body: '' }, { description: config.description, draft: config.publishing });
  return serializePage(base, { ...parsePage(base), ...input });
}
export async function savePage(github, area, filename, input) {
  const config = contentArea(area);
  if (!config) throw invalid('This content directory is not enabled in the editor.');
  let original;
  if (input.sha) {
    const loaded = await github.getContent(area, filename);
    if (loaded.sha !== input.sha) throw Object.assign(new Error('This page has changed in GitHub since you opened it. Reload the latest version before saving.'), { status: 409 });
    original = loaded.content;
  } else if (!config.create) throw invalid('New files are not enabled for this content directory.');
  const existing = original ? parsePage(original) : {};
  const entry = { ...existing, ...input, description: input.description ?? existing.description ?? '', draft: input.draft ?? (config.publishing ? !input.publish : existing.draft ?? false), body: input.body ?? existing.body ?? '' };
  const content = original ? serializePage(original, entry) : newPage(area, entry);
  const saved = await github.saveContent({ area, filename, content, sha: input.sha, publish: config.publishing && !entry.draft });
  return { ...saved, filename, content, ...parsePage(content), ...contentVisibility(content) };
}

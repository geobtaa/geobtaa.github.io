import { isMap, parseDocument, stringify } from 'yaml';
import { parseContent } from './content.mjs';

const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n(?:\r?\n)?)([\s\S]*)$/;
const fields = ['title', 'date', 'draft', 'excerpt', 'authors', 'tags', 'cover'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

function document(content) {
  const match = content.match(FRONTMATTER);
  if (!match) throw invalid('Content file does not have valid YAML frontmatter.');
  const doc = parseDocument(match[2]);
  if (doc.errors.length || !isMap(doc.contents)) throw invalid('Blog frontmatter must be a valid YAML mapping.');
  return { match, doc, data: doc.toJS() };
}

// Use the written calendar date, never Date/toISOString on stored timestamps.
export function calendarDate(value) {
  return typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '' : '';
}

export function todayCalendar(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseBlog(content) {
  const { data } = document(content);
  return {
    ...parseContent(content),
    date: calendarDate(data.date),
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    authors: data.authors == null ? [] : Array.isArray(data.authors) ? data.authors : [data.authors],
    tags: data.tags ?? [],
    cover: data.cover ?? null,
  };
}

export function validateBlog(input, existing) {
  if (typeof input.title !== 'string' || !input.title.trim()) throw invalid('Title is required.');
  if (typeof input.body !== 'string') throw invalid('Body must be text.');
  if (typeof input.draft !== 'boolean') throw invalid('Hide from site must be true or false.');
  const date = input.date;
  // Do not force an untouched legacy post to acquire a missing optional date.
  if (date || !existing || date !== existing.date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw invalid('Enter a valid publication date.');
    const [year, month, day] = date.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > days) throw invalid('Enter a valid publication date.');
  }
  if (typeof input.excerpt !== 'string') throw invalid('Excerpt must be text.');
  if (!Array.isArray(input.authors) || input.authors.some((author) => typeof author === 'string' ? !author.trim() : !author || typeof author.name !== 'string' || !author.name.trim())) throw invalid('Each author needs a name.');
  if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) throw invalid('Each tag must be nonblank text.');
  if (input.cover !== null && (!input.cover || typeof input.cover !== 'object' || Array.isArray(input.cover))) throw invalid('Cover must be an image object.');
  // Unchanged legacy covers remain intact, including light/dark variants.
  if (input.cover && (!existing || !same(input.cover, existing.cover))) {
    const cover = input.cover;
    const images = 'image' in cover ? [cover.image] : [cover.light, cover.dark];
    if (images.some((image) => typeof image !== 'string' || !image.trim()) || typeof cover.alt !== 'string') throw invalid('A cover needs an image and alt text.');
    if (cover.caption !== undefined && typeof cover.caption !== 'string') throw invalid('Cover caption must be text.');
  }
  return input;
}

export function newBlog(input) {
  input = { date: todayCalendar(), draft: true, excerpt: '', authors: [], tags: [], cover: null, body: '', ...input };
  validateBlog(input);
  const data = { title: input.title.trim(), date: input.date, draft: input.draft };
  if (input.excerpt) data.excerpt = input.excerpt;
  if (input.authors.length) data.authors = input.authors;
  if (input.tags.length) data.tags = input.tags;
  if (input.cover) data.cover = input.cover;
  return `---\n${stringify(data)}---\n\n${input.body}`;
}

export function serializeBlog(original, input) {
  const { match, doc, data } = document(original);
  const existing = parseBlog(original);
  validateBlog(input, existing);
  const edits = [];
  for (const field of fields) {
    if (same(input[field], existing[field])) continue;
    let value = input[field];
    if (field === 'date' && typeof data.date === 'string') value += data.date.slice(10);
    if (field === 'authors' && !Array.isArray(data.authors) && data.authors != null && value.length === 1) value = value[0];
    const pair = doc.contents.items.find((item) => item.key?.value === field);
    const empty = field === 'cover' ? value === null : ['excerpt', 'authors', 'tags'].includes(field) && value.length === 0;
    // Replace only the changed field. Other YAML, comments, optional values, and
    // timestamp spelling remain byte-for-byte intact.
    const replacement = empty ? '' : stringify({ [field]: value });
    if (pair) {
      const lineEnd = match[2].indexOf('\n', pair.key.range[0]);
      const end = pair.value?.range?.[2] ?? (lineEnd === -1 ? match[2].length : lineEnd + 1);
      edits.push({ start: pair.key.range[0], end, text: end >= match[2].length ? replacement.replace(/\n$/, '') : replacement });
    }
    else if (!empty) edits.push({ start: match[2].length, end: match[2].length, text: `\n${replacement.trimEnd()}` });
  }
  let yaml = match[2];
  for (const edit of edits.sort((a, b) => b.start - a.start)) yaml = yaml.slice(0, edit.start) + edit.text + yaml.slice(edit.end);
  const newline = match[1].includes('\r\n') ? '\r\n' : '\n';
  return `${match[1]}${yaml.replace(/\r?\n/g, newline)}${match[3]}${input.body}`;
}

export function postSlug(title) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '') || 'post';
}

export async function saveBlog(github, filename, input) {
  if (!filename) {
    const content = newBlog(input);
    const saved = await github.createBlog({ title: input.title, suggestedFilename: input.suggestedFilename, content });
    return { ...saved, content, ...parseBlog(content) };
  }
  if (!input.sha) throw invalid('An existing post SHA is required. Create new posts through the blog collection.');
  const loaded = await github.getContent('posts', filename);
  if (loaded.sha !== input.sha) throw Object.assign(new Error('This page has changed in GitHub since you opened it. Your edits are still here; copy them before reloading.'), { status: 409 });
  // Use authoritative frontmatter, never a client-supplied originalContent.
  const content = serializeBlog(loaded.content, { ...parseBlog(loaded.content), ...input });
  const saved = await github.saveContent({ area: 'posts', filename, content, sha: input.sha });
  return { ...saved, filename, content, ...parseBlog(content) };
}

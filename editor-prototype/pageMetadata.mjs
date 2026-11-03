import { isMap, parseDocument, stringify } from 'yaml';

const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n(?:\r?\n)?)([\s\S]*)$/;
export const PAGE_METADATA_FIELDS = ['year', 'committee', 'lead', 'members', 'dates_active', 'sidebar', 'tableOfContents', 'template', 'hidePageTitle', 'pagefind', 'banner', 'head'];
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function document(content) {
  const match = content.match(FRONTMATTER);
  if (!match) throw invalid('Content file does not have valid YAML frontmatter.');
  const doc = parseDocument(match[2]);
  if (doc.errors.length || !isMap(doc.contents)) throw invalid('Frontmatter must be a valid YAML mapping.');
  return { match, doc, data: doc.toJS() };
}
export function parsePageMetadata(content) {
  const { data } = document(content);
  return { metadata: Object.fromEntries(PAGE_METADATA_FIELDS.filter((field) => Object.hasOwn(data, field)).map((field) => [field, data[field]])), frontmatterFields: Object.keys(data) };
}
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function validatePageMetadata(metadata, existing = {}) {
  if (!object(metadata)) throw invalid('Page metadata must be an object.');
  for (const [field, value] of Object.entries(metadata)) {
    if (!PAGE_METADATA_FIELDS.includes(field)) throw invalid(`Editing ${field} is not supported.`);
    if (value == null || same(value, existing[field])) continue;
    if (['committee', 'lead', 'dates_active'].includes(field) && typeof value !== 'string') throw invalid(`${field} must be text.`);
    if (field === 'year' && (!/^\d{4}$/.test(String(value)) || Number(value) < 1800 || Number(value) > 2100)) throw invalid('Enter a year between 1800 and 2100.');
    if (field === 'members' && (!Array.isArray(value) || value.some((member) => typeof member !== 'string' || !member.trim()))) throw invalid('Each member needs a name.');
    if (['hidePageTitle', 'pagefind'].includes(field) && typeof value !== 'boolean') throw invalid(`${field} must be true or false.`);
    if (field === 'template' && !['doc', 'splash'].includes(value)) throw invalid('Choose a document or splash layout.');
    if (field === 'sidebar') {
      if (!object(value)) throw invalid('Sidebar settings must be an object.');
      if (value.label !== undefined && typeof value.label !== 'string') throw invalid('Navigation label must be text.');
      if (value.order !== undefined && (typeof value.order !== 'number' || !Number.isFinite(value.order))) throw invalid('Navigation order must be a number.');
      if (value.hidden !== undefined && typeof value.hidden !== 'boolean') throw invalid('Navigation visibility must be true or false.');
    }
    if (field === 'tableOfContents') {
      if (typeof value !== 'boolean' && !object(value)) throw invalid('Table of contents settings are invalid.');
      if (object(value)) {
        for (const key of ['minHeadingLevel', 'maxHeadingLevel']) if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > 6)) throw invalid('Table of contents heading levels must be between 1 and 6.');
        if ((value.minHeadingLevel ?? 2) > (value.maxHeadingLevel ?? 3)) throw invalid('The minimum heading level cannot exceed the maximum.');
      }
    }
    if (field === 'banner' && (!object(value) || typeof value.content !== 'string')) throw invalid('Banner content must be text.');
    if (field === 'head') {
      if (!Array.isArray(value) || value.some((item) => !object(item) || typeof item.tag !== 'string' || (item.attrs !== undefined && !object(item.attrs)))) throw invalid('Page head settings are invalid.');
      for (const item of value) if (item.attrs && Object.values(item.attrs).some((attribute) => typeof attribute !== 'string' && typeof attribute !== 'boolean' && typeof attribute !== 'number')) throw invalid('Page head attribute values are invalid.');
    }
  }
}

// Blog-style targeted YAML patches: leave all untouched fields and the body
// verbatim, including optional keys, comments, timestamps, and unknown metadata.
export function patchFrontmatter(content, changes) {
  const { match, doc, data } = document(content);
  const edits = [];
  for (const [field, value] of Object.entries(changes)) {
    if (same(value, data[field]) || (value === undefined && !Object.hasOwn(data, field))) continue;
    const pair = doc.contents.items.find((item) => item.key?.value === field);
    const replacement = value === undefined ? '' : stringify({ [field]: value });
    if (pair) {
      const lineEnd = match[2].indexOf('\n', pair.key.range[0]);
      const end = pair.value?.range?.[2] ?? (lineEnd === -1 ? match[2].length : lineEnd + 1);
      edits.push({ start: pair.key.range[0], end, text: end >= match[2].length ? replacement.replace(/\n$/, '') : replacement });
    } else if (value !== undefined) edits.push({ start: match[2].length, end: match[2].length, text: `\n${replacement.trimEnd()}` });
  }
  let yaml = match[2];
  for (const edit of edits.sort((a, b) => b.start - a.start)) yaml = yaml.slice(0, edit.start) + edit.text + yaml.slice(edit.end);
  const newline = match[1].includes('\r\n') ? '\r\n' : '\n';
  return `${match[1]}${yaml.replace(/\r?\n/g, newline)}${match[3]}${match[4]}`;
}
export function applyPageMetadata(content, metadata) {
  if (metadata === undefined) return content;
  const existing = parsePageMetadata(content).metadata;
  validatePageMetadata(metadata, existing);
  const changes = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (same(value, existing[key])) continue;
    // null is an explicit removal; omitted fields are not edits.
    changes[key] = value === null ? undefined : value;
  }
  return patchFrontmatter(content, changes);
}

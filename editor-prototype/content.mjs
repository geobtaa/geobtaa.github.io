import { parseDocument } from 'yaml';

const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n(?:\r?\n)?)([\s\S]*)$/;

export function parseContent(content) {
  const match = content.match(FRONTMATTER);
  if (!match) throw new Error('Content file does not have valid YAML frontmatter.');

  const data = parseDocument(match[2]).toJS() ?? {};
  return {
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    draft: data.draft === true,
    body: match[4],
  };
}

export const parseProject = parseContent;

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function replaceField(yaml, name, value) {
  const line = new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n)?`, 'm');
  const replacement = `${name}: ${value}\n`;
  if (line.test(yaml)) return yaml.replace(line, replacement);
  return `${yaml.replace(/\s*$/, '')}\n${replacement}`;
}

export function serializeContent(original, entry, options = {}) {
  const match = original.match(FRONTMATTER);
  if (!match) throw new Error('Content file does not have valid YAML frontmatter.');

  let yaml = match[2];
  const existing = parseContent(original);
  if (existing.title !== entry.title) yaml = replaceField(yaml, 'title', yamlScalar(entry.title));
  if (options.description && existing.description !== entry.description) yaml = replaceField(yaml, 'description', yamlScalar(entry.description));
  if (options.draft && (existing.draft !== entry.draft || (entry.draft && !/^draft:/m.test(yaml)))) yaml = replaceField(yaml, 'draft', entry.draft ? 'true' : 'false');

  const newline = match[1].includes('\r\n') ? '\r\n' : '\n';
  yaml = yaml.replace(/\r?\n/g, newline);
  const body = String(entry.body ?? '').replace(/\r?\n/g, newline);
  const boundary = match[3].replace(/\r?\n/g, newline);
  return `${match[1].replace(/\r?\n/g, newline)}${yaml}${boundary}${body}`;
}

export function serializeProject(original, project) {
  return serializeContent(original, project, { description: true, draft: true });
}

export function newProject(project) {
  return newContent(project, { description: true, draft: true });
}

export function newContent(entry, options = {}) {
  const yaml = [
    `title: ${yamlScalar(entry.title)}`,
    ...(options.description ? [`description: ${yamlScalar(entry.description)}`] : []),
    ...(options.draft ? [`draft: ${entry.draft ? 'true' : 'false'}`] : []),
  ].join('\n');
  return `---\n${yaml}\n---\n\n${String(entry.body ?? '').replace(/^\n/, '')}`;
}

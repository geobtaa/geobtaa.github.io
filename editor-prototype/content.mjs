import { parseDocument } from 'yaml';

const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)(?:\r?\n)?([\s\S]*)$/;

export function parseProject(content) {
  const match = content.match(FRONTMATTER);
  if (!match) throw new Error('Project file does not have valid YAML frontmatter.');

  const data = parseDocument(match[2]).toJS() ?? {};
  return {
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    draft: data.draft === true,
    body: match[4],
  };
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function replaceField(yaml, name, value) {
  const line = new RegExp(`^${name}:[^\\r\\n]*(?:\\r?\\n)?`, 'm');
  const replacement = `${name}: ${value}\n`;
  if (line.test(yaml)) return yaml.replace(line, replacement);
  return `${yaml.replace(/\s*$/, '')}\n${replacement}`;
}

export function serializeProject(original, project) {
  const match = original.match(FRONTMATTER);
  if (!match) throw new Error('Project file does not have valid YAML frontmatter.');

  let yaml = match[2];
  const existing = parseProject(original);
  if (existing.title !== project.title) yaml = replaceField(yaml, 'title', yamlScalar(project.title));
  if (existing.description !== project.description) yaml = replaceField(yaml, 'description', yamlScalar(project.description));
  if (existing.draft !== project.draft || !/^draft:/m.test(yaml)) yaml = replaceField(yaml, 'draft', project.draft ? 'true' : 'false');

  const newline = match[1].includes('\r\n') ? '\r\n' : '\n';
  yaml = yaml.replace(/\r?\n/g, newline).replace(/\s*$/, '');
  const body = String(project.body ?? '').replace(/\r?\n/g, newline);
  return `---${newline}${yaml}${newline}---${newline}${newline}${body.replace(/^\r?\n/, '')}`;
}

export function newProject(project) {
  const yaml = [
    `title: ${yamlScalar(project.title)}`,
    `description: ${yamlScalar(project.description)}`,
    `draft: ${project.draft ? 'true' : 'false'}`,
  ].join('\n');
  return `---\n${yaml}\n---\n\n${String(project.body ?? '').replace(/^\n/, '')}`;
}

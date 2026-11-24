import { parseBodySyntax, type SyntaxNode } from './contentSyntax.ts';

const aliases: Record<string, string> = { note: 'note', info: 'note', tip: 'tip', caution: 'caution', warning: 'caution', Caution: 'caution', danger: 'danger' };
const bodyNodes = new Set(['paragraph', 'heading', 'text', 'break', 'emphasis', 'strong', 'delete', 'inlineCode', 'code', 'thematicBreak', 'blockquote', 'list', 'listItem', 'link']);
function supportedBody(node: SyntaxNode): boolean {
  if (!bodyNodes.has(node.type) || (node.type === 'listItem' && node.checked != null)) return false;
  if (node.type === 'code' && 'meta' in node && node.meta) return false;
  return !node.children || node.children.every(supportedBody);
}
export type DirectiveCalloutFields = { type: string; title: string; text: string };

/** Only expose syntax represented by the nested rich-text editor, never JSX or expressions. */
export function parseDirectiveCallout(source: string) {
  if (!/^ {0,3}:{3,}/.test(source)) return null;
  const candidate = source.trim();
  const opening = candidate.match(/^(:{3,})(note|tip|caution|danger|info|warning|Caution)(?=\[|[ \t\r\n]|$)[^\r\n]*(\r?\n)/);
  if (!opening) return null;
  const closeStart = candidate.lastIndexOf('\n') + 1;
  const closing = candidate.slice(closeStart).match(/^ {0,3}(:{3,})[ \t]*$/);
  if (!closing || closing[1].length < opening[1].length || closeStart < opening[0].length) return null;
  let tree;
  try { tree = parseBodySyntax(candidate); } catch { return null; }
  const node = tree.children[0] as SyntaxNode;
  if (tree.children.length !== 1 || node?.type !== 'containerDirective' || node.name !== opening[2] || node.position?.end.offset !== candidate.length || Object.keys(node.attributes || {}).length) return null;
  const children = [...(node.children || [])];
  // A colon line inside an unterminated code fence is not a directive close.
  if (children.some(child => (child.position?.end.offset || 0) > closeStart)) return null;
  const first = children[0];
  const label = first?.data && 'directiveLabel' in first.data && first.data.directiveLabel ? children.shift() : undefined;
  if (label?.children?.some(child => child.type !== 'text') || !children.every(supportedBody)) return null;
  const text = candidate.slice(opening[0].length, closeStart).replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n[ \t]*)+$/g, '');
  // The extracted body must also be safe on its own in the nested editor.
  try { if (!parseBodySyntax(text).children.every(supportedBody)) return null; } catch { return null; }
  return {
    fields: { type: aliases[opening[2]], title: label?.children?.map(child => child.value || '').join('') || '', text },
    raw: source, candidate, offset: source.indexOf(candidate), opening, closeStart,
  };
}

function encodeTitle(title: string) {
  return title.replace(/[&<>"'`*_{}\[\]()+\-.!#:|~\\\r\n]/g, character => `&#${character.charCodeAt(0)};`);
}

export function updateDirectiveCallout(source: string, fields: DirectiveCalloutFields) {
  const parsed = parseDirectiveCallout(source);
  if (!parsed || !['note', 'tip', 'caution', 'danger'].includes(fields.type)) return source;
  if (fields.type === parsed.fields.type && fields.title === parsed.fields.title && fields.text === parsed.fields.text) return source;
  const { candidate, offset, opening, closeStart } = parsed;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const bodyChanged = fields.text !== parsed.fields.text;
  const body = bodyChanged ? `${newline}${fields.text.replace(/\r?\n/g, newline)}${newline}${newline}` : candidate.slice(opening[0].length, closeStart);
  // A literal colon fence in edited text must never close the surrounding callout.
  const runs = body.match(/^ {0,3}:+[ \t]*(?=\r?$)/gm) || [];
  const fence = ':'.repeat(Math.max(opening[1].length, ...runs.map(run => run.trim().length + 1)));
  const title = fields.title === parsed.fields.title
    ? opening[0].slice(opening[1].length + opening[2].length).replace(/[ \t]*\r?\n$/, '')
    : fields.title ? `[${encodeTitle(fields.title)}]` : '';
  const headerWhitespace = opening[0].match(/[ \t]*\r?\n$/)![0];
  const closing = candidate.slice(closeStart).match(/^( *)(:+)([ \t]*)$/)!;
  const closingFence = ':'.repeat(Math.max(fence.length, closing[2].length));
  const updated = `${fence}${fields.type}${title}${headerWhitespace}${body}${closing[1]}${closingFence}${closing[3]}`;
  return source.slice(0, offset) + updated + source.slice(offset + candidate.length);
}

/** Match one complete, explicitly closed directive, leaving adjacent blocks separate. */
export function matchDirectiveCallout(source: string) {
  if (!/^ {0,3}:{3,}(?:note|tip|caution|danger|info|warning|Caution)(?=\[|[ \t\r\n]|$)/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  const end = tree.children[0]?.position?.end.offset;
  if (end === undefined) return null;
  const after = source.slice(end).match(/^[ \t]*(?:\r?\n|$)/)?.[0];
  if (after === undefined) return null;
  const raw = source.slice(0, end + after.length);
  return parseDirectiveCallout(raw) ? raw : null;
}

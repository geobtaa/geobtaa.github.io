import { parseBodySyntax, supportedMarkdownNode, mdxOnlyMarkdownNode, type SourceFormat, type SyntaxNode } from './contentSyntax.ts';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import { matchFormattedImage } from './formattedImage.ts';
import { parseSimpleComponentMdx } from './simpleComponents.ts';
import { parseLinkButtonMdx } from './linkButtonMdx.ts';
import { parseLinkCardMdx } from './linkCardMdx.ts';
import { parseCollectionMdx } from './collectionMdx.ts';
import { parseContainedLinkCards } from './containedLinkCards.ts';
import { parseLegacyChipList } from './legacyChipList.ts';
import { parseLegacyCardGrid } from './legacyCardGrid.ts';

export type ProtectedSource = { protectedType: 'setup' | 'content' | 'uncertain'; sourceLabel: string };

export type BodySegment = { id: number; kind: 'markdown' | 'protected' | 'structured'; content: string; containedLinkCards?: boolean; legacyChipList?: boolean; legacyCardGrid?: boolean; protectedType?: ProtectedSource['protectedType']; sourceLabel?: string };

// Classification describes presentation only. All protected categories retain
// the same source preservation, movement and removal restrictions.
function protectionForNode(node: SyntaxNode, source: string): ProtectedSource {
  if (node.type === 'mdxjsEsm') return { protectedType: 'setup', sourceLabel: 'Imports and page code' };
  if (node.type === 'mdxFlowExpression') return { protectedType: 'setup', sourceLabel: 'Page expression or comment' };
  if (node.type === 'paragraph' && node.children?.length === 1) {
    const child = node.children[0];
    if (child.type === 'mdxJsxTextElement' && ['script', 'style'].includes(child.name || '')) return { protectedType: 'setup', sourceLabel: `Page ${child.name}` };
  }
  if (node.type === 'mdxJsxFlowElement') {
    if (['script', 'style'].includes(node.name || '')) return { protectedType: 'setup', sourceLabel: `Page ${node.name}` };
    return { protectedType: 'content', sourceLabel: node.name ? `Existing component or layout: ${node.name}` : 'Existing MDX fragment' };
  }
  if (node.type === 'html') {
    const name = source.match(/^\s*<([\w.:-]+)/)?.[1];
    if (name && ['script', 'style'].includes(name.toLowerCase())) return { protectedType: 'setup', sourceLabel: `Page ${name.toLowerCase()}` };
    return { protectedType: 'content', sourceLabel: name ? `Existing HTML or component: ${name}` : 'Existing HTML block' };
  }
  // A Markdown file can contain legacy import-looking prose. Only hide it as
  // setup when the complete isolated block parses as actual MDX page code.
  if (node.type === 'paragraph' && /^\s*import\b/.test(source)) {
    try {
      const parsed = parseBodySyntax(source);
      if (parsed.children.length === 1 && parsed.children[0].type === 'mdxjsEsm') return { protectedType: 'setup', sourceLabel: 'Imports and page code' };
    } catch { /* Ambiguous source remains visible. */ }
  }
  const labels: Record<string, string> = { paragraph: 'Existing text with unsupported syntax', heading: 'Existing heading', list: 'Existing list', table: 'Existing table', definition: 'Existing reference definition', footnoteDefinition: 'Existing footnote', containerDirective: 'Existing directive', leafDirective: 'Existing directive', blockquote: 'Existing quotation' };
  return labels[node.type] ? { protectedType: 'content', sourceLabel: labels[node.type] } : { protectedType: 'uncertain', sourceLabel: 'Unclassified source' };
}

// Accept the old option for existing callers; protected syntax nodes now always
// stay separate, including callers that formerly requested merged presentation.
export function splitBody(body: string, { format = 'mdx' }: { mergeProtected?: boolean; format?: SourceFormat } = {}): BodySegment[] {
  if (!body.trim()) return [{ id: 0, kind: 'markdown', content: body }];
  let tree;
  try { tree = parseBodySyntax(body, format); }
  catch {
    // Uncertain syntax is never partially exposed to a lossy editor. The API
    // reports syntax errors on save; the original source remains available.
    return [{ id: 0, kind: 'protected', content: body, protectedType: 'uncertain', sourceLabel: 'Source could not be parsed' }];
  }
  const segments: BodySegment[] = [];
  const push = (kind: BodySegment['kind'], content: string, protection?: ProtectedSource) => {
    if (!content) return;
    const previous = segments.at(-1);
    const legacyChipList = kind === 'protected' && format === 'mdx' && !!parseLegacyChipList(content);
    const legacyCardGrid = kind === 'protected' && format === 'mdx' && !!parseLegacyCardGrid(content);
    const containedLinkCards = !legacyChipList && kind === 'protected' && format === 'mdx' && !!parseContainedLinkCards(content);
    if (!legacyCardGrid && !previous?.legacyCardGrid && !legacyChipList && !previous?.legacyChipList && !containedLinkCards && !previous?.containedLinkCards && kind === 'markdown' && previous?.kind === kind) previous.content += content;
    else segments.push({ id: segments.length, kind, content, ...(kind === 'protected' ? protection : {}), ...(legacyCardGrid ? { legacyCardGrid: true } : {}), ...(legacyChipList ? { legacyChipList: true } : {}), ...(containedLinkCards ? { containedLinkCards: true } : {}) });
  };
  const lineEnd = (offset: number) => {
    const newline = body.indexOf('\n', offset);
    const end = newline < 0 ? body.length : newline;
    return body.slice(offset, end).trim() ? offset : newline < 0 ? end : newline + 1;
  };
  let cursor = 0;
  for (const node of tree.children) {
    let start = node.position!.start.offset!;
    const beginning = body.lastIndexOf('\n', start - 1) + 1;
    if (beginning >= cursor && !body.slice(beginning, start).trim()) start = beginning;
    const end = lineEnd(node.position!.end.offset!);
    push('markdown', body.slice(cursor, start));
    const raw = body.slice(start, end);
    const protection = protectionForNode(node, raw);
    if (format === 'md' && mdxOnlyMarkdownNode(node, body)) {
      push('protected', raw, protection);
    } else if (node.type === 'mdxjsEsm') {
      // The AST can group consecutive imports. Keep individual statements for
      // the existing explicit Program Update conversion, including multiline JS.
      const program = (node as MdxjsEsm).data?.estree;
      const statements = program?.comments?.length ? [] : program?.body || [];
      let offset = start;
      for (const statement of statements) {
        const next = statement.range && lineEnd(statement.range[1]);
        if (next && next <= end) {
          const label = statement.type === 'ImportDeclaration' ? `Import: ${statement.source.value}` : 'Page code';
          push('protected', body.slice(offset, next), { protectedType: 'setup', sourceLabel: label });
          offset = next;
        }
      }
      push('protected', body.slice(offset, end), protection);
    } else if (format === 'mdx' && (parseLegacyChipList(raw) || parseLegacyCardGrid(raw))) {
      // The collection fields are editable; its legacy component/layout stays anchored.
      push('protected', raw, protection);
    } else if (parseLinkCardMdx(raw) || parseLinkButtonMdx(raw) || parseSimpleComponentMdx(raw) || parseCollectionMdx(raw)) {
      push('structured', raw);
    } else if (matchFormattedImage(raw)?.raw === raw.replace(/\r?\n$/, '') || supportedMarkdownNode(node)) {
      push('markdown', raw);
    } else push('protected', raw, protection);
    cursor = end;
  }
  push('markdown', body.slice(cursor));
  return segments.length ? segments : [{ id: 0, kind: 'markdown', content: body }];
}

// Whitespace-only segments separate blocks but are not reorder targets.
export function visibleBodySegments(segments: BodySegment[], emptyEditorId: number | null = null) {
  return segments.filter((segment) => segment.kind !== 'markdown' || segment.content.trim() || segment.id === emptyEditorId);
}

export function moveBodySegment(segments: BodySegment[], id: number, direction: -1 | 1, emptyEditorId: number | null = null): BodySegment[] {
  const visible = visibleBodySegments(segments, emptyEditorId);
  const index = visible.findIndex((segment) => segment.id === id);
  const current = visible[index];
  const neighbor = visible[index + direction];
  if (!current || !neighbor || current.kind === 'protected' || neighbor.kind === 'protected') return segments;
  const next = [...segments];
  const from = segments.indexOf(current), to = segments.indexOf(neighbor);
  [next[from], next[to]] = [next[to], next[from]];
  // Blocks can lose their original leading/trailing separator when moved.
  // Add spacing to editable blocks only; protected source remains verbatim.
  const newline = segments.some((segment) => segment.content.includes('\r\n')) ? '\r\n' : '\n';
  for (let index = 1; index < next.length; index += 1) {
    const previous = next[index - 1], current = next[index];
    const trailing = previous.content.match(/(?:\r?\n)*$/)?.[0] || '';
    const leading = current.content.match(/^(?:\r?\n)*/)?.[0] || '';
    const count = ((trailing + leading).match(/\n/g) || []).length;
    if (count >= 2) continue;
    const padding = newline.repeat(2 - count);
    if (previous.kind !== 'protected') next[index - 1] = { ...previous, content: previous.content + padding };
    else if (current.kind !== 'protected') next[index] = { ...current, content: padding + current.content };
  }
  return next;
}

// Whole-block removal is distinct from editing source or deleting setup.
export function canRemoveProtected(segment: BodySegment, format: SourceFormat = 'mdx') {
  if (format !== 'mdx' || segment.kind !== 'protected' || segment.protectedType !== 'content' || segment.legacyCardGrid || segment.legacyChipList || segment.containedLinkCards) return false;
  // A layout may contain ESM declarations or script/style nodes. Keep the
  // complete wrapper locked rather than deleting embedded page dependencies.
  const hasPageCode = (node: SyntaxNode): boolean => node.type === 'mdxjsEsm' || ['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) && ['script', 'style'].includes(node.name || '') || !!node.children?.some(hasPageCode);
  try { return !parseBodySyntax(segment.content).children.some(hasPageCode); }
  catch { return false; }
}

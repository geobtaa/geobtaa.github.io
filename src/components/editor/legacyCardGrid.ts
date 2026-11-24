import { parseBodySyntax, type SyntaxNode } from './contentSyntax.ts';
import { decodeAttribute, encodeAttribute } from './linkCardMdx.ts';

export type LegacyGridCard = { title: string; body: string };
const bodyTypes = new Set(['heading', 'paragraph', 'text', 'break', 'emphasis', 'strong', 'delete', 'inlineCode', 'code', 'thematicBreak', 'blockquote', 'list', 'listItem', 'link']);

function safeBodyNode(node: SyntaxNode, source: string): boolean {
  if (node.type === 'heading' && (node as SyntaxNode & { depth?: number }).depth !== 4) return false;
  if (!bodyTypes.has(node.type) || node.type === 'listItem' && node.checked != null || node.type === 'code' && 'meta' in node && node.meta) return false;
  if (node.type === 'text') {
    // Reference definitions may live outside the grid. Only explicit links or
    // escaped/entity-encoded literal brackets are safe in an isolated editor.
    const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
    if ([...raw.matchAll(/(\\*)\[/g)].some(match => match[1].length % 2 === 0)) return false;
  }
  return !node.children || node.children.every(child => safeBodyNode(child, source));
}

function meaning(node: SyntaxNode): unknown {
  const fields = ['type', 'depth', 'value', 'ordered', 'start', 'spread', 'checked', 'lang', 'meta', 'url', 'title'];
  const record = node as unknown as Record<string, unknown>;
  return {
    ...Object.fromEntries(fields.filter(key => record[key] != null).map(key => [key, key === 'value' && node.type === 'text' ? String(record[key]).replace(/\s+/g, ' ') : record[key]])),
    ...(node.children ? { children: node.children.map(meaning) } : {}),
  };
}

export function safeLegacyCardBody(body: string): boolean {
  try {
    const mdx = parseBodySyntax(body), md = parseBodySyntax(body, 'md');
    return mdx.children.every(node => safeBodyNode(node, body)) && md.children.every(node => safeBodyNode(node, body)) && JSON.stringify(mdx.children.map(meaning)) === JSON.stringify(md.children.map(meaning));
  } catch { return false; }
}

function dedentBody(body: string) {
  const lines = body.split(/\r?\n/).filter(line => line.trim());
  const indent = lines.length ? Math.min(...lines.map(line => line.match(/^ */)![0].length)) : 0;
  // Spaces only: mixed/tab indentation needs its own equivalence review.
  return indent ? body.replace(/^ +/gm, spaces => spaces.slice(indent)) : body;
}

export function parseLegacyCardGrid(source: string) {
  if (!/^ {0,3}<(?:CardGrid|Card)(?=[\s>])/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  const grid = tree.children[0] as SyntaxNode;
  const standalone = grid?.name === 'Card';
  if (tree.children.length !== 1 || grid?.type !== 'mdxJsxFlowElement' || !['CardGrid', 'Card'].includes(grid.name || '') || !Array.isArray(grid.attributes) || (!standalone && (grid.attributes.length || !grid.children?.length))) return null;
  const cards: (LegacyGridCard & { heading: boolean; titleStart: number; titleEnd: number; quote: string; bodyStart: number; bodyEnd: number })[] = [];
  for (const card of standalone ? [grid] : grid.children!) {
    if (card.type !== 'mdxJsxFlowElement' || card.name !== 'Card' || !Array.isArray(card.attributes) || card.attributes.length > 1) return null;
    const title = card.attributes[0];
    let titleStart: number, titleEnd: number, quote = '', label: string;
    const heading = !title;
    let children = card.children || [];
    let headingEnd: number | undefined;
    if (heading) {
      const first = children[0] as SyntaxNode & { depth?: number };
      if (first?.type !== 'heading' || first.depth !== 4 || !first.children?.every(child => child.type === 'text' && safeBodyNode(child, source))) return null;
      const start = first.position!.start.offset!, end = first.position!.end.offset!;
      const raw = source.slice(start, end);
      // Keep the level and separator immutable. Rich, multiline, setext and
      // closing-hash headings need a separate source-preservation review.
      if (!/^####[ \t][^\r\n]*$/.test(raw) || /[ \t]+#+[ \t]*$/.test(raw)) return null;
      titleStart = start + 5; titleEnd = end;
      label = first.children.map(child => child.value || '').join('');
      headingEnd = end;
      children = children.slice(1);
    } else {
      if (title.type !== 'mdxJsxAttribute' || title.name !== 'title' || typeof title.value !== 'string' || /[<>]/.test(title.value)) return null;
      // Starlight renders Card titles as HTML. Decode one rendered-text layer;
      // unknown/semicolonless entities require a separate rendering review.
      if (/&[a-z#]/i.test(title.value.replace(/&(?:[a-z][a-z\d]*|#\d+|#x[\da-f]+);/gi, ''))) return null;
      const attributeStart = title.position!.start.offset!, attributeEnd = title.position!.end.offset!;
      const attribute = source.slice(attributeStart, attributeEnd);
      const quoted = attribute.match(/^title\s*=\s*(["'])([\s\S]*)\1$/);
      if (!quoted) return null;
      quote = quoted[1]; titleStart = attributeStart + attribute.indexOf(quote) + 1; titleEnd = attributeEnd - 1;
      label = decodeAttribute(title.value);
    }
    const start = card.position!.start.offset!, end = card.position!.end.offset!;
    const raw = source.slice(start, end);
    const opening = raw.match(/^<Card\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/), closing = raw.match(/<\/Card[ \t]*>$/);
    if (!opening || !closing) return null;
    const bodyStart = headingEnd ?? start + opening[0].length, bodyEnd = start + closing.index!;
    const rawBody = source.slice(bodyStart, bodyEnd).replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n[ \t]*)+$/g, '');
    if (!children.every(node => safeBodyNode(node, source))) return null;
    const originalMeaning = JSON.stringify(children.map(meaning));
    // Normalize only the editing view, and only when it represents the original
    // MDX structure exactly. Unchanged bodies are still serialized verbatim.
    const body = [...new Set([rawBody, dedentBody(rawBody)])].find(candidate => safeLegacyCardBody(candidate) && originalMeaning === JSON.stringify(parseBodySyntax(candidate, 'md').children.map(meaning)));
    if (body === undefined) return null;
    cards.push({ title: label, body, heading, titleStart, titleEnd, quote, bodyStart, bodyEnd });
  }
  let cursor = 0;
  const protectedParts: string[] = [];
  for (const card of cards) {
    protectedParts.push(source.slice(cursor, card.titleStart), source.slice(card.titleEnd, card.bodyStart));
    cursor = card.bodyEnd;
  }
  protectedParts.push(source.slice(cursor));
  return { cards, protectedParts, standalone };
}

function literalHeading(value: string) {
  // Encode Markdown/MDX syntax so the field remains a plain heading, including
  // literal brackets, hashes, expressions and whitespace supplied by the user.
  return value.replace(/[&<>"'`*_{}\[\]()+\-.!#:|~\\\s]/gu, character => `&#${character.codePointAt(0)};`);
}

export function updateLegacyCardGrid(source: string, data: LegacyGridCard[]) {
  const parsed = parseLegacyCardGrid(source);
  if (!parsed || !Array.isArray(data) || data.length !== parsed.cards.length || !data.every(card => card && typeof card.title === 'string' && typeof card.body === 'string')) return source;
  const edits: { start: number; end: number; value: string }[] = [];
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  parsed.cards.forEach((card, index) => {
    const next = data[index];
    if (next.title !== card.title) edits.push({ start: card.titleStart, end: card.titleEnd, value: card.heading ? literalHeading(next.title) : encodeAttribute(encodeAttribute(next.title, card.quote), card.quote) });
    if (next.body !== card.body) edits.push({ start: card.bodyStart, end: card.bodyEnd, value: `${newline}${newline}${next.body.replace(/\r?\n/g, newline)}${newline}${newline}` });
  });
  // An empty heading's insertion point can coincide with the body start.
  // Replace the body first so refilling both fields cannot overwrite the label.
  return edits.sort((a, b) => b.start - a.start || b.end - a.end).reduce((text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), source);
}

export function matchLegacyCardGrid(source: string) {
  if (!/^ {0,3}<(?:CardGrid|Card)(?=[\s>])/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  const end = tree.children[0]?.position?.end.offset;
  if (end === undefined) return null;
  const separator = source.slice(end).match(/^[ \t]*(?:\r?\n|$)/)?.[0];
  if (separator === undefined) return null;
  const raw = source.slice(0, end + separator.length);
  return parseLegacyCardGrid(raw) ? raw : null;
}

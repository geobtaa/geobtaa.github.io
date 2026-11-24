import { parseBodySyntax, type SyntaxNode } from './contentSyntax.ts';
import { parseLinkCardMdx, updateLinkCardMdx, type LinkCardFields } from './linkCardMdx.ts';

// Only walk known layout paths. Expressions, custom components, inline JSX,
// and unsupported LinkCard attributes remain part of the opaque source.
function layout(node: SyntaxNode) {
  if (node.type !== 'mdxJsxFlowElement' || !Array.isArray(node.attributes)) return false;
  if (node.name === 'CardGrid' || node.name === 'TwoThirdsLayout') return node.attributes.length === 0;
  return node.name === 'div' && node.attributes.every(attribute => attribute.type === 'mdxJsxAttribute' && ['class', 'slot', 'id'].includes(attribute.name) && typeof attribute.value === 'string');
}

export function parseContainedLinkCards(source: string) {
  if (!/^\s*<(?:div|CardGrid|TwoThirdsLayout)(?=[\s>])/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  if (tree.children.length !== 1 || !layout(tree.children[0])) return null;
  const cards: { start: number; end: number; raw: string; fields: LinkCardFields }[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === 'mdxJsxFlowElement' && node.name === 'LinkCard') {
      const start = node.position!.start.offset!, end = node.position!.end.offset!;
      const raw = source.slice(start, end), parsed = parseLinkCardMdx(raw);
      if (parsed) cards.push({ start, end, raw, fields: { title: parsed.title, href: parsed.href, description: parsed.description } });
    } else if (layout(node)) node.children?.forEach(visit);
  };
  visit(tree.children[0]);
  if (!cards.length) return null;
  // Separate immutable fragments avoid sentinel collisions with source text.
  let cursor = 0;
  const protectedParts = cards.map(card => { const part = source.slice(cursor, card.start); cursor = card.end; return part; });
  protectedParts.push(source.slice(cursor));
  return { cards, protectedParts };
}

export function updateContainedLinkCard(source: string, index: number, fields: LinkCardFields) {
  const card = parseContainedLinkCards(source)?.cards[index];
  return card ? source.slice(0, card.start) + updateLinkCardMdx(card.raw, fields) + source.slice(card.end) : source;
}

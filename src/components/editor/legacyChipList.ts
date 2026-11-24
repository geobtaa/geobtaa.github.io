import { parseBodySyntax, type SyntaxNode } from './contentSyntax.ts';

// Known inert wrappers can stay opaque while their single ChipList is edited.
function wrapper(node: SyntaxNode) {
  return node.type === 'mdxJsxFlowElement' && node.name === 'div' && Array.isArray(node.attributes) && node.attributes.every(attribute =>
    attribute.type === 'mdxJsxAttribute' && (['class', 'id', 'slot'].includes(attribute.name) && typeof attribute.value === 'string' || attribute.name === 'markdown' && attribute.value === null));
}

export function parseLegacyChipList(source: string) {
  if (!/^ {0,3}<(?:ChipList|div)(?=[\s>])/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  if (tree.children.length !== 1) return null;
  const candidates: SyntaxNode[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === 'mdxJsxFlowElement' && node.name === 'ChipList') candidates.push(node);
    else if (wrapper(node)) node.children?.forEach(visit);
  };
  visit(tree.children[0]);
  if (candidates.length !== 1) return null;
  const chip = candidates[0];
  if (!Array.isArray(chip.attributes) || chip.attributes.length > 1 || chip.attributes.some(attribute => attribute.type !== 'mdxJsxAttribute' || attribute.name !== 'class' || typeof attribute.value !== 'string')) return null;
  const start = chip.position!.start.offset!, end = chip.position!.end.offset!;
  const raw = source.slice(start, end);
  const opening = raw.match(/^<ChipList\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/);
  const closing = raw.match(/<\/ChipList[ \t]*>$/);
  if (!opening || !closing) return null;
  const innerStart = start + opening[0].length, innerEnd = start + closing.index!;
  const children = chip.children || [];
  if (children.length > 1 || children.length === 1 && children[0].type !== 'list') return null;
  const list = children[0] as (SyntaxNode & { ordered?: boolean; spread?: boolean }) | undefined;
  if (list?.ordered) return null;
  const items: string[] = [];
  for (const item of list?.children || []) {
    if (item.type !== 'listItem' || item.checked != null || (item.children?.length || 0) > 1) return null;
    const paragraph = item.children?.[0];
    if (paragraph && (paragraph.type !== 'paragraph' || paragraph.children?.some(child => child.type !== 'text'))) return null;
    // Definitions elsewhere in the document can turn apparently plain labels
    // into reference links. Standalone tokenization must not lose that context.
    if (paragraph) {
      const raw = source.slice(paragraph.position!.start.offset, paragraph.position!.end.offset);
      if ([...raw.matchAll(/(\\*)\[/g)].some(match => match[1].length % 2 === 0)) return null;
    }
    items.push(paragraph?.children?.map(child => child.value || '').join('') || '');
  }
  return { items, innerStart, innerEnd, list, protectedParts: [source.slice(0, innerStart), source.slice(innerEnd)] };
}

function literalItem(value: string) {
  // Keep labels literal, including empty/whitespace values, MDX, and list syntax.
  return value.replace(/[&<>"'`*_{}\[\]()+\-.!#:|~\\\s]/gu, character => `&#${character.codePointAt(0)};`);
}

export function updateLegacyChipList(source: string, items: string[]) {
  const parsed = parseLegacyChipList(source);
  if (!parsed || !items.every(item => typeof item === 'string') || JSON.stringify(items) === JSON.stringify(parsed.items)) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const { list, innerStart, innerEnd } = parsed;
  const first = list?.position?.start.offset, last = list?.position?.end.offset;
  const leading = first !== undefined ? source.slice(innerStart, first) : newline.repeat(2);
  const trailing = last !== undefined ? source.slice(last, innerEnd) : newline.repeat(2);
  const indent = leading.match(/(?:^|\n)([ \t]*)$/)?.[1] || '';
  const marker = first !== undefined ? source[first] : '-';
  const separator = newline.repeat(list?.spread ? 2 : 1) + indent;
  const body = items.map(item => `${marker} ${literalItem(item)}`).join(separator);
  return source.slice(0, innerStart) + leading + body + trailing + source.slice(innerEnd);
}

export function matchLegacyChipList(source: string) {
  if (!/^ {0,3}<(?:ChipList|div)(?=[\s>])/.test(source)) return null;
  let tree;
  try { tree = parseBodySyntax(source); } catch { return null; }
  const end = tree.children[0]?.position?.end.offset;
  if (end === undefined) return null;
  const separator = source.slice(end).match(/^[ \t]*(?:\r?\n|$)/)?.[0];
  if (separator === undefined) return null;
  const raw = source.slice(0, end + separator.length);
  return parseLegacyChipList(raw) ? raw : null;
}

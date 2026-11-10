import { MarkdownManager } from '@tiptap/markdown';
import { encodeAttribute, decodeAttribute } from './linkCardMdx.ts';
import { ensureDefaultComponentImport } from './starlightImports.ts';
import { parseCollectionData } from '../editor-blocks/data.mjs';

export const COLLECTION_BLOCKS = {
  chipList: { label: 'Chip List', binding: 'CmsChipList', property: 'items', node: 'chipListBlock', path: 'src/components/editor-blocks/ChipList.astro' },
  cardGrid: { label: 'Card Grid', binding: 'CmsCardGrid', property: 'cards', node: 'cardGridBlock', path: 'src/components/editor-blocks/CardGrid.astro' },
  metrics: { label: 'Metrics', binding: 'CmsMetrics', property: 'items', node: 'metricsBlock', path: 'src/components/editor-blocks/Metrics.astro' },
} as const;
export type CollectionKind = keyof typeof COLLECTION_BLOCKS;
export type GridCard = { title: string; body: string };
export type Metric = { label: string; value: string };
export type CollectionData = string[] | GridCard[] | Metric[];
export const COLLECTION_KINDS = Object.keys(COLLECTION_BLOCKS) as CollectionKind[];

export function emptyCollectionData(kind: CollectionKind): CollectionData {
  if (kind === 'chipList') return [''];
  if (kind === 'metrics') return [{ label: '', value: '' }];
  return [{ title: '', body: '' }, { title: '', body: '' }];
}

// Keep unfamiliar card content protected rather than letting an editor drop it.
const lexer = new MarkdownManager({ extensions: [] }).instance;
const cardTokens = new Set(['space', 'paragraph', 'text', 'escape', 'strong', 'em', 'link', 'list', 'list_item', 'codespan', 'code', 'br', 'del', 'heading', 'blockquote', 'hr', 'def']);
export function supportedCardBody(body: string) {
  let supported = true;
  lexer.walkTokens(lexer.lexer(body), token => {
    if (!cardTokens.has(token.type) || (token.type === 'list_item' && token.task)) supported = false;
  });
  return supported;
}

export function createCollectionMdx(kind: CollectionKind, data: CollectionData) {
  const config = COLLECTION_BLOCKS[kind];
  // Quoted JSON keeps arbitrary chip text and Markdown out of MDX expressions.
  return `<${config.binding} ${config.property}="${encodeAttribute(JSON.stringify(data))}" />`;
}

export function parseCollectionMdx(source: string): { kind: CollectionKind; data: CollectionData; raw: string } | null {
  for (const kind of COLLECTION_KINDS) {
    const config = COLLECTION_BLOCKS[kind];
    const match = source.trim().match(new RegExp(`^<${config.binding} ${config.property}="([^"\\r\\n]*)" \\/>$`));
    if (!match) continue;
    const data = parseCollectionData(kind, decodeAttribute(match[1]));
    if (!data || (kind === 'cardGrid' && !(data as GridCard[]).every(card => supportedCardBody(card.body)))) return null;
    if (createCollectionMdx(kind, data) !== source.trim()) return null;
    return { kind, data, raw: source };
  }
  return null;
}

export function updateCollectionMdx(source: string, data: CollectionData) {
  const parsed = parseCollectionMdx(source);
  if (!parsed || JSON.stringify(parsed.data) === JSON.stringify(data)) return source;
  return `${source.match(/^\s*/)?.[0] || ''}${createCollectionMdx(parsed.kind, data)}${source.match(/\s*$/)?.[0] || ''}`;
}

export function matchCollectionBlock(source: string, kind: CollectionKind) {
  const { binding, property } = COLLECTION_BLOCKS[kind];
  return source.match(new RegExp(`^([ \\t]*<${binding} ${property}="[^"\\r\\n]*" \\/>[ \\t]*(?:\\r?\\n|$))`))?.[1] || null;
}

export function ensureCollectionImport(source: string, kind: CollectionKind) {
  const { binding, path } = COLLECTION_BLOCKS[kind];
  return ensureDefaultComponentImport(source, binding, path);
}

export function collectionKindForNode(name: string) {
  return COLLECTION_KINDS.find(kind => COLLECTION_BLOCKS[kind].node === name);
}

import { decodeAttribute, encodeAttribute } from './linkCardMdx.ts';
import { ensureStarlightImport } from './starlightImports.ts';

export const SIMPLE_COMPONENTS = {
  badge: { label: 'Badge', component: 'Badge', binding: 'CmsBadge', node: 'simpleBadgeBlock' },
  callout: { label: 'Callout', component: 'Aside', binding: 'CmsCallout', node: 'simpleCalloutBlock' },
  card: { label: 'Card', component: 'Card', binding: 'CmsCard', node: 'simpleCardBlock' },
} as const;
export type SimpleKind = keyof typeof SIMPLE_COMPONENTS;
export type SimpleFields = { text: string; title: string; variant: string; size: string; type: string };
export const SIMPLE_KINDS = Object.keys(SIMPLE_COMPONENTS) as SimpleKind[];
export const BADGE_VARIANTS = ['default', 'note', 'success', 'tip', 'caution', 'danger'];
export const BADGE_SIZES = ['small', 'medium', 'large'];
export const CALLOUT_TYPES = ['note', 'tip', 'caution', 'danger'];
export function emptySimpleFields(): SimpleFields {
  return { text: '', title: '', variant: 'default', size: 'small', type: 'note' };
}
function decode(value: string) {
  return decodeAttribute(value).replace(/&#(\d+);/g, (_, code) => {
    const point = Number(code);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  });
}
// These fields are literal text. Escape Markdown/MDX punctuation rather than
// interpreting it as formatting, expressions, components or directives.
function encodeMessage(value: string) {
  return value.replace(/[&<>"'`*_{}\[\]()+\-.!#:|~\\]/g, (character) => `&#${character.charCodeAt(0)};`).replace(/\r?\n/g, '  \n');
}
export function createSimpleComponentMdx(kind: SimpleKind, fields: SimpleFields): string {
  if (kind === 'badge') return `<CmsBadge text="${encodeAttribute(fields.text)}" variant="${fields.variant}" size="${fields.size}" />`;
  const config = SIMPLE_COMPONENTS[kind];
  // Starlight Card deliberately renders its title as HTML; escape that title
  // twice so a CMS plain-text title stays literal after MDX attribute decoding.
  const attributes = kind === 'card' ? `title="${encodeAttribute(encodeAttribute(fields.title))}"` : `type="${fields.type}" title="${encodeAttribute(fields.title)}"`;
  return `<${config.binding} ${attributes}>\n\n${encodeMessage(fields.text)}\n\n</${config.binding}>`;
}
export function parseSimpleComponentMdx(source: string): { kind: SimpleKind; fields: SimpleFields; raw: string } | null {
  const candidate = source.trim().replace(/\r\n/g, '\n');
  const fields = emptySimpleFields();
  let kind: SimpleKind;
  const badge = candidate.match(/^<CmsBadge text="([^"]*)" variant="([^"]*)" size="([^"]*)" \/>$/);
  const callout = candidate.match(/^<CmsCallout type="([^"]*)" title="([^"]*)">\n\n([\s\S]*?)\n\n<\/CmsCallout>$/);
  const card = candidate.match(/^<CmsCard title="([^"]*)">\n\n([\s\S]*?)\n\n<\/CmsCard>$/);
  if (badge) {
    kind = 'badge'; fields.text = decodeAttribute(badge[1]); fields.variant = badge[2]; fields.size = badge[3];
    if (!BADGE_VARIANTS.includes(fields.variant) || !BADGE_SIZES.includes(fields.size)) return null;
  } else if (callout) {
    kind = 'callout'; fields.type = callout[1]; fields.title = decodeAttribute(callout[2]); fields.text = decode(callout[3].replace(/  \n/g, '\n'));
    if (!CALLOUT_TYPES.includes(fields.type)) return null;
  } else if (card) {
    kind = 'card'; fields.title = decodeAttribute(decodeAttribute(card[1])); fields.text = decode(card[2].replace(/  \n/g, '\n'));
  } else return null;
  // Accept only the CMS's own simple format. Extra attributes, child components,
  // Markdown formatting, or other unrecognized syntax remain protected.
  if (createSimpleComponentMdx(kind, fields) !== candidate) return null;
  return { kind, fields, raw: source };
}
export function updateSimpleComponentMdx(source: string, fields: SimpleFields) {
  const parsed = parseSimpleComponentMdx(source);
  if (!parsed || Object.keys(fields).every((key) => fields[key as keyof SimpleFields] === parsed.fields[key as keyof SimpleFields])) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return `${source.match(/^\s*/)?.[0] || ''}${createSimpleComponentMdx(parsed.kind, fields).replace(/\n/g, newline)}${source.match(/\s*$/)?.[0] || ''}`;
}
export function matchSimpleComponentBlock(source: string, kind: SimpleKind) {
  const { binding } = SIMPLE_COMPONENTS[kind];
  const end = kind === 'badge' ? '\\/>' : `<\\/${binding}>`;
  return source.match(new RegExp(`^([ \\t]*<${binding}\\b[\\s\\S]*?${end}[ \\t]*(?:\\r?\\n|$))`))?.[1] || null;
}
export function ensureSimpleComponentImport(source: string, kind: SimpleKind) {
  const config = SIMPLE_COMPONENTS[kind];
  return ensureStarlightImport(source, config.component, config.binding);
}
export function simpleKindForNode(name: string): SimpleKind | undefined {
  return SIMPLE_KINDS.find((kind) => SIMPLE_COMPONENTS[kind].node === name);
}

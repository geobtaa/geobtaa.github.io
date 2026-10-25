import { ensureStarlightImport } from './starlightImports.ts';
import { decodeAttribute, encodeAttribute } from './linkCardMdx.ts';

export type LinkButtonFields = { text: string; href: string; variant: 'primary' | 'secondary' | 'minimal' };
export const LINK_BUTTON_IMPORT = "import { LinkButton } from '@astrojs/starlight/components';";
const variants = ['primary', 'secondary', 'minimal'];

function encodeText(text: string) {
  return encodeAttribute(text).replace(/[{}\[\]*_`\\~]/g, (character) => `&#${character.charCodeAt(0)};`);
}
function decode(value: string) {
  return decodeAttribute(value.replace(/&#(\d+);/g, (_, code) => {
    const number = Number(code);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\uFFFD';
  }));
}

function parts(source: string) {
  const match = source.match(/^(\s*<LinkButton\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>)([\s\S]*?)(<\/LinkButton>\s*)$/);
  if (!match) return null;
  const [, opening, attributes, content] = match;
  const text = content.trim();
  // Only a literal text label is editable. Markdown, expressions and child tags stay protected.
  if (/^(?:#{1,6}\s|[-+]\s|\d+[.)]\s)/.test(text)) return null;
  if (/[<>{}\[\]*_`\\~\r\n]/.test(text) || /&(?!amp;|quot;|apos;|lt;|gt;|#\d+;)/.test(text)) return null;
  const found: { name: string; value: string; quote: string; start: number; end: number }[] = [];
  const offset = opening.length - attributes.length - 1;
  let end = 0;
  for (const attribute of attributes.matchAll(/([A-Za-z][\w-]*)\s*=\s*(["'])([^]*?)\2/g)) {
    if (attributes.slice(end, attribute.index).trim()) return null;
    const start = offset + attribute.index! + attribute[0].indexOf(attribute[2]) + 1;
    found.push({ name: attribute[1], quote: attribute[2], value: decode(attribute[3]), start, end: start + attribute[3].length });
    end = attribute.index! + attribute[0].length;
  }
  if (attributes.slice(end).trim() || found.some((item, index) => !['href', 'variant'].includes(item.name) || found.findIndex((other) => other.name === item.name) !== index)) return null;
  const href = found.find((item) => item.name === 'href');
  const variant = found.find((item) => item.name === 'variant')?.value ?? 'primary';
  if (!href || !variants.includes(variant)) return null;
  return { text: decode(text), href: href.value, variant: variant as LinkButtonFields['variant'], found, textStart: opening.length + content.indexOf(text), textEnd: opening.length + content.indexOf(text) + text.length, openingEnd: opening.length - 1 };
}

export function parseLinkButtonMdx(source: string): (LinkButtonFields & { raw: string }) | null {
  const parsed = parts(source);
  return parsed ? { text: parsed.text, href: parsed.href, variant: parsed.variant, raw: source } : null;
}
export function createLinkButtonMdx(fields: LinkButtonFields) {
  return `<LinkButton href="${encodeAttribute(fields.href)}" variant="${fields.variant}">${encodeText(fields.text)}</LinkButton>`;
}
export function updateLinkButtonMdx(source: string, fields: LinkButtonFields) {
  const parsed = parts(source);
  if (!parsed) return source;
  const edits: { start: number; end: number; value: string }[] = [];
  if (fields.text !== parsed.text) edits.push({ start: parsed.textStart, end: parsed.textEnd, value: encodeText(fields.text) });
  for (const attribute of parsed.found) {
    const next = fields[attribute.name as 'href' | 'variant'];
    if (next !== attribute.value) edits.push({ start: attribute.start, end: attribute.end, value: encodeAttribute(next, attribute.quote) });
  }
  if (!parsed.found.some((item) => item.name === 'variant') && fields.variant !== 'primary') edits.push({ start: parsed.openingEnd, end: parsed.openingEnd, value: ` variant="${fields.variant}"` });
  return edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), source);
}
export function matchLinkButtonBlock(source: string) {
  return source.match(/^([ \t]*<LinkButton\b[\s\S]*?<\/LinkButton>[ \t]*(?:\r?\n|$))/)?.[1] || null;
}
export function ensureLinkButtonImport(source: string) {
  return ensureStarlightImport(source, 'LinkButton');
}

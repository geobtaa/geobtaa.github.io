import { ensureStarlightImport } from './starlightImports.ts';
import { characterEntities } from 'character-entities';

export type LinkCardFields = { title: string; href: string; description: string };
export type ParsedLinkCard = LinkCardFields & { raw: string; descriptionPresent: boolean };

export const LINK_CARD_IMPORT = "import { LinkCard } from '@astrojs/starlight/components';";

type Attribute = { name: string; quote: string; value: string; valueStart: number; valueEnd: number };

export function decodeAttribute(value: string) {
  // Decode one attribute layer, including numeric references accepted by MDX.
  // A single pass keeps literal entity text such as &amp;lt; from becoming markup.
  return value.replace(/&([a-z][a-z\d]*|#\d+|#x[\da-f]+);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) return Object.hasOwn(characterEntities, code) ? characterEntities[code] : entity;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\uFFFD';
  });
}
export function encodeAttribute(value: string, quote = '"') {
  const encoded = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return quote === '"' ? encoded.replace(/"/g, '&quot;') : encoded.replace(/'/g, '&apos;');
}

export function createLinkCardMdx(fields: LinkCardFields) {
  const lines = [
    '<LinkCard',
    `  title="${encodeAttribute(fields.title)}"`,
    `  href="${encodeAttribute(fields.href)}"`,
  ];
  if (fields.description) lines.push(`  description="${encodeAttribute(fields.description)}"`);
  lines.push('/>');
  return lines.join('\n');
}

export function ensureLinkCardImport(source: string) {
  return ensureStarlightImport(source, 'LinkCard');
}

function attributes(source: string): Attribute[] | null {
  const opening = source.match(/^\s*<LinkCard\b([\s\S]*?)\/>\s*$/);
  if (!opening) return null;
  const body = opening[1];
  const bodyOffset = opening.index! + opening[0].indexOf(body);
  const found: Attribute[] = [];
  const pattern = /([A-Za-z][\w-]*)\s*=\s*(["'])([\s\S]*?)\2/g;
  let end = 0;
  for (const match of body.matchAll(pattern)) {
    if (body.slice(end, match.index).trim()) return null;
    const valueOffset = match[0].indexOf(match[2]) + 1;
    found.push({
      name: match[1], quote: match[2], value: match[3],
      valueStart: bodyOffset + match.index! + valueOffset,
      valueEnd: bodyOffset + match.index! + valueOffset + match[3].length,
    });
    end = match.index! + match[0].length;
  }
  if (body.slice(end).trim()) return null;
  return found;
}

export function parseLinkCardMdx(source: string): ParsedLinkCard | null {
  const found = attributes(source);
  if (!found) return null;
  const values = new Map<string, Attribute>();
  for (const attribute of found) {
    if (!['title', 'href', 'description'].includes(attribute.name) || values.has(attribute.name)) return null;
    values.set(attribute.name, attribute);
  }
  if (!values.has('title') || !values.has('href')) return null;
  return {
    raw: source,
    title: decodeAttribute(values.get('title')!.value),
    href: decodeAttribute(values.get('href')!.value),
    description: decodeAttribute(values.get('description')?.value || ''),
    descriptionPresent: values.has('description'),
  };
}

export function updateLinkCardMdx(source: string, fields: LinkCardFields) {
  const parsed = parseLinkCardMdx(source);
  const found = attributes(source);
  if (!parsed || !found) return source;
  const original = { title: parsed.title, href: parsed.href, description: parsed.description };
  let updated = source;
  for (const attribute of [...found].sort((a, b) => b.valueStart - a.valueStart)) {
    const next = fields[attribute.name as keyof LinkCardFields];
    if (next !== original[attribute.name as keyof LinkCardFields]) {
      updated = `${updated.slice(0, attribute.valueStart)}${encodeAttribute(next, attribute.quote)}${updated.slice(attribute.valueEnd)}`;
    }
  }
  if (!parsed.descriptionPresent && fields.description) {
    const close = updated.lastIndexOf('/>');
    const newline = updated.includes('\r\n') ? '\r\n' : '\n';
    const lineStart = Math.max(updated.lastIndexOf('\n', close - 1) + 1, 0);
    if (updated.slice(0, close).includes('\n')) {
      const indent = updated.slice(lineStart, close).match(/^\s*/)?.[0] || '';
      updated = `${updated.slice(0, lineStart)}${indent || '  '}description="${encodeAttribute(fields.description)}"${newline}${updated.slice(lineStart)}`;
    } else {
      const before = updated.slice(0, close);
      updated = `${before}${/\s$/.test(before) ? '' : ' '}description="${encodeAttribute(fields.description)}" ${updated.slice(close)}`;
    }
  }
  return updated;
}

export function matchLinkCardBlock(source: string) {
  const match = source.match(/^([ \t]*<LinkCard\b[\s\S]*?\/>[ \t]*(?:\r?\n|$))/);
  return match?.[1] || null;
}

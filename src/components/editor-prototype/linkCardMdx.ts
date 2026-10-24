export type LinkCardFields = { title: string; href: string; description: string };
export type ParsedLinkCard = LinkCardFields & { raw: string; descriptionPresent: boolean };

export const LINK_CARD_IMPORT = "import { LinkCard } from '@astrojs/starlight/components';";

type Attribute = { name: string; quote: string; value: string; valueStart: number; valueEnd: number };

function decodeAttribute(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function encodeAttribute(value: string, quote = '"') {
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

function importsLinkCard(line: string) {
  const match = line.match(/^\s*import\s+(.+?)\s+from\s+(['"])@astrojs\/starlight\/components\2\s*;?\s*$/);
  const named = match?.[1].match(/\{([^}]*)\}/)?.[1];
  return named?.split(',').some((binding) => /^LinkCard(?:\s+as\s+LinkCard)?$/.test(binding.trim())) || false;
}

export function ensureLinkCardImport(source: string) {
  const lines = source.match(/[^\n]*\n|[^\n]+$/g) || [];
  if (lines.some(importsLinkCard)) return { content: source, added: false };

  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let offset = 0;
  let afterLastImport = -1;
  for (const line of lines) {
    offset += line.length;
    if (/^\s*import\s/.test(line)) afterLastImport = offset;
  }

  if (afterLastImport >= 0) {
    const before = source.slice(0, afterLastImport);
    const separator = /\r?\n$/.test(before) ? '' : newline;
    return {
      content: `${before}${separator}${LINK_CARD_IMPORT}${newline}${source.slice(afterLastImport)}`,
      added: true,
    };
  }

  return {
    content: source ? `${LINK_CARD_IMPORT}${newline}${newline}${source}` : `${LINK_CARD_IMPORT}${newline}`,
    added: true,
  };
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
    const valueOffset = match[0].indexOf(match[3]);
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
      updated = `${updated.slice(0, close)}description="${encodeAttribute(fields.description)}" ${updated.slice(close)}`;
    }
  }
  return updated;
}

export function matchLinkCardBlock(source: string) {
  const match = source.match(/^([ \t]*<LinkCard\b[\s\S]*?\/>[ \t]*(?:\r?\n|$))/);
  return match?.[1] || null;
}

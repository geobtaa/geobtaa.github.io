/** The only HTML image wrapper owned by the CMS. Everything else stays protected. */
export function matchFormattedImage(source: string) {
  const match = source.match(/^<figure data-cms-image="true" data-align="(left|center|right)"(?: data-width="([1-9]\d{0,4})")?>\r?\n\r?\n(!\[(?:\\[^\r\n]|[^\\\]\r\n])*\]\((?:<[^<>\r\n]+>|[^\s()<>]+)(?: ("(?:\\[^\r\n]|[^"\\\r\n])*"|'(?:\\[^\r\n]|[^'\\\r\n])*'))?\))\r?\n\r?\n<\/figure>(?=\r?\n|$)/);
  if (!match) return null;
  const width = match[2] ? Number(match[2]) : null;
  if (width !== null && (width < 50 || width > 10000)) return null;
  return { raw: match[0], align: match[1], width, markdown: match[3] };
}

export function formatImage(markdown: string, align: string | null, width: number | null) {
  if (!align && !width) return markdown;
  return `<figure data-cms-image="true" data-align="${align || 'center'}"${width ? ` data-width="${width}"` : ''}>\n\n${markdown}\n\n</figure>`;
}

// Custom components bypass Tiptap's ordinary link extension. Apply the same
// explicit policy in their forms, the write API, and the Astro renderer.
const allowedSchemes = new Set(['http', 'https', 'mailto', 'tel', 'ftp']);

export function isSafeComponentHref(value: string): boolean {
  // Browsers ignore tabs/newlines in schemes and leading control characters.
  const address = value.trim().replace(/[\u0000-\u0020\u007f]/g, '');
  const scheme = address.match(/^([a-z][a-z\d+.-]*):/i)?.[1];
  return !scheme || allowedSchemes.has(scheme.toLowerCase());
}

export const COMPONENT_LINK_ERROR = 'Use an http, https, mailto, tel, or ftp URL, or a relative link.';

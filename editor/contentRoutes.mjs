import { slug as githubSlug } from 'github-slugger';
import { isMap, parseDocument } from 'yaml';
import { CONTENT_ROOT } from './contentAreas.mjs';

export const DOC_EXTENSIONS = /\.(?:markdown|mdown|mkdn|mkd|mdwn|md|mdx)$/;

// Match Astro's default glob ID generator, followed by Starlight's
// slugToParam. Keep filename case folding separate from explicit slug values.
export function routeFromFilename(filename) {
  return filename.replace(DOC_EXTENSIONS, '').split('/').map(part => githubSlug(part)).join('/').replace(/\/index$/, '');
}

export function canonicalRoute(slug) {
  const param = ['index', '', '/'].includes(slug) ? '' : slug.replace(/\/index$/, '');
  // URLs with/without a trailing slash and Unicode normalization variants must
  // not claim separate output files. Decode escaped Unicode in explicit slugs.
  return decodeURI(param).normalize().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

export function documentSlug(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Cannot determine a document route without valid frontmatter.');
  const doc = parseDocument(match[1]);
  if (doc.errors.length || !isMap(doc.contents)) throw new Error('Cannot determine a document route from invalid frontmatter.');
  const slug = doc.toJS()?.slug;
  return slug ? String(slug) : null;
}

export function documentRoute(filename, slug = null) {
  return canonicalRoute(slug ?? routeFromFilename(filename));
}

export function isRoutedDocument(path) {
  return path.startsWith(`${CONTENT_ROOT}/`) && DOC_EXTENSIONS.test(path) && !path.split('/').at(-1).startsWith('_');
}

export function staticPageRoute(path) {
  if (!path.startsWith('src/pages/') || path.includes('[') || !/\.(?:astro|mdx?|html|[cm]?[jt]s)$/.test(path)) return null;
  const slug = path.slice('src/pages/'.length).replace(/\.(?:astro|mdx?|html|[cm]?[jt]s)$/, '');
  return canonicalRoute(slug);
}

export function routeConflictMessage(route, owner) {
  return `The URL /${route ? `${route}/` : ''} is already claimed by ${owner}. Choose a different filename. Nothing was saved to GitHub.`;
}

import { documentRoute, documentSlug, canonicalRoute } from './contentRoutes.mjs';
import { contentVisibility } from './content.mjs';
const origin = 'https://gin.btaa.org';
// Only relax the existing validator for well-formed root-relative internal page
// links. Relative links, localhost, bad escapes and other policy errors stay fatal.
export function draftLinkDestination(link) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//') || /[\\\s]/.test(link)) return null;
  try {
    decodeURI(link); // Malformed escapes must not bypass the validator.
    const path = link.split(/[?#]/, 1)[0];
    if (decodeURI(path).split('/').some(part => part === '.' || part === '..')) return null;
    const url = new URL(link, origin);
    if (url.origin !== origin) return null;
    return canonicalRoute(url.pathname);
  } catch { return null; }
}
export function documentDraftRoutes(documents) {
  const routes = new Set();
  for (const { filename, content } of documents) if (contentVisibility(content).draft) routes.add(documentRoute(filename, documentSlug(content)));
  return routes;
}
export function sidebarBlockers(groups, route) {
  if (!Array.isArray(groups)) throw new Error('Navigation configuration could not be checked. Ask a maintainer.');
  const found = [];
  function visit(entry) {
    if (!entry || typeof entry !== 'object') throw new Error('Unsupported navigation configuration.');
    if (entry.kind === 'autogenerate') return;
    if (entry.kind === 'link') {
      let target = draftLinkDestination(entry.link);
      if (target === null && typeof entry.link === 'string' && entry.link.startsWith(origin + '/')) target = draftLinkDestination(entry.link.slice(origin.length));
      if (target === null && (typeof entry.link !== 'string' || !/^[a-z][a-z0-9+.-]*:/i.test(entry.link))) throw new Error('Unsupported navigation link. Ask a maintainer.');
      if (target === route) found.push(entry.label || entry.link);
      return;
    }
    if (entry.kind === 'group' && Array.isArray(entry.items)) { entry.items.forEach(visit); return; }
    throw new Error('Unsupported navigation configuration. Ask a maintainer.');
  }
  for (const group of groups) {
    if (!Array.isArray(group.sidebar)) throw new Error('Navigation configuration could not be checked.');
    group.sidebar.forEach(visit);
  }
  return found;
}

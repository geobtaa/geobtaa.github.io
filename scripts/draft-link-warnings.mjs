import { glob, readFile } from 'node:fs/promises';
import { documentDraftRoutes, draftLinkDestination, sidebarBlockers } from '../editor/publicationRoutes.mjs';
import { staticPageRoute } from '../editor/contentRoutes.mjs';

/** @param {{root?: URL, groups?: ReadonlyArray<import('../navigation.config.ts').NavGroup>, warn?: (message: string) => void}} [options] */
export async function draftLinkWarnings({ root = new URL('../', import.meta.url), groups, warn = message => console.warn(process.env.GITHUB_ACTIONS === 'true' ? '::warning::' + message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A') : message) } = {}) {
  const documents = [];
  for await (const file of glob('**/*.{md,mdx}', { cwd: new URL('src/content/docs/', root) })) {
    if (file.split('/').at(-1).startsWith('_')) continue;
    documents.push({ filename: file, content: await readFile(new URL(file, new URL('src/content/docs/', root)), 'utf8') });
  }
  const routes = documentDraftRoutes(documents);
  for await (const file of glob('src/pages/**/*', { cwd: root })) {
    const route = staticPageRoute(file);
    if (route !== null && routes.has(route)) throw new Error(`Draft route /${route}/ is also served by a custom page.`);
  }
  for (const route of routes) {
    const blockers = sidebarBlockers(groups, route);
    if (blockers.length) throw new Error(`Cannot unpublish /${route}/: explicit navigation entry ${blockers.join(', ')}. Ask a maintainer to update navigation.`);
  }
  const reported = new Set();
  return ({ file, link }) => {
    const route = draftLinkDestination(link);
    if (route === null || !routes.has(route)) return false;
    const key = `${file}:${link}`;
    if (!reported.has(key)) {
      reported.add(key);
      warn(`Link to unpublished page: ${file} → ${link}. The destination is excluded from the website; update this link when convenient.`);
    }
    return true;
  };
}

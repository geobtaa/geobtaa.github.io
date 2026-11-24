import { parsePage, savePage } from './page.mjs';
import http from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { decodeBytes } from './draftStorage.mjs';
import { createGitHubClient, GitHubConflictError } from './github.mjs';
import { contentVisibility } from './content.mjs';
import { CONTENT_AREAS, contentArea, validateContentPath } from './contentAreas.mjs';
import { imageContentType, validateImagePath, validateImageUpload } from './imageAssets.mjs';
import { saveBlog } from './blog.mjs';
import { parseProgramUpdate, saveProgramUpdate } from './programUpdates.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PROJECT_EDITOR_PORT || 8787);
const allowedOrigins = new Set([
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  ...(process.env.PROJECT_EDITOR_ORIGIN ? [process.env.PROJECT_EDITOR_ORIGIN] : []),
]);

function contentRoute(pathname) {
  const match = pathname.match(/^\/api\/content\/([^/]+)(?:\/(.+))?$/);
  if (!match || !contentArea(match[1])) return null;
  return { area: match[1], filename: match[2] ? validateContentPath(match[2]) : null };
}

function respond(response, status, data, origin, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const decoder = new StringDecoder('utf8');
  let raw = '';
  for await (const chunk of request) {
    // IncomingMessage buffers can split a multibyte character. Preserve the
    // existing character-count limit while decoding across chunk boundaries.
    raw += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    if (raw.length > 28_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  raw += decoder.end();
  if (raw.length > 28_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  let input;
  try { input = JSON.parse(raw); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400 });
  return input;
}

export const createEditorServer = (github) => http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return respond(response, 403, { error: 'Origin is not allowed.' });
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      });
      return response.end();
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/session') {
      return respond(response, 200, { authenticated: true, login: 'local development', workspace: github.workspace || 'geobtaa/geobtaa.github.io#cms-drafts-v1' }, origin);
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return respond(response, 200, { ok: true }, origin);
    }
    if (request.method === 'GET' && url.pathname === '/api/images') {
      return respond(response, 200, await github.listImages({ area: url.searchParams.get('area'), filename: url.searchParams.get('filename') }), origin);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/images/file/')) {
      const path = validateImagePath(url.pathname.slice('/api/images/file/'.length));
      const image = await github.getImage(path);
      response.writeHead(200, { 'Content-Type': imageContentType(path), 'Cache-Control': 'private, max-age=300', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
      return response.end(image.content);
    }
    if (request.method === 'POST' && url.pathname === '/api/images') {
      const input = await readJson(request);
      if (typeof input.content !== 'string') throw Object.assign(new Error('Image content must be base64 text.'), { status: 400 });
      const bytes = decodeBytes(input.content);
      const filename = validateImageUpload({ filename: input.filename, mimeType: input.mimeType, bytes });
      return respond(response, 201, await github.uploadImage({ area: input.area, documentFilename: input.documentFilename, filename, mimeType: input.mimeType, bytes }), origin);
    }
    if (url.pathname === '/api/images' || url.pathname.startsWith('/api/images/file/')) throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: url.pathname === '/api/images' ? 'GET, POST' : 'GET' });
    if (url.pathname.startsWith('/api/publication-status/')) {
      const route = contentRoute(url.pathname.replace('/api/publication-status/', '/api/content/'));
      if (!route?.filename) throw Object.assign(new Error('A saved document is required.'), { status: 400 });
      if (request.method !== 'GET') throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: 'GET' });
      const publicationRequest = { state: 'merged', mergeHead: url.searchParams.get('mergeHead'), snapshotHead: url.searchParams.get('snapshotHead') };
      return respond(response, 200, { autoMergeEnabled: process.env.CMS_PUBLISH_ENABLED === 'true' && process.env.CMS_AUTO_MERGE_ENABLED === 'true', ...await github.getWebsiteInfo(route.area, route.filename, { unpublishEnabled: process.env.CMS_PUBLISH_ENABLED === 'true' ? process.env.CMS_UNPUBLISH_ENABLED : undefined, publicationRequest }) }, origin);
    }
    if (url.pathname.startsWith('/api/publish/')) {
      const statusRoute = contentRoute(url.pathname.replace('/api/publish/', '/api/content/'));
      if (!statusRoute?.filename) throw Object.assign(new Error('A saved document is required.'), { status: 400 });
      if (request.method === 'GET') return respond(response, 200, await github.getPublicationStatus(statusRoute.area, statusRoute.filename), origin);
      if (request.method !== 'POST') throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: 'GET, POST' });
      const route = contentRoute(url.pathname.replace('/api/publish/', '/api/content/'));
      if (!route?.filename) throw Object.assign(new Error('A saved document is required.'), { status: 400 });
      const input = await readJson(request);
      if (Object.hasOwn(input, 'autoMerge')) {
        if (typeof input.autoMerge !== 'boolean') throw Object.assign(new Error('Choose whether to authorize or cancel automatic publication.'), { status: 400 });
        if (input.autoMerge && (process.env.CMS_PUBLISH_ENABLED !== 'true' || process.env.CMS_AUTO_MERGE_ENABLED !== 'true')) throw Object.assign(new Error('Automatic publication is not enabled yet. You can still submit a manual request.'), { status: 403 });
        if (input.autoMerge && input.action === 'unpublish') await github.assertUnpublishEnabled(process.env.CMS_UNPUBLISH_ENABLED);
        const result = await github.setPublicationAutoMerge({ ...route, head: input.head, snapshotHead: input.snapshotHead, action: input.action, enabled: input.autoMerge });
        return respond(response, 200, result, origin);
      }
      if (process.env.CMS_PUBLISH_ENABLED !== 'true') throw Object.assign(new Error('Publish is disabled pending repository policy review.'), { status: 403 });
      if (input.action === 'unpublish') await github.assertUnpublishEnabled(process.env.CMS_UNPUBLISH_ENABLED);
      if (input.initialize === true) {
        if (input.action !== 'unpublish') throw Object.assign(new Error('Internal working-copy preparation is only available for unpublishing.'), { status: 400 });
        const result = await github.initializeUnpublish({ ...route, expectedSha: input.expectedSha, expectedHead: input.expectedHead, resumeHead: input.resumeHead });
        return respond(response, 200, result, origin);
      }
      return respond(response, 200, await (input.prepare === true ? github.preparePublication({ ...route, head: input.head, action: input.action }) : github.publishContent({ ...route, head: input.head, action: input.action, candidate: input.candidate })), origin);
    }
    if (url.pathname === '/api/content') {
      if (request.method !== 'GET') throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: 'GET' });
      return respond(response, 200, { areas: CONTENT_AREAS }, origin);
    }
    const route = contentRoute(url.pathname);
    if (route) {
      const { area, filename } = route;
      if (area === 'posts' && request.method === 'POST' && !filename) return respond(response, 201, await saveBlog(github, null, await readJson(request)), origin);
      if (area === 'updates' && request.method === 'POST' && !filename) return respond(response, 201, await saveProgramUpdate(github, null, await readJson(request)), origin);
      if (request.method === 'GET' && !filename) return respond(response, 200, await (github.discoverContent ? github.discoverContent(area) : github.listContent(area)), origin);
      if (!filename) throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: ['posts', 'updates'].includes(area) ? 'GET, POST' : 'GET' });
      if (request.method === 'GET') {
        const file = await github.getContent(area, filename);
        return respond(response, 200, { ...file, ...(area === 'updates' ? parseProgramUpdate(file.content) : parsePage(file.content)), ...contentVisibility(file.content) }, origin);
      }
      if (request.method === 'PUT') {
        const input = await readJson(request);
        if (area === 'posts') return respond(response, 200, await saveBlog(github, filename, input), origin);
        if (area === 'updates') return respond(response, 200, await saveProgramUpdate(github, filename, input), origin);
        return respond(response, 200, await savePage(github, area, filename, input), origin);
      }
      throw Object.assign(new Error('Method not allowed.'), { status: 405, allow: 'GET, PUT' });
    }
    respond(response, 404, { error: 'Not found.' }, origin);
  } catch (error) {
    const status = error instanceof GitHubConflictError ? 409 : (error.status || 500);
    respond(response, status, { error: error.message || 'Unexpected server error.', ...(error.code ? { code: error.code } : {}), ...(error.suggestedFilename ? { suggestedFilename: error.suggestedFilename } : {}), ...(error.creationState ? { creationState: error.creationState } : {}) }, origin, error.allow ? { Allow: error.allow } : {});
  }
});

if (import.meta.main) {
  const github = createGitHubClient({
    token: process.env.GITHUB_TOKEN,
    owner: process.env.PROJECT_EDITOR_OWNER,
    repo: process.env.PROJECT_EDITOR_REPO,
  });
  createEditorServer(github).listen(port, host, () => {
    console.log(`Project editor GitHub API listening on http://${host}:${port}`);
  });
}

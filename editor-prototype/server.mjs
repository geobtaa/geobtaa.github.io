import http from 'node:http';
import { createGitHubClient, GitHubConflictError } from './github.mjs';
import { newProject, parseContent, serializeContent } from './content.mjs';
import { CONTENT_AREAS, contentArea, validateContentPath } from './contentAreas.mjs';
import { imageContentType, validateImagePath, validateImageUpload } from './imageAssets.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PROJECT_EDITOR_PORT || 8787);
const allowedOrigins = new Set([
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  ...(process.env.PROJECT_EDITOR_ORIGIN ? [process.env.PROJECT_EDITOR_ORIGIN] : []),
]);
const github = createGitHubClient({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.PROJECT_EDITOR_OWNER,
  repo: process.env.PROJECT_EDITOR_REPO,
});

function contentRoute(pathname) {
  const match = pathname.match(/^\/api\/content\/([^/]+)(?:\/(.+))?$/);
  if (!match || !contentArea(match[1])) return null;
  return { area: match[1], filename: match[2] ? validateContentPath(match[2]) : null };
}

function respond(response, status, data, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 7_100_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  return JSON.parse(raw || '{}');
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return respond(response, 403, { error: 'Origin is not allowed.' });
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    });
    return response.end();
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/session') {
      return respond(response, 200, { authenticated: true, login: 'local development' }, origin);
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return respond(response, 200, { ok: true }, origin);
    }
    if (request.method === 'GET' && url.pathname === '/api/images') {
      return respond(response, 200, await github.listImages(), origin);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/images/file/')) {
      const path = validateImagePath(url.pathname.slice('/api/images/file/'.length));
      const image = await github.getImage(path);
      response.writeHead(200, { 'Content-Type': imageContentType(path), 'Cache-Control': 'private, max-age=300', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
      return response.end(image.content);
    }
    if (request.method === 'POST' && url.pathname === '/api/images') {
      const input = await readJson(request);
      const bytes = Buffer.from(String(input.content || ''), 'base64');
      const filename = validateImageUpload({ filename: input.filename, mimeType: input.mimeType, bytes });
      return respond(response, 201, await github.uploadImage({ filename, bytes }), origin);
    }
    if (url.pathname === '/api/content') return respond(response, 200, { areas: CONTENT_AREAS }, origin);
    const route = contentRoute(url.pathname);
    if (route) {
      const { area, filename } = route;
      if (request.method === 'GET' && !filename) return respond(response, 200, await github.listContent(area), origin);
      if (!filename) throw Object.assign(new Error('Content filename is required.'), { status: 400 });
      if (request.method === 'GET') {
        const file = await github.getContent(area, filename);
        return respond(response, 200, { ...file, ...parseContent(file.content) }, origin);
      }
      if (request.method === 'PUT') {
        const input = await readJson(request);
        const config = contentArea(area);
        if (!input.title?.trim() || (config.description && !input.description?.trim())) throw Object.assign(new Error(`Title${config.description ? ' and description are' : ' is'} required.`), { status: 400 });
        const entry = { title: input.title.trim(), description: input.description?.trim() ?? '', draft: config.publishing ? !input.publish : false, body: input.body ?? '' };
        if (!input.sha && !config.create) throw Object.assign(new Error('New files are not enabled for this content directory.'), { status: 400 });
        const content = input.sha ? serializeContent(input.originalContent, entry, { description: config.description, draft: config.publishing }) : newProject(entry);
        const saved = await github.saveContent({ area, filename, content, sha: input.sha, publish: config.publishing && Boolean(input.publish) });
        return respond(response, 200, { ...saved, content, ...parseContent(content) }, origin);
      }
    }
    respond(response, 404, { error: 'Not found.' }, origin);
  } catch (error) {
    const status = error instanceof GitHubConflictError ? 409 : (error.status || 500);
    respond(response, status, { error: error.message || 'Unexpected server error.' }, origin);
  }
});

server.listen(port, host, () => {
  console.log(`Project editor GitHub API listening on http://${host}:${port}`);
});

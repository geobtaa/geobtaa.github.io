import http from 'node:http';
import { createGitHubClient, GitHubConflictError } from './github.mjs';
import { newProject, parseProject, serializeProject } from './content.mjs';

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

function filenameFrom(pathname) {
  const value = decodeURIComponent(pathname.slice('/api/projects/'.length));
  if (!/^[a-z0-9][a-z0-9-]*\.mdx?$/.test(value)) throw Object.assign(new Error('Invalid Project filename.'), { status: 400 });
  return value;
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
    if (raw.length > 2_000_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  return JSON.parse(raw || '{}');
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return respond(response, 403, { error: 'Origin is not allowed.' });
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
    if (request.method === 'GET' && url.pathname === '/api/projects') {
      return respond(response, 200, await github.listProjects(), origin);
    }
    if (url.pathname.startsWith('/api/projects/')) {
      const filename = filenameFrom(url.pathname);
      if (request.method === 'GET') {
        const file = await github.getProject(filename);
        return respond(response, 200, { ...file, ...parseProject(file.content) }, origin);
      }
      if (request.method === 'PUT') {
        const input = await readJson(request);
        if (!input.title?.trim() || !input.description?.trim()) throw Object.assign(new Error('Title and description are required.'), { status: 400 });
        const project = { title: input.title.trim(), description: input.description.trim(), draft: !input.publish, body: input.body ?? '' };
        const content = input.sha ? serializeProject(input.originalContent, project) : newProject(project);
        const saved = await github.saveProject({ filename, content, sha: input.sha, publish: Boolean(input.publish) });
        return respond(response, 200, { ...saved, content, ...parseProject(content) }, origin);
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

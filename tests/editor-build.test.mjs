import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { chrome, withEditorBrowser } from '../editor-prototype/browserHarness.mjs';

const directory = resolve('dist-editor');

test('CMS artifact contains only the editor and support files, with its complete local dependency graph', async () => {
  const files = await readdir(directory);
  const expected = ['404.html', '_astro', '_redirects', '_routes.json', 'index.html'];
  try { await readFile('public/_headers'); expected.push('_headers'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.deepEqual(files.sort(), expected.sort());
  assert.equal(await readFile(directory + '/_routes.json', 'utf8'), await readFile('public/_routes.json', 'utf8'));
  assert.equal(await readFile(directory + '/_redirects', 'utf8'), '/editor / 302\n/editor/ / 302\n');
  const { document } = parseHTML(await readFile(directory + '/index.html', 'utf8'));
  assert.equal(document.querySelector('meta[name=robots]').content, 'noindex, nofollow');
  const island = document.querySelector('astro-island');
  const references = [...document.querySelectorAll('link[rel=stylesheet], script[src]')].map(node => node.getAttribute('href') || node.getAttribute('src'));
  references.push(island.getAttribute('component-url'), island.getAttribute('renderer-url'));
  assert.ok(references.every(path => path.startsWith('/_astro/') && !path.includes('..')));
  // Resolve actual imports (including split runtime chunks and CSS dependencies).
  await build({ entryPoints: references.map(path => directory + path), bundle: true, write: false,
    outdir: directory + '/__validation', logLevel: 'silent', external: ['https://*', 'http://*'],
    loader: { '.woff': 'file', '.woff2': 'file', '.png': 'file', '.svg': 'file' } });
});

test('built CMS hydrates at root, preserves OAuth deep links, images and public preview links', {
  skip: chrome || process.env.CI ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 60_000,
}, async () => {
  const body = '[Public document](/library/example/)\n\n![Repository image](@images/example.png)\n\n<LinkCard title="Public card" href="/projects/curation/" />\n\n<LinkButton href="/guides/">Public button</LinkButton>';
  const record = { filename: 'example.mdx', sha: 'loaded', title: 'Built CMS', description: '', draft: true, metadata: {}, body, content: '---\ntitle: Built CMS\n---\n\n' + body };
  const fixture = `window.requests = [];
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.origin).pathname;
      window.requests.push({path, method: options.method || 'GET'});
      if (path === '/api/session') return Response.json({authenticated: true, login: 'tester'});
      if (path === '/api/content/library/example.mdx') return Response.json(${JSON.stringify(record)});
      throw new Error('Unexpected API request: ' + path);
    };`;
  await withEditorBrowser(fixture, async ({ evaluate, waitFor }) => {
    await waitFor('!!document.querySelector(".body-editor .tiptap")');
    assert.equal(await evaluate('location.pathname'), '/');
    await evaluate(`[...document.querySelectorAll('.editor-mode-toggle button')].find(button => button.textContent === 'Preview').click()`);
    await waitFor('document.querySelectorAll(".cms-preview a[href]").length === 3');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.cms-preview a[href]')].map(a => ({href: a.href, target: a.target, rel: a.rel}))`), [
      { href: 'https://gin.btaa.org/library/example/', target: '_blank', rel: 'noopener noreferrer' },
      { href: 'https://gin.btaa.org/projects/curation/', target: '_blank', rel: 'noopener noreferrer' },
      { href: 'https://gin.btaa.org/guides/', target: '_blank', rel: 'noopener noreferrer' },
    ]);
    assert.equal(await evaluate('new URL(document.querySelector(".cms-preview img").src).pathname'), '/api/images/file/example.png');
    await waitFor('document.querySelector(".cms-preview img").naturalWidth > 0');
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'No unsaved changes');
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
    assert.equal(await evaluate('document.querySelector("astro-island").hasAttribute("ssr")'), false);
    const assets = await evaluate(`performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.startsWith('/_astro/')).map(entry => ({name: entry.name, status: entry.responseStatus}))`);
    assert.ok(assets.length >= 4);
    assert.ok(assets.every(asset => asset.status === 200), JSON.stringify(assets));
  }, { builtDirectory: 'dist-editor', initialSearch: '?area=library&file=example.mdx#body',
    images: { 'example.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIo0AAAAASUVORK5CYII=', 'base64') },
  });

  await withEditorBrowser(`window.fetch = async () => Response.json({authenticated: false});`, async ({ evaluate, waitFor }) => {
    await waitFor('!!document.querySelector("a.button.primary")');
    assert.equal(await evaluate(`new URL(document.querySelector('a.button.primary').href).searchParams.get('returnTo')`), '/?area=library&file=example.mdx#body');
  }, { builtDirectory: 'dist-editor', initialSearch: '?area=library&file=example.mdx#body' });
});

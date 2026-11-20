import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, access, glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildDeploymentMarker } from '../scripts/write-cms-deployment.mjs';
import { CONTENT_AREAS } from '../editor/contentAreas.mjs';
const exec = promisify(execFile);
test('real production builds omit draft routes across every editor area, visibly warn for inbound links, and block unrelated bad links', { timeout: 180_000 }, async () => {
 const out = await mkdtemp(join(tmpdir(), 'cms-unpublish-build-')), name = `cms-unpublish-${process.pid}`;
 const source = resolve(`src/content/docs/guides/${name}-links.mdx`), fixtures = [];
 const build = () => exec(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', out], { maxBuffer: 12_000_000 });
 try {
  for (const area of Object.keys(CONTENT_AREAS)) {
   const file = resolve(`src/content/docs/${area}/${name}.mdx`), route = `${area}/${name}-alias`;
   fixtures.push({ file, route });
   await writeFile(file, `---\ntitle: Unpublished fixture\ndraft: true\nslug: ${route}\n---\n\nPrivate draft fixture.\n`, { flag: 'wx' });
  }
  const body = fixtures.map(({ route }) => `[Unpublished](/${route}/?from=test#heading)`).join('\n\n');
  await writeFile(source, `---\ntitle: Link warning fixture\n---\n\n${body}`, { flag: 'wx' });
  const result = await build();
  assert.match(result.stdout + result.stderr, /Link to unpublished page/);
  for (const { route } of fixtures) {
   await assert.rejects(access(join(out, route, 'index.html')));
   assert.ok(!(await readFile(join(out, 'sitemap-0.xml'), 'utf8')).includes(route));
  }
  for await (const file of glob('**/*.html', { cwd: out })) assert.doesNotMatch(await readFile(join(out, file), 'utf8'), /Private draft fixture/);
  assert.doesNotMatch(await readFile(join(out, 'blog/index.html'), 'utf8'), new RegExp(`(?:posts|updates)/${name}-alias`));
  assert.doesNotMatch(await readFile(join(out, 'library/index.html'), 'utf8'), new RegExp(`library/${name}-alias`));
  const marker = await buildDeploymentMarker({ sha: 'a'.repeat(40), repository: 'geobtaa/geobtaa.github.io', runId: 1, runAttempt: 1,
   files: fixtures.map(({ file }) => ({ path: file.slice(process.cwd().length + 1), sha: 'b'.repeat(40), mode: '100644', type: 'blob' })),
   readSource: file => readFile(file, 'utf8'), readOutput: route => readFile(join(out, route, 'index.html')) });
  assert.equal(Object.keys(marker.documents).length, Object.keys(CONTENT_AREAS).length);
  assert.ok(Object.values(marker.documents).every(document => document.draft === true));
  await writeFile(source, `---\ntitle: Link warning fixture\n---\n\n${body}\n\n[Unrelated error](/cms-definitely-missing-route/)`);
  await assert.rejects(build(), error => /Links validation failed/.test(error.stdout + error.stderr));
  // Republishing removes the warning exemption and restores anchor validation.
  const one = fixtures[0];
  await writeFile(one.file, (await readFile(one.file, 'utf8')).replace('draft: true', 'draft: false'));
  await writeFile(source, `---\ntitle: Link warning fixture\n---\n\n[Wrong anchor](/${one.route}/#cms-missing-anchor)`);
  await assert.rejects(build(), error => /invalid hash|Links validation failed/.test(error.stdout + error.stderr));
 } finally {
  await Promise.all([source, ...fixtures.map(item => item.file)].map(file => rm(file, { force: true })));
  await rm(out, { recursive: true, force: true });
 }
});

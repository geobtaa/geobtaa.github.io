import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { contentVisibility } from '../editor-prototype/content.mjs';
import { documentRoute, documentSlug, isRoutedDocument } from '../editor-prototype/contentRoutes.mjs';

export async function buildDeploymentMarker({ sha, runId, runAttempt, repository, files, readSource, readOutput }) {
  if (!/^[a-f0-9]{40}$/.test(sha || '') || !Number.isSafeInteger(runId) || runId < 1 || !Number.isSafeInteger(runAttempt) || runAttempt < 1 || repository !== 'geobtaa/geobtaa.github.io') throw new Error('Invalid production build identity.');
  const documents = {};
  for (const file of files) {
    if (!isRoutedDocument(file.path) || file.mode !== '100644' || file.type !== 'blob') continue;
    const source = await readSource(file.path);
    if (contentVisibility(source).draft) continue;
    const route = documentRoute(file.path.slice('src/content/docs/'.length), documentSlug(source));
    if (route.split('/').some(part => ['.', '..'].includes(part))) throw new Error('Invalid production route.');
    let html; try { html = await readOutput(route); } catch { continue; } // A non-rendered document is never confirmed live.
    documents[file.path] = { blob: file.sha, route, htmlHash: createHash('sha256').update(html).digest('hex') };
  }
  return { version: 1, repository, sha, runId, runAttempt, environment: 'github-pages', workflow: '.github/workflows/astro.yml', documents };
}
async function main() {
  const git = args => execFileSync('git', args, { encoding: 'utf8' });
  if (process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_REPOSITORY !== 'geobtaa/geobtaa.github.io') throw new Error('Production markers can only be generated for the production repository main branch.');
  const sha = process.env.GITHUB_SHA;
  if (git(['rev-parse', 'HEAD']).trim() !== sha) throw new Error('Build checkout does not match the workflow source SHA.');
  git(['diff', '--exit-code', 'HEAD', '--', 'src', 'public']);
  const files = git(['ls-tree', '-r', '-z', sha]).split('\0').filter(Boolean).map(line => {
    const match = line.match(/^([0-9]+) (blob|tree|commit) ([a-f0-9]+)\t([\s\S]+)$/);
    if (!match) throw new Error('Invalid Git tree entry.');
    return { mode: match[1], type: match[2], sha: match[3], path: match[4] };
  });
  const dist = resolve('dist');
  const marker = await buildDeploymentMarker({ sha, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), repository: process.env.GITHUB_REPOSITORY, files,
    readSource: path => git(['show', `${sha}:${path}`]),
    readOutput: route => { const file = resolve(dist, route, 'index.html'); if (!file.startsWith(dist + sep)) throw new Error('Invalid output path.'); return readFile(file); },
  });
  await mkdir(resolve(dist, '_cms'), { recursive: true });
  await writeFile(resolve(dist, '_cms/deployment.json'), JSON.stringify(marker));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

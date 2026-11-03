import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { CONTENT_AREAS } from './contentAreas.mjs';
import { newPage, parsePage, serializePage, savePage } from './page.mjs';
import { applyPageMetadata, parsePageMetadata } from './pageMetadata.mjs';
import { newBlog, parseBlog, serializeBlog } from './blog.mjs';
const data = (source) => parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
const original = `---
title: 'Original title'
description: |
  A multiline description.
  Keep the rest of this YAML.
year: '2025'
date: 2025-12-31T23:00:00.000-06:00
authors:
  - name: Staff
    title: Editor
    url: https://example.com
tags: [Maps]
sidebar:
  order: 2
  hidden: true
  badge: New
  attrs:
    class: custom-navigation
tableOfContents: true
custom: {keep: 'exactly'} # Preserve this comment.
slug: stable-url
---

import CenterLayout from '@components/CenterLayout.astro';

<CenterLayout>
Keep this block untouched.
</CenterLayout>
`;

test('all enabled content files round-trip exactly through expanded metadata editing', async () => {
  for (const area of Object.keys(CONTENT_AREAS)) {
    for await (const filename of glob(`src/content/docs/${area}/**/*.{md,mdx}`)) {
      const source = await readFile(filename, 'utf8');
      assert.equal(serializePage(source, parsePage(source)), source, filename);
    }
  }
});

test('targeted metadata edits preserve optional values, author details, timestamps, filenames and MDX', () => {
  const loaded = parsePage(original);
  const saved = serializePage(original, { ...loaded, title: 'Revised', metadata: { ...loaded.metadata, year: 2026, sidebar: { ...loaded.metadata.sidebar, label: 'New label' } } });
  const metadata = data(saved);
  assert.equal(metadata.year, 2026);
  assert.equal(metadata.sidebar.label, 'New label');
  assert.equal(metadata.sidebar.attrs.class, 'custom-navigation');
  assert.equal(metadata.sidebar.badge, 'New');
  assert.equal(metadata.date, data(original).date);
  assert.deepEqual(metadata.authors, data(original).authors);
  assert.ok(saved.includes("custom: {keep: 'exactly'} # Preserve this comment."));
  assert.ok(saved.includes('slug: stable-url'));
  assert.equal(parsePage(saved).body, loaded.body);
});

test('dates remain calendar dates, retain timestamp suffixes, and can be removed from non-blog pages', () => {
  const loaded = parsePage(original);
  const changed = serializePage(original, { ...loaded, date: '2026-03-01' });
  assert.equal(data(changed).date, '2026-03-01T23:00:00.000-06:00');
  const removed = serializePage(original, { ...loaded, date: '' });
  assert.equal(data(removed).date, undefined);
  assert.equal(parsePage(removed).date, '');
});

test('new non-blog pages allow optional fields without adding automatic blog metadata', () => {
  for (const area of Object.keys(CONTENT_AREAS).filter(area => area !== 'posts')) {
    const source = newPage(area, { title: 'New page', description: '', draft: false, body: 'Body' });
    const metadata = data(source);
    for (const key of ['date', 'excerpt', 'authors', 'tags', 'cover', 'sidebar', 'template', 'year']) assert.equal(metadata[key], undefined, `${area}: ${key}`);
    assert.equal(data(newPage(area, { title: 'New page', description: '', draft: true, body: '' })).draft, true);
  }
});

test('working-group fields and removals keep existing conventions', () => {
  const loaded = parsePage(original);
  const saved = serializePage(original, { ...loaded, description: '', metadata: { committee: 'Steering', lead: 'New lead', members: ['One', 'Two'], dates_active: 'May 2025 – October 2026', year: null } });
  assert.equal(data(saved).year, undefined);
  assert.equal(data(saved).description, undefined);
  assert.deepEqual(data(saved).members, ['One', 'Two']);
  assert.equal(data(saved).dates_active, 'May 2025 – October 2026');
  assert.equal(data(saved).sidebar.hidden, true, 'omitted metadata fields are preserved');
});

test('metadata validation rejects invalid edits but preserves unchanged legacy formats', () => {
  for (const metadata of [{ year: 1700 }, { members: [''] }, { sidebar: { order: 'first' } }, { template: 'other' }, { tableOfContents: { minHeadingLevel: 5, maxHeadingLevel: 2 } }, { hidePageTitle: 'yes' }, { slug: 'other-url' }]) {
    assert.throws(() => applyPageMetadata(original, metadata), { status: 400 });
  }
  const legacy = original.replace("year: '2025'", 'year: legacy-value');
  assert.equal(serializePage(legacy, parsePage(legacy)), legacy);
});

test('CRLF, comments, blank fields and multiline values survive metadata changes', () => {
  const source = '---\r\ntitle: Page\r\ndescription: |\r\n  Several lines.\r\n  Another line.\r\nyear:\r\ncustom: keep # exact\r\n---\r\n\r\nBody\r\n';
  assert.equal(serializePage(source, parsePage(source)), source);
  const saved = serializePage(source, { ...parsePage(source), metadata: { year: 2026, members: ['One'], banner: { content: 'First\nSecond\n' } } });
  assert.equal(data(saved).year, 2026);
  assert.deepEqual(data(saved).members, ['One']);
  assert.equal(data(saved).banner.content, 'First\nSecond\n');
  assert.ok(saved.includes('custom: keep # exact'));
  assert.equal(parsePage(saved).body, 'Body\r\n');
});

test('blog metadata rules and shared page settings work together', () => {
  const source = newBlog({ title: 'Blog', date: '2026-10-26', body: '', metadata: { tableOfContents: false } });
  assert.equal(data(source).tableOfContents, false);
  const saved = serializeBlog(source, { ...parseBlog(source), metadata: { sidebar: { hidden: true } } });
  assert.equal(data(saved).sidebar.hidden, true);
  assert.equal(data(saved).tableOfContents, false);
  assert.throws(() => serializeBlog(source, { ...parseBlog(source), date: '' }), { status: 400 });
});

test('every non-blog save uses authoritative frontmatter and detects stale SHAs', async () => {
  for (const area of Object.keys(CONTENT_AREAS).filter(area => area !== 'posts')) {
    let written;
    const github = { getContent: async () => ({ content: original, sha: 'loaded' }), saveContent: async input => { written = input; return { sha: 'saved', commitSha: 'commit' }; } };
    const input = { ...parsePage(original), sha: 'loaded', title: 'New title', originalContent: 'untrusted', metadata: { year: 2026 } };
    const result = await savePage(github, area, 'stable-file.mdx', input);
    assert.equal(written.filename, 'stable-file.mdx');
    assert.equal(data(result.content).year, 2026);
    assert.equal(data(result.content).custom.keep, 'exactly');
    assert.deepEqual(result.metadata, parsePageMetadata(result.content).metadata);
    await assert.rejects(savePage(github, area, 'stable-file.mdx', { ...input, sha: 'stale' }), { status: 409 });
  }
});


test('an existing blog description can be edited without changing unrelated frontmatter', () => {
  const original = newBlog({ title: 'Blog', date: '2026-10-26', description: 'Old description' });
  const saved = serializeBlog(original, { ...parseBlog(original), description: 'New description' });
  assert.equal(data(saved).description, 'New description');
  const removed = serializeBlog(saved, { ...parseBlog(saved), description: '' });
  assert.equal(data(removed).description, undefined);
});

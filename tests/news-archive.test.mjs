import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { readArchiveSelection, matchesArchiveItem, BLOG_PAGE_SIZE } from '../src/utils/blogArchive.ts';

test('archive state validates URL input and search combines terms, type and year', () => {
  assert.deepEqual(readArchiveSelection(new URLSearchParams('type=invalid&year=oops&shown=Infinity')), { query: '', type: 'all', year: '', shown: 12 });
  assert.equal(readArchiveSelection(new URLSearchParams(), 3).shown, 36);
  const selection = readArchiveSelection(new URLSearchParams('q=Coastal+ATLAS&type=post&year=2026&shown=24'));
  assert.equal(matchesArchiveItem({ search: 'An atlas of coastal wetlands', category: 'post', year: '2026' }, selection), true);
  assert.equal(matchesArchiveItem({ search: 'An atlas of coastal wetlands', category: 'update', year: '2026' }, selection), false);
  assert.equal(matchesArchiveItem({ search: 'An atlas of coastal wetlands', category: 'post', year: '2025' }, selection), false);
  assert.equal(matchesArchiveItem({ search: 'An atlas', category: 'post', year: '2026' }, selection), false);
});

test('static pagination exposes each published item exactly once without JavaScript', async () => {
  const first = parseHTML(await readFile(new URL('../dist/blog/index.html', import.meta.url), 'utf8')).document;
  const paths = [...first.querySelectorAll('[data-archive-pagination] a')].map(link => link.getAttribute('href'));
  const total = first.querySelectorAll('[data-blog-card]').length;
  assert.equal(paths.length, Math.ceil(total / BLOG_PAGE_SIZE));
  const seen = [];
  for (const path of paths) {
    const { document } = parseHTML(await readFile(new URL(`../dist${path}index.html`, import.meta.url), 'utf8'));
    const visible = [...document.querySelectorAll('[data-blog-card]:not([hidden])')];
    assert.ok(visible.length > 0 && visible.length <= BLOG_PAGE_SIZE);
    seen.push(...visible.map(card => card.getAttribute('href')));
    assert.equal(document.querySelectorAll('.grid-card__badge:not(.grid-card__badge--update)').length, 0);
    assert.equal(document.querySelector('[data-archive-controls]').hasAttribute('hidden'), true);
    assert.ok(document.querySelector('noscript'));
  }
  assert.equal(seen.length, total);
  assert.equal(new Set(seen).size, total);
});

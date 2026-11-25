import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stringify } from 'yaml';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

// Build the real pages/helpers/components against a small isolated collection.
// Expected titles below are hand-established from this table, not calculated by
// the production matching code. Tags/authors intersect; selected years form a union.
const documents = [
  ['posts/alpha', { title: 'Coastal atlas', date: new Date('2026-06-01Z'), tags: ['Maps', 'Water'], authors: [{ name: 'Ana' }, 'Ben'], excerpt: 'Estuary & wetlands.' }],
  ['posts/beta', { title: 'Urban survey', date: new Date('2025-06-01Z'), tags: ['Maps', 'A/B', 'A B'], authors: ['Ana'] }],
  ['updates/delta', { title: 'River update', date: new Date('2024-06-01Z'), tags: ['Water'], authors: [{ name: 'Ben' }] }],
  ['posts/solo', { title: 'Solo story', date: new Date('2023-06-01Z'), tags: ['People'], authors: 'Solo Editor' }],
  ['posts/object', { title: 'Object story', date: new Date('2022-06-01Z'), authors: { name: 'Object Editor' } }],
  ['posts/bare', { title: 'Bare story' }],
  ['posts/draft', { title: 'Hidden draft', draft: true, tags: ['Draft only'] }],
  ['library/handbook', { title: 'Map handbook', year: '2026', tags: ['Guide', 'Maps'], authors: 'Dana', description: 'Atlas & estuary reference.' }],
  ['library/report', { title: 'Coastal report', date: new Date('2025-06-01Z'), tags: ['Report', 'Maps'], authors: { name: 'Eli' } }],
  ['library/memo', { title: 'Undated memo' }],
  ['library/hidden', { title: 'Hidden library entry', sidebar: { hidden: true }, tags: ['Hidden only'] }],
  ['library/draft', { title: 'Library draft', draft: true }],
];
let directory;
const options = { skip: chrome || process.env.CI ? false : 'Chrome/Chromium required.', timeout: 60_000 };
// TODO tests still execute their correctness assertions. Strict mode reproduces
// the recorded failures as ordinary failures until production fixes are approved.
const knownIssue = reason => ({ ...options, ...(process.env.FILTER_REVIEW_STRICT === '1' ? {} : { todo: reason }) });
before(async () => {
  if (!chrome && !process.env.CI) return;
  directory = await realpath(await mkdtemp(join(resolve('.'), '.filter-browser-')));
  for (const folder of ['src/pages/blog', 'src/pages/library', 'src/components', 'src/utils', 'src/scripts', 'src/content', 'src/content/i18n', 'src/assets/images']) {
    await mkdir(join(directory, folder), { recursive: true });
  }
  for (const file of ['tsconfig.json', 'src/content.config.ts', 'src/content/BlogSchema.ts',
    'src/pages/blog/index.astro', 'src/pages/library/index.astro', 'src/components/ContentGrid.astro',
    'src/components/BlogArchive.astro', 'src/scripts/blogArchive.ts', 'src/utils/blogArchive.ts',
    'src/components/PageFilterSection.astro', 'src/components/FilterPanel.astro',
    'src/utils/blogContent.ts', 'src/utils/libraryContent.ts', 'src/utils/filterConfig.ts']) {
    await copyFile(file, join(directory, file));
  }
  for (const [slug, metadata] of documents) {
    const file = join(directory, 'src/content/docs', slug + '.md');
    await mkdir(resolve(file, '..'), { recursive: true });
    await writeFile(file, `---\n${stringify(metadata)}---\n\nFixture content.\n`);
  }
  // Exercise the existing optional search control without adding it to either
  // production page. The real Blog/Library wiring is tested separately below.
  await writeFile(join(directory, 'src/pages/search.astro'), `---
import FilterPanel from '../components/FilterPanel.astro';
import ContentGrid from '../components/ContentGrid.astro';
import { loadBlogContent } from '../utils/blogContent';
const data = await loadBlogContent();
---
<html lang="en"><head><title>Search fixture</title></head><body>
<FilterPanel {...data} years={data.years.map(String)} selectedTags={[]} selectedAuthors={[]} selectedYears={[]} searchLabel="Search posts" />
<button data-filter-reset="blog">Clear filters</button>
<ContentGrid items={data.items} />
</body></html>`);
  await writeFile(join(directory, 'astro.config.mjs'), `import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
export default defineConfig({srcDir:${JSON.stringify(relative(resolve('.'), join(directory, 'src')))},outDir:${JSON.stringify(relative(resolve('.'), join(directory, 'dist')))},cacheDir:${JSON.stringify(relative(resolve('.'), join(directory, 'cache')))},publicDir:${JSON.stringify(relative(resolve('.'), join(directory, 'public')))},site:'https://filters.example', integrations:[starlight({title:'Filter fixtures',sidebar:[]})]});`);
  try {
    await promisify(execFile)(process.execPath, [resolve('node_modules/astro/bin/astro.mjs'), 'build', '--config', relative(resolve('.'), join(directory, 'astro.config.mjs'))], { env: { ...process.env, TZ: 'UTC' }, maxBuffer: 5_000_000 });
  } catch (error) { throw new Error(`Filter fixture build failed:\n${error.stdout}\n${error.stderr}`); }
}, { timeout: 120_000 });
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function browse(run) {
  await withEditorBrowser('', async browser => {
    const { evaluate, waitFor, send } = browser;
    const visit = async path => {
      const origin = await evaluate('location.origin');
      const previous = await evaluate('performance.timeOrigin');
      await send('Page.navigate', { url: origin + path });
      await waitFor(`performance.timeOrigin !== ${previous} && !!document.querySelector('form[data-filter-ready="true"], [data-blog-archive][data-ready]')`);
    };
    const visible = context => evaluate(`Array.from(document.querySelectorAll('[data-${context}-card]')).filter(el => getComputedStyle(el).display !== 'none').map(el => el.querySelector('h3, .library-list__link').textContent.trim())`);
    const choose = async (name, value) => {
      await evaluate(`(() => { const input = [...document.querySelectorAll('.filter-panel input')].find(el => el.name === ${JSON.stringify(name)} && el.value === ${JSON.stringify(value)}); if (!input) throw new Error('Missing filter option'); input.closest('details').open = true; input.click(); })()`);
    };
    const clear = () => evaluate('document.querySelector("[data-filter-reset]").click()');
    await run({ ...browser, visit, visible, choose, clear });
  }, { builtDirectory: join(directory, 'dist') });
}

test('Library controls, combined selections, badges, empty results and clearing', options, async () => {
  await browse(async ({ visit, visible, choose, clear, evaluate }) => {
    await visit('/library/');
    const all = ['Map handbook', 'Coastal report', 'Undated memo'];
    assert.deepEqual(await visible('library'), all);
    await choose('tag', 'Maps');
    assert.deepEqual(await visible('library'), all.slice(0, 2));
    await choose('year', '2026');
    assert.deepEqual(await visible('library'), [all[0]]);
    await choose('year', '2025');
    assert.deepEqual(await visible('library'), all.slice(0, 2));
    assert.equal(await evaluate('document.querySelector("[data-filter-count=years]").textContent.trim()'), '2');
    assert.equal(await evaluate('document.querySelector("[data-filter-count=tags]").textContent.trim()'), '1');
    await choose('tag', 'Guide');
    assert.deepEqual(await visible('library'), [all[0]]);
    await choose('year', '2026');
    assert.deepEqual(await visible('library'), []);
    assert.equal(await evaluate('document.querySelector("[data-library-empty]").hidden'), false);
    await clear();
    assert.deepEqual(await visible('library'), all);
    assert.equal(await evaluate('document.querySelector("[data-library-empty]").hidden'), true);
    assert.equal(await evaluate('document.querySelectorAll(".filter-panel input:checked").length'), 0);
    assert.equal(await evaluate('location.search'), '');
    await choose('year', '2025');
    assert.deepEqual(await visible('library'), [all[1]]);
    assert.equal(await evaluate('document.querySelectorAll("input[name=author]").length'), 0);
    assert.equal(await evaluate('document.querySelector("[data-filter-section=tags] summary").textContent.trim()'), 'Type');
  });
});

test('optional search control supports keyboard input, combined filters, counts and clearing', options, async () => {
  await browse(async ({ visit, visible, evaluate, send, arrow, choose, clear }) => {
    await visit('/search/');
    await evaluate('document.querySelector("input[name=q]").focus()');
    await send('Input.insertText', { text: '  ESTUARY & wetlands.  ' });
    assert.deepEqual(await visible('blog'), ['Coastal atlas']);
    assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'), 'ESTUARY & wetlands.');
    await choose('year', '2025');
    assert.deepEqual(await visible('blog'), []);
    await clear();
    assert.equal((await visible('blog')).length, 6);
    assert.equal(await evaluate('document.querySelector("input[name=q]").value'), '');
    assert.equal(await evaluate('document.querySelector("input[name=q]").labels[0].textContent.trim()'), 'Search posts');
    await evaluate('document.querySelector("[data-filter-section=authors] summary").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate('document.querySelector("[data-filter-section=authors]").open'), true);
    await arrow('Tab', 9);
    assert.equal(await evaluate('document.activeElement.name'), 'author');
    assert.ok(await evaluate('document.activeElement.labels[0].textContent.trim().length > 0'));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    assert.deepEqual(await visible('blog'), ['Coastal atlas', 'Urban survey']);
    const ids = await evaluate('[...document.querySelectorAll(".filter-panel input")].map(el=>el.id)');
    assert.equal(new Set(ids).size, ids.length, 'punctuation-equivalent labels must have distinct IDs');
    await send('Accessibility.enable');
    const { nodes } = await send('Accessibility.getFullAXTree');
    const checkboxes = nodes.filter(node => !node.ignored && node.role?.value === 'checkbox');
    assert.ok(checkboxes.length > 0);
    assert.ok(checkboxes.every(node => node.name?.value.trim()), 'exposed checkboxes have accessible names');
    assert.ok(nodes.some(node => !node.ignored && node.role?.value === 'searchbox' && node.name?.value === 'Search posts'));
  });
});

for (const context of ['library']) {
  test(`${context}: URL filters reload and cross-page Back/Forward remain isolated`, options, async () => {
    await browse(async ({ visit, visible, evaluate, send, waitFor }) => {
      await visit(`/${context}/?tag=Maps&year=2025`);
      const expected = context === 'blog' ? 'Urban survey' : 'Coastal report';
      assert.deepEqual(await visible(context), [expected]);
      assert.equal(await evaluate('document.querySelectorAll("input:checked").length'), 2);
      const time = await evaluate('performance.timeOrigin');
      await send('Page.reload');
      await waitFor(`performance.timeOrigin !== ${time} && !!document.querySelector('[data-filter-ready=true], [data-blog-archive][data-ready]')`);
      assert.deepEqual(await visible(context), [expected]);
      const other = 'blog';
      await visit('/blog/?q=Solo');
      assert.deepEqual(await visible(other), [other === 'blog' ? 'Solo story' : 'Map handbook']);
      await evaluate('history.back()');
      await waitFor(`location.pathname === '/${context}/' && !!document.querySelector('[data-filter-ready=true], [data-blog-archive][data-ready]')`);
      assert.deepEqual(await visible(context), [expected]);
      await evaluate('history.forward()');
      await waitFor(`location.pathname === '/${other}/' && !!document.querySelector('[data-filter-ready=true], [data-blog-archive][data-ready]')`);
      assert.deepEqual(await visible(other), [other === 'blog' ? 'Solo story' : 'Map handbook']);
    });
  });
}

test('URL search handles case, punctuation and Library scalar/object authors; hidden entries stay excluded', options, async () => {
  await browse(async ({ visit, visible, evaluate }) => {
    for (const [url, context, expected] of [
      ['/blog/?q=ESTUARY%20%26%20wetlands.', 'blog', ['Coastal atlas']],
      ['/library/?q=Dana', 'library', ['Map handbook']],
      ['/library/?q=Eli', 'library', ['Coastal report']],
      ['/library/?q=does-not-exist', 'library', []],
      ['/blog/?q=Urban+survey', 'blog', ['Urban survey']],
      ['/library/?author=Ana&tag=Guide', 'library', ['Map handbook']],
    ]) {
      await visit(url);
      assert.deepEqual(await visible(context), expected);
    }
    assert.equal(await evaluate('new URLSearchParams(location.search).has("author")'), false, 'Library deliberately disables author filtering');
  });
});

// The Library has a pre-existing search persistence defect; News coverage is in tests/news-archive.browser.mjs.
// Do not change expected results to match the Library bug.
// Remove the TODO designation when each corresponding production fix is made.
for (const context of ['library']) {
  test(`${context}: changing a checkbox preserves an active URL search`, knownIssue('Page config omits the search input; checkbox changes discard q'), async () => {
    await browse(async ({ visit, visible, choose, evaluate }) => {
      await visit(`/${context}/?q=coastal`);
      assert.deepEqual(await visible(context), [context === 'blog' ? 'Coastal atlas' : 'Coastal report']);
      await choose('tag', 'Maps');
      assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'), 'coastal');
      assert.deepEqual(await visible(context), [context === 'blog' ? 'Coastal atlas' : 'Coastal report']);
    });
  });
}

test('Library filters and News search stay isolated across history navigation', options, async () => {
  await browse(async ({ visit, choose, evaluate, visible, waitFor }) => {
    await visit('/library/');
    assert.equal(await evaluate('document.querySelectorAll(".filter-panel input[name=q]").length'), 0);
    await visit('/blog/');
    assert.equal(await evaluate('document.querySelectorAll("[data-archive-controls] input[name=q]").length'), 1);
    const length = await evaluate('history.length');
    await evaluate(`document.querySelector('[name=type][value=post]').click(); const year = document.querySelector('#archive-year'); year.value = '2025'; year.dispatchEvent(new Event('change', {bubbles:true}));`);
    assert.equal(await evaluate('history.length'), length);
    await evaluate('history.back()');
    await waitFor('location.pathname === "/library/" && !!document.querySelector("[data-filter-ready=true], [data-blog-archive][data-ready]")');
    assert.deepEqual(await visible('library'), ['Map handbook', 'Coastal report', 'Undated memo']);
    await evaluate('history.forward()');
    await waitFor('location.pathname === "/blog/" && !!document.querySelector("[data-filter-ready=true], [data-blog-archive][data-ready]")');
    assert.deepEqual(await visible('blog'), ['Urban survey']);
  });
});

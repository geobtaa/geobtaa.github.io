import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { parse } from 'yaml';
import { NAV_GROUPS, deriveGroupFromPath } from '../navigation.config.ts';

// Inspect the built HTML so these checks cover Starlight's configuration,
// route middleware, and our component overrides together. Run after build.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const content = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const normalizeText = (node) => node?.textContent.replace(/\s+/g, ' ').trim();
const directChild = (node, name) => [...node.children].find((child) => child.localName === name);
const pages = [];
for await (const filename of glob('**/*.html', { cwd: dist })) {
  const { document } = parseHTML(await readFile(`${dist}/${filename}`, 'utf8'));
  const sidebar = document.querySelector('sl-sidebar-state-persist > ul.top-level');
  if (sidebar) {
    pages.push({
      path: `/${filename.replace(/index\.html$/, '')}`,
      document,
      sidebar,
    });
  }
}

const dates = new Map();
for await (const filename of glob('**/*.{md,mdx}', { cwd: content })) {
  const source = await readFile(`${content}/${filename}`, 'utf8');
  const frontmatter = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
  const date = frontmatter?.date ? new Date(frontmatter.date).valueOf() : 0;
  dates.set(`/${filename.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '')}/`, date);
}

function assertCollapsed(details, collapsed, path) {
  const containsCurrent = details.querySelector('a[aria-current="page"]') !== null;
  assert.equal(details.hasAttribute('open'), containsCurrent || !collapsed,
    `${path}: initial collapse state for ${normalizeText(details.querySelector('summary .large'))}`);
}

function assertOrganization(list, expected, path) {
  const items = [...list.children].filter((child) => child.localName === 'li');
  assert.equal(items.length, expected.length, `${path}: sidebar group count`);
  items.forEach((item, index) => {
    const entry = expected[index];
    if (entry.kind === 'link') {
      const link = directChild(item, 'a');
      assert.equal(normalizeText(link), entry.label, `${path}: link label and position`);
      assert.equal(link.getAttribute('href'), entry.link, `${path}: link destination`);
      return;
    }
    const details = directChild(item, 'details');
    assert.ok(details, `${path}: ${entry.label} is a group`);
    assert.equal(normalizeText(details.querySelector('summary .large')), entry.label,
      `${path}: group label and position`);
    const collapsed = entry.collapsed ?? true;
    assertCollapsed(details, collapsed, path);
    if (entry.kind === 'group') {
      assertOrganization(directChild(details, 'ul'), entry.items, path);
    } else {
      // Generated subgroups inherited this state before Starlight 0.39.
      details.querySelectorAll('details').forEach((child) => assertCollapsed(child, collapsed, path));
    }
  });
}

test('built sidebars preserve configured organization, labels, and initial collapse behavior', () => {
  assert.ok(pages.length > 0, 'run npm run build before the navigation checks');
  for (const page of pages) {
    const group = NAV_GROUPS.find(({ id }) => id === deriveGroupFromPath(page.path));
    assert.ok(group, `${page.path}: sidebar has a navigation group`);
    assertOrganization(page.sidebar, group.sidebar, page.path);
  }
});

test('reverse-chronological groups and previous/next navigation agree on every built post and update', () => {
  const sortedLabels = new Set();
  function collect(entries) {
    for (const entry of entries) {
      if (entry.kind === 'autogenerate' && entry.sort === 'reverse-date') sortedLabels.add(entry.label);
      if (entry.kind === 'group') collect(entry.items);
    }
  }
  NAV_GROUPS.forEach(({ sidebar }) => collect(sidebar));
  assert.ok(sortedLabels.size > 0, 'configuration exercises reverse-date sorting');
  let checked = 0;
  for (const page of pages) {
    for (const details of page.sidebar.querySelectorAll('details')) {
      const label = normalizeText(details.querySelector('summary .large'));
      if (!sortedLabels.has(label)) continue;
      const links = [...details.querySelectorAll('a[href]')];
      assert.ok(links.length > 0, `${page.path}: ${label} is populated`);
      const timestamps = links.map((link) => {
        const href = link.getAttribute('href');
        assert.ok(dates.has(href), `${page.path}: ${href} resolves to source content`);
        const timestamp = dates.get(href);
        assert.ok(Number.isFinite(timestamp), `${href}: date is valid`);
        return timestamp;
      });
      assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a),
        `${page.path}: ${label} is newest first`);
      const current = links.findIndex((link) => link.getAttribute('aria-current') === 'page');
      if (current === -1) continue;
      assert.equal(page.document.querySelector('.pagination-links a[rel="prev"]')?.getAttribute('href'),
        links[current - 1]?.getAttribute('href'), `${page.path}: previous is the adjacent newer entry`);
      assert.equal(page.document.querySelector('.pagination-links a[rel="next"]')?.getAttribute('href'),
        links[current + 1]?.getAttribute('href'), `${page.path}: next is the adjacent older entry`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'checks cover built entries in the sorted groups');
});

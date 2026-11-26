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
  const sidebar = document.querySelector('sl-sidebar-state-persist > ul.top-level, [data-news-sidebar]');
  if (sidebar) {
    pages.push({
      path: `/${filename.replace(/index\.html$/, '')}`,
      document,
      sidebar,
    });
  }
}

const publishedNews = new Map();
const publishedConferences = [];
for await (const filename of glob('**/*.{md,mdx}', { cwd: content })) {
  const source = await readFile(`${content}/${filename}`, 'utf8');
  const frontmatter = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
  const date = frontmatter?.date ? new Date(frontmatter.date).valueOf() : 0;
  const url = `/${filename.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '')}/`;
  if (/^(posts|updates)\//.test(filename) && frontmatter.draft !== true) publishedNews.set(url, { date, title: frontmatter.title });
  if (/^conference\/\d{4}\.(md|mdx)$/.test(filename) && frontmatter.draft !== true) publishedConferences.push(url);
}
publishedConferences.sort((a, b) => Number(b.split('/')[2]) - Number(a.split('/')[2]));

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
    if (group.id === 'blog') {
      const archiveLinks = [...page.sidebar.querySelectorAll('.archive-links a')];
      assert.deepEqual(archiveLinks.map(link => link.getAttribute('href')), ['/blog/']);
      const stories = [...page.sidebar.querySelectorAll('.recent-stories a')];
      const expectedStories = [...publishedNews].filter(([url]) => url.startsWith('/posts/')).sort((a, b) => b[1].date - a[1].date).slice(0, 5).map(([url]) => url);
      assert.deepEqual(stories.map(link => link.getAttribute('href')), expectedStories, `${page.path}: only five recent stories`);
      const recent = [...page.sidebar.querySelectorAll('.recent-updates a')];
      const expected = [...publishedNews].filter(([url]) => url.startsWith('/updates/')).sort((a, b) => b[1].date - a[1].date).slice(0, 5).map(([url]) => url);
      assert.deepEqual(recent.map(link => link.getAttribute('href')), expected, `${page.path}: only five recent updates`);
      assert.equal(page.sidebar.querySelectorAll('details').length, 0);
    } else if (group.id === 'conference') {
      assertOrganization(page.sidebar, [
        { kind: 'link', label: 'Conference overview', link: '/conference/' },
        { kind: 'link', label: 'Map Gallery', link: '/conference/map-gallery/' },
        { kind: 'group', label: 'Past Conferences', collapsed: false, items: publishedConferences.map(link => ({ kind: 'link', label: link.split('/')[2], link })) },
      ], page.path);
      assert.ok(page.document.documentElement.hasAttribute('data-has-sidebar'), `${page.path}: sidebar is enabled`);
      const currentLinks = [...page.sidebar.querySelectorAll('[aria-current="page"]')];
      const expected = ['/conference/', '/conference/map-gallery/', ...publishedConferences].includes(page.path) ? [page.path] : [];
      assert.deepEqual(currentLinks.map(link => link.getAttribute('href')), expected, `${page.path}: active link`);
    } else assertOrganization(page.sidebar, group.sidebar, page.path);
  }
});

test('conference overview, gallery, guidelines, and all published years share the sidebar', () => {
  const conferencePages = pages.filter(page => page.path.startsWith('/conference/')).map(page => page.path);
  assert.deepEqual(conferencePages.sort(), ['/conference/', '/conference/map-gallery/', '/conference/map-gallery/submission-guidelines/', ...publishedConferences].sort());
  assert.ok(publishedConferences.includes('/conference/2026/'));
});

test('every update links to its adjacent older/newer update and every story offers other stories', () => {
  const updates = [...publishedNews].filter(([url]) => url.startsWith('/updates/')).sort((a, b) => b[1].date - a[1].date).map(([url]) => url);
  let updateCount = 0;
  let storyCount = 0;
  for (const page of pages) {
    if (page.path.startsWith('/updates/')) {
      const index = updates.indexOf(page.path);
      assert.ok(index >= 0, `${page.path}: is a published update`);
      const nav = page.document.querySelector('[data-news-pagination]');
      assert.ok(nav);
      assert.equal(nav.querySelector('[rel="prev"]')?.getAttribute('href'), updates[index + 1], `${page.path}: older neighbor`);
      assert.equal(nav.querySelector('[rel="next"]')?.getAttribute('href'), updates[index - 1], `${page.path}: newer neighbor`);
      updateCount++;
    }
    if (page.path.startsWith('/posts/')) {
      const section = page.document.querySelector('[data-more-stories]');
      assert.ok(section);
      const links = [...section.querySelectorAll('li a')];
      assert.equal(links.length, Math.min(3, [...publishedNews.keys()].filter(url => url.startsWith('/posts/') && url !== page.path).length));
      links.forEach(link => {
        const href = link.getAttribute('href');
        assert.notEqual(href, page.path);
        assert.ok(publishedNews.has(href));
        assert.ok(href.startsWith('/posts/'));
      });
      storyCount++;
    }
  }
  assert.equal(updateCount, updates.length);
  assert.equal(storyCount, [...publishedNews.keys()].filter(url => url.startsWith('/posts/')).length);
});

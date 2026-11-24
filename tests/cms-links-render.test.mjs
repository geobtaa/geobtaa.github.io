import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { glob, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createLinkCardMdx, parseLinkCardMdx, updateLinkCardMdx } from '../src/components/editor/linkCardMdx.ts';
import { createLinkButtonMdx } from '../src/components/editor/linkButtonMdx.ts';
import { parseLegacyChipList, updateLegacyChipList } from '../src/components/editor/legacyChipList.ts';
import { parseLegacyCardGrid, updateLegacyCardGrid } from '../src/components/editor/legacyCardGrid.ts';
import { parseContent } from '../editor/content.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);

// Exercise the actual site configuration, MDX compiler, and Starlight renderer.
// Like the browser harness, add only a uniquely named temporary source fixture;
// always remove it, and keep its build output/cache in a temporary directory.
async function buildLinks(body, check) {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'cms-links-render-')));
  const slug = `cms-links-render-${randomUUID()}`;
  const fixture = join(root, 'src/content/docs/posts', `${slug}.mdx`);
  const fixtureSource = body => `---\ntitle: Link safety fixture\ndraft: false\n---\n\nimport { LinkCard, LinkButton, LinkCard as AlternateCard, LinkButton as AlternateButton } from '@astrojs/starlight/components';\n\n${body}\n`;
  try {
    await writeFile(fixture, fixtureSource(body), { flag: 'wx' });
    const script = `import { build } from 'astro'; await build(${JSON.stringify({ root, outDir: join(temporary, 'dist'), cacheDir: join(temporary, 'cache') })});`;
    const build = () => execute(process.execPath, ['--input-type=module', '-e', script], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, maxBuffer: 5_000_000, timeout: 45_000 });
    await check(build, async () => parseHTML(await readFile(join(temporary, 'dist/posts', slug, 'index.html'), 'utf8')).document, body => writeFile(fixture, fixtureSource(body)));
  } finally {
    await rm(fixture, { force: true });
    await rm(temporary, { recursive: true, force: true });
  }
}

test('Astro renders new, edited, aliased and existing Link Card text literally', { timeout: 60_000 }, async () => {
  const fields = { title: '<img src="x" onerror="alert(1)"> & "Maps"', description: '<script>alert(2)</script><a href="javascript:alert(3)">click</a> &lt;b&gt; {value}', href: 'https://example.com/maps?a=1&b=2#details' };
  const created = createLinkCardMdx(fields);
  let edited = '<LinkCard title="" href=""/>';
  for (const next of [fields, { title: '', description: '', href: '' }, fields]) {
    edited = updateLinkCardMdx(edited, next);
    assert.ok(parseLinkCardMdx(edited), 'clear/save/reopen/refill keeps a valid component');
  }
  const existing = [];
  for await (const file of glob('src/content/docs/**/*.{md,mdx}', { cwd: root })) {
    for (const match of (await readFile(join(root, file), 'utf8')).matchAll(/<LinkCard\b[\s\S]*?\/>/g)) {
      const parsed = parseLinkCardMdx(match[0]);
      assert.ok(parsed, file);
      existing.push({ source: match[0], ...parsed });
    }
  }
  assert.ok(existing.length > 0);
  const body = [created, edited, created.replace('<LinkCard', '<AlternateCard'), ...existing.map(card => card.source)].join('\n\n');
  await buildLinks(body, async (build, document) => {
    await build();
    const cards = [...(await document()).querySelectorAll('.sl-link-card')];
    assert.equal(cards.length, existing.length + 3);
    for (const [index, expected] of [...Array(3).fill(fields), ...existing].entries()) {
      const card = cards[index];
      assert.equal(card.querySelector('.title').textContent, expected.title);
      assert.equal(card.querySelector('.description')?.textContent || '', expected.description);
      assert.equal(card.querySelector('a').getAttribute('href'), expected.href);
      assert.equal(card.querySelectorAll('.title *, .description *').length, 0, 'text fields must not create elements');
    }
  });
});

test('Astro refuses unsafe static URLs on supported cards and buttons, including aliases', { timeout: 60_000 }, async () => {
  for (const body of [
    createLinkCardMdx({ title: 'Unsafe', description: '', href: 'java\tscript:alert(1)' }),
    createLinkButtonMdx({ text: 'Unsafe', href: 'data:text/html,<script>alert(1)</script>', variant: 'primary' }),
    '<AlternateCard title="Unsafe" href="java&#x73;cript:alert(1)" />',
    '<AlternateButton href="vbscript:msgbox(1)">Unsafe</AlternateButton>',
  ]) {
    await buildLinks(body, async build => {
      await assert.rejects(build, error => /Unsafe (LinkCard|LinkButton) URL/.test(error.stderr + error.stdout));
    });
  }
});

test('Astro retains legacy ChipList classes and list structure while edited labels stay literal', { timeout: 60_000 }, async () => {
  const cases = [
    '<ChipList class="not-content custom-chips">\n\n- First\n- Second\n\n</ChipList>',
    '<ChipList class="not-content">\n\t- First\n\n\t- Second\n</ChipList>',
    '<div class="grid cards" markdown>\n\n#### Search terms\n<ChipList class="not-content">\n- First\n- Second\n</ChipList>\n</div>',
  ];
  const labels = ['Maps & <script>alert(1)</script> {value}', '**literal** :note[label]', '&amp; stays literal'];
  const body = ["import ChipList from 'src/components/ChipList.astro';", ...cases.flatMap((raw, index) => {
    const edited = updateLegacyChipList(raw, labels);
    const restored = updateLegacyChipList(edited, parseLegacyChipList(raw).items);
    return [raw, edited, restored].map((source, variant) => `<section data-chip-fixture="${index}-${variant}">\n\n${source}\n\n</section>`);
  })].join('\n\n');
  await buildLinks(body, async (build, document) => {
    await build();
    const dom = await document();
    for (const index of cases.keys()) {
      const before = dom.querySelector(`[data-chip-fixture="${index}-0"] .chip-list`);
      const edited = dom.querySelector(`[data-chip-fixture="${index}-1"] .chip-list`);
      const restored = dom.querySelector(`[data-chip-fixture="${index}-2"] .chip-list`);
      assert.equal(edited.className, before.className);
      assert.equal(restored.className, before.className);
      assert.ok(!edited.classList.contains('cms-chip-list'));
      assert.deepEqual([...edited.querySelectorAll('li')].map(li => li.textContent.trim()), labels);
      assert.equal(edited.querySelectorAll('script, strong, a').length, 0, 'labels cannot introduce markup');
      const shape = list => [...list.children].map(li => ({ text: li.textContent.trim(), elements: [...li.children].map(child => child.tagName) }));
      assert.deepEqual(shape(restored), shape(before), 'editing and restoring labels retains tight/loose list structure');
      if (index === 2) assert.equal(edited.closest('.grid.cards').querySelector('h4').textContent, 'Search terms');
    }
  });
});

test('Astro retains supported legacy CardGrids, direct body structure and loose lists through edits', { timeout: 60_000 }, async () => {
  const grids = [];
  for (const file of ['2023-12.mdx', '2024-01.mdx', '2024-02.mdx', '2024-03.mdx', '2024-09.mdx', '2024-10.mdx', '2024-11.mdx', '2024-12.mdx', '2025-01.mdx', '2025-02.mdx', '2025-03.mdx', '2025-04.mdx', '2025-07.mdx', '2025-08.mdx', '2025-09.mdx', '2025-10.mdx', '2025-12-04-november-2025-program-highlights.mdx', '2026-01-05-december-2025-program-update.mdx']) {
    const body = parseContent(await readFile(join(root, 'src/content/docs/updates', file), 'utf8')).body;
    grids.push(splitBody(body).find(s => s.legacyCardGrid).content);
  }
  const title = '<script>literal</script> & Title {value}';
  const pairs = grids.map(raw => {
    const parsed = parseLegacyCardGrid(raw);
    const data = parsed.cards.map(({ title, body }) => ({ title, body }));
    const revisedBody = data[0].body.replace(/(^[ \t]*[-*+] )(.*)/m, '$1$2 **verified** [Details](https://example.com/details)');
    data[0] = { title, body: revisedBody === data[0].body ? data[0].body + ' **verified** [Details](https://example.com/details)' : revisedBody };
    const edited = updateLegacyCardGrid(raw, data);
    assert.deepEqual(parseLegacyCardGrid(edited).protectedParts, parsed.protectedParts);
    return { raw, edited };
  });
  const body = ["import { Card, CardGrid } from '@astrojs/starlight/components';", ...pairs.flatMap(({ raw, edited }, index) => [raw, edited].map((source, variant) => `<section data-grid-fixture="${index}-${variant}">\n\n${source}\n\n</section>`))].join('\n\n');
  await buildLinks(body, async (build, document) => {
    await build();
    const dom = await document();
    for (const index of pairs.keys()) {
      const before = dom.querySelector(`[data-grid-fixture="${index}-0"] .card-grid`);
      const after = dom.querySelector(`[data-grid-fixture="${index}-1"] .card-grid`);
      assert.equal(after.className, before.className);
      assert.equal(after.children.length, 4);
      for (let card = 0; card < 4; card++) {
        assert.equal(after.children[card].className, before.children[card].className);
        const oldBody = before.children[card].querySelector('.body'), newBody = after.children[card].querySelector('.body');
        assert.deepEqual([...newBody.children].map(n => n.tagName), [...oldBody.children].map(n => n.tagName), 'no extra body wrapper');
        assert.equal(newBody.querySelectorAll('li > p').length, oldBody.querySelectorAll('li > p').length, 'loose list paragraphs stay intact');
        if (card > 0) assert.equal(newBody.innerHTML, oldBody.innerHTML);
      }
      assert.equal(after.children[0].querySelector('.title span').textContent, title);
      assert.equal(after.children[0].querySelector('.title span').children.length, 0, 'title stays literal');
      assert.ok([...after.children[0].querySelectorAll('.body strong')].some(node => node.textContent === 'verified'));
      assert.ok([...after.children[0].querySelectorAll('.body a')].some(node => node.getAttribute('href') === 'https://example.com/details'));
    }
  });
});

test('Astro preserves untitled card heading semantics, anchors and TOC through isolated edits', { timeout: 100_000 }, async () => {
  const sources = [];
  for (const file of ['2024-04.mdx', '2024-05.mdx', '2024-06.mdx', '2024-07.mdx', '2025-12-04-november-2025-program-highlights.mdx', '2026-01-05-december-2025-program-update.mdx']) {
    const body = parseContent(await readFile(join(root, 'src/content/docs/updates', file), 'utf8')).body;
    sources.push(...splitBody(body).filter(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).cards[0].heading).map(s => s.content));
  }
  assert.equal(sources.length, 8);
  const rename = 'Renamed & <literal> {heading}';
  const edited = sources.map((raw, index) => {
    const parsed = parseLegacyCardGrid(raw);
    return updateLegacyCardGrid(raw, parsed.cards.map(({ title, body }, card) => ({
      title: index === sources.length - 1 ? rename : title,
      body: card === 0 ? body + '\n\nAdded **verified** text.' : body,
    })));
  });
  const fixtureBody = sources => ["import { Card, CardGrid } from '@astrojs/starlight/components';", ...sources.map((source, index) => `<section data-heading-fixture="${index}">\n\n${source}\n\n</section>`)].join('\n\n');
  await buildLinks(fixtureBody(sources), async (build, document, replace) => {
    await build();
    const before = await document();
    await replace(fixtureBody(edited));
    await build();
    const after = await document();
    const tocLinks = dom => [...dom.querySelectorAll('starlight-toc a')].map(a => a.getAttribute('href'));
    const oldIds = [], newIds = [];
    for (const index of sources.keys()) {
      const oldCards = before.querySelectorAll(`[data-heading-fixture="${index}"] .card`);
      const newCards = after.querySelectorAll(`[data-heading-fixture="${index}"] .card`);
      assert.equal(newCards.length, oldCards.length);
      assert.equal(newCards.length, parseLegacyCardGrid(sources[index]).cards.length);
      for (let card = 0; card < oldCards.length; card++) {
        const oldCard = oldCards[card], newCard = newCards[card];
        assert.equal(newCard.className, oldCard.className);
        assert.equal(newCard.querySelector('.title').textContent.trim(), '', 'no component title was invented');
        const oldHeading = oldCard.querySelector('.body h4'), newHeading = newCard.querySelector('.body h4');
        assert.ok(oldHeading && newHeading);
        oldIds.push(oldHeading.id); newIds.push(newHeading.id);
        assert.equal(newCard.querySelectorAll('.body h1, .body h2, .body h3, .body h5, .body h6').length, 0);
        assert.equal(newCard.querySelector('.sl-anchor-link').getAttribute('href'), '#' + newHeading.id);
        if (index === sources.length - 1) {
          assert.equal(newHeading.textContent, rename);
          assert.equal(newHeading.children.length, 0, 'heading edits remain literal text');
          assert.notEqual(newHeading.id, oldHeading.id, 'renaming deliberately changes the generated anchor');
        } else {
          assert.equal(newHeading.outerHTML, oldHeading.outerHTML, 'body edits preserve heading and anchor');
        }
        assert.equal(newCard.querySelectorAll('li > p').length, oldCard.querySelectorAll('li > p').length);
        if (card > 0) assert.equal(newCard.innerHTML, oldCard.innerHTML);
        else assert.equal(newCard.querySelector('strong').textContent, 'verified');
      }
    }
    assert.equal(oldIds.length, 24);
    // Preserve existing TOC inclusion/exclusion under the real site settings.
    assert.deepEqual(tocLinks(before).filter(href => oldIds.slice(0, -1).includes(href?.slice(1))), tocLinks(after).filter(href => newIds.slice(0, -1).includes(href?.slice(1))));
    const wasIncluded = tocLinks(before).includes('#' + oldIds.at(-1));
    assert.equal(tocLinks(after).includes('#' + newIds.at(-1)), wasIncluded);
  });
});

test('Astro preserves multiple section headings and standalone card rendering after edits', { timeout: 100_000 }, async () => {
  const sources = [];
  for (const file of ['updates/2024-09.mdx', 'updates/2024-10.mdx', ...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map(month => `updates/2025-${month}.mdx`), 'library/geodata-collection-implementation-plan.mdx']) {
    const body = parseContent(await readFile(join(root, 'src/content/docs', file), 'utf8')).body;
    sources.push(...splitBody(body).filter(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).standalone).map(s => ({ raw: s.content, file })));
  }
  assert.equal(sources.length, 15);
  const renamed = 'Revised Service Model {literal} & <tag>';
  const edited = sources.map(({ raw, file }) => {
    const card = parseLegacyCardGrid(raw).cards[0];
    let body = card.body + '\n\nAdded **verified** text.';
    if (file === 'updates/2025-09.mdx') body = body.replace('#### Service Model Collaboration Workgroup', '#### Revised Service Model &#123;literal&#125; &amp; &lt;tag&gt;');
    return updateLegacyCardGrid(raw, [{ title: card.title, body }]);
  });
  const fixtureBody = sources => ["import { Card } from '@astrojs/starlight/components';", ...sources.map((source, index) => `<section data-multiple-heading-fixture="${index}">\n\n${source}\n\n</section>`)].join('\n\n');
  await buildLinks(fixtureBody(sources.map(s => s.raw)), async (build, document, replace) => {
    await build();
    const before = await document();
    await replace(fixtureBody(edited));
    await build();
    const after = await document();
    const toc = dom => [...dom.querySelectorAll('starlight-toc a')].map(a => a.getAttribute('href'));
    for (const [index, { file }] of sources.entries()) {
      const selector = `[data-multiple-heading-fixture="${index}"] .card`;
      const oldCard = before.querySelector(selector), newCard = after.querySelector(selector);
      assert.equal(newCard.className, oldCard.className);
      assert.equal(newCard.querySelector('.title').innerHTML, oldCard.querySelector('.title').innerHTML);
      const oldHeadings = [...oldCard.querySelectorAll('.body h4')], newHeadings = [...newCard.querySelectorAll('.body h4')];
      assert.equal(newHeadings.length, oldHeadings.length);
      assert.equal(newCard.querySelectorAll('.body h1, .body h2, .body h3, .body h5, .body h6').length, 0);
      assert.equal(newCard.querySelectorAll('li > p').length, oldCard.querySelectorAll('li > p').length);
      assert.equal(newCard.querySelectorAll('ul').length, oldCard.querySelectorAll('ul').length);
      assert.equal(newCard.querySelectorAll('a:not(.sl-anchor-link)').length, oldCard.querySelectorAll('a:not(.sl-anchor-link)').length);
      for (const [position, heading] of newHeadings.entries()) {
        const oldHeading = oldHeadings[position];
        if (file === 'updates/2025-09.mdx' && position === 1) {
          assert.equal(heading.textContent, renamed);
          assert.equal(heading.children.length, 0);
          assert.notEqual(heading.id, oldHeading.id);
        } else assert.equal(heading.outerHTML, oldHeading.outerHTML);
        assert.equal(heading.parentElement.querySelector('.sl-anchor-link').getAttribute('href'), '#' + heading.id);
        assert.equal(toc(after).includes('#' + heading.id), toc(before).includes('#' + oldHeading.id));
      }
      assert.equal(newCard.querySelector('.body > p:last-child strong').textContent, 'verified');
    }
  });
});

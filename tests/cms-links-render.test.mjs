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
  try {
    await writeFile(fixture, `---\ntitle: Link safety fixture\ndraft: false\n---\n\nimport { LinkCard, LinkButton, LinkCard as AlternateCard, LinkButton as AlternateButton } from '@astrojs/starlight/components';\n\n${body}\n`, { flag: 'wx' });
    const script = `import { build } from 'astro'; await build(${JSON.stringify({ root, outDir: join(temporary, 'dist'), cacheDir: join(temporary, 'cache') })});`;
    const build = () => execute(process.execPath, ['--input-type=module', '-e', script], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, maxBuffer: 5_000_000, timeout: 45_000 });
    await check(build, async () => parseHTML(await readFile(join(temporary, 'dist/posts', slug, 'index.html'), 'utf8')).document);
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

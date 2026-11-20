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

import assert from 'node:assert/strict';
import test from 'node:test';
import { splitBody, canRemoveProtected } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from './validateDocument.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';
const body = "import Widget from './Widget.astro';\n\n<Widget>\nOriginal layout.\n</Widget>\n\n<Other />\n\nAfter.\n";
const wrap = body => `---\ntitle: Removal\ndraft: false\n---\n\n${body}`;
const blocks = splitBody(body).filter(s => canRemoveProtected(s));

test('only explicit complete eligible blocks may be removed; retained source and setup remain exact', async () => {
  assert.equal(blocks.length, 2);
  const next = body.replace(blocks[0].content, 'Replacement text.\n');
  await validateDocument(wrap(next), { originalBody: body, protectedRemovals: [blocks[0].content] });
  for (const records of [[], [blocks[0].content, blocks[0].content], ['<Invented />'], [splitBody(body)[0].content]]) {
    await assert.rejects(validateDocument(wrap(next), { originalBody: body, protectedRemovals: records }));
  }
  for (const altered of [next.replace('<Other />', '<Changed />'), next.replace('./Widget.astro', './Changed.astro'), next.replace('<Other />', '```mdx\n<Other />\n```')]) {
    await assert.rejects(validateDocument(wrap(altered), { originalBody: body, protectedRemovals: [blocks[0].content] }));
  }
  await assert.rejects(validateDocument(wrap(body), { originalBody: body, protectedRemovals: [blocks[0].content] }));
  for (const source of ['<Layout>\n\nimport X from \"./X\";\n\n<X />\n\n</Layout>', '<Layout><script>run()</script></Layout>', '{expression}', '<Broken>', '<Card>\n#### Heading\n\nBody\n</Card>', '<ChipList>\n- One\n</ChipList>']) {
    assert.ok(splitBody(source).every(s => !canRemoveProtected(s)));
  }
  const duplicate = '<Widget />\n\n<Widget />\n';
  await validateDocument(wrap('<Widget />\n'), { originalBody: duplicate, protectedRemovals: ['<Widget />\n'] });
  await assert.rejects(validateDocument(wrap(''), { originalBody: duplicate, protectedRemovals: ['<Widget />\n'] }));
  await assert.rejects(validateDocument(wrap(next), { filename: 'page.md', originalBody: body, protectedRemovals: [blocks[0].content] }));
});

test('removal records survive multiple drafts, reopen and independently verified publication', async () => {
  const filename = 'removal.mdx', path = `src/content/docs/library/${filename}`;
  const repo = await draftTestRepository({ [path]: wrap(body) });
  const store = () => publicationTestClient({ request: repo.request });
  let file = await store().getContent('library', filename);
  const input = extra => ({ ...file, ...parsePage(file.content), ...extra });
  await assert.rejects(savePage(store(), 'library', filename, input({ body: body.replace(blocks[0].content, '') })));
  file = await savePage(store(), 'library', filename, input({ body: body.replace(blocks[0].content, 'Replacement.\n'), protectedRemovals: [blocks[0].content] }));
  file = await store().getContent('library', filename);
  file = await savePage(store(), 'library', filename, input({ title: 'Metadata edit' }));
  const oldSha = file.sha;
  file = await savePage(store(), 'library', filename, input({ body: parsePage(file.content).body.replace(blocks[1].content, ''), protectedRemovals: [blocks[1].content] }));
  await assert.rejects(savePage(store(), 'library', filename, { ...input({}), sha: oldSha }), { status: 409 });
  await store().publishContent({ area: 'library', filename, head: file.head });
  const pr = repo.pulls[0];
  await store().verifyPublication(pr.head.ref, pr.head.sha);
  const content = new TextDecoder().decode(repo.objects.get(repo.filesAt(pr.head.sha).get(path).sha));
  assert.ok(content.includes("import Widget from './Widget.astro';"));
  assert.ok(content.includes('Replacement.'));
  assert.ok(!content.includes('<Widget>') && !content.includes('<Other'));
});

test('replacing an HTML formatting list with ordinary numeric aspect ratios is a supported explicit removal', async () => {
  const setup = '{/* Previous submission deadline: March 24, 2025. */}\n';
  const list = '1. <strong>Aspect Ratio</strong>: Recommended between 4:3 and 16:9.\n1. <strong>File Name</strong>: `lastname_firstname_YYYY-MM-DD.jpg`.\n';
  const originalBody = `${setup}\n${list}`;
  const replacement = '1. **Aspect Ratio**: Recommended between 4:3 and 16:9.\n2. **File Name**: lastname\\_firstname\\_YYYY-MM-DD.jpg.\n';
  const edited = `${setup}\n${replacement}`;
  assert.equal(splitBody(replacement)[0].kind, 'markdown');
  await validateDocument(wrap(edited), {originalBody, protectedRemovals:[list]});
  await assert.rejects(validateDocument(wrap(edited), {originalBody}), /read-only content/);
  await assert.rejects(validateDocument(wrap(replacement), {originalBody, protectedRemovals:[list]}), /read-only content/);
  for (const directive of ['4:3[label]', '4:3{key="value"}', ':note[label]']) {
    await assert.rejects(validateDocument(wrap(`${setup}\n${directive}\n`), {originalBody, protectedRemovals:[list]}));
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { newBlog } from './blog.mjs';
import { validateDocument } from './validateDocument.mjs';
import { createSimpleComponentMdx, emptySimpleFields, ensureSimpleComponentImport } from '../src/components/editor/simpleComponents.ts';
import { createCollectionMdx, ensureCollectionImport } from '../src/components/editor/collectionMdx.ts';

test('Markdown files reject MDX-only component insertion while retaining existing source', async () => {
  const validate = (body, originalBody = '') => validateDocument(newBlog({ title: 'Markdown', body }), { filename: 'legacy.md', originalBody });
  const components = [
    '<LinkCard title="Maps" href="/maps/" />', '<LinkButton href="/maps/">Maps</LinkButton>',
    ...['badge', 'callout', 'card'].map(kind => createSimpleComponentMdx(kind, { ...emptySimpleFields(), title: 'Title', text: 'Text' })),
    ...['chipList', 'cardGrid', 'metrics'].map(kind => createCollectionMdx(kind, [])),
  ];
  for (const component of components) {
    await assert.rejects(validate(`Before.\n\n${component}\n`), error => error.status === 400 && /require an \.mdx/.test(error.message));
  }
  const legacy = `Before.\n\n${components[0]}\n`;
  await validate(legacy.replace('Before.', 'Edited paragraph.'), legacy);
  await assert.rejects(validate(legacy.replace('title="Maps"', 'title="New"'), legacy), { status: 400 });
  await validate('Example:\n\n```mdx\nimport { LinkCard } from "@astrojs/starlight/components";\n<LinkCard title="Maps" href="/maps/" />\n```\n');
  await validate('Use `<LinkCard />` in MDX.\n\nInline `import { LinkCard } from "@astrojs/starlight/components";` is an example.\n');
  await assert.rejects(validate('import {\n  LinkCard as Card\n} from "@astrojs/starlight/components";\n\n<Card title="Maps" href="/maps/" />'), { status: 400 });
  await validate('A regular [link](/maps/) and ![Map](/map.png).\n\n| A | B |\n| - | - |\n| 1 | 2 |\n');
});

test('validation preserves exact protected source, its indentation and order while allowing surrounding edits', async () => {
  const component = '  <Unknown value={"a } in a string"}>\r\n  Keep exact.  \r\n  </Unknown>  \r\n';
  const originalBody = `Before.\r\n\r\n${component}\r\nFootnote[^n].\r\n\r\n[^n]: Keep citation.\r\n`;
  const validate = body => validateDocument(newBlog({ title: 'Test', body }), { originalBody });
  await validate(originalBody.replace('Before.', 'Revised ordinary paragraph.'));
  for (const body of [originalBody.replace('Keep exact.', 'Rewritten'), originalBody.replace(component, ''), originalBody.replace('  </Unknown>  ', '</Unknown>'), originalBody.replace('[^n]: Keep citation.', '[^n]: Rewritten citation.'), `\n\`\`\`\`mdx\n${originalBody}\n\`\`\`\`\n`]) {
    await assert.rejects(validate(body), error => error.status === 400 && /read-only content/.test(error.message));
  }
});

test('validation allows the supported component imports and messages resembling JavaScript', async () => {
  for (const kind of ['callout', 'card']) {
    const source = createSimpleComponentMdx(kind, { ...emptySimpleFields(), title: 'A literal title', text: 'import { value } from "example";\nexport const answer = { value: 42 };' });
    const body = ensureSimpleComponentImport(source, kind).content;
    await validateDocument(newBlog({ title: 'Test', body }));
  }
  const body = ensureCollectionImport(createCollectionMdx('cardGrid', [{ title: 'Card', body: 'Literal {braces} in a Markdown-only card.' }]), 'cardGrid').content;
  await validateDocument(newBlog({ title: 'Test', body }));
});

test('validation compiles existing JavaScript without executing it and rejects newly introduced expressions', async () => {
  const originalBody = 'export const diagnostic = (globalThis.__cmsValidationExecuted = true);\n\nOriginal paragraph.\n';
  globalThis.__cmsValidationExecuted = false;
  try {
    await validateDocument(newBlog({ title: 'Test', body: originalBody.replace('Original paragraph.', 'Updated paragraph.') }), { originalBody });
    assert.equal(globalThis.__cmsValidationExecuted, false);
    await assert.rejects(validateDocument(newBlog({ title: 'Test', body: 'New {globalThis.__cmsValidationExecuted = true} expression.' })), error => error.status === 400);
    assert.equal(globalThis.__cmsValidationExecuted, false);
  } finally { delete globalThis.__cmsValidationExecuted; }
});

test('Markdown files retain their grammar, and MDX syntax errors report a location before saving', async () => {
  const originalBody = 'A literal <ID> in a Markdown document.\n\n<!-- Keep this HTML comment -->\n';
  await validateDocument(newBlog({ title: 'Test', body: originalBody }), { filename: 'existing.md', originalBody });
  await assert.rejects(validateDocument(newBlog({ title: 'Test', body: 'Paragraph.\n\nInvalid {a: 1}.' })), error => error.status === 400 && /Invalid MDX at body line 3/.test(error.message) && /Nothing was saved/.test(error.message));
});

import { parseContent } from './content.mjs';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { LINK_CARD_IMPORT } from '../src/components/editor-prototype/linkCardMdx.ts';
import { LINK_BUTTON_IMPORT } from '../src/components/editor-prototype/linkButtonMdx.ts';
import { SIMPLE_COMPONENTS } from '../src/components/editor-prototype/simpleComponents.ts';
import { COLLECTION_BLOCKS } from '../src/components/editor-prototype/collectionMdx.ts';

const generatedImports = new Set([
  LINK_CARD_IMPORT, LINK_BUTTON_IMPORT,
  ...Object.values(SIMPLE_COMPONENTS).map(({ component, binding }) => `import { ${component} as ${binding} } from '@astrojs/starlight/components';`),
  ...Object.values(COLLECTION_BLOCKS).map(({ binding, path }) => `import ${binding} from '${path}';`),
]);
const invalid = message => Object.assign(new Error(message), { status: 400 });
const key = source => source.replace(/\r?\n$/, '');

export async function validateDocument(content, { filename = 'new.mdx', originalBody = '' } = {}) {
  const body = parseContent(content).body;
  const format = filename.endsWith('.md') ? 'md' : 'mdx';
  // Compile, but never evaluate, the generated document. Keep the compiler off
  // the editor's startup path; both authenticated gateways await this before
  // creating any GitHub blob, commit or branch.
  try {
    const [{ compile }, { default: remarkGfm }, { default: remarkDirective }] = await Promise.all([
      import('@mdx-js/mdx'), import('remark-gfm'), import('remark-directive'),
    ]);
    await compile(body, { format, remarkPlugins: [remarkGfm, remarkDirective] });
  } catch (error) {
    const place = error.line ? ` at body line ${error.line}${error.column ? `:${error.column}` : ''}` : '';
    throw invalid(`Invalid ${format === 'mdx' ? 'MDX' : 'Markdown'}${place}: ${error.reason || error.message}. Nothing was saved to GitHub.`);
  }
  const protectedBlocks = source => splitBody(source, { mergeProtected: false, format }).filter(segment => segment.kind === 'protected').map(segment => segment.content);
  const originals = protectedBlocks(originalBody);
  const changed = () => invalid('Existing read-only content was changed, removed, or moved into a different syntax context. Keep its protected source unchanged. Nothing was saved to GitHub.');
  let index = 0;
  for (const raw of protectedBlocks(body)) {
    const original = originals[index];
    // Compare parsed blocks, not substring occurrences: wrapping source in a
    // code fence must not satisfy the preservation check by hiding the bytes.
    // Appending a separator after a former EOF block is allowed; changing an
    // existing line ending, indentation, or trailing spaces is not.
    if (original !== undefined && key(raw) === key(original) && raw.startsWith(original)) { index++; continue; }
    if (generatedImports.has(raw.trim())) continue;
    if (originals.length) throw changed();
    throw invalid('New unsupported Markdown or executable MDX cannot be added through the visual editor. Use supported blocks or a reviewed source edit. Nothing was saved to GitHub.');
  }
  if (index !== originals.length) throw changed();
}

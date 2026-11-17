import type { Root } from 'mdast';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';
import { escapeHtml } from '../components/editor-blocks/data.mjs';
import { COMPONENT_LINK_ERROR, isSafeComponentHref } from '../components/editor-prototype/componentLinkSafety.ts';

/** Starlight renders LinkCard strings with set:html after MDX entity decoding. */
const remarkSafeComponentLinks: Plugin<[], Root> = () => (tree, file) => {
  const bindings = new Map<string, 'LinkCard' | 'LinkButton'>();
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    for (const statement of (node as MdxjsEsm).data?.estree?.body || []) {
      if (statement.type !== 'ImportDeclaration' || statement.source.value !== '@astrojs/starlight/components') continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ImportSpecifier') continue;
        const imported = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
        if (imported === 'LinkCard' || imported === 'LinkButton') bindings.set(specifier.local.name, imported);
      }
    }
  }
  visitParents(tree, (node) => {
    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;
    const component = node.name && bindings.get(node.name);
    if (!component) return;
    for (const attribute of node.attributes) {
      // Expressions and spreads are developer-authored MDX, outside the CMS's
      // supported literal-attribute format. Do not rewrite their source.
      if (attribute.type !== 'mdxJsxAttribute' || typeof attribute.value !== 'string') continue;
      if (attribute.name === 'href' && !isSafeComponentHref(attribute.value)) {
        file.fail(`Unsafe ${component} URL. ${COMPONENT_LINK_ERROR}`, attribute.position);
      }
      if (component === 'LinkCard' && (attribute.name === 'title' || attribute.name === 'description')) {
        // Escape decoded text here, rather than adding another entity layer to
        // repository MDX and making existing/editor round trips ambiguous.
        attribute.value = escapeHtml(attribute.value);
      }
    }
  });
};
export default remarkSafeComponentLinks;

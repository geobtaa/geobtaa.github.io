import type { Parent } from 'mdast';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

const BLOG_PATH_MATCH = /\/src\/content\/docs\/posts\//;

const remarkCenterLayoutImages: Plugin<[], Parent> = () => {
  return (tree, file) => {
    const rawPath =
      typeof file?.path === 'string'
        ? file.path
        : Array.isArray(file?.history) && typeof file.history[0] === 'string'
          ? file.history[0]
          : '';
    if (!BLOG_PATH_MATCH.test(rawPath)) return;

    let needsImport = false;

    visitParents(tree, 'image', (node, ancestors) => {
      const parent = ancestors.at(-1);
      const grandparent = ancestors.at(-2) as Parent | undefined;

      if (!parent || parent.type !== 'paragraph' || !grandparent || !Array.isArray(grandparent.children)) {
        return;
      }

      if (parent.children.length !== 1) return;

      const caption = typeof node.title === 'string' ? node.title : '';

      const figureChildren: Parent['children'] = [parent];

      if (caption) {
        figureChildren.push({
          type: 'mdxJsxFlowElement',
          name: 'figcaption',
          attributes: [],
          children: [
            {
              type: 'mdxJsxTextElement',
              name: 'em',
              attributes: [],
              children: [{ type: 'text', value: caption }],
            },
          ],
        });
      }

      const replacement = {
        type: 'mdxJsxFlowElement',
        name: 'CenterLayout',
        attributes: [],
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: 'figure',
            attributes: [],
            children: figureChildren,
          },
        ],
      };

      const index = grandparent.children.indexOf(parent);
      if (index === -1) return;

      grandparent.children.splice(index, 1, replacement);
      needsImport = true;
    });

    if (!needsImport || !Array.isArray(tree.children)) return;

    const hasImport = tree.children.some(
      (child) => child.type === 'mdxjsEsm' && typeof child.value === 'string' && child.value.includes('CenterLayout'),
    );

    if (!hasImport) {
      const importValue = "import CenterLayout from '/src/components/CenterLayout.astro';";
      tree.children.unshift({
        type: 'mdxjsEsm',
        value: importValue,
        data: {
          estree: {
            type: 'Program',
            sourceType: 'module',
            body: [
              {
                type: 'ImportDeclaration',
                source: { type: 'Literal', value: '/src/components/CenterLayout.astro' },
                specifiers: [
                  {
                    type: 'ImportDefaultSpecifier',
                    local: { type: 'Identifier', name: 'CenterLayout' },
                  },
                ],
              },
            ],
          },
        },
      });
    }
  };
};

export default remarkCenterLayoutImages;

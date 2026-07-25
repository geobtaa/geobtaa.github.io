import type { Root, RootContent } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

const BLOG_PATH_MATCH = /\/src\/content\/docs\/posts\//;

const remarkCenterLayoutImages: Plugin<[], Root> = () => {
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
      const grandparent = ancestors.at(-2);

      if (!parent || parent.type !== 'paragraph' || !grandparent || !Array.isArray(grandparent.children)) {
        return;
      }

      if (parent.children.length !== 1) return;

      const caption = typeof node.title === 'string' ? node.title : '';

      const figureChildren: MdxJsxFlowElement['children'] = [parent];

      if (caption) {
        figureChildren.push({
          type: 'mdxJsxFlowElement',
          name: 'figcaption',
          attributes: [],
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'emphasis',
                  children: [{ type: 'text', value: caption }],
                },
              ],
            },
          ],
        });
      }

      const replacement: MdxJsxFlowElement = {
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

      const siblings = grandparent.children as RootContent[];
      const index = siblings.indexOf(parent);
      if (index === -1) return;

      siblings.splice(index, 1, replacement);
      needsImport = true;
    });

    if (!needsImport || !Array.isArray(tree.children)) return;

    const hasImport = tree.children.some(
      (child) => child.type === 'mdxjsEsm' && typeof child.value === 'string' && child.value.includes('CenterLayout'),
    );

    if (!hasImport) {
      const importValue = "import CenterLayout from '/src/components/CenterLayout.astro';";
      const centerLayoutImport: MdxjsEsm = {
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
                attributes: [],
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
      };
      tree.children.unshift(centerLayoutImport);
    }
  };
};

export default remarkCenterLayoutImages;

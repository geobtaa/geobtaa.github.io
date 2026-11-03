import type { Root } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

declare module 'mdast' {
  interface ImageData { cmsFormatted?: boolean }
}

function imageStyle(align: string, width: number | null) {
  return `width:${width ? `${width}px` : 'fit-content'};max-width:100%;margin:1rem ${align === 'right' ? '0' : 'auto'} 1rem ${align === 'left' ? '0' : 'auto'};`;
}

/** Render only the CMS's narrow, single-image figure format. No component imports. */
const remarkFormattedImages: Plugin<[], Root> = () => (tree) => {
  // Plain .md files represent HTML tags as siblings instead of MDX elements.
  visitParents(tree, 'html', (node, ancestors) => {
    const match = node.value.trim().match(/^<figure data-cms-image="true" data-align="(left|center|right)"(?: data-width="([1-9]\d{0,4})")?>$/);
    if (!match) return;
    const width = match[2] ? Number(match[2]) : null;
    if (width !== null && (width < 50 || width > 10000)) return;
    const parent = ancestors.at(-1);
    if (!parent || !('children' in parent)) return;
    const index = parent.children.findIndex(child => child === node);
    const paragraph = parent.children[index + 1];
    const closing = parent.children[index + 2];
    if (paragraph?.type !== 'paragraph' || paragraph.children.length !== 1 || paragraph.children[0].type !== 'image' || closing?.type !== 'html' || closing.value.trim() !== '</figure>') return;
    const image = paragraph.children[0];
    image.data = { ...image.data, cmsFormatted: true };
    node.value = node.value.trim().replace(/>$/, ` style="${imageStyle(match[1], width)}">`);
    if (image.title) {
      const caption = image.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      closing.value = `<figcaption><p><em>${caption}</em></p></figcaption>\n${closing.value}`;
    }
  });
  visitParents(tree, 'mdxJsxFlowElement', (node) => {
    if (node.name !== 'figure') return;
    const attrs = node.attributes;
    if (attrs.some(a => a.type !== 'mdxJsxAttribute' || !['data-cms-image', 'data-align', 'data-width'].includes(a.name) || typeof a.value !== 'string')) return;
    if (new Set(attrs.map(a => a.type === 'mdxJsxAttribute' && a.name)).size !== attrs.length) return;
    const value = (name: string) => attrs.find(a => a.type === 'mdxJsxAttribute' && a.name === name);
    const marker = value('data-cms-image');
    const alignment = value('data-align');
    const widthAttr = value('data-width');
    if (marker?.type !== 'mdxJsxAttribute' || marker.value !== 'true' || alignment?.type !== 'mdxJsxAttribute' || !['left', 'center', 'right'].includes(String(alignment.value))) return;
    const width = widthAttr?.type === 'mdxJsxAttribute' ? Number(widthAttr.value) : null;
    if (width !== null && (!Number.isInteger(width) || width < 50 || width > 10000)) return;
    if (node.children.length !== 1 || node.children[0].type !== 'paragraph' || node.children[0].children.length !== 1 || node.children[0].children[0].type !== 'image') return;
    const image = node.children[0].children[0];
    const align = alignment.value;
    node.attributes.push({ type: 'mdxJsxAttribute', name: 'style', value: imageStyle(String(align), width) });
    // Keep image Markdown in the source so Astro continues resolving repository assets.
    if (image.title) {
      const caption: MdxJsxFlowElement = {
        type: 'mdxJsxFlowElement', name: 'figcaption', attributes: [],
        children: [{ type: 'paragraph', children: [{ type: 'emphasis', children: [{ type: 'text', value: image.title }] }] }],
      };
      node.children.push(caption);
    }
  });
};
export default remarkFormattedImages;

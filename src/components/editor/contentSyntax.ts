import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxjs } from 'micromark-extension-mdxjs';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown } from 'mdast-util-directive';
import type { Node } from 'unist';

export type SourceFormat = 'md' | 'mdx';
export const MDX_COMPONENT_MESSAGE = 'Custom components require an .mdx document. This .md file supports text, links, images, and tables.';
export type SyntaxNode = Node & { children?: SyntaxNode[]; checked?: boolean | null; name?: string | null; attributes?: unknown; value?: string };

// Markdown parses JSX as HTML and imports as prose. Keep those legacy blocks
// read-only instead of presenting components that Astro cannot render here.
// Inspect syntax nodes so fenced and inline code examples remain ordinary text.
export function mdxOnlyMarkdownNode(node: SyntaxNode, source: string): boolean {
  if (node.type === 'code' || node.type === 'inlineCode') return false;
  if (node.type === 'html' && /<\/?[A-Z][\w.:-]*(?=[\s/>])/.test(node.value || '')) return true;
  if (node.type === 'paragraph') {
    const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
    if (/^import\s+(?:['"]|[\s\S]*?\bfrom\s*['"])/.test(raw)) return true;
  }
  return !!node.children?.some(child => mdxOnlyMarkdownNode(child, source));
}

export function parseBodySyntax(source: string, format: SourceFormat = 'mdx') {
  const tree = fromMarkdown(source, {
    extensions: [gfm(), directive(), ...(format === 'mdx' ? [mdxjs()] : [])],
    mdastExtensions: [gfmFromMarkdown(), directiveFromMarkdown(), ...(format === 'mdx' ? [mdxFromMarkdown()] : [])],
  });
  const restoreTableText = (node: SyntaxNode, inTable = false) => {
    inTable ||= node.type === 'table';
    if (inTable && node.type === 'textDirective') {
      const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
      // Starlight restores unhandled inline directives as literal text. Only
      // admit bare forms here: labels, attributes and custom syntax stay protected.
      if (/^:[a-z\d][\w-]*$/i.test(raw) && !Object.keys(node.attributes || {}).length && !node.children?.length) {
        node.type = 'text';
        node.value = raw;
        delete node.name;
        delete node.attributes;
        delete node.children;
      }
    }
    node.children?.forEach(child => restoreTableText(child, inTable));
  };
  restoreTableText(tree);
  return tree;
}

const editable = new Set(['paragraph', 'heading', 'text', 'break', 'emphasis', 'strong', 'delete', 'inlineCode', 'code', 'thematicBreak', 'blockquote', 'list', 'listItem', 'image', 'link', 'table', 'tableRow', 'tableCell']);

// A narrow allowlist: an unsupported descendant protects its entire containing
// block. In particular, task state, references, definitions and inline MDX must
// never be sent through a schema that cannot represent them.
export function supportedMarkdownNode(node: SyntaxNode): boolean {
  if (node.type === 'listItem' && node.checked != null) return false;
  if (node.type === 'html') return /^<\/?u>$|^<br\s*\/?>$/i.test(node.value || '');
  if (node.type === 'mdxJsxTextElement') {
    if (!['br', 'u'].includes(node.name || '') || !Array.isArray(node.attributes) || node.attributes.length) return false;
  } else if (!editable.has(node.type)) return false;
  return !node.children || node.children.every(supportedMarkdownNode);
}

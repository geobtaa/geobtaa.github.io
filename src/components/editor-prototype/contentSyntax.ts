import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxjs } from 'micromark-extension-mdxjs';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { directive } from 'micromark-extension-directive';
import { directiveFromMarkdown } from 'mdast-util-directive';
import type { Node } from 'unist';

export type SourceFormat = 'md' | 'mdx';
export type SyntaxNode = Node & { children?: SyntaxNode[]; checked?: boolean | null; name?: string | null; attributes?: unknown; value?: string };

export function parseBodySyntax(source: string, format: SourceFormat = 'mdx') {
  return fromMarkdown(source, {
    extensions: [gfm(), directive(), ...(format === 'mdx' ? [mdxjs()] : [])],
    mdastExtensions: [gfmFromMarkdown(), directiveFromMarkdown(), ...(format === 'mdx' ? [mdxFromMarkdown()] : [])],
  });
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

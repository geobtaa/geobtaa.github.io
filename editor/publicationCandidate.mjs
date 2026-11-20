// Browser prepares an untrusted proposal. CI derives and verifies the same result independently.
import { parse } from 'yaml';
import { parseContent } from './content.mjs';
import { validateImagePath } from './imageAssets.mjs';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { patchFrontmatter } from './pageMetadata.mjs';
export function imageReferences(content, filename, unknown = null) {
  const data = parse(content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  const refs = new Set();
  const add = source => {
    if (typeof source !== 'string') return;
    const match = source.match(/^(?:@images\/|\/?src\/assets\/images\/|(?:\.\.\/)+assets\/images\/)(.+)$/);
    if (match) refs.add(validateImagePath(match[1]));
    else unknown?.add(source);
  };
  const walk = node => { if (node.type === 'image') add(node.url); for (const child of node.children || []) walk(child); };
  walk(parseBodySyntax(parseContent(content).body, filename.endsWith('.md') ? 'md' : 'mdx'));
  for (const field of ['image', 'light', 'dark']) add(data.cover?.[field]);
  return refs;
}

export function preparePublicationCandidate({ content, assets }, filename) {
  const references = imageReferences(content, filename);
  return { content: patchFrontmatter(content, { draft: false }), assets: Object.keys(assets).filter(path => references.has(path)) };
}

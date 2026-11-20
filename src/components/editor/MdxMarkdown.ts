import { Extension } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import CodeBlock from '@tiptap/extension-code-block';
import Link from '@tiptap/extension-link';
import { decodeNumericCharacterReference } from 'micromark-util-decode-numeric-character-reference';
import { decodeAttribute } from './linkCardMdx.ts';
import { parseBodySyntax, type SyntaxNode } from './contentSyntax.ts';

const entity = /^&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i;

export const SafeLink = Link.extend({
  renderMarkdown(node, helpers) {
    const href = String(node.attrs?.href || '');
    const destination = /[\s()<>\\"]/.test(href) ? `<${href.replace(/[\\<>]/g, '\\$&')}>` : href;
    const title = String(node.attrs?.title || '').replace(/[\\"]/g, '\\$&');
    return `[${helpers.renderChildren(node)}](${destination}${title ? ` "${title}"` : ''})`;
  },
});

export const SafeCodeBlock = CodeBlock.extend({
  renderMarkdown(node, helpers) {
    const language = String(node.attrs?.language || '');
    const content = helpers.renderChildren(node.content || []);
    const marker = language.includes('`') ? '~' : '`';
    const runs = content.match(marker === '`' ? /`+/g : /~+/g) || [];
    const fence = marker.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
    return `${fence}${language}\n${content}\n${fence}`;
  },
});

// Use public Markdown tokenizer hooks so entities are decoded exactly once in
// text, in the browser and in DOM-free tests alike. Code tokens stay literal.
export const LiteralEntities = Extension.create({
  name: 'cmsTextEntity',
  markdownTokenizer: {
    name: 'cmsTextEntity', level: 'inline',
    start(source) { return source.search(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i); },
    tokenize(source) {
      const match = source.match(entity);
      return match ? { type: 'cmsTextEntity', raw: match[0] } : undefined;
    },
  },
  parseMarkdown(token, helpers) {
    const raw = String(token.raw || ''), code = raw.match(entity)?.[1] || '';
    const text = code.startsWith('#')
      ? decodeNumericCharacterReference(code.slice(/^#x/i.test(code) ? 2 : 1), /^#x/i.test(code) ? 16 : 10)
      : decodeAttribute(raw);
    return helpers.createTextNode(text);
  },
});

function safeMdx(markdown: string): string {
  const tree = parseBodySyntax(markdown, 'md');
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === 'code' || node.type === 'inlineCode') return;
    const start = node.position?.start.offset, end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) {
      const source = markdown.slice(start, end);
      if (node.type === 'html' && /^<br\s*\/?>$/i.test(source)) edits.push({ start, end, text: '<br />' });
      if (node.type === 'text') {
        let text = source.replace(/(\\*)([{}])/g, (match, slashes: string, brace: string) => slashes.length % 2 ? match : `${slashes}\\${brace}`);
        // Ordinary prose beginning with import/export must not become ESM.
        text = text.replace(/^( {0,3})(import|export)(?=\s)/gm, (_, indent: string, word: string) => `${indent}&#${word.charCodeAt(0)};${word.slice(1)}`);
        if (text !== source) edits.push({ start, end, text });
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  for (const edit of edits.sort((a, b) => b.start - a.start)) markdown = markdown.slice(0, edit.start) + edit.text + markdown.slice(edit.end);
  return markdown;
}

// Keep Tiptap's parser, commands and history. Only adapt the public serialization
// boundary; never run replacements over protected repository source.
export const MdxMarkdown = Markdown.extend({
  onBeforeCreate(event) {
    this.parent?.(event);
    const serialize = this.editor.getMarkdown;
    this.editor.getMarkdown = () => safeMdx(serialize());
  },
});

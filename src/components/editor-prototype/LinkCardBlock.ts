import { createElement, type ChangeEvent } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { matchLinkCardBlock, parseLinkCardMdx, updateLinkCardMdx } from './linkCardMdx.ts';

function LinkCardEditor({ node, updateAttributes }: NodeViewProps) {
  const input = (label: string, key: 'title' | 'href', type = 'text') => createElement('label', null,
    label,
    createElement('input', {
      type, value: node.attrs[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => updateAttributes({ [key]: event.target.value }),
    }),
  );
  return createElement(NodeViewWrapper, { className: 'structured-link-card', contentEditable: false },
    createElement('strong', null, 'Link card'),
    input('Title', 'title'),
    createElement('label', null, 'Description', createElement('textarea', {
      rows: 2, value: node.attrs.description,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => updateAttributes({ description: event.target.value }),
    })),
    input('URL', 'href', 'url'),
  );
}

export const LinkCardBlock = Node.create({
  name: 'linkCardBlock', group: 'block', atom: true, isolating: true,
  addAttributes() {
    return { title: { default: '' }, href: { default: '' }, description: { default: '' }, raw: { default: '' } };
  },
  parseHTML() { return [{ tag: 'div[data-link-card-block]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-link-card-block': '', ...HTMLAttributes }]; },
  addNodeView() { return ReactNodeViewRenderer(LinkCardEditor); },
  parseMarkdown(token, helpers) {
    const parsed = parseLinkCardMdx(String(token.raw || ''));
    return helpers.createNode('linkCardBlock', parsed || {}, []);
  },
  renderMarkdown(node) {
    return updateLinkCardMdx(String(node.attrs?.raw || ''), {
      title: String(node.attrs?.title || ''), href: String(node.attrs?.href || ''), description: String(node.attrs?.description || ''),
    }).replace(/\r?\n$/, '');
  },
  markdownTokenizer: {
    name: 'linkCardBlock', level: 'block',
    start(source) { return source.search(/^[ \t]*<LinkCard\b/m); },
    tokenize(source) {
      const raw = matchLinkCardBlock(source);
      if (!raw || !parseLinkCardMdx(raw)) return undefined;
      return { type: 'linkCardBlock', raw };
    },
  },
});

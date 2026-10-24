import { createElement, useEffect, useState, type ChangeEvent } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { createLinkCardMdx, matchLinkCardBlock, parseLinkCardMdx, updateLinkCardMdx } from './linkCardMdx.ts';

function LinkCardEditor({ node, updateAttributes }: NodeViewProps) {
  const { title, href, description } = node.attrs;
  const [fields, setFields] = useState({ title, href, description });
  // React restores controlled inputs at the end of each change event. Keep the
  // typed value locally so it does not revert while the node-view update arrives.
  useEffect(() => { setFields({ title, href, description }); }, [title, href, description]);
  const change = (key: 'title' | 'href' | 'description', value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    updateAttributes({ [key]: value });
  };
  const input = (label: string, key: 'title' | 'href', type = 'text') => createElement('label', null,
    label,
    createElement('input', {
      type, value: fields[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(key, event.target.value),
    }),
  );
  return createElement(NodeViewWrapper, { className: 'structured-link-card', contentEditable: false },
    createElement('strong', null, 'Link card'),
    input('Title', 'title'),
    createElement('label', null, 'Description', createElement('textarea', {
      rows: 2, value: fields.description,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => change('description', event.target.value),
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
    const fields = {
      title: String(node.attrs?.title || ''), href: String(node.attrs?.href || ''), description: String(node.attrs?.description || ''),
    };
    const raw = String(node.attrs?.raw || '');
    return (raw ? updateLinkCardMdx(raw, fields) : createLinkCardMdx(fields)).replace(/\r?\n$/, '');
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

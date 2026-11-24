import { FieldLabel } from './FieldLabel.ts';
import { createElement, useEffect, useState, type ChangeEvent } from 'react';
import { LinkAddressField } from './LinkAddressField.ts';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { createLinkCardMdx, matchLinkCardBlock, parseLinkCardMdx, updateLinkCardMdx, type LinkCardFields } from './linkCardMdx.ts';
import { previewComponentLink } from './previewLinks.ts';

export function LinkCardProperties({ value, onChange }: { value: LinkCardFields; onChange: (fields: LinkCardFields) => void }) {
  const { title, href, description } = value;
  const [fields, setFields] = useState({ title, href, description });
  // React restores controlled inputs at the end of each change event. Keep the
  // typed value locally so it does not revert while the node-view update arrives.
  useEffect(() => { setFields({ title, href, description }); }, [title, href, description]);
  const change = (key: 'title' | 'href' | 'description', value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    onChange(next);
  };
  const input = (label: string, key: 'title' | 'href', type = 'text') => createElement('label', null,
    createElement(FieldLabel, { text: label, required: true }),
    createElement('input', { required: true,
      type, value: fields[key],
      onChange: (event: ChangeEvent<HTMLInputElement>) => change(key, event.target.value),
    }),
  );
  return createElement('div', { className: 'structured-link-card' },
    createElement('strong', null, 'Link card'),
    input('Title', 'title'),
    createElement('label', null, 'Description', createElement('textarea', {
      rows: 2, value: fields.description,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => change('description', event.target.value),
    })),
    createElement(LinkAddressField, { required: true, value: fields.href, onChange: (value: string) => change('href', value) }),
  );
}

export function LinkCardPreview({ title, href, description }: LinkCardFields) {
  return createElement('a', { className: 'preview-link-card', ...previewComponentLink(href), title: href },
    createElement('strong', null, title),
    description && createElement('p', null, description),
    createElement('span', { className: 'preview-card-arrow', 'aria-hidden': true }, '→'),
  );
}

function LinkCardEditor({ node, updateAttributes, extension }: NodeViewProps) {
  const { title, href, description } = node.attrs;
  const fields = { title, href, description };
  return createElement(NodeViewWrapper, { contentEditable: false }, extension.options.readOnly
    ? createElement(LinkCardPreview, fields)
    : createElement(LinkCardProperties, { value: fields, onChange: updateAttributes }));
}

export const LinkCardBlock = Node.create({
  name: 'linkCardBlock', group: 'block', atom: true, isolating: true,
  addOptions() { return { readOnly: false }; },
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

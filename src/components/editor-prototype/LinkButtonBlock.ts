import { createElement, useEffect, useState, type ChangeEvent } from 'react';
import { LinkAddressField } from './LinkAddressField.ts';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { createLinkButtonMdx, matchLinkButtonBlock, parseLinkButtonMdx, updateLinkButtonMdx, type LinkButtonFields } from './linkButtonMdx.ts';

function LinkButtonEditor({ node, updateAttributes }: NodeViewProps) {
  const { text, href, variant } = node.attrs;
  const [fields, setFields] = useState<LinkButtonFields>({ text, href, variant });
  useEffect(() => { setFields({ text, href, variant }); }, [text, href, variant]);
  const change = (key: keyof LinkButtonFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    updateAttributes({ [key]: value });
  };
  return createElement(NodeViewWrapper, { className: 'structured-link-card structured-link-button', contentEditable: false },
    createElement('strong', null, 'Link button'),
    createElement('span', { className: `link-button-preview ${fields.variant}` }, fields.text || 'Button text'),
    createElement('label', null, 'Button text', createElement('input', { value: fields.text, onChange: (event: ChangeEvent<HTMLInputElement>) => change('text', event.target.value) })),
    createElement(LinkAddressField, { value: fields.href, onChange: (value: string) => change('href', value) }),
    createElement('label', null, 'Appearance', createElement('select', { value: fields.variant, onChange: (event: ChangeEvent<HTMLSelectElement>) => change('variant', event.target.value) },
      ...['primary', 'secondary', 'minimal'].map((value) => createElement('option', { key: value, value }, value[0].toUpperCase() + value.slice(1))),
    )),
  );
}

export const LinkButtonBlock = Node.create({
  name: 'linkButtonBlock', group: 'block', atom: true, isolating: true,
  addAttributes() { return { text: { default: '' }, href: { default: '' }, variant: { default: 'primary' }, raw: { default: '' } }; },
  parseHTML() { return [{ tag: 'div[data-link-button-block]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-link-button-block': '', ...HTMLAttributes }]; },
  addNodeView() { return ReactNodeViewRenderer(LinkButtonEditor); },
  parseMarkdown(token, helpers) { return helpers.createNode('linkButtonBlock', parseLinkButtonMdx(String(token.raw || '')) || {}, []); },
  renderMarkdown(node) {
    const fields: LinkButtonFields = { text: node.attrs?.text || '', href: node.attrs?.href || '', variant: node.attrs?.variant || 'primary' };
    return (node.attrs?.raw ? updateLinkButtonMdx(node.attrs.raw, fields) : createLinkButtonMdx(fields)).replace(/\r?\n$/, '');
  },
  markdownTokenizer: {
    name: 'linkButtonBlock', level: 'block',
    start(source) { return source.search(/^[ \t]*<LinkButton\b/m); },
    tokenize(source) {
      const raw = matchLinkButtonBlock(source);
      return raw && parseLinkButtonMdx(raw) ? { type: 'linkButtonBlock', raw } : undefined;
    },
  },
});

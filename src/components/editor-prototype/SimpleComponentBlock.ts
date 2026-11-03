import { createElement, Fragment, useEffect, useState, type ChangeEvent } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { BADGE_SIZES, BADGE_VARIANTS, CALLOUT_TYPES, SIMPLE_COMPONENTS, SIMPLE_KINDS, createSimpleComponentMdx, emptySimpleFields, matchSimpleComponentBlock, parseSimpleComponentMdx, simpleKindForNode, updateSimpleComponentMdx, type SimpleFields, type SimpleKind } from './simpleComponents.ts';

export function SimpleComponentFields({ kind, fields, onChange, autoFocus = false }: { autoFocus?: boolean; kind: SimpleKind; fields: SimpleFields; onChange: (key: keyof SimpleFields, value: string) => void }) {
  const input = (label: string, key: keyof SimpleFields, required = false) => createElement('label', { key }, label,
    createElement('input', { value: fields[key], required, autoFocus, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value) }));
  const select = (label: string, key: keyof SimpleFields, options: string[]) => createElement('label', { key }, label,
    createElement('select', { value: fields[key], onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(key, event.target.value) },
      ...options.map((option) => createElement('option', { key: option, value: option }, option[0].toUpperCase() + option.slice(1)))));
  return createElement(Fragment, null,
    kind === 'badge' ? input('Badge text', 'text', true) : input(kind === 'card' ? 'Title' : 'Title (optional)', 'title', kind === 'card'),
    kind === 'badge' ? select('Style', 'variant', BADGE_VARIANTS) : null,
    kind === 'badge' ? select('Size', 'size', BADGE_SIZES) : null,
    kind === 'callout' ? select('Type', 'type', CALLOUT_TYPES) : null,
    kind !== 'badge' ? createElement('label', null, 'Message', createElement('textarea', { rows: 4, required: true, value: fields.text, onChange: (event: ChangeEvent<HTMLTextAreaElement>) => onChange('text', event.target.value) })) : null,
  );
}
function SimpleEditor({ node, updateAttributes }: NodeViewProps) {
  const kind = simpleKindForNode(node.type.name)!;
  const { text, title, variant, size, type } = node.attrs;
  const [fields, setFields] = useState<SimpleFields>({ text, title, variant, size, type });
  useEffect(() => { setFields({ text, title, variant, size, type }); }, [text, title, variant, size, type]);
  return createElement(NodeViewWrapper, { className: `structured-simple-component simple-${kind}`, contentEditable: false },
    createElement('strong', null, SIMPLE_COMPONENTS[kind].label),
    kind === 'badge' ? createElement('span', { className: `badge-preview badge-${fields.variant} badge-size-${fields.size}` }, fields.text || 'Badge') : null,
    createElement(SimpleComponentFields, { kind, fields, onChange: (key, value) => {
      setFields((current) => ({ ...current, [key]: value })); updateAttributes({ [key]: value });
    } }),
  );
}
export const SimpleComponentBlocks = SIMPLE_KINDS.map((kind) => Node.create({
  name: SIMPLE_COMPONENTS[kind].node, group: 'block', atom: true, isolating: true,
  addAttributes() { return Object.fromEntries(Object.entries({ ...emptySimpleFields(), raw: '' }).map(([key, value]) => [key, { default: value }])); },
  parseHTML() { return [{ tag: `div[data-simple-component="${kind}"]` }]; },
  renderHTML() { return ['div', { 'data-simple-component': kind }]; },
  addNodeView() { return ReactNodeViewRenderer(SimpleEditor); },
  parseMarkdown(token, helpers) {
    const parsed = parseSimpleComponentMdx(String(token.raw || ''));
    return helpers.createNode(SIMPLE_COMPONENTS[kind].node, parsed ? { ...parsed.fields, raw: parsed.raw } : {});
  },
  renderMarkdown(node) {
    const fields = Object.fromEntries(Object.keys(emptySimpleFields()).map((key) => [key, node.attrs?.[key] || ''])) as SimpleFields;
    return (node.attrs?.raw ? updateSimpleComponentMdx(node.attrs.raw, fields) : createSimpleComponentMdx(kind, fields)).replace(/\r?\n$/, '');
  },
  markdownTokenizer: {
    name: SIMPLE_COMPONENTS[kind].node, level: 'block',
    start(source) { return source.search(new RegExp(`^[ \\t]*<${SIMPLE_COMPONENTS[kind].binding}\\b`, 'm')); },
    tokenize(source) {
      const raw = matchSimpleComponentBlock(source, kind);
      return raw && parseSimpleComponentMdx(raw)?.kind === kind ? { type: SIMPLE_COMPONENTS[kind].node, raw } : undefined;
    },
  },
}));

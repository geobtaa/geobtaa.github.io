import { FieldLabel } from './FieldLabel.ts';
import { createElement, Fragment, useEffect, useState, type ChangeEvent } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { CardBodyEditor } from './CardBodyEditor.ts';
import { parseDirectiveCallout } from './directiveCallout.ts';
import { BADGE_SIZES, BADGE_VARIANTS, CALLOUT_TYPES, SIMPLE_COMPONENTS, SIMPLE_KINDS, createSimpleComponentMdx, emptySimpleFields, matchSimpleComponentBlock, parseSimpleComponentMdx, simpleKindForNode, updateSimpleComponentMdx, type SimpleFields, type SimpleKind } from './simpleComponents.ts';

export function SimpleComponentFields({ kind, fields, onChange, autoFocus = false, richMessage = false }: { autoFocus?: boolean; richMessage?: boolean; kind: SimpleKind; fields: SimpleFields; onChange: (key: keyof SimpleFields, value: string) => void }) {
  const input = (label: string, key: keyof SimpleFields, required = false) => createElement('label', { key }, createElement(FieldLabel, { text: label, required }),
    createElement('input', { value: fields[key], required, autoFocus, onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value) }));
  const select = (label: string, key: keyof SimpleFields, options: string[]) => createElement('label', { key }, label,
    createElement('select', { value: fields[key], onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(key, event.target.value) },
      ...options.map((option) => createElement('option', { key: option, value: option }, option[0].toUpperCase() + option.slice(1)))));
  return createElement(Fragment, null,
    kind === 'badge' ? input('Badge text', 'text', true) : input('Title', 'title', kind === 'card'),
    kind === 'badge' ? select('Style', 'variant', BADGE_VARIANTS) : null,
    kind === 'badge' ? select('Size', 'size', BADGE_SIZES) : null,
    kind === 'callout' ? select('Type', 'type', CALLOUT_TYPES) : null,
    richMessage ? createElement(CardBodyEditor, { body: fields.text, label: 'Callout message', onChange: text => onChange('text', text) })
      : kind !== 'badge' ? createElement('label', null, createElement(FieldLabel, { text: 'Message', required: true }), createElement('textarea', { rows: 4, required: true, value: fields.text, onChange: (event: ChangeEvent<HTMLTextAreaElement>) => onChange('text', event.target.value) })) : null,
  );
}
function SimpleEditor({ node, updateAttributes, extension }: NodeViewProps) {
  const kind = simpleKindForNode(node.type.name)!;
  const { text, title, variant, size, type } = node.attrs;
  const richMessage = kind === 'callout' && !!parseDirectiveCallout(node.attrs.raw || '');
  const [fields, setFields] = useState<SimpleFields>({ text, title, variant, size, type });
  useEffect(() => { setFields({ text, title, variant, size, type }); }, [text, title, variant, size, type]);
  if (extension.options.readOnly) return createElement(NodeViewWrapper, { className: `preview-simple preview-${kind} preview-callout-${type}`, contentEditable: false },
    kind === 'badge'
      ? createElement('span', { className: `badge-preview badge-${variant} badge-size-${size}` }, text)
      : createElement(kind === 'callout' ? 'aside' : 'article', null,
        createElement('strong', null, title || (kind === 'callout' ? type[0].toUpperCase() + type.slice(1) : '')),
        richMessage ? createElement(CardBodyEditor, { body: text, label: 'Callout message', readOnly: true, onChange: () => {} })
          : createElement('p', { style: { whiteSpace: 'pre-wrap' } }, text),
      ),
  );
  return createElement(NodeViewWrapper, { className: `structured-simple-component simple-${kind}`, contentEditable: false },
    createElement('strong', null, SIMPLE_COMPONENTS[kind].label),
    kind === 'badge' ? createElement('span', { className: `badge-preview badge-${fields.variant} badge-size-${fields.size}` }, fields.text || 'Badge') : null,
    createElement(SimpleComponentFields, { kind, fields, richMessage, onChange: (key, value) => {
      setFields((current) => ({ ...current, [key]: value })); updateAttributes({ [key]: value });
    } }),
  );
}
export const SimpleComponentBlocks = SIMPLE_KINDS.map((kind) => Node.create({
  name: SIMPLE_COMPONENTS[kind].node, group: 'block', atom: true, isolating: true,
  addOptions() { return { readOnly: false }; },
  addAttributes() { return Object.fromEntries(Object.entries({ ...emptySimpleFields(), raw: '' }).map(([key, value]) => [key, { default: value }])); },
  parseHTML() { return [{ tag: `div[data-simple-component="${kind}"]` }]; },
  renderHTML() { return ['div', { 'data-simple-component': kind }]; },
  addNodeView() { return ReactNodeViewRenderer(SimpleEditor, kind === 'callout' ? { stopEvent: ({ event }) => !event.type.startsWith('drag') } : {}); },
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
    start(source) { return source.search(kind === 'callout' ? /^(?:[ \t]*<CmsCallout\b| {0,3}:{3,}(?:note|tip|caution|danger|info|warning|Caution)(?=\[|[ \t\r\n]|$))/m : new RegExp(`^[ \\t]*<${SIMPLE_COMPONENTS[kind].binding}\\b`, 'm')); },
    tokenize(source) {
      const raw = matchSimpleComponentBlock(source, kind);
      return raw && parseSimpleComponentMdx(raw)?.kind === kind ? { type: SIMPLE_COMPONENTS[kind].node, raw } : undefined;
    },
  },
}));

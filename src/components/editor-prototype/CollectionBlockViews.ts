import { createElement as h, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { COLLECTION_BLOCKS, COLLECTION_KINDS, collectionKindForNode, createCollectionMdx, matchCollectionBlock, parseCollectionMdx, updateCollectionMdx, type CollectionData, type CollectionKind, type GridCard, type Metric } from './collectionMdx.ts';
import { CardBodyEditor } from './CardBodyEditor.ts';

type Entry = { id: number; value: string; title: string; body: string };
function entriesFor(kind: CollectionKind, data: CollectionData): Entry[] {
  return data.map((value, index) => ({ id: index + 1, value: kind === 'chipList' ? value as string : kind === 'metrics' ? (value as Metric).value : '', title: kind === 'cardGrid' ? (value as GridCard).title : kind === 'metrics' ? (value as Metric).label : '', body: kind === 'cardGrid' ? (value as GridCard).body : '' }));
}
function dataFor(kind: CollectionKind, entries: Entry[]): CollectionData {
  if (kind === 'chipList') return entries.map(entry => entry.value);
  if (kind === 'metrics') return entries.map(({ title, value }) => ({ label: title, value }));
  return entries.map(({ title, body }) => ({ title, body }));
}

function CollectionEditor({ node, updateAttributes, extension }: NodeViewProps) {
  const kind = collectionKindForNode(node.type.name)!;
  const chipList = kind === 'chipList';
  const metrics = kind === 'metrics';
  const cardGrid = kind === 'cardGrid';
  const readOnly = extension.options.readOnly;
  const item = chipList ? 'chip' : metrics ? 'metric' : 'card';
  const itemLabel = chipList ? 'Chip' : metrics ? 'Metric' : 'Card';
  const [entries, setEntries] = useState<Entry[]>(node.attrs.entries);
  const entriesRef = useRef(entries);
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ id?: number; direction?: string } | null>(null);
  const nextId = useRef(Math.max(0, ...entries.map(entry => entry.id)) + 1);
  const [status, setStatus] = useState('');
  useEffect(() => { entriesRef.current = node.attrs.entries; setEntries(node.attrs.entries); }, [node.attrs.entries]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const { id, direction } = pendingFocus.current;
    pendingFocus.current = null;
    const entry = root.current?.querySelector(`[data-collection-entry="${id}"]`);
    const moveButton = direction ? entry?.querySelector<HTMLButtonElement>(`[data-entry-move="${direction}"]`) : null;
    const target = moveButton && !moveButton.disabled ? moveButton : entry?.querySelector<HTMLInputElement>('input') || root.current?.querySelector<HTMLButtonElement>('[data-add-entry]');
    target?.focus({ preventScroll: true });
  }, [entries]);
  const commit = (next: Entry[]) => { entriesRef.current = next; setEntries(next); updateAttributes({ entries: next }); };
  const change = (id: number, key: 'value' | 'title' | 'body', value: string) => commit(entriesRef.current.map(entry => entry.id === id ? { ...entry, [key]: value } : entry));
  const add = () => {
    const id = Math.max(nextId.current, ...entriesRef.current.map(entry => entry.id + 1)); nextId.current = id + 1;
    pendingFocus.current = { id };
    commit([...entriesRef.current, { id, value: '', title: '', body: '' }]);
    setStatus(`${itemLabel} added.`);
  };
  const remove = (id: number) => {
    const current = entriesRef.current;
    const index = current.findIndex(entry => entry.id === id);
    const next = current.filter(entry => entry.id !== id);
    pendingFocus.current = { id: next[Math.min(index, next.length - 1)]?.id };
    commit(next); setStatus(`${itemLabel} removed.`);
  };
  const move = (id: number, direction: -1 | 1) => {
    const next = [...entriesRef.current];
    const index = next.findIndex(entry => entry.id === id);
    if (!next[index + direction]) return;
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    pendingFocus.current = { id, direction: String(direction) };
    commit(next); setStatus(`${itemLabel} moved to position ${index + direction + 1} of ${next.length}.`);
  };
  return h(NodeViewWrapper, { className: `collection-block collection-${kind}`, contentEditable: false },
    h('div', { ref: root },
      h('strong', { className: 'collection-heading' }, COLLECTION_BLOCKS[kind].label),
      chipList && h('ul', { className: 'editor-chip-preview', 'aria-label': 'Chip list preview' }, ...entries.filter(entry => entry.value.trim()).map(entry => h('li', { key: entry.id }, entry.value))),
      metrics && h('div', { className: 'cms-metrics-block', 'aria-label': 'Metrics preview' }, h('dl', { className: 'cms-metrics' }, ...entries.filter(entry => entry.title.trim() || entry.value.trim()).map(entry => h('div', { key: entry.id, className: 'cms-metric' }, h('dt', { className: 'cms-metric-label' }, entry.title), h('dd', { className: 'cms-metric-value' }, entry.value))))),
      !readOnly && h('p', { className: 'collection-status', role: 'status' }, status),
      (cardGrid || !readOnly) && h('div', { className: `collection-${chipList ? 'chip' : metrics ? 'metric' : 'card'}-entries` }, ...entries.map((entry, index) => h('fieldset', { key: entry.id, className: 'collection-entry', 'data-collection-entry': entry.id },
        !readOnly && h('legend', null, `${itemLabel} ${index + 1}`),
        !readOnly && h('label', null, chipList ? 'Text' : metrics ? 'Label' : 'Title', h('input', { value: chipList ? entry.value : entry.title, 'aria-label': `${itemLabel} ${index + 1} ${chipList ? 'text' : metrics ? 'label' : 'title'}`, onChange: (event: ChangeEvent<HTMLInputElement>) => change(entry.id, chipList ? 'value' : 'title', event.target.value) })),
        metrics && !readOnly && h('label', null, 'Value', h('input', { value: entry.value, 'aria-label': `Metric ${index + 1} value`, onChange: (event: ChangeEvent<HTMLInputElement>) => change(entry.id, 'value', event.target.value) })),
        cardGrid && readOnly && h('strong', null, entry.title),
        cardGrid && h(CardBodyEditor, { body: entry.body, label: `Card ${index + 1} content`, readOnly, onChange: body => change(entry.id, 'body', body) }),
        !readOnly && h('div', { className: 'collection-entry-actions' },
          h('button', { type: 'button', 'data-entry-move': '-1', 'aria-label': `Move ${item} ${index + 1} up`, disabled: index === 0, onClick: () => move(entry.id, -1) }, '↑ Move up'),
          h('button', { type: 'button', 'data-entry-move': '1', 'aria-label': `Move ${item} ${index + 1} down`, disabled: index === entries.length - 1, onClick: () => move(entry.id, 1) }, '↓ Move down'),
          h('button', { type: 'button', 'aria-label': `Remove ${item} ${index + 1}`, onClick: () => remove(entry.id) }, `Remove ${item}`),
        ),
      ))),
      !readOnly && h('button', { type: 'button', 'data-add-entry': '', onClick: add }, `Add ${item}`),
    ),
  );
}

export const CollectionBlocks = COLLECTION_KINDS.map(kind => Node.create({
  name: COLLECTION_BLOCKS[kind].node, group: 'block', atom: true, isolating: true,
  addOptions() { return { readOnly: false }; },
  addAttributes() { return { entries: { default: [] }, raw: { default: '' } }; },
  parseHTML() { return [{ tag: `div[data-collection-block="${kind}"]` }]; },
  renderHTML() { return ['div', { 'data-collection-block': kind }]; },
  addNodeView() { return ReactNodeViewRenderer(CollectionEditor, { stopEvent: ({ event }) => !event.type.startsWith('drag') }); },
  parseMarkdown(token, helpers) {
    const parsed = parseCollectionMdx(String(token.raw || ''));
    return helpers.createNode(COLLECTION_BLOCKS[kind].node, { entries: entriesFor(kind, parsed?.data || []), raw: parsed?.raw || '' });
  },
  renderMarkdown(node) {
    const data = dataFor(kind, node.attrs?.entries || []);
    return (node.attrs?.raw ? updateCollectionMdx(node.attrs.raw, data) : createCollectionMdx(kind, data)).replace(/\r?\n$/, '');
  },
  markdownTokenizer: {
    name: COLLECTION_BLOCKS[kind].node, level: 'block',
    start(source) { return source.search(new RegExp(`^[ \\t]*<${COLLECTION_BLOCKS[kind].binding}\\b`, 'm')); },
    tokenize(source) {
      const raw = matchCollectionBlock(source, kind);
      return raw && parseCollectionMdx(raw) ? { type: COLLECTION_BLOCKS[kind].node, raw } : undefined;
    },
  },
}));

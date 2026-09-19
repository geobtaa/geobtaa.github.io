import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Editor } from '@tiptap/core';
import { parseHTML } from 'linkedom';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { richTextEditorOptions } from '../src/components/editor-prototype/richTextEditor.ts';

const { window } = parseHTML('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window,
  document: window.document,
  DOMParser: window.DOMParser,
  MutationObserver: window.MutationObserver,
  getSelection: window.getSelection?.bind(window),
  innerHeight: 800,
  innerWidth: 1200,
});
window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
window.HTMLElement.prototype.getClientRects = () => [];
const selection = { anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, rangeCount: 0, isCollapsed: true, removeAllRanges() {}, addRange() {} };
window.document.getSelection = () => selection;
window.getSelection = () => selection;

function openEditor(markdown = '') {
  let externalMarkdown = markdown;
  const editor = new Editor({ ...richTextEditorOptions(markdown, (next) => { externalMarkdown = next; }), injectCSS: false });
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  return { editor, externalMarkdown: () => externalMarkdown };
}

function type(editor, value) {
  for (const character of value) editor.commands.insertContent(character);
}

function assertSingleParagraph(editor, text) {
  const document = editor.getJSON();
  assert.equal(document.content?.length, 1);
  assert.equal(document.content?.[0].type, 'paragraph');
  assert.equal(document.content?.[0].content?.map((node) => node.text || '').join(''), text);
}

test('consecutive characters stay in one paragraph immediately after opening', () => {
  const { editor, externalMarkdown } = openEditor('Existing ');
  type(editor, 'Some');
  assertSingleParagraph(editor, 'Existing Some');
  assert.equal(externalMarkdown(), 'Existing Some');
  editor.destroy();
});

test('typing remains continuous after bold is turned on and off', () => {
  const { editor } = openEditor();
  editor.commands.toggleBold();
  type(editor, 'Some');
  editor.commands.toggleBold();
  type(editor, ' text');
  assertSingleParagraph(editor, 'Some text');
  assert.equal(editor.getMarkdown(), '**Some** text');
  editor.destroy();
});

test('opening another entry initializes a new document once', () => {
  const first = openEditor('First');
  type(first.editor, ' entry');
  first.editor.destroy();

  const second = openEditor('Second ');
  type(second.editor, 'Some');
  assertSingleParagraph(second.editor, 'Second Some');
  second.editor.destroy();
});

test('saving external Markdown does not rehydrate the live editor', () => {
  const { editor, externalMarkdown } = openEditor('Before ');
  type(editor, 'save');
  const instance = editor;
  const savedMarkdown = externalMarkdown();

  type(editor, ' and after');
  assert.equal(editor, instance);
  assert.equal(savedMarkdown, 'Before save');
  assertSingleParagraph(editor, 'Before save and after');
  editor.destroy();
});

test('typing in Markdown adjacent to protected MDX preserves the MDX block', () => {
  const body = 'Before\n\n<Card>\nprotected\n</Card>\n\nAfter ';
  const segments = splitBody(body);
  const protectedSegment = segments.find((segment) => segment.kind === 'protected');
  const editableSegment = segments.at(-1);
  assert.equal(protectedSegment?.content, '<Card>\nprotected\n</Card>\n');
  assert.equal(editableSegment?.kind, 'markdown');

  const { editor } = openEditor(editableSegment?.content);
  type(editor, 'Some');
  assertSingleParagraph(editor, 'After Some');
  assert.match(segments.map((segment) => segment === editableSegment ? editor.getMarkdown() : segment.content).join(''), /<Card>\nprotected\n<\/Card>/);
  editor.destroy();
});

test('React integration has no live-content rehydration and remounts only for entry sessions', async () => {
  const source = await readFile(new URL('../src/components/editor-prototype/ProjectEditor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /commands\.setContent|setContent\s*\(/);
  assert.match(source, /<BodyEditor key=\{bodyEditorSession\} initialValue=\{project\.body\}/);
  assert.doesNotMatch(source, /<BodyEditor key=\{`\$\{project\.filename\}:\$\{project\.sha/);
});

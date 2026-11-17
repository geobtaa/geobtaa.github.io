import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

// Native selection and controlled-input restoration require a real browser.
test('Link Card inputs keep the cursor during mid-field typing, undo/redo, and reload', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.',
  timeout: 30_000,
}, async () => {
  await withEditorBrowser(`import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { richTextEditorOptions } from '../src/components/editor-prototype/richTextEditor.ts';
function App() {
  const editor = useEditor({ ...richTextEditorOptions('<LinkCard title="Original title" href="https://example.com/path" description="Original description" />', () => {}), immediatelyRender: false });
  window.editor = editor;
  return React.createElement(EditorContent, { editor });
}
createRoot(document.getElementById('root')).render(React.createElement(App));`, async ({ evaluate, waitFor, arrow, send }) => {
    await waitFor('!!document.querySelector(".structured-link-card input")');
    for (const [index, selector, original] of [[0, 'input', 'Original title'], [0, 'textarea', 'Original description'], [1, 'input', 'https://example.com/path']]) {
      const field = `document.querySelectorAll('.structured-link-card ${selector}')[${index}]`;
      await evaluate(`${field}.focus(); ${field}.select()`);
      await arrow('ArrowLeft', 37);
      await arrow('ArrowRight', 39);
      await arrow('ArrowRight', 39);
      for (const character of 'xyz') {
        await send('Input.insertText', { text: character });
        await delay(25);
      }
      assert.equal(await evaluate(`${field}.value`), `${original.slice(0, 2)}xyz${original.slice(2)}`, `${selector}[${index}] kept the insertion point`);
      if (selector === 'textarea' || index === 0) assert.equal(await evaluate(`${field}.selectionStart`), 5);
    }
    const saved = await evaluate('window.editor.getMarkdown()');
    assert.match(saved, /title="Orxyziginal title"/);
    assert.match(saved, /description="Orxyziginal description"/);
    assert.match(saved, /href="htxyztps:\/\/example.com\/path"/);
    await evaluate('window.editor.commands.undo()');
    await waitFor('document.querySelectorAll(".structured-link-card input")[1].value === window.editor.state.doc.firstChild.attrs.href');
    assert.notEqual(await evaluate('window.editor.getMarkdown()'), saved);
    await evaluate('window.editor.commands.redo()');
    await waitFor('document.querySelectorAll(".structured-link-card input")[1].value === "htxyztps://example.com/path"');
    assert.equal(await evaluate('window.editor.getMarkdown()'), saved);
    await evaluate(`window.editor.commands.setContent(${JSON.stringify(saved)}, { contentType: 'markdown' })`);
    await waitFor('document.querySelector(".structured-link-card input").value === "Orxyziginal title"');
    assert.equal(await evaluate('window.editor.getMarkdown()'), saved);
  });
});

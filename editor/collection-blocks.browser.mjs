import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';
import { createCollectionMdx, parseCollectionMdx } from '../src/components/editor/collectionMdx.ts';

const legacy = '<ChipList>\n- **Rich legacy chip**\n</ChipList>\n\n<CardGrid>\n<Card title="Legacy">Keep **rich** content.</Card>\n</CardGrid>\n';
const originalBody = `import ChipList from 'src/components/ChipList.astro';\nimport { Card, CardGrid } from '@astrojs/starlight/components';\n\n${legacy}\nAn ordinary paragraph.\n`;
const fixture = (preview = false) => `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: 'blocks.mdx', sha: 'loaded', title: 'Blocks', description: '', draft: true, date: '2026-11-09', authors: [], tags: [], cover: null, body: ${JSON.stringify(originalBody)}, content: ${JSON.stringify('---\ntitle: Blocks\n---\n\n' + originalBody)} };
${preview ? `window.record.conversion = { kind: 'legacy', error: null, body: ${JSON.stringify(`import CmsChipList from 'src/components/editor-blocks/ChipList.astro';\nimport CmsCardGrid from 'src/components/editor-blocks/CardGrid.astro';\nimport CmsMetrics from 'src/components/editor-blocks/Metrics.astro';\n\n${createCollectionMdx('chipList', ['Preview chips'])}\n\n${createCollectionMdx('cardGrid', [{ title: 'Preview card', body: '**Read-only content.**' }])}\n\n${createCollectionMdx('metrics', [{ label: 'Preview visitors', value: '3,651' }])}`)} };` : ''}
window.writes = [];
window.confirm = () => true;
window.prompt = () => 'example.com/maps';
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/updates') return Response.json({ branch: 'custom-cms', entries: [{ name: 'blocks.mdx', path: 'src/content/docs/updates/blocks.mdx', sha: window.record.sha }] });
  if (path === '/api/content/updates/blocks.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 60_000 };
async function open(browser) {
  await browser.waitFor('!!document.querySelector(".dashboard-card")');
  await browser.evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
  await browser.waitFor('!!document.querySelector(".project-list button")');
  await browser.evaluate('document.querySelector(".project-list button").click()');
  await browser.waitFor('!!document.querySelector(".body-editor")');
}
const click = async (browser, selector) => {
  await browser.waitFor(`!!(${selector}) && !(${selector}).disabled`);
  await browser.evaluate(`(${selector}).click()`);
};
const button = (text, scope = 'document') => `[...${scope}.querySelectorAll('button')].find(button => (button.getAttribute('aria-label') || button.textContent.trim()) === ${JSON.stringify(text)})`;
const labeledButton = label => `[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === ${JSON.stringify(label)})`;
async function fill(browser, selector, value) {
  await browser.evaluate(`(${selector}).focus(); (${selector}).select()`);
  await browser.send('Input.insertText', { text: value });
}
async function insert(browser, label, row) {
  const menu = await openNewBlockMenu(browser, label, row);
  await click(browser, button(label, menu));
}
async function save(browser, count) {
  await browser.evaluate('document.querySelector(".top-save").click()');
  await browser.waitFor(`window.writes.length === ${count} && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"`);
}

async function cardState(browser, card) {
  return browser.evaluate(`(() => {
    const content = (${card})?.querySelector('.card-body .tiptap');
    const editor = content?.editor;
    const selection = editor?.state.selection;
    return {
      browser: navigator.userAgent, platform: navigator.platform,
      focused: document.activeElement === content,
      domSelection: window.getSelection()?.toString(),
      editorSelection: selection?.toJSON(),
      selectedText: selection && editor.state.doc.textBetween(selection.from, selection.to, ' '),
      html: content?.innerHTML, markdown: editor?.getMarkdown(),
    };
  })()`);
}
async function waitForCard(browser, card, condition, stage) {
  try { await browser.waitFor(condition); }
  catch (error) {
    const diagnostic = await cardState(browser, card).catch(failure => ({ unavailable: failure.message }));
    throw new Error(`${stage}: ${error.message}\nCard diagnostics: ${JSON.stringify(diagnostic, null, 2)}`, { cause: error });
  }
}

test('chips and rich card grids insert, reorder entries, preserve cursors and formatting, save/reopen and remove independently', options, async () => {
  await withEditorBrowser(fixture(), async browser => {
    const { evaluate, waitFor, send } = browser;
    await open(browser);
    assert.equal(await evaluate('document.querySelectorAll(".collection-block").length'), 0, 'legacy layouts stay protected');
    await insert(browser, 'Chip List');
    await waitFor('!!document.querySelector(".collection-chipList input")');
    await fill(browser, 'document.querySelector(".collection-chipList input")', 'Lincoln, Nebraska');
    await click(browser, button('Add chip', 'document.querySelector(".collection-chipList")'));
    await waitFor('document.activeElement?.getAttribute("aria-label") === "Chip 2 text"');
    await send('Input.insertText', { text: 'Maps & <literal> {value}' });
    await click(browser, button('Add chip', 'document.querySelector(".collection-chipList")'));
    await send('Input.insertText', { text: 'Third chip' });
    await click(browser, labeledButton('Move chip 3 up'));
    await waitFor('document.activeElement?.getAttribute("aria-label") === "Move chip 2 up"');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".collection-chipList input")].map(input => input.value)'), ['Lincoln, Nebraska', 'Third chip', 'Maps & <literal> {value}']);
    await click(browser, labeledButton('Remove chip 2'));
    await waitFor('document.querySelectorAll(".collection-chipList input").length === 2');
    const firstChip = 'document.querySelector(".collection-chipList input")';
    await evaluate(`${firstChip}.focus(); ${firstChip}.setSelectionRange(2, 2)`);
    for (const text of 'xyz') await send('Input.insertText', { text });
    assert.equal(await evaluate(`${firstChip}.value`), 'Lixyzncoln, Nebraska');
    assert.equal(await evaluate(`${firstChip}.selectionStart`), 5);
    await insert(browser, 'Card Grid', 'document.querySelector(".collection-chipList").closest(".block-row")');
    await waitFor('document.querySelectorAll(".collection-cardGrid .collection-entry").length === 2');
    const card = index => `document.querySelectorAll('.collection-cardGrid .collection-entry')[${index}]`;
    await fill(browser, `${card(0)}.querySelector('input')`, 'Maps & <literal> {title}');
    const richText = 'An important update with <literal> & {data}.';
    const content = `${card(0)}.querySelector('.card-body .tiptap')`;
    await evaluate(`${content}.focus()`);
    await send('Input.insertText', { text: richText });
    await waitForCard(browser, card(0), `${content}.textContent === ${JSON.stringify(richText)}`, 'Card text insertion');
    // Use the browser's select-all shortcut in the focused nested editor, then
    // wait for ProseMirror to observe it. A DOM Range alone leaves a window in
    // which Bold sees a collapsed editor selection and only toggles stored marks.
    const modifiers = await evaluate('/Mac/.test(navigator.platform) ? 4 : 2');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers });
    await waitForCard(browser, card(0), `(() => {
      const editor = ${content}.editor, { from, to } = editor.state.selection;
      return document.activeElement === ${content} && from !== to
        && editor.state.doc.textBetween(from, to, ' ') === ${JSON.stringify(richText)}
        && window.getSelection().toString().trim() === ${JSON.stringify(richText)};
    })()`, 'Card select-all synchronization');
    const formattingTrace = { selected: await cardState(browser, card(0)), bold: null, list: null };
    await click(browser, button('Bold', `${card(0)}.querySelector('.toolbar')`));
    await waitForCard(browser, card(0), `${content}.querySelector('strong')?.textContent === ${JSON.stringify(richText)} && ${content}.editor.getMarkdown().includes('**')`, 'Bold applies before subsequent edits');
    formattingTrace.bold = await cardState(browser, card(0));
    await click(browser, button('Link', `${card(0)}.querySelector('.toolbar')`));
    await waitForCard(browser, card(0), `${content}.querySelector('a')?.getAttribute('href') === 'https://example.com/maps' && ${content}.querySelector('strong')?.textContent === ${JSON.stringify(richText)}`, 'Link preserves bold');
    await click(browser, button('Bulleted list', `${card(0)}.querySelector('.toolbar')`));
    await waitForCard(browser, card(0), `${content}.querySelector('li strong')?.textContent === ${JSON.stringify(richText)}`, 'List preserves bold');
    formattingTrace.list = await cardState(browser, card(0));
    await fill(browser, `${card(1)}.querySelector('input')`, 'Second card');
    await evaluate(`${card(1)}.querySelector('.card-body .tiptap').focus()`);
    await send('Input.insertText', { text: 'Second card body.' });
    await click(browser, button('Undo', `${card(1)}.querySelector('.toolbar')`));
    await waitFor(`${card(1)}.querySelector('.card-body .tiptap').textContent === ''`);
    await click(browser, button('Redo', `${card(1)}.querySelector('.toolbar')`));
    await waitFor(`${card(1)}.querySelector('.card-body .tiptap').textContent === 'Second card body.'`);
    await click(browser, button('Add card', 'document.querySelector(".collection-cardGrid")'));
    await waitFor('document.activeElement?.getAttribute("aria-label") === "Card 3 title"');
    await send('Input.insertText', { text: 'Third card' });
    await evaluate(`${card(2)}.querySelector('.card-body .tiptap').focus()`);
    await send('Input.insertText', { text: 'Third card body.' });
    await click(browser, labeledButton('Move card 3 up'));
    await click(browser, labeledButton('Move card 2 up'));
    await waitFor(`${card(0)}.querySelector('input').value === 'Third card'`);
    assert.ok((await evaluate(`${card(1)}.querySelector('.card-body .tiptap').textContent`)).includes('An important update'));
    await click(browser, labeledButton('Remove card 3'));
    await waitFor('document.querySelectorAll(".collection-cardGrid .collection-entry").length === 2');
    await save(browser, 1);
    const saved = await evaluate('window.record.body');
    assert.ok(saved.includes(legacy));
    const chipSource = saved.split('\n').find(line => line.startsWith('<CmsChipList '));
    const gridSource = saved.split('\n').find(line => line.startsWith('<CmsCardGrid '));
    assert.deepEqual(parseCollectionMdx(chipSource).data, ['Lixyzncoln, Nebraska', 'Maps & <literal> {value}']);
    const cards = parseCollectionMdx(gridSource).data;
    assert.equal(cards[0].title, 'Third card'); assert.equal(cards[0].body, 'Third card body.');
    assert.equal(cards[1].title, 'Maps & <literal> {title}');
    const formattingDiagnostics = `Serialized card: ${JSON.stringify(cards[1], null, 2)}\nFormatting trace: ${JSON.stringify(formattingTrace, null, 2)}`;
    assert.ok(cards[1].body.includes('**'), `Saved card must retain bold Markdown.\n${formattingDiagnostics}`);
    assert.ok(cards[1].body.includes('https://example.com/maps'), `Saved card must retain its link.\n${formattingDiagnostics}`);
    assert.match(cards[1].body, /^- /, `Saved card must retain its list.\n${formattingDiagnostics}`);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".collection-cardGrid .card-body .tiptap").length === 2');
    assert.equal(await evaluate(`${card(1)}.querySelector('.card-body .tiptap strong').textContent`), 'An important update with <literal> & {data}.');
    await fill(browser, 'document.querySelector(".editor-fields input[required]")', 'Updated metadata');
    await save(browser, 2);
    assert.equal(await evaluate('window.record.body'), saved, 'unchanged reopening preserves exact source');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await click(browser, labeledButton('Remove chip 2'));
    await click(browser, labeledButton('Remove chip 1'));
    await waitFor('document.querySelectorAll(".collection-chipList input").length === 0');
    await click(browser, button('Add chip', 'document.querySelector(".collection-chipList")'));
    await waitFor('document.activeElement?.getAttribute("aria-label") === "Chip 1 text"');
    await send('Input.insertText', { text: 'Restored chip' });
    await click(browser, button('Remove Card Grid'));
    await waitFor('!document.querySelector(".collection-cardGrid")');
    await save(browser, 3);
    assert.ok((await evaluate('window.record.body')).includes(legacy));
    assert.ok(!(await evaluate('window.record.body')).includes('<CmsCardGrid '));
    assert.ok((await evaluate('window.record.body')).includes('Restored chip'));
  });
});

test('conversion previews show chips and formatted cards without editable controls or nested editors', options, async () => {
  await withEditorBrowser(fixture(true), async browser => {
    await open(browser);
    await click(browser, button('Preview editable version'));
    await browser.waitFor('!!document.querySelector(".conversion-preview-content .collection-cardGrid .tiptap")');
    assert.equal(await browser.evaluate('document.querySelector(".conversion-preview-content .collection-cardGrid .tiptap").getAttribute("contenteditable")'), 'false');
    assert.equal(await browser.evaluate('document.querySelector(".conversion-preview-content .editor-chip-preview").textContent'), 'Preview chips');
    assert.equal(await browser.evaluate('document.querySelector(".conversion-preview-content .cms-metric-value").textContent'), '3,651');
    assert.equal(await browser.evaluate('document.querySelectorAll(".conversion-preview-content .collection-block input, .conversion-preview-content .collection-block button").length'), 0);
    await click(browser, button('Cancel preview'));
    assert.equal(await browser.evaluate('window.writes.length'), 0);
    assert.equal(await browser.evaluate('document.querySelector(".top-save").disabled'), true);
  });
});

test('Metrics inserts editable free-form values, previews responsively, reorders and saves/reopens as a removable block', options, async () => {
  await withEditorBrowser(fixture(), async browser => {
    const { evaluate, waitFor, send } = browser;
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await open(browser); await insert(browser,'Metrics');
    await waitFor('document.querySelectorAll(".collection-metrics .collection-entry").length === 1');
    const input = label => `[...document.querySelectorAll('.collection-metrics input')].find(input=>input.getAttribute('aria-label')===${JSON.stringify(label)})`;
    const items = [{ label:'Visitors',value:'3,651' },{label:'Visits with Downloads',value:'10.4%'},{label:'Visits with Searches',value:'15.38%'},{label:'Pageviews',value:'13,774'}];
    for (const [index,item] of items.entries()) {
      if (index) { await click(browser,button('Add metric','document.querySelector(".collection-metrics")')); await waitFor(`document.activeElement?.getAttribute('aria-label')==='Metric ${index+1} label'`); }
      await fill(browser,input(`Metric ${index+1} label`),item.label); await fill(browser,input(`Metric ${index+1} value`),item.value);
    }
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".collection-metrics dd")].map(item=>item.textContent)'),items.map(item=>item.value));
    const columns = 'getComputedStyle(document.querySelector(".collection-metrics .cms-metrics")).gridTemplateColumns.split(/\\s+/).length';
    for (const [width,count] of [[720,4],[520,2],[320,1]]) {
      await evaluate(`document.querySelector('.collection-metrics .cms-metrics-block').style.width='${width}px'`);
      await waitFor(`${columns}===${count}`);
    }
    const style = await evaluate(`(() => {const value=document.querySelector('.collection-metrics dd'),label=document.querySelector('.collection-metrics dt');return{size:parseFloat(getComputedStyle(value).fontSize),align:getComputedStyle(value).textAlign,above:value.getBoundingClientRect().top<label.getBoundingClientRect().top}})()`);
    assert.ok(style.size>=28); assert.equal(style.align,'center'); assert.equal(style.above,true);
    await evaluate('document.querySelector(".collection-metrics .cms-metrics-block").style.width=""');
    await click(browser,labeledButton('Move metric 4 up'));
    await waitFor('document.activeElement?.getAttribute("aria-label")==="Move metric 3 up"');
    await click(browser,labeledButton('Remove metric 2'));
    await click(browser,button('Add metric','document.querySelector(".collection-metrics")'));
    await fill(browser,input('Metric 4 label'),'Maps & <literal> {label}');
    await fill(browser,input('Metric 4 value'),'Approx. 5–10 million');
    await save(browser,1);
    const source = await evaluate('window.record.body'); const raw = source.split('\n').find(line=>line.startsWith('<CmsMetrics '));
    const expected = [items[0],items[3],items[2],{label:'Maps & <literal> {label}',value:'Approx. 5–10 million'}];
    assert.deepEqual(parseCollectionMdx(raw).data,expected); assert.ok(source.includes(legacy));
    await evaluate('document.querySelector(".editor-navigation .back").click()'); await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()'); await waitFor('document.querySelectorAll(".collection-metrics .collection-entry").length===4');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".collection-metrics dd")].map(item=>item.textContent)'),expected.map(item=>item.value));
    await fill(browser, 'document.querySelector(".editor-fields input[required]")', 'Updated metadata');
    await save(browser,2); assert.equal(await evaluate('window.record.body'),source);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    await click(browser,button('Remove Metrics')); await waitFor('!document.querySelector(".collection-metrics")');
    await save(browser,3); assert.ok(!(await evaluate('window.record.body')).includes('<CmsMetrics '));
    assert.ok((await evaluate('window.record.body')).includes(legacy));
  });
});

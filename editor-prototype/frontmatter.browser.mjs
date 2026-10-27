import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_AREAS } from './contentAreas.mjs';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
import { CONTENT_AREAS } from './contentAreas.mjs';
import { parsePage, serializePage, newPage } from './page.mjs';
import { serializeBlog } from './blog.mjs';
import { contentVisibility } from './content.mjs';
import { stringify } from 'yaml';
window.records = {};
window.writes = [];
window.confirm = () => true;
for (const area of Object.keys(CONTENT_AREAS)) {
  const metadata = { title: area + ' title', description: '', draft: false, sidebar: { order: 2, badge: 'Keep', attrs: { class: 'keep-navigation' } }, tableOfContents: false, custom: { keep: true } };
  if (area === 'library' || area === 'posts') Object.assign(metadata, { date: '2025-12-31T23:00:00.000-06:00', authors: [{ name: 'Staff', title: 'Keep author title' }], tags: ['Maps'] });
  if (area === 'library' || area === 'scholarship') metadata.year = 2025;
  if (area === 'guides' || area === 'scholarship') metadata.tags = ['Maps'];
  if (area === 'workgroups') Object.assign(metadata, { committee: 'Steering', lead: 'Staff', members: ['One'], dates_active: 'May 2025 – October 2026' });
  if (area === 'conference') Object.assign(metadata, { template: 'splash', hidePageTitle: false, banner: { content: 'Old <b>banner</b>' }, head: [{ tag: 'meta', attrs: { property: 'og:image', content: '/old-image.png' } }, { tag: 'meta', attrs: { name: 'custom-setting', content: 'Keep this' } }] });
  window.records[area] = '---\\n' + stringify(metadata) + '---\\n\\nEditable text.\\n\\n<CenterLayout>Protected MDX.</CenterLayout>\\n';
}
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  const [area, filename] = path.replace('/api/content/', '').split('/');
  if (!filename) return Response.json({ branch: 'custom-cms', entries: [{ name: 'entry.mdx', path: 'src/content/docs/' + area + '/entry.mdx', sha: 'loaded', ...contentVisibility(window.records[area]), visibilityKnown: true }] });
  if (options.method === 'PUT') {
    const input = JSON.parse(options.body); window.writes.push({ area, input });
    window.records[area] = input.sha ? (area === 'posts' ? serializeBlog(window.records[area], input) : serializePage(window.records[area], input)) : newPage(area, input);
  }
  return Response.json({ filename, content: window.records[area], sha: 'loaded', commitSha: 'saved-commit', ...parsePage(window.records[area]), ...contentVisibility(window.records[area]) });
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('every content area edits and reopens metadata using the existing controls and formats', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 60_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    const field = label => `[...document.querySelectorAll('.editor-fields label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input, textarea, select')`;
    const fill = async (label, value) => {
      const selector = field(label);
      await evaluate(`${selector}.focus(); ${selector}.select()`);
      await send('Input.insertText', { text: value });
    };
    const setValue = async (label, value) => evaluate(`(() => {
      const input = ${field(label)};
      Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    for (const [area, config] of Object.entries(CONTENT_AREAS)) {
      await waitFor('!!document.querySelector(".dashboard-card")');
      await evaluate(`[...document.querySelectorAll('.dashboard-card')].find(button => button.querySelector('.dashboard-card-title').textContent.includes(${JSON.stringify(config.label)})).click()`);
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor('!!document.querySelector(".editor-fields")');
      assert.equal(await evaluate('document.querySelector(".visibility-switch").getAttribute("aria-checked")'), 'true');
      await fill('Title', `Revised ${area}`);
      await fill('Description', `Revised ${area} summary.\nSecond line.`);
      await evaluate('document.querySelector(".visibility-switch").click(); document.querySelector(".page-settings").open = true');
      await fill('Navigation label', `${area} navigation`);
      await fill('Navigation order', '7');
      await setValue('Navigation visibility', 'true');
      await setValue('Table of contents', 'true');
      if (area === 'library' || area === 'scholarship') await fill('Year (optional)', '2026');
      if (area === 'library' || area === 'posts') {
        await setValue(area === 'posts' ? 'Publication date' : 'Date (optional)', '2026-03-01');
        await fill('Author 1', 'Revised author');
      }
      if (['guides', 'library', 'posts', 'scholarship'].includes(area)) await fill('Tags (optional)', 'Revised tag,  Another tag, , ');
      if (area === 'workgroups') {
        await fill('Committee', 'Metadata'); await fill('Lead', 'New lead'); await fill('Member 1', 'New member'); await fill('Active dates', 'October 2026 – present');
      }
      if (area === 'conference') { await fill('Banner content', 'New <b>banner</b>'); await fill('Open Graph image URL', '/new-image.png'); }
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.some(write => write.area === ${JSON.stringify(area)}) && document.querySelector('.save-state').textContent === 'No unsaved changes'`);
      const saved = await evaluate(`window.records[${JSON.stringify(area)}]`);
      assert.ok(saved.includes('<CenterLayout>Protected MDX.</CenterLayout>'));
      const entry = await evaluate(`window.writes.find(write => write.area === ${JSON.stringify(area)}).input`);
      assert.equal(entry.metadata.sidebar.badge, 'Keep');
      assert.equal(entry.metadata.sidebar.attrs.class, 'keep-navigation');
      assert.equal(entry.draft, true);
      if (['guides', 'library', 'posts', 'scholarship'].includes(area)) assert.deepEqual(entry.tags, ['Revised tag', 'Another tag']);
      if (area === 'library' || area === 'posts') {
        assert.equal(entry.date, '2026-03-01');
        assert.equal(entry.authors[0].title, 'Keep author title');
        assert.ok(saved.includes('2026-03-01T23:00:00.000-06:00'));
      }
      await evaluate('document.querySelector(".editor-navigation .back").click()');
      await waitFor('!!document.querySelector(".project-list button")');
      assert.equal(await evaluate('document.querySelector(".project-list .visibility-badge").textContent'), 'Draft');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor('!!document.querySelector(".editor-fields")');
      assert.equal(await evaluate(`${field('Title')}.value`), `Revised ${area}`);
      assert.equal(await evaluate(`${field('Description')}.value`), `Revised ${area} summary.\nSecond line.`);
      assert.equal(await evaluate(`${field('Navigation label')}.value`), `${area} navigation`);
      assert.equal(await evaluate(`${field('Navigation visibility')}.value`), 'true');
      if (['guides', 'library', 'posts', 'scholarship'].includes(area)) assert.equal(await evaluate(`${field('Tags (optional)')}.value`), 'Revised tag, Another tag');
      if (area === 'workgroups') assert.equal(await evaluate(`${field('Member 1')}.value`), 'New member');
      if (area === 'library' || area === 'scholarship') assert.equal(await evaluate(`${field('Year (optional)')}.value`), '2026');
      await evaluate('document.querySelector(".dashboard-link").click()');
    }
    // A new non-blog page can be created without acquiring an automatic date.
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Library")).click()');
    await waitFor('!!document.querySelector(".list-heading .primary")');
    await evaluate('document.querySelector(".list-heading .primary").click()');
    await waitFor('!!document.querySelector(".editor-fields")');
    assert.equal(await evaluate(`${field('Date (optional)')}.value`), '');
    await fill('Title', 'New library document');
    await fill('Year (optional)', '2026');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 11 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes.at(-1).input.date'), '');
    assert.doesNotMatch(await evaluate('window.records.library'), /^date:/m);
  });
});


test('comma-separated tags support continuous typing, mid-field edits, and clearing', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    const input = `([...document.querySelectorAll('.editor-fields label')].find(label => label.textContent.startsWith('Tags ')).querySelector('input'))`;
    await waitFor(`!!${input}`);
    await evaluate(`${input}.focus(); ${input}.select()`);
    for (const text of 'First, Second') await send('Input.insertText', { text });
    assert.equal(await evaluate(`${input}.value`), 'First, Second');
    await evaluate(`${input}.setSelectionRange(2, 2)`);
    for (const text of 'xyz') await send('Input.insertText', { text });
    assert.equal(await evaluate(`${input}.value`), 'Fixyzrst, Second');
    assert.equal(await evaluate(`${input}.selectionStart`), 5);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.deepEqual(await evaluate('window.writes[0].input.tags'), ['Fixyzrst', 'Second']);
    await evaluate(`${input}.focus(); ${input}.select()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.deepEqual(await evaluate('window.writes[1].input.tags'), []);
    assert.doesNotMatch(await evaluate('window.records.posts'), /^tags:/m);
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

// Mock only the gateway; render the real dashboard, content list, and editor.
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.requests = [];
window.confirmCalls = 0;
window.discard = false;
window.confirm = () => { window.confirmCalls++; return window.discard; };
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  window.requests.push({ path, method: options.method || 'GET' });
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'test-editor' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: 'example.mdx', path: 'src/content/docs/posts/example.mdx', sha: 'loaded', draft: true, sidebarHidden: false, visibilityKnown: true }] });
  if (path === '/api/content/posts/example.mdx') return Response.json({ filename: 'example.mdx', sha: 'loaded', content: '', title: 'Example', description: '', draft: true, body: 'Editable text.', date: '2026-10-24', excerpt: '', authors: [], tags: [], cover: null });
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('dashboard starts without an area, back buttons navigate safely, and navigation stays visible on mobile', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.',
  timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('document.querySelector("h1")?.textContent === "Editor dashboard"');
    assert.deepEqual(await evaluate('window.requests.map(item => item.path)'), ['/api/session']);
    assert.equal(await evaluate('document.querySelector(".area-selector")'), null);
    assert.equal(await evaluate('document.querySelectorAll(".dashboard-card").length'), 10);
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    assert.equal(await evaluate('document.querySelector(".area-selector select").value'), 'posts');
    assert.equal(await evaluate('document.querySelector(".editor-navigation .back").textContent'), '← Back to dashboard');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelector("h1")?.textContent === "Edit Blog Post"');
    assert.equal(await evaluate('document.querySelector(".editor-navigation .back").textContent'), '← Back to Blog Posts');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list")');
    assert.equal(await evaluate('window.confirmCalls'), 0, 'unchanged posts do not prompt');
    await evaluate('document.querySelector(".list-heading .primary").click()');
    await waitFor('document.querySelector("h1")?.textContent === "New Blog Post"');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    assert.equal(await evaluate('window.confirmCalls'), 1);
    assert.equal(await evaluate('document.querySelector("h1").textContent'), 'New Blog Post', 'canceling discard keeps the editor open');
    await evaluate('document.querySelector(".dashboard-link").click()');
    assert.equal(await evaluate('window.confirmCalls'), 2);
    assert.equal(await evaluate('document.querySelector("h1").textContent'), 'New Blog Post');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('new Promise(resolve => requestAnimationFrame(() => { window.scrollTo(0, 600); requestAnimationFrame(resolve); }))');
    const layout = await evaluate(`(() => {
      const nav = document.querySelector('.editor-navigation');
      const back = nav.querySelector('.back');
      return { top: nav.getBoundingClientRect().top, height: back.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > window.innerWidth };
    })()`);
    assert.ok(layout.top >= -1 && layout.top <= 1, `navigation sticks to the top while scrolling: ${JSON.stringify(layout)}`);
    assert.ok(layout.height >= 44, 'back button remains a large touch target');
    assert.equal(layout.overflow, false, 'mobile page has no horizontal overflow');
    await evaluate('window.discard = true; document.querySelector(".editor-actions .back").click()');
    await waitFor('!!document.querySelector(".project-list")');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('document.querySelector("h1")?.textContent === "Editor dashboard"');
    assert.equal(await evaluate('document.querySelector(".area-selector")'), null);
    assert.equal(await evaluate('window.requests.some(item => item.path.includes("/projects"))'), false);
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list")');
    await evaluate('document.querySelector(".list-heading .primary").click()');
    await waitFor('document.querySelector("h1")?.textContent === "New Blog Post"');
    await evaluate('document.querySelector(".dashboard-link").click()');
    await waitFor('document.querySelector("h1")?.textContent === "Editor dashboard"');
  });
});

const visibilityFixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
const page = (name, draft, sidebarHidden = false) => ({ filename: name + '.mdx', sha: 'loaded-' + name, content: '', title: name, description: 'Summary', draft, sidebarHidden, body: 'Editable text.', date: '2026-10-24', excerpt: '', authors: [], tags: [], cover: null });
window.records = { posts: { 'draft.mdx': page('draft', true), 'navigation-only.mdx': page('navigation-only', false, true), 'ready.mdx': page('ready', false) }, projects: { 'project.mdx': page('project', true) }, library: { 'report.mdx': page('report', true, true) } };
window.writes = [];
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'test-editor' });
  const [area, filename] = path.replace('/api/content/', '').split('/');
  if (!filename) return Response.json({ branch: 'custom-cms', entries: [...Object.entries(window.records[area]).map(([name, record]) => ({ name, path: 'src/content/docs/' + area + '/' + name, sha: record.sha, draft: record.draft, sidebarHidden: record.sidebarHidden, visibilityKnown: true })), ...(area === 'posts' ? [{ name: 'unknown.mdx', path: 'src/content/docs/posts/unknown.mdx', sha: 'unknown', visibilityKnown: false }] : [])] });
  if (options.method === 'PUT') {
    const input = JSON.parse(options.body);
    window.writes.push({ area, input });
    const record = window.records[area][filename];
    Object.assign(record, { title: input.title, draft: area === 'projects' ? !input.publish : record.draft && area !== 'posts' ? record.draft : input.draft, sha: 'saved-' + window.writes.length });
    return Response.json({ ...record, branch: 'custom-cms', commitSha: 'commit-1234567' });
  }
  return Response.json(window.records[area][filename]);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('visibility badges distinguish drafts from navigation-only hiding and both Save buttons honor the draft toggle', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.',
  timeout: 30_000,
}, async () => {
  await withEditorBrowser(visibilityFixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    const badges = await evaluate('[...document.querySelectorAll(".project-list li")].map(row => ({ name: row.querySelector(".content-name").textContent, draft: row.classList.contains("draft-entry"), badges: [...row.querySelectorAll(".visibility-badge")].map(badge => badge.textContent) }))');
    assert.deepEqual(badges.find((row) => row.name === 'draft'), { name: 'draft', draft: true, badges: ['Draft'] });
    assert.deepEqual(badges.find((row) => row.name === 'navigation-only').badges, []);
    assert.deepEqual(badges.find((row) => row.name === 'ready').badges, []);
    assert.deepEqual(badges.find((row) => row.name === 'unknown').badges, []);
    await evaluate('[...document.querySelectorAll(".project-list button")].find(button => button.querySelector(".content-name").textContent === "draft").click()');
    await waitFor('!!document.querySelector(".visibility-panel.is-draft")');
    assert.equal(await evaluate('document.querySelector(".visibility-switch").getAttribute("aria-checked")'), 'false');
    assert.deepEqual(await evaluate('[...document.querySelector(".visibility-switch").children].map(label => label.textContent)'), ['Draft', 'Published']);
    await evaluate('document.querySelector(".visibility-switch").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await waitFor('document.querySelector(".visibility-switch").getAttribute("aria-checked") === "true"');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
    await waitFor('document.querySelector(".visibility-switch").getAttribute("aria-checked") === "false"');
    assert.equal(await evaluate('document.querySelectorAll(".top-save, .editor-actions .primary").length'), 2);
    await evaluate('document.querySelector("form input[required]").focus(); document.querySelector("form input[required]").select()');
    await send('Input.insertText', { text: 'Edited draft' });
    await waitFor('document.querySelector(".save-state").textContent === "Unsaved changes"');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes[0].input.draft'), true);
    assert.equal(await evaluate('window.records.posts["draft.mdx"].title'), 'Edited draft');
    assert.equal(await evaluate('document.querySelector(".visibility-panel .visibility-switch").getAttribute("aria-checked")'), 'false');
    assert.equal(await evaluate('document.querySelectorAll(".visibility-control").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll(".visibility-panel p").length'), 0);
    await evaluate('document.querySelector(".visibility-switch").click()');
    await waitFor('!!document.querySelector(".visibility-panel.is-ready")');
    assert.equal(await evaluate('document.querySelector(".visibility-switch").getAttribute("aria-checked")'), 'true');
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    await evaluate('document.querySelector(".editor-actions .primary").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes[1].input.draft'), false);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list")');
    assert.equal(await evaluate('[...document.querySelectorAll(".project-list li")].find(row => row.querySelector(".content-name").textContent === "draft").classList.contains("draft-entry")'), false);
    await evaluate('[...document.querySelectorAll(".project-list button")].find(button => button.querySelector(".content-name").textContent === "navigation-only").click()');
    await waitFor('!!document.querySelector(".visibility-panel .status-navigation")');
    assert.equal(await evaluate('document.querySelector(".visibility-switch").getAttribute("aria-checked")'), 'true');
    await evaluate('document.querySelector(".dashboard-link").click()');
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Projects")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".visibility-panel.is-draft")');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes.at(-1).input.publish'), false, 'saving a draft project keeps it hidden');
    await evaluate('document.querySelector(".visibility-switch").click()');
    await waitFor('document.querySelector(".visibility-switch").getAttribute("aria-checked") === "true"');
    await evaluate('document.querySelector(".editor-actions .primary").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes.at(-1).input.publish'), true);
    assert.equal(await evaluate('window.records.projects["project.mdx"].draft'), false);
    await evaluate('document.querySelector(".dashboard-link").click()');
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Library")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".visibility-panel.is-draft")');
    assert.equal(await evaluate('document.querySelector(".visibility-control").getAttribute("aria-checked")'), 'false', 'every enabled area can edit its draft state');
    assert.ok(await evaluate('document.querySelector(".visibility-panel").textContent.includes("Draft")'));
  });
});

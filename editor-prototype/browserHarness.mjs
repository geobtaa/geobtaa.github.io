import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
export let chrome;
for (const candidate of candidates) {
  try { await access(candidate); chrome = candidate; break; } catch { /* Try the next installed browser. */ }
}

// Run browser tests against an isolated fixture without accessing GitHub.
export async function withEditorBrowser(fixtureCode, run) {
  assert.ok(chrome, 'Chrome/Chromium is required.');
  const fixtureName = `.editor-browser-fixture-${process.pid}.tsx`;
  const fixture = join(root, 'editor-prototype', fixtureName);
  const profile = await mkdtemp(join(tmpdir(), 'editor-browser-'));
  let server, browser, socket;
  try {
    await writeFile(fixture, fixtureCode, { flag: 'wx' });
    server = await createServer({
      root, configFile: false, logLevel: 'error', cacheDir: join(profile, 'vite'), esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 0 },
      plugins: [{
        name: 'editor-test-page',
        configureServer(vite) {
          vite.middlewares.use('/__editor-test', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(await vite.transformIndexHtml('/__editor-test', `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/editor-prototype/${fixtureName}"></script></body></html>`));
          });
        },
      }],
    });
    await server.listen();
    browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const debugUrl = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Chrome launch timed out.')), 10_000);
      browser.stderr.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      browser.once('error', (error) => { clearTimeout(timer); reject(error); });
      browser.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code}): ${output.slice(-1000)}`)); });
    });
    const pages = await (await fetch(`http://${new URL(debugUrl).host}/json/list`)).json();
    socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
    await once(socket, 'open');
    let sequence = 0;
    const pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 5_000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await evaluate(expression)) return;
        await delay(50);
      }
      assert.fail(`Browser condition did not become true: ${expression}`);
    };
    const arrow = async (key, code) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    };
    await send('Page.navigate', { url: `http://127.0.0.1:${server.httpServer.address().port}/__editor-test` });
    await run({ evaluate, waitFor, send, arrow });
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null) { const exited = once(browser, 'exit'); browser.kill(); await exited; }
    await server?.close();
    await rm(fixture, { force: true });
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

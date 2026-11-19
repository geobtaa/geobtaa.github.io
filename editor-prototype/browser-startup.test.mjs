import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForChrome } from './browserStartup.mjs';

async function fixture(run) {
  const profile = await mkdtemp(join(tmpdir(), 'chrome-startup-test-'));
  const browser = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), pid: 123, exitCode: null, signalCode: null });
  try { await run(browser, profile); }
  finally {
    assert.equal(browser.listenerCount('error'), 0);
    assert.equal(browser.listenerCount('exit'), 0);
    assert.equal(browser.stderr.listenerCount('data'), 0);
    await rm(profile, { recursive: true, force: true });
  }
}
test('Chrome readiness accepts a split stderr signal and removes startup listeners', () => fixture(async (browser, profile) => {
  const ready = waitForChrome(browser, profile);
  browser.stderr.emit('data', 'DevTools listen');
  browser.stderr.emit('data', 'ing on ws://127.0.0.1:12345/devtools/browser/fixture\n');
  assert.equal(await ready, 'ws://127.0.0.1:12345/devtools/browser/fixture');
}));
test('Chrome readiness tolerates an incomplete profile file and missing stderr', () => fixture(async (browser, profile) => {
  await writeFile(join(profile, 'DevToolsActivePort'), '12345\n');
  const ready = waitForChrome(browser, profile, { timeout: 1000, pollInterval: 5 });
  setTimeout(() => { void writeFile(join(profile, 'DevToolsActivePort'), '12345\n/devtools/browser/fixture\n'); }, 30);
  assert.equal(await ready, 'ws://127.0.0.1:12345/devtools/browser/fixture');
}));
test('a stalled Chrome still fails with bounded stderr and process diagnostics', () => fixture(async (browser, profile) => {
  const ready = waitForChrome(browser, profile, { timeout: 20, pollInterval: 5 });
  browser.stderr.emit('data', 'Browser initialization stalled');
  await assert.rejects(ready, /Chrome launch timed out after 20 ms; pid=123.*initialization stalled/);
}));
test('Chrome exits and spawn errors fail immediately rather than being retried', () => fixture(async (browser, profile) => {
  let ready = waitForChrome(browser, profile);
  browser.stderr.emit('data', 'Missing browser dependency');
  browser.emit('exit', 1, null);
  await assert.rejects(ready, /exited before readiness.*Missing browser dependency/);
  ready = waitForChrome(browser, profile);
  browser.emit('error', new Error('Executable unavailable'));
  await assert.rejects(ready, /could not start.*Executable unavailable/);
}));

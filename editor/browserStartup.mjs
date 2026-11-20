import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Cold Chrome startup on a shared runner is separate from editor readiness.
// The profile file is Chrome's authoritative readiness signal if stderr is late.
export function waitForChrome(browser, profile, { timeout = 20_000, pollInterval = 100 } = {}) {
  return new Promise((resolve, reject) => {
    let output = '', settled = false, pollTimer;
    const finish = (error, url) => {
      if (settled) return;
      settled = true; clearTimeout(deadline); clearTimeout(pollTimer);
      browser.stderr.off('data', onData); browser.off('error', onError); browser.off('exit', onExit);
      if (error) reject(error); else resolve(url);
    };
    const diagnostics = reason => new Error(`${reason}; pid=${browser.pid ?? 'unknown'}, exitCode=${browser.exitCode}, signal=${browser.signalCode ?? 'none'}; Chrome stderr: ${output.trim() || '(empty)'}`);
    const ready = value => {
      try {
        const url = new URL(value);
        if (url.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && Number(url.port) > 0 && /^\/devtools\/browser\/[^\s/]+$/.test(url.pathname)) finish(null, url.href);
      } catch { /* Partial readiness data is not a running browser. */ }
    };
    const onData = chunk => {
      output = (output + chunk).slice(-4000);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) ready(match[1]);
    };
    const onError = error => finish(diagnostics(`Chrome could not start: ${error.message}`));
    const onExit = (code, signal) => finish(diagnostics(`Chrome exited before readiness (${code}, ${signal || 'no signal'})`));
    const poll = async () => {
      try {
        const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        if (/^\d+$/.test(port)) ready(`ws://127.0.0.1:${port}${path || ''}`);
      } catch (error) {
        if (error.code !== 'ENOENT') finish(diagnostics(`Cannot read Chrome readiness: ${error.message}`));
      }
      if (!settled) pollTimer = setTimeout(poll, pollInterval);
    };
    const deadline = setTimeout(() => finish(diagnostics(`Chrome launch timed out after ${timeout} ms`)), timeout);
    browser.stderr.on('data', onData); browser.once('error', onError); browser.once('exit', onExit);
    if (browser.exitCode != null || browser.signalCode != null) onExit(browser.exitCode, browser.signalCode);
    else void poll();
  });
}

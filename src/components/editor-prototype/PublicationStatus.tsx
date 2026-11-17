import { useEffect, useState } from 'react';
export type PublicationState = { state: string; message?: string; selectedHead?: string; deployedHead?: string; number?: number; url?: string; liveUrl?: string; newerDraft?: boolean; deploymentId?: number; runId?: number };
const states = new Set(['none', 'checking', 'publishing', 'published', 'validation-failed', 'conflict', 'deployment-failed', 'action-required', 'superseded']);
const urlOn = (value: string | undefined, origin: string) => { try { const url = new URL(value || ''); return url.origin === origin ? url.href : undefined; } catch { return undefined; } };
export function PublicationStatus({ path, head, dirty, refreshVersion, disabled, load, onRetry }: {
  path: string; head?: string; dirty: boolean; refreshVersion: number; disabled: boolean;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string) => void;
}) {
  const [status, setStatus] = useState<PublicationState>({ state: 'checking', message: 'Checking publication…' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, timeout: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const schedule = (delay: number) => { timeout = setTimeout(() => { if (document.visibilityState === 'hidden') schedule(30000); else void check(); }, delay); };
    const check = async () => {
      let delay = 15000;
      try {
        const result = await load(path, controller.signal);
        if (!states.has(result.state) || (result.state === 'published' && (!/^[a-f0-9]{40}$/.test(result.selectedHead || '') || !/^[a-f0-9]{40}$/.test(result.deployedHead || '') || !Number.isSafeInteger(result.deploymentId) || !Number.isSafeInteger(result.runId) || !urlOn(result.liveUrl, 'https://gin.btaa.org')))) throw new Error('The publication response could not be verified.');
        if (active) setStatus(result);
        if (['none', 'published', 'superseded'].includes(result.state)) delay = 60000;
      } catch (error) {
        if (active) setStatus({ state: 'checking', message: `Publication status unavailable. ${(error as Error).message} Your edits remain here.` });
        delay = 30000;
      } finally {
        if (active) schedule(delay);
      }
    };
    void check();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [path, head, refreshVersion, retry, load]);
  const live = status.state === 'published' ? urlOn(status.liveUrl, 'https://gin.btaa.org') : undefined;
  const pr = urlOn(status.url, 'https://github.com');
  const canRetry = (['action-required', 'conflict', 'validation-failed'].includes(status.state) || status.state === 'publishing' && !Number.isInteger(status.number)) && /^[a-f0-9]{40}$/.test(status.selectedHead || '');
  return <section className="publication-status" aria-label="Publication status" data-state={status.state}>
    <p role="status">{status.message || (status.state === 'none' ? 'No publication has been requested for this draft.' : 'Checking publication…')}</p>
    {(dirty || status.newerDraft || status.selectedHead && status.selectedHead !== head) && status.state !== 'none' && <p>Newer edits in this editor are not included in this publication.</p>}
    {pr && <a href={pr} target="_blank" rel="noopener noreferrer">Open publication PR #{status.number}</a>}
    {live && <a href={live} target="_blank" rel="noopener noreferrer">View live</a>}
    {Number.isSafeInteger(status.runId) && status.runId! > 0 && <a href={`https://github.com/geobtaa/geobtaa.github.io/actions/runs/${status.runId}`} target="_blank" rel="noopener noreferrer">Open Pages workflow run</a>}
    <button type="button" onClick={() => setRetry(value => value + 1)}>Refresh publication status</button>
    {canRetry && <button type="button" disabled={disabled || dirty} onClick={() => onRetry(status.selectedHead!)}>Retry this publication</button>}
    {status.state === 'deployment-failed' && <p>A maintainer can inspect or rerun the Pages workflow. Refresh status afterward; a new publication PR is not needed.</p>}
  </section>;
}

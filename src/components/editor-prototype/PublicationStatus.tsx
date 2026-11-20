import { useEffect, useState } from 'react';
export type PublicationState = { state: string; message?: string; selectedHead?: string; number?: number; url?: string; newerDraft?: boolean };
const states = new Set(['none', 'checking', 'reserved', 'pr-open', 'closed', 'merged', 'conflict']);
function prLink(status: PublicationState) {
  return Number.isInteger(status.number) && status.url === `https://github.com/geobtaa/geobtaa.github.io/pull/${status.number}` ? status.url : undefined;
}
export function PublicationStatus({ path, head, dirty, refreshVersion, disabled, load, onRetry, submitted }: {
  path: string; head?: string; dirty: boolean; refreshVersion: number; disabled: boolean; submitted?: PublicationState;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string) => void;
}) {
  const [status, setStatus] = useState<PublicationState | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (submitted) setStatus(submitted);
    void load(path, controller.signal).then(result => {
      if (!states.has(result.state) || ['pr-open', 'closed', 'merged', 'conflict'].includes(result.state) && !prLink(result)) throw new Error('The PR response could not be verified.');
      if (active) setStatus(result);
    }).catch(error => {
      if (active) setStatus(previous => ({ ...previous, state: 'checking', message: `PR status unavailable. ${error.message} Your saved draft is intact.` }));
    });
    return () => { active = false; controller.abort(); };
  }, [path, head, refreshVersion, retry, load, submitted]);
  if (!status || status.state === 'none') return null;
  const pr = prLink(status);
  const canRetry = ['reserved', 'closed', 'conflict'].includes(status.state) && /^[a-f0-9]{40}$/.test(status.selectedHead || '');
  return <section className="publication-status" aria-label="Publication PR" data-state={status.state}>
    {status.state === 'pr-open' ? <div role="status"><strong>Submitted for publishing</strong><p>Your changes have been submitted. Open the publication request in GitHub to review the changes. Once the automated checks pass, merge the request to publish the page.</p></div> : <p role="status">{status.message || 'Checking publication PR…'}</p>}
    {(dirty || status.newerDraft || status.selectedHead && status.selectedHead !== head) && status.state !== 'none' && <p>Newer edits in this editor are not included in this PR.</p>}
    {pr && <a href={pr} target="_blank" rel="noopener noreferrer">Review publication request #{status.number}</a>}
    {status.state === 'merged' && <a href="https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml" target="_blank" rel="noopener noreferrer">View GitHub Pages deployment</a>}
    <button type="button" onClick={() => setRetry(value => value + 1)}>Check status</button>
    {canRetry && <button type="button" disabled={disabled || dirty} onClick={() => onRetry(status.selectedHead!)}>Recreate PR for this saved revision</button>}
  </section>;
}

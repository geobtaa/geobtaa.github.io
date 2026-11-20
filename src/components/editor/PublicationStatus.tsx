import { useEffect, useState } from 'react';
import { UnpublishDialog } from './UnpublishDialog';
export type PublicationState = { state: string; checks?: string; message?: string; selectedHead?: string; number?: number; url?: string; newerDraft?: boolean; action?: 'publish' | 'unpublish'; mainDraft?: boolean | null; unpublishEnabled?: boolean; website?: { publication: string; requestApplied?: boolean; message?: string }; deployment?: { state: string; url?: string } };
const states = new Set(['none', 'checking', 'reserved', 'pr-open', 'closed', 'merged', 'conflict']);
function prLink(status: PublicationState) {
  return Number.isInteger(status.number) && status.url === `https://github.com/geobtaa/geobtaa.github.io/pull/${status.number}` ? status.url : undefined;
}
export function PublicationStatus({ path, head, dirty, hasDraft = true, newPage = false, refreshVersion, disabled, load, onRetry, onUnpublish, onUnpublishPending, submitted }: {
  path: string; head?: string; dirty: boolean; hasDraft?: boolean; newPage?: boolean; refreshVersion: number; disabled: boolean;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string, action?: 'publish' | 'unpublish') => void;
  onUnpublish?: () => void; onUnpublishPending?: (pending: boolean) => void; submitted?: PublicationState;
}) {
  const [status, setStatus] = useState<PublicationState | null>(null);
  const [retry, setRetry] = useState(0), [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (submitted) setStatus(previous => ({ ...previous, ...submitted }));
    void load(path, controller.signal).then(result => {
      if (!states.has(result.state) || ['pr-open', 'closed', 'merged', 'conflict'].includes(result.state) && !prLink(result)) throw new Error('The publication response could not be verified.');
      if (active) setStatus(previous => result.state === 'checking' ? { ...previous, ...result } : result);
    }).catch(error => {
      if (active) setStatus(previous => ({ ...previous, state: 'checking', website: { publication: 'unavailable' }, message: `Status unavailable. ${error.message} Your saved work is safe.` }));
    });
    return () => { active = false; controller.abort(); };
  }, [path, head, refreshVersion, retry, load, submitted]);
  const current = status || { state: 'checking' }, pr = prLink(current);
  useEffect(() => { onUnpublishPending?.(current.action === 'unpublish' && ['pr-open', 'reserved', 'conflict', 'checking'].includes(current.state)); }, [current.action, current.state, onUnpublishPending]);
  const publication = current.website?.publication;
  const title = publication === 'published' ? 'Published' : publication === 'unpublished' ? 'Unpublished' : newPage ? 'Not yet published' : status ? 'Publication status unavailable' : 'Checking publication status…';
  const unpublishing = current.action === 'unpublish';
  const canRetry = ['reserved', 'closed', 'conflict'].includes(current.state) && /^[a-f0-9]{40}$/.test(current.selectedHead || '');
  const active = ['pr-open', 'reserved', 'conflict', 'checking'].includes(current.state);
  let detail = '';
  if (current.state === 'pr-open' && current.checks === 'failed') detail = 'The request failed validation. Open the publication request to review the checks.';
  else if (current.state === 'pr-open') detail = unpublishing ? 'Unpublish request awaiting review and merge.' : 'Submitted for publishing. Review and merge the request after its checks pass.';
  else if (current.state === 'conflict') detail = 'Request needs refreshing. Review the current page before refreshing if its content changed.';
  else if (current.state === 'closed') detail = 'The request was closed without merging.';
  else if (current.state === 'merged' && current.website?.requestApplied !== true) detail = current.deployment?.state === 'failed' ? 'Website update failed. Your request was merged, but deployment is not confirmed.' : 'Request merged. Website update is not yet confirmed.';
  else if (['reserved', 'checking'].includes(current.state)) detail = current.message || 'The request status could not be confirmed. Your saved work is safe.';
  return <section className="publication-status" aria-label="Publication PR" data-state={current.state}>
    <strong className="publication-heading" role="status">{title}</strong>
    {dirty ? <p>You have unsaved changes.</p> : hasDraft && <p>A working draft is saved.</p>}
    {detail && <p role="status">{detail}</p>}
    {(dirty || current.newerDraft || hasDraft && current.selectedHead && current.selectedHead !== head) && pr && <p>Newer edits in this editor are not included in this PR.</p>}
    {current.website?.message && <p>{current.website.message}</p>}
    {pr && <a href={pr} target="_blank" rel="noopener noreferrer">Review publication request #{current.number}</a>}
    {current.state === 'merged' && <a href="https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml" target="_blank" rel="noopener noreferrer">View GitHub Pages deployment</a>}
    <button type="button" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Check status</button>
    {canRetry && <button type="button" disabled={disabled || dirty} onClick={() => onRetry(current.selectedHead!, current.action)}>Refresh request</button>}
    {current.mainDraft === false && onUnpublish && <div className="unpublish-action">
      <button type="button" disabled={disabled || dirty || !hasDraft || active || !current.unpublishEnabled} onClick={() => setConfirm(true)}>Unpublish page</button>
      {!current.unpublishEnabled ? <small>Unpublishing is not enabled yet.</small> : (!hasDraft || dirty) && <small>Save your draft before submitting an unpublish request.</small>}
    </div>}
    {confirm && <UnpublishDialog onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onUnpublish?.(); }} />}
  </section>;
}

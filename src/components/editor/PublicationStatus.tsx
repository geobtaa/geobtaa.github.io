import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UnpublishDialog } from './UnpublishDialog';
export type PublicationState = { state: string; checks?: string; message?: string; selectedHead?: string; number?: number; url?: string; newerDraft?: boolean; action?: 'publish' | 'unpublish'; mainDraft?: boolean | null; unpublishEnabled?: boolean; website?: { publication: string; requestApplied?: boolean; message?: string }; deployment?: { state: string; url?: string } };
const states = new Set(['none', 'checking', 'reserved', 'pr-open', 'closed', 'merged', 'conflict']);
function prLink(status: PublicationState) {
  return Number.isInteger(status.number) && status.url === `https://github.com/geobtaa/geobtaa.github.io/pull/${status.number}` ? status.url : undefined;
}
export function PublicationStatus({ path, head, dirty, hasDraft = true, newPage = false, refreshVersion, disabled, load, onRetry, onUnpublish, onUnpublishPending, submitted, actionTarget, saveStatus }: {
  actionTarget?: HTMLElement | null; saveStatus?: ReactNode;
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
  const verifiedWebsite = ['published', 'unpublished'].includes(publication || '');
  const mergedPending = current.state === 'merged' && (!verifiedWebsite || current.website?.requestApplied !== true);
  const historical = current.state === 'closed' || current.state === 'merged' && !mergedPending;
  const needsCheck = !verifiedWebsite || active || mergedPending;
  let detail = '';
  if (current.state === 'pr-open' && current.checks === 'failed') detail = 'The request failed validation. Open the publication request to review the checks.';
  else if (current.state === 'pr-open') detail = unpublishing ? 'Unpublish request awaiting review and merge.' : 'Submitted for publishing. Review and merge the request after its checks pass.';
  else if (current.state === 'conflict') detail = 'Request needs refreshing. Review the current page before refreshing if its content changed.';
  else if (mergedPending) detail = current.deployment?.state === 'failed' ? 'Website update failed. Your request was merged, but deployment is not confirmed.' : 'Request merged. Website update is not yet confirmed.';
  else if (status && ['reserved', 'checking'].includes(current.state)) detail = current.message || 'The request status could not be confirmed. Your saved work is safe.';
  const websiteDetail = !verifiedWebsite && status ? 'The website status could not be verified.' : mergedPending ? current.website?.message : undefined;
  const newerEdits = (dirty || current.newerDraft || hasDraft && current.selectedHead && current.selectedHead !== head) && pr;
  const requestLink = pr && <a href={pr} target="_blank" rel="noopener noreferrer">Review publication request #{current.number}</a>;
  const updateRequest = canRetry && <button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={() => onRetry(current.selectedHead!, current.action)}>Update publication request</button>;
  const unpublishReason = current.mainDraft !== false ? 'This page is not currently available to unpublish.' : !current.unpublishEnabled ? 'Unpublishing is not enabled yet.' : dirty ? 'Save your changes before unpublishing.' : active ? 'Review the pending request first.' : undefined;
  return <section className="publication-status" aria-label="Publication PR" data-state={current.state}>
    <div className="document-status-row"><strong className={`publication-heading visibility-badge ${publication === 'published' ? 'status-ready' : publication === 'unpublished' ? 'status-draft' : 'status-unknown'}`} role="status">{title}</strong>{saveStatus}</div>
    {(detail || websiteDetail || needsCheck) && <div className="publication-notice" aria-label="Publication notice">
      {detail && <p role="status">{detail}</p>}
      {websiteDetail && <p role="status">{websiteDetail}</p>}
      {!historical && newerEdits && <p>Newer edits in this editor are not included in this PR.</p>}
      <div className="publication-notice-actions">
        {!historical && requestLink}
        {mergedPending && <a href="https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml" target="_blank" rel="noopener noreferrer">View GitHub Pages deployment</a>}
        {needsCheck && <button className="publication-text-action" type="button" disabled={disabled} onClick={() => setRetry(value => value + 1)}>Check again</button>}
        {!historical && updateRequest}
      </div>
    </div>}
    {historical && pr && <details className="publication-history">
      <summary>Previous publication request</summary>
      <p>{current.state === 'closed' ? 'The request was closed without merging.' : 'The request was merged and its website update was verified.'}</p>
      {newerEdits && <p>Newer edits in this editor are not included in this PR.</p>}
      <div className="publication-notice-actions">{requestLink}{updateRequest}</div>
    </details>}
    {actionTarget && onUnpublish && createPortal(<button className="unpublish-document" type="button" title={unpublishReason} disabled={disabled || dirty || active || !current.unpublishEnabled || current.mainDraft !== false} onClick={() => setConfirm(true)}>Unpublish page</button>, actionTarget)}
    {confirm && <UnpublishDialog onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onUnpublish?.(); }} />}
  </section>;
}

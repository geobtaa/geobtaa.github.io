import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UnpublishDialog } from './UnpublishDialog';
import { publicationApplied, publicationLink as prLink, usePublicationProgress, type PublicationState } from './publicationProgress';
export type { PublicationState } from './publicationProgress';
export function PublicationStatus({ path, head, dirty, hasDraft = true, newPage = false, refreshVersion, disabled, load, onRetry, onUnpublish, onUnpublishPending, submitted, actionTarget, saveStatus, onAutoMerge, onAutoMergeAvailable, onManualPublish }: {
  actionTarget?: HTMLElement | null; saveStatus?: ReactNode;
  path: string; head?: string; dirty: boolean; hasDraft?: boolean; newPage?: boolean; refreshVersion: number; disabled: boolean;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string, action?: 'publish' | 'unpublish') => void;
  onAutoMerge?: (status: PublicationState, enabled: boolean) => void; onAutoMergeAvailable?: (available: boolean) => void; onManualPublish?: () => void;
  onUnpublish?: (automatically?: boolean) => void; onUnpublishPending?: (pending: boolean) => void; submitted?: PublicationState;
}) {
  const [confirm, setConfirm] = useState(false);
  const { status, checkAgain } = usePublicationProgress(path, load, { head, refreshVersion, submitted });
  const current = status || { state: 'checking' }, pr = prLink(current);
  useEffect(() => { onUnpublishPending?.(current.action === 'unpublish' && ['pr-open', 'reserved', 'conflict', 'checking'].includes(current.state)); }, [current.action, current.state, onUnpublishPending]);
  useEffect(() => { onAutoMergeAvailable?.(current.autoMergeEnabled === true); }, [current.autoMergeEnabled, onAutoMergeAvailable]);
  const publication = current.website?.publication;
  const title = publication === 'published' ? 'Published' : publication === 'unpublished' ? 'Unpublished' : newPage ? 'Not yet published' : status ? 'Publication status unavailable' : 'Checking publication status…';
  const unpublishing = current.action === 'unpublish';
  const canRetry = ['reserved', 'closed', 'conflict'].includes(current.state) && /^[a-f0-9]{40}$/.test(current.selectedHead || '');
  const active = ['pr-open', 'reserved', 'conflict', 'checking'].includes(current.state);
  const verifiedWebsite = ['published', 'unpublished'].includes(publication || '');
  const mergedPending = current.state === 'merged' && !publicationApplied(current);
  const [observedRequest, setObservedRequest] = useState<number>();
  useEffect(() => { if (pr && (active || mergedPending)) setObservedRequest(current.number); }, [pr, active, mergedPending, current.number]);
  const justDeployed = current.state === 'merged' && !mergedPending && pr && (observedRequest === current.number || submitted?.number === current.number);
  const historical = current.state === 'closed' || current.state === 'merged' && !mergedPending;
  const needsCheck = !verifiedWebsite || active || mergedPending;
  let detail = '';
  if (current.state === 'pr-open' && current.checks === 'failed') detail = 'The request failed validation. Your draft is safe. Review the failed checks or ask a maintainer for help; publication is blocked until they pass.';
  else if (current.state === 'pr-open' && current.reviewDecision === 'CHANGES_REQUESTED') detail = 'A reviewer requested changes. Your saved work is safe. Ask a maintainer to resolve the review before publication can continue.';
  else if (current.state === 'pr-open' && current.autoMerge === true) detail = current.reviewDecision === 'REVIEW_REQUIRED' ? 'Waiting for the required review. GitHub will merge this request when its requirements pass.' : `Automatic ${unpublishing ? 'unpublishing' : 'publication'} authorized. Waiting for required checks and reviews; the website update follows the merge.`;
  else if (current.state === 'pr-open') detail = unpublishing ? 'Unpublish request awaiting review and merge.' : 'Submitted for publishing. Review and merge the request after its checks pass.';
  else if (current.state === 'conflict') detail = `The website changed while this request was waiting. Use Update publication request, then authorize the replacement with ${unpublishing ? 'Unpublish' : 'Publish'} when ready. If this page changed, ask a maintainer to reconcile your saved work.`;
  else if (mergedPending) detail = current.deployment?.state === 'failed' ? 'Website update failed. Your request was merged, but deployment is not confirmed.' : 'Request merged. Website update is not yet confirmed.';
  else if (status && ['reserved', 'checking'].includes(current.state)) detail = current.message || 'The request status could not be confirmed. Your saved work is safe.';
  const websiteDetail = !verifiedWebsite && status ? 'The website status could not be verified.' : mergedPending ? current.website?.message : undefined;
  const newerEdits = (dirty || current.newerDraft || hasDraft && current.selectedHead && current.selectedHead !== head) && pr;
  const requestLink = pr && <a href={pr} target="_blank" rel="noopener noreferrer">Review publication request #{current.number}</a>;
  const updateRequest = canRetry && <button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={() => onRetry(current.selectedHead!, current.action)}>Update publication request</button>;
  const unpublishReason = current.mainDraft !== false ? 'This page is not currently available to unpublish.' : !current.unpublishEnabled ? 'Unpublishing is not enabled yet.' : dirty ? 'Save your changes before unpublishing.' : active ? 'Review the pending request first.' : undefined;
  return <section className="publication-status" aria-label="Publication PR" data-state={current.state}>
    <div className="document-status-row"><strong className={`publication-heading visibility-badge ${publication === 'published' ? 'status-ready' : publication === 'unpublished' ? 'status-draft' : 'status-unknown'}`} role="status">{title}</strong>{saveStatus}{justDeployed && <span className="publication-complete" role="status">{newerEdits ? 'Submitted update deployed' : 'Update deployed'}</span>}</div>
    {(detail || websiteDetail || needsCheck) && <div className="publication-notice" aria-label="Publication notice">
      {detail && <p role="status">{detail}</p>}
      {websiteDetail && <p role="status">{websiteDetail}</p>}
      {!historical && newerEdits && <p>Newer edits in this editor are not included in this PR.</p>}
      <div className="publication-notice-actions">
        {!historical && requestLink}
        {mergedPending && <a href="https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml" target="_blank" rel="noopener noreferrer">View GitHub Pages deployment</a>}
        {needsCheck && <button className="publication-text-action" type="button" disabled={disabled} onClick={checkAgain}>Check again</button>}
        {!historical && updateRequest}
        {current.autoMerge === true && ['pr-open', 'conflict', 'checking'].includes(current.state) && onAutoMerge && <button className="publication-text-action" type="button" disabled={disabled} onClick={() => onAutoMerge(current, false)}>{unpublishing ? 'Cancel automatic unpublishing' : 'Cancel automatic publication'}</button>}
        {current.state === 'pr-open' && current.autoMerge === false && current.autoMergeEnabled && onAutoMerge && <button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={() => onAutoMerge(current, true)}>{unpublishing ? 'Unpublish when ready' : 'Publish when ready'}</button>}
      </div>
    </div>}
    {historical && pr && <details className="publication-history">
      <summary>Previous publication request</summary>
      <p>{current.state === 'closed' ? 'The request was closed without merging.' : 'The request was merged and its website update was verified.'}</p>
      {newerEdits && <p>Newer edits in this editor are not included in this PR.</p>}
      <div className="publication-notice-actions">{requestLink}{updateRequest}</div>
    </details>}
    {current.autoMergeEnabled && hasDraft && !active && onManualPublish && <details className="publication-history"><summary>Manual publishing</summary><button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={onManualPublish}>Submit for manual merge</button></details>}
    {actionTarget && onUnpublish && createPortal(<button className="unpublish-document" type="button" title={unpublishReason} disabled={disabled || dirty || active || !current.unpublishEnabled || current.mainDraft !== false} onClick={() => setConfirm(true)}>Unpublish page</button>, actionTarget)}
    {confirm && <UnpublishDialog autoMergeEnabled={current.autoMergeEnabled === true} onCancel={() => setConfirm(false)} onConfirm={automatically => { setConfirm(false); onUnpublish?.(automatically); }} />}
  </section>;
}

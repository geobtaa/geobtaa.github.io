import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { publicationApplied, publicationLink as prLink, usePublicationProgress, type PublicationState } from './publicationProgress';
export type { PublicationState } from './publicationProgress';
export function PublicationStatus({ path, head, dirty, hasDraft = true, newPage = false, refreshVersion, disabled, load, onRetry, onUnpublish, onUnpublishPending, submitted, actionTarget, saveStatus, onAutoMerge, onAutoMergeAvailable, onStatus, technicalError, technicalDetails }: {
  actionTarget?: HTMLElement | null; saveStatus?: ReactNode;
  path: string; head?: string; dirty: boolean; hasDraft?: boolean; newPage?: boolean; refreshVersion: number; disabled: boolean;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string, action?: 'publish' | 'unpublish') => void;
  onAutoMerge?: (status: PublicationState, enabled: boolean) => void; onAutoMergeAvailable?: (available: boolean) => void; onStatus?: (status: PublicationState) => void; technicalError?: string; technicalDetails?: ReactNode;
  onUnpublish?: (automatically?: boolean) => void; onUnpublishPending?: (pending: boolean) => void; submitted?: PublicationState;
}) {
  const { status, checkAgain } = usePublicationProgress(path, load, { head, refreshVersion, submitted });
  useEffect(() => { if (status) onStatus?.(status); }, [status, onStatus]);
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
  if (current.state === 'pr-open' && current.checks === 'failed') detail = 'Checks failed. Your saved work is safe. Ask a maintainer to resolve the problem before this action can finish.';
  else if (current.state === 'pr-open' && current.reviewDecision === 'CHANGES_REQUESTED') detail = 'Changes are needed before this action can finish. Your saved work is safe; ask a maintainer for help.';
  else if (current.state === 'pr-open' && current.autoMerge === true) detail = unpublishing ? 'Unpublishing is in progress. This page will be removed automatically after validation and the website update finish.' : 'Publishing is in progress. Your saved version will go online automatically after validation and the website update finish.';
  else if (current.state === 'pr-open' && current.autoMerge === false && !current.autoMergeEnabled) detail = 'Automatic publishing is unavailable. Your saved work is safe. Ask a maintainer for help.';
  else if (current.state === 'pr-open') detail = current.autoMerge === false ? `Automatic ${unpublishing ? 'unpublishing' : 'publishing'} is not authorized. Choose ${unpublishing ? 'Unpublish' : 'Publish'} to review and confirm the saved version.` : 'Checking whether this action is authorized. Your saved work is safe.';
  else if (current.state === 'conflict') detail = 'The website changed while this action was waiting. Update it below, then review and confirm the saved version. If this page changed, ask a maintainer to help keep your saved work.';
  else if (mergedPending) detail = current.deployment?.state === 'failed' ? 'The website update failed. Your saved work is safe. Ask a maintainer for help, then check again.' : 'The changes have been accepted for deployment. Completion is not yet confirmed.';
  else if (current.state === 'reserved') detail = 'This action was not fully submitted. Review and confirm the saved version to try again.';
  else if (status && current.state === 'checking') detail = 'Progress could not be confirmed. Your saved work is safe. Check again before trying this action again.';
  const websiteDetail = !verifiedWebsite && status ? 'The current website status could not be verified.' : undefined;
  const newerEdits = (dirty || current.newerDraft || hasDraft && current.selectedHead && current.selectedHead !== head) && pr;
  const requestLink = pr && <a href={pr} target="_blank" rel="noopener noreferrer">Publication request #{current.number} on GitHub</a>;
  const updateRequest = canRetry && <button className="publication-text-action" type="button" disabled={disabled || dirty || !current.autoMergeEnabled} onClick={() => onRetry(current.selectedHead!, current.action)}>{unpublishing ? 'Update and unpublish' : 'Update and publish'}</button>;
  const unpublishReason = current.mainDraft !== false ? 'This page is not currently available to unpublish.' : (!current.unpublishEnabled || !current.autoMergeEnabled) ? 'Unpublishing is not enabled yet. Ask a maintainer.' : dirty ? 'Save your changes before unpublishing.' : active ? 'Review the pending request first.' : undefined;
  return <section className="publication-status" aria-label="Publication status" data-state={current.state}>
    <div className="document-status-row"><strong className={`publication-heading visibility-badge ${publication === 'published' ? 'status-ready' : publication === 'unpublished' ? 'status-draft' : 'status-unknown'}`} role="status">{title}</strong>{saveStatus}{justDeployed && <span className="publication-complete" role="status">{newerEdits ? 'Submitted update deployed' : 'Update deployed'}</span>}</div>
    {(detail || websiteDetail || needsCheck) && <div className="publication-notice" aria-label="Publication notice">
      {detail && <p role="status">{detail}</p>}
      {websiteDetail && <p role="status">{websiteDetail}</p>}
      {!historical && newerEdits && <p>Newer edits in this editor are not included in this action.</p>}
      <div className="publication-notice-actions">
        {needsCheck && <button className="publication-text-action" type="button" disabled={disabled} onClick={checkAgain}>Check again</button>}
        {!historical && updateRequest}
        {current.autoMerge === true && ['pr-open', 'conflict', 'checking'].includes(current.state) && onAutoMerge && <button className="publication-text-action" type="button" disabled={disabled} onClick={() => onAutoMerge(current, false)}>{unpublishing ? 'Cancel unpublishing' : 'Cancel publishing'}</button>}
        {current.state === 'pr-open' && current.autoMerge === false && current.autoMergeEnabled && onAutoMerge && <button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={() => onAutoMerge(current, true)}>{unpublishing ? 'Unpublish' : 'Publish'}</button>}
      </div>
      {current.autoMerge === true && active && <p className="publication-cancellation-limit">Cancellation stops a pending action. It cannot undo changes already accepted for deployment.</p>}
    </div>}
    {(pr || technicalError || technicalDetails || current.message || current.website?.message) && <details className="publication-history">
      <summary>View details</summary>
      {historical && <p>{current.state === 'closed' ? 'The publication request was closed without merging.' : 'The request was merged and its website update was verified.'}</p>}
      {current.state === 'pr-open' && <p>{current.autoMerge === true ? 'GitHub auto-merge is enabled for this immutable snapshot.' : current.autoMerge === false ? 'GitHub auto-merge is not enabled.' : 'GitHub auto-merge status could not be confirmed.'}</p>}
      {current.state === 'merged' && !historical && <p>GitHub reports this request merged; its deployment is not yet verified.</p>}
      {current.message && !['pr-open', 'merged', 'closed'].includes(current.state) && <p>{current.message}</p>}
      {current.website?.message && <p>{current.website.message}</p>}
      {technicalError && <p>{technicalError}</p>}{technicalDetails}
      <div className="publication-notice-actions">{requestLink}{current.state === 'merged' && <a href="https://github.com/geobtaa/geobtaa.github.io/actions/workflows/astro.yml" target="_blank" rel="noopener noreferrer">GitHub Pages deployment</a>}{historical && updateRequest}</div>
    </details>}
    {actionTarget && onUnpublish && createPortal(<button className="unpublish-document" type="button" title={unpublishReason} disabled={disabled || dirty || active || !current.unpublishEnabled || !current.autoMergeEnabled || current.mainDraft !== false} onClick={() => onUnpublish?.(true)}>Unpublish</button>, actionTarget)}

  </section>;
}

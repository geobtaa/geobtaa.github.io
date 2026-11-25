import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { publicationApplied, publicationBlocksNewRequest, publicationCanResume, publicationProgress, publicationLink as prLink, usePublicationProgress, type PublicationState } from './publicationProgress';
export type { PublicationState } from './publicationProgress';
export function PublicationStatus({ path, head, sha, dirty, hasDraft = true, preservedEdits = false, newPage = false, refreshVersion, disabled, load, onRetry, onUnpublish, submitted, actionTarget, saveStatus, onAutoMerge, onAutoMergeAvailable, onStatus, technicalError, technicalDetails }: {
  actionTarget?: HTMLElement | null; saveStatus?: ReactNode;
  path: string; head?: string; sha?: string; dirty: boolean; hasDraft?: boolean; preservedEdits?: boolean; newPage?: boolean; refreshVersion: number; disabled: boolean;
  load: (path: string, signal: AbortSignal) => Promise<PublicationState>; onRetry: (head: string, action?: 'publish' | 'unpublish') => void;
  onAutoMerge?: (status: PublicationState, enabled: boolean) => void; onAutoMergeAvailable?: (available: boolean) => void; onStatus?: (status: PublicationState) => void; technicalError?: string; technicalDetails?: ReactNode;
  onUnpublish?: (automatically?: boolean) => void; submitted?: PublicationState;
}) {
  const { status, checkAgain, refreshing, refreshMessage } = usePublicationProgress(path, load, { head, refreshVersion, submitted });
  useEffect(() => { if (status) onStatus?.(status); }, [status, onStatus]);
  const current = status || { state: 'checking' }, pr = prLink(current);
  useEffect(() => { onAutoMergeAvailable?.(current.autoMergeEnabled === true); }, [current.autoMergeEnabled, onAutoMergeAvailable]);
  const publication = current.website?.publication;
  const unpublishing = current.action === 'unpublish';
  const applied = publicationApplied(current);
  const mainAhead = !hasDraft && !!sha && !!current.website?.deployedBlob && current.website.deployedBlob !== sha;
  const newerSaved = preservedEdits || hasDraft && (current.newerDraft || !!current.selectedHead && current.selectedHead !== head);
  const progress = publicationProgress(current);
  const pending = progress === 'Publishing…' || progress === 'Unpublishing…';
  let title = progress;
  let detail = '';
  if (pending) {
    detail = `${unpublishing ? 'Removal continues' : 'Updates'} automatically, usually in about 5 minutes. You can leave the editor.`;
    if (dirty || newerSaved) detail += dirty ? ' Newer unsaved edits are not included.' : ' Newer saved changes are not included.';
  } else if (title === 'Needs attention') {
    detail = current.state === 'reserved' || current.state === 'pr-open' && current.autoMerge === false
      ? `Your draft is safe. Review and confirm ${unpublishing ? 'Unpublish' : 'Publish'} to finish submitting.`
      : 'Your draft is safe, but this action could not be completed. Ask a maintainer for help.';
  } else if (!title || applied || title === 'Checking publication status…' && !pr) {
    if (dirty) { title = 'Unsaved changes'; detail = publication === 'published' ? 'An earlier version is live.' : newPage ? 'This page has not been published.' : publication === 'unpublished' ? 'This page is unpublished.' : ''; }
    else if (mainAhead || newerSaved || hasDraft && !applied) {
      title = 'Draft saved'; detail = publication === 'published' ? 'Your changes are saved. An earlier version is live.' : newPage ? 'Your changes are saved. This page has not been published.' : publication === 'unpublished' ? 'Your changes are saved. This page is unpublished.' : 'Your changes are saved but not yet published.';
    } else title = publication === 'published' ? 'Published' : publication === 'unpublished' ? 'Unpublished' : newPage ? 'Draft saved' : 'Checking publication status…';
  }
  const uncertain = current.verificationPending || current.state === 'checking' && !!status;
  if (uncertain && title !== 'Needs attention') detail = pending ? 'Publication progress is temporarily unavailable. Your request continues automatically.' + (dirty || newerSaved ? ' Newer edits are not included.' : '') : 'Status is temporarily unavailable. Your saved work is safe. We’ll check automatically.';
  if (technicalError && !pending && !applied) {
    title = 'Needs attention';
    detail = 'Your draft is safe. Submission could not be confirmed. Review the status before trying again.';
  } else if (pending && technicalError?.startsWith('Cancellation')) {
    detail = 'Cancellation could not be confirmed. This action may still complete. We’ll check automatically.';
  }
  if (title === 'Needs attention' && dirty) detail += ' Newer edits are not saved yet.';
  const canRetry = publicationCanResume(current);
  const unpublishReason = current.mainDraft !== false ? 'This page is not currently available to unpublish.' : (!current.unpublishEnabled || !current.autoMergeEnabled) ? 'Unpublishing is not enabled yet. Ask a maintainer.' : dirty ? 'Save your changes before unpublishing.' : publicationBlocksNewRequest(current) ? 'A publication request is pending.' : undefined;
  return <section className="publication-status" aria-label="Publication status" data-state={current.state}>
    <div className="publication-summary">
      <div className="document-status-row"><strong className={`publication-heading save-state draft-status visibility-badge ${title === 'Published' ? 'status-ready' : 'status-draft'}`} role="status">{title}</strong>{saveStatus}</div>
      <p className="publication-notice" role="status">{detail || '\u00a0'}</p>
    </div>
    <details className="publication-history">
      <summary>Technical details</summary>
      {applied && <p>The request was merged and its website update was verified.</p>}
      {current.state === 'closed' && <p>The request was closed. Saved work remains available.</p>}
      <p>Request status: {current.state}. Automatic publication: {current.autoMerge === true ? 'authorized' : current.autoMerge === false ? 'not authorized' : 'unconfirmed'}.</p>
      {(current.checks || current.checksState) && <p>Validation: {current.checks || current.checksState}.</p>}
      {current.reviewDecision && <p>Review: {current.reviewDecision}.</p>}
      {current.deployment && <p>Website update: {current.deployment.state}.</p>}
      {current.selectedHead && <p>Submitted revision: <code>{current.selectedHead}</code></p>}
      {current.message && <p>{current.message}</p>}
      {current.website?.message && <p>{current.website.message}</p>}
      {technicalError && <p>{technicalError}</p>}{technicalDetails}
      <div className="publication-notice-actions">
        {pr && <a href={pr} target="_blank" rel="noopener noreferrer">Publication request #{current.number} on GitHub</a>}
        <button className="publication-text-action publication-refresh" type="button" disabled={disabled || refreshing} onClick={checkAgain}>{refreshing ? 'Refreshing…' : 'Refresh status'}</button>
        {canRetry && unpublishing && <button className="publication-text-action" type="button" disabled={disabled || dirty} onClick={() => current.state === 'pr-open' ? onAutoMerge?.(current, true) : onRetry(current.selectedHead!, current.action)}>Resume unpublishing</button>}
        {current.autoMerge === true && ['pr-open', 'conflict', 'checking'].includes(current.state) && onAutoMerge && <button className="publication-text-action" type="button" disabled={disabled} onClick={() => onAutoMerge(current, false)}>{unpublishing ? 'Cancel unpublishing' : 'Cancel publishing'}</button>}
      </div>
      <p className="publication-refresh-feedback" role="status">{refreshMessage || '\u00a0'}</p>
      {current.autoMerge === true && !applied && <p className="publication-cancellation-limit">Cancellation stops a pending action. It cannot undo changes already accepted for deployment.</p>}
    </details>
    {actionTarget && onUnpublish && createPortal(<button className="unpublish-document" type="button" title={unpublishReason} disabled={disabled || !!unpublishReason} onClick={() => onUnpublish(true)}>Unpublish</button>, actionTarget)}
  </section>;
}

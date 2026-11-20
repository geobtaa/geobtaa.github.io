import { useEffect, useRef } from 'react';
export type PublicationDialogProps = {
  revision: { filename: string; head?: string; savedAt?: string; savedBy?: string; earlier?: boolean };
  disabled?: boolean; onCancel: () => void; onConfirm: () => void;
};
export function PublicationDialog({ action, published = false, revision, disabled, onCancel, onConfirm }: PublicationDialogProps & { action: 'publish' | 'unpublish'; published?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, []);
  const unpublish = action === 'unpublish';
  const title = unpublish ? 'Unpublish this page?' : published ? 'Publish these changes?' : 'Publish this page?';
  const message = unpublish ? 'This page will be removed from the public website after the required checks finish. Your saved work will remain available in the editor.' : published ? 'Your saved changes will update the public website after the required checks finish.' : 'Your saved changes will be published to the public website after the required checks finish.';
  const date = revision.savedAt ? new Date(revision.savedAt) : null;
  const savedTime = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, {dateStyle:'medium',timeStyle:'short'}).format(date) : null;
  return <dialog ref={dialog} className="unsaved-changes-dialog publication-confirmation" aria-labelledby="publication-confirmation-title" aria-describedby={`publication-confirmation-description publication-confirmation-version${!unpublish && revision.earlier ? ' publication-confirmation-earlier' : ''}`} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="publication-confirmation-title">{title}</h2>
    <p id="publication-confirmation-description">{message}</p>
    <p id="publication-confirmation-version" className="publication-version">{revision.filename}{unpublish ? ' · Current website version' : <> · Saved version <code title={revision.head}>{revision.head?.slice(0, 12)}</code>{savedTime && <> · {savedTime}</>}{revision.savedBy && <> · {revision.savedBy}</>}</>}</p>
    {!unpublish && revision.earlier && <p id="publication-confirmation-earlier">This is the earlier saved version selected for this action. Newer saved changes are not included.</p>}
    <div className="actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary confirm-publication" type="button" disabled={disabled} onClick={onConfirm}>{unpublish ? 'Unpublish' : 'Publish'}</button></div>
  </dialog>;
}

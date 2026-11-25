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
  const message = unpublish ? 'Remove this page from the website? Your saved work will remain in the editor.' : 'Your saved changes will appear on the website automatically. You can leave the editor after submitting.';
  return <dialog ref={dialog} className="unsaved-changes-dialog publication-confirmation" aria-labelledby="publication-confirmation-title" aria-describedby={`publication-confirmation-description${!unpublish && revision.earlier ? ' publication-confirmation-earlier' : ''}`} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="publication-confirmation-title">{title}</h2>
    <p id="publication-confirmation-description">{message}</p>
    {!unpublish && revision.earlier && <p id="publication-confirmation-earlier">This is the earlier saved version <code title={revision.head}>{revision.head?.slice(0, 12)}</code>. Newer saved changes are not included.</p>}
    <div className="actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary confirm-publication" type="button" disabled={disabled} onClick={onConfirm}>{unpublish ? 'Unpublish' : 'Publish'}</button></div>
  </dialog>;
}

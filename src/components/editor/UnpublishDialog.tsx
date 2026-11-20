import { useEffect, useRef } from 'react';
export function UnpublishDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="unsaved-changes-dialog" aria-labelledby="unpublish-title" aria-describedby="unpublish-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="unpublish-title">Unpublish this page?</h2>
    <p id="unpublish-description">This submits a request to remove the page from the public website. The page and your saved edits will remain available in the editor. It stays online until the request is merged and the website update succeeds.</p>
    <div className="actions"><button type="button" autoFocus onClick={onCancel}>Cancel</button><button type="button" onClick={onConfirm}>Submit unpublish request</button></div>
  </dialog>;
}

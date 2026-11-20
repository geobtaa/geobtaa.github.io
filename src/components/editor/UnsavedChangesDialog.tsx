import { useEffect, useRef } from 'react';

export function UnsavedChangesDialog({ message, onKeepEditing, onLeave }: {
  message: string; onKeepEditing: () => void; onLeave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="unsaved-changes-dialog" aria-labelledby="unsaved-changes-title" aria-describedby="unsaved-changes-message" onCancel={event => {
    event.preventDefault(); onKeepEditing();
  }}>
    <h2 id="unsaved-changes-title">Unsaved changes</h2>
    <p id="unsaved-changes-message">{message}</p>
    <div className="actions">
      <button type="button" className="primary" autoFocus onClick={onKeepEditing}>Keep editing</button>
      <button type="button" onClick={onLeave}>Leave editor</button>
    </div>
  </dialog>;
}

import { useEffect, useRef } from 'react';
import { UnsavedChangesList } from './UnsavedChangesList';
import type { RecoveryCopy } from './editorRecovery';

export function RecoveryManager({ copies, reason, canResume, onResume, onBackup, onDiscard, onClose }: {
  copies: RecoveryCopy[]; reason: string; canResume: (copy: RecoveryCopy) => boolean;
  onResume: (copy: RecoveryCopy) => void; onBackup: (copy: RecoveryCopy) => void;
  onDiscard: (copy: RecoveryCopy) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!; element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="recovery-manager" aria-labelledby="recovery-manager-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="recovery-manager-title">Find unsaved work</h2>
    <p>{reason}</p>
    <button type="button" autoFocus onClick={onClose}>Close</button>
    {copies.length ? <UnsavedChangesList copies={copies} canResume={canResume} onResume={onResume} onBackup={onBackup} onDiscard={onDiscard} /> : <p>No stored versions remain.</p>}
  </dialog>;
}

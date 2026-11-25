import { useEffect, useRef, useState } from 'react';
import { MAX_RECOVERY_FILE_BYTES, parseRecoveryFile, type RecoveryCopy } from './editorRecovery';
import type { EditorRoute } from './editorNavigation';

export function RecoveryFileOptions({ context, route, disabled, restoreBlocked, onDownload, onRestore }: {
  context: string; route: EditorRoute; disabled: boolean; restoreBlocked: string;
  onDownload: () => void; onRestore: (copy: RecoveryCopy, context: string) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0), working = useRef(false), latestContext = useRef(context);
  latestContext.current = context;
  const [selected, setSelected] = useState<{ copy: RecoveryCopy; context: string } | null>(null);
  const [issue, setIssue] = useState(''), [reading, setReading] = useState(false), [restoring, setRestoring] = useState(false);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { dialog.current?.close(); if (previous?.isConnected) previous.focus(); };
  }, [selected]);
  useEffect(() => {
    if (selected && selected.context !== context && !working.current) {
      setSelected(null); setIssue('The open page changed. Choose the backup file again after saving any current edits.');
    }
  }, [context, selected]);
  const choose = async (file?: File) => {
    if (!file || disabled || restoreBlocked || working.current) return;
    const request = ++sequence.current, capturedContext = context;
    setIssue(''); setReading(true);
    try {
      if (file.size > MAX_RECOVERY_FILE_BYTES) throw new Error('This backup file is too large to restore in the editor. Keep the file and ask a maintainer for help.');
      const copy = parseRecoveryFile(await file.text(), route);
      if (request !== sequence.current) return;
      if (capturedContext !== latestContext.current) throw new Error('The open page changed while the file was being read. Choose the backup again.');
      setSelected({ copy, context: capturedContext });
    } catch (error) { if (request === sequence.current) setIssue((error as Error).message); }
    finally { if (request === sequence.current) setReading(false); }
  };
  const confirm = async () => {
    if (!selected || disabled || restoreBlocked || working.current || selected.context !== latestContext.current) return;
    working.current = true; setRestoring(true); setIssue('');
    try { await onRestore(selected.copy, selected.context); setSelected(null); }
    catch (error) { setIssue((error as Error).message); }
    finally { working.current = false; setRestoring(false); }
  };
  return <details className="recovery-file-options">
    <summary>Recovery options</summary>
    <div className="recovery-file-panel">
      <p>Did something go wrong? If saving or publishing is not working, you can download a backup of the content currently in this editor, including unsaved edits. You can load it here later to recover your work.</p>
      <div className="recovery-file-actions">
        <button className="save-backup" type="button" disabled={disabled || reading || restoring} onClick={onDownload}>Save backup file</button>
        <button className="restore-backup" type="button" disabled={disabled || !!restoreBlocked || reading || restoring} onClick={() => input.current?.click()}>{reading ? 'Reading backup…' : 'Restore backup file'}</button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" aria-label="Choose editor backup file" hidden onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} />
      {restoreBlocked && <p className="recovery-file-hint">{restoreBlocked}</p>}
      {issue && !selected && <p className="recovery-file-error" role="alert">{issue}</p>}
      <a href="https://github.com/geobtaa/geobtaa.github.io/blob/main/docs/CMS_USER_GUIDE.md#troubleshooting-and-common-errors" target="_blank" rel="noopener noreferrer" aria-label="Troubleshooting guide (opens in a new tab)">Troubleshooting guide</a>
    </div>
    {selected && <dialog ref={dialog} className="unsaved-changes-dialog backup-restore-dialog" aria-labelledby="backup-restore-title" aria-describedby="backup-restore-description backup-restore-version" onCancel={event => { event.preventDefault(); if (!restoring) setSelected(null); }}>
      <h2 id="backup-restore-title">Restore this backup?</h2>
      <p id="backup-restore-description">Load this version into the editor as unsaved changes? Review it, then choose Save Draft. Restoring does not publish the page.</p>
      <p id="backup-restore-version">{selected.copy.fields.title || 'Untitled page'} · {selected.copy.route.filename || 'New page'}<br />Backup from <time dateTime={selected.copy.savedAt}>{new Date(selected.copy.savedAt).toLocaleString()}</time></p>
      {issue && <p className="recovery-file-error" role="alert">{issue}</p>}
      {restoreBlocked && <p role="alert">{restoreBlocked}</p>}
      <div className="actions"><button type="button" disabled={restoring} onClick={() => setSelected(null)}>Cancel</button><button className="primary confirm-backup-restore" type="button" disabled={disabled || !!restoreBlocked || restoring} onClick={() => void confirm()}>{restoring ? 'Restoring…' : 'Restore backup'}</button></div>
    </dialog>}
  </details>;
}

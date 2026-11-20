import { useState } from 'react';
import { CONTENT_AREAS } from '../../../editor/contentAreas.mjs';
import { groupRecoveryCopies, type RecoveryCopy } from './editorRecovery';

export function RecoveryOptions({ copy, disabled, onBackup, onDiscard }: {
  copy: RecoveryCopy; disabled?: boolean; onBackup: (copy: RecoveryCopy) => void; onDiscard: (copy: RecoveryCopy) => void;
}) {
  return <div key={`${copy.id}:${copy.revision}`} className="recovery-version-actions">
    <p>For the version kept on <time dateTime={copy.savedAt}>{new Date(copy.savedAt).toLocaleString()}</time>.</p>
    <p>Save backup file saves this version to your computer without changing the editor or GitHub.</p>
    <button type="button" disabled={disabled} onClick={() => onBackup(copy)}>Save backup file</button>{' '}
    <button type="button" className="destructive" disabled={disabled} onClick={() => onDiscard(copy)}>Discard unsaved changes</button>
  </div>;
}

export function UnsavedChangesList({ copies, canResume, onResume, onBackup, onDiscard }: {
  copies: RecoveryCopy[]; canResume: (copy: RecoveryCopy) => boolean;
  onResume: (copy: RecoveryCopy) => void; onBackup: (copy: RecoveryCopy) => void; onDiscard: (copy: RecoveryCopy) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(() => {
    const groups = groupRecoveryCopies(copies);
    return groups.length === 1 && groups[0].versions.length > 1 ? groups[0].key : null;
  });
  const groups = groupRecoveryCopies(copies);
  if (!groups.length) return null;
  return <aside className="recovery-panel" aria-label="Unsaved changes">
    <h2>Unsaved changes</h2>
    <p>These edits are stored only in this browser and have not been confirmed saved to GitHub. Resume editing to review and save them. Clearing this browser's data will remove them.</p>
    <ul className="unsaved-documents">{groups.map(group => <li key={group.key}>
      <strong className="unsaved-document-title">{group.latest.fields.title || group.latest.route.filename || `Untitled ${CONTENT_AREAS[group.latest.route.area!].itemLabel}`}</strong>
      <span>{CONTENT_AREAS[group.latest.route.area!].label} · {group.latest.route.filename || 'New unsaved page'} · Latest kept <time dateTime={group.latest.savedAt}>{new Date(group.latest.savedAt).toLocaleString()}</time></span>
      {group.latest.fields.creationAttempt && <p>A previous save is unconfirmed. Resuming retains its safe retry information.</p>}
      <div className="recovery-copy-actions">
        <button type="button" className="primary" disabled={!canResume(group.latest)} onClick={() => group.needsChoice ? setExpanded(group.key) : onResume(group.latest)}>Resume editing</button>
        {group.versions.length > 1 && <button type="button" aria-expanded={expanded === group.key} onClick={() => setExpanded(expanded === group.key ? null : group.key)}>View earlier versions</button>}
        <RecoveryOptions copy={group.latest} onBackup={onBackup} onDiscard={onDiscard} />
      </div>
      {expanded === group.key && <section className="unsaved-versions" aria-label="Unsaved versions">
        <h3>Choose a version to resume</h3>
        <p>Each version was kept separately, from another editing session or starting version of the page. The latest timestamp does not mean it includes the other edits. No versions will be combined or discarded automatically.</p>
        {group.needsChoice && <p role="status">These versions differ. Choose the work you want to restore.</p>}
        <ol>{group.versions.map((copy, index) => <li key={copy.id}>
          <strong>{index === 0 ? 'Latest kept version' : 'Earlier version'} · Session {index + 1}</strong>
          <p><time dateTime={copy.savedAt}>{new Date(copy.savedAt).toLocaleString()}</time> · {copy.fields.title || 'Untitled page'}</p>
          {copy.baseSha !== group.latest.baseSha && <p>Started from a different GitHub version.</p>}
          {copy.fields.creationAttempt && <p>Unconfirmed save for {copy.fields.creationAttempt.filename}. Its original retry information will be retained.</p>}
          <pre className="unsaved-version-excerpt">{copy.fields.body.slice(0, 240)}{copy.fields.body.length > 240 ? '…' : ''}</pre>
          <div className="recovery-copy-actions">
            <button type="button" disabled={!canResume(copy)} onClick={() => onResume(copy)}>Resume this version</button>
            <RecoveryOptions copy={copy} onBackup={onBackup} onDiscard={onDiscard} />
          </div>
        </li>)}</ol>
      </section>}
    </li>)}</ul>
  </aside>;
}

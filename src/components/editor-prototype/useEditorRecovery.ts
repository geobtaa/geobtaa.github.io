import { useEffect, useRef, useState } from 'react';
import type { Project } from './editorTypes.ts';
import { routeKey, type EditorRoute } from './editorNavigation.ts';
import { recoveryFields, recoveryKey, recoveryPrefix, readRecoveryCopies, removeRecovery, type RecoveryCopy } from './editorRecovery.ts';

export function useEditorRecovery({ scope, route, project, baseline }: { scope: string | null; route: EditorRoute; project: Project | null; baseline: Project | null }) {
  const [copies, setCopies] = useState<RecoveryCopy[]>([]);
  const [storageError, setStorageError] = useState('');
  const [status, setStatus] = useState<'none' | 'pending' | 'saved' | 'error'>('none');
  const [savedAt, setSavedAt] = useState('');
  const latest = useRef({ scope, route, project, baseline }); latest.current = { scope, route, project, baseline };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const session = useRef<{ key: string; id: string; copy?: RecoveryCopy; fields?: string }>({ key: '', id: '' });
  const consume = useRef<RecoveryCopy | null>(null);
  const key = scope && baseline ? JSON.stringify([scope, routeKey(route), baseline.sha || null]) : '';
  const hasChanges = !!project && !!baseline && JSON.stringify(recoveryFields(project)) !== JSON.stringify(recoveryFields(baseline));
  const fieldsKey = project ? JSON.stringify(recoveryFields(project)) : '';
  const refresh = () => {
    const context = latest.current;
    if (!context.scope) { setCopies([]); return; }
    try {
      const result = readRecoveryCopies(window.localStorage, context.scope, context.project ? context.route : undefined);
      setCopies(result.copies.filter(copy => copy.id !== session.current.id));
      if (result.unreadable) setStorageError('Some recovery copies could not be read. Keep a separate copy of important unsaved work.');
    } catch { setStorageError('This browser cannot store recovery copies. Keep a separate copy of unsaved work.'); setStatus('error'); }
  };
  const flush = () => {
    clearTimeout(timer.current);
    const context = latest.current;
    if (!context.scope || !context.project || !context.baseline || !context.route.area || (!context.route.filename && !context.route.draftId)) return false;
    const contextKey = JSON.stringify([context.scope, routeKey(context.route), context.baseline.sha || null]);
    if (session.current.key !== contextKey) session.current = { key: contextKey, id: crypto.randomUUID() };
    const fields = recoveryFields(context.project);
    const serialized = JSON.stringify(fields);
    try {
      if (serialized === JSON.stringify(recoveryFields(context.baseline))) {
        if (session.current.copy) removeRecovery(window.localStorage, context.scope, session.current.copy);
        if (consume.current) { removeRecovery(window.localStorage, context.scope, consume.current); consume.current = null; }
        session.current.copy = undefined; session.current.fields = undefined;
        setStatus('none'); return true;
      }
      if (serialized === session.current.fields && session.current.copy && window.localStorage.getItem(recoveryKey(context.scope, session.current.id)) === JSON.stringify(session.current.copy)) return true;
      const copy: RecoveryCopy = { version: 1, id: session.current.id, revision: crypto.randomUUID(), route: context.route, baseSha: context.baseline.sha || null, savedAt: new Date().toISOString(), fields };
      window.localStorage.setItem(recoveryKey(context.scope, copy.id), JSON.stringify(copy));
      session.current.copy = copy; session.current.fields = serialized;
      if (consume.current) { removeRecovery(window.localStorage, context.scope, consume.current); consume.current = null; }
      setStatus('saved'); setSavedAt(copy.savedAt); setStorageError('');
      return true;
    } catch { setStatus('error'); setStorageError('Recovery could not be saved on this device. Keep this tab open or download your unsaved edits.'); return false; }
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    clearTimeout(timer.current);
    session.current = { key, id: crypto.randomUUID() };
    consume.current = null;
    setStatus('none'); setSavedAt(''); setStorageError(''); refresh();
    return () => clearTimeout(timer.current);
  }, [key, scope, routeKey(route)]);
  useEffect(() => {
    if (!key) return;
    if (!hasChanges) { flushRef.current(); return; }
    setStatus('pending');
    timer.current = setTimeout(() => flushRef.current(), 350);
    return () => clearTimeout(timer.current);
  }, [key, fieldsKey, hasChanges]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') flushRef.current(); };
    const pagehide = () => flushRef.current();
    const storage = (event: StorageEvent) => {
      const context = latest.current;
      if (context.scope && (!event.key || event.key.startsWith(recoveryPrefix(context.scope)))) refresh();
    };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pagehide); window.addEventListener('storage', storage);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pagehide); window.removeEventListener('storage', storage); };
  }, []);
  const restored = (copy: RecoveryCopy) => { consume.current = copy; setCopies(current => current.filter(item => item.id !== copy.id)); };
  const saved = () => {
    const context = latest.current;
    clearTimeout(timer.current);
    if (context.scope) {
      try {
        if (session.current.copy) removeRecovery(window.localStorage, context.scope, session.current.copy);
        if (consume.current) removeRecovery(window.localStorage, context.scope, consume.current);
      } catch { setStorageError('Changes were saved, but a local recovery copy could not be cleared.'); }
    }
    session.current.copy = undefined; session.current.fields = undefined; consume.current = null;
    setStatus('none'); refresh();
  };
  const discard = (copy: RecoveryCopy) => {
    const context = latest.current;
    if (!context.scope) return;
    try {
      if (!removeRecovery(window.localStorage, context.scope, copy)) setStorageError('That recovery copy changed in another tab. Review the latest copy before discarding it.');
      refresh();
    } catch { setStorageError('The recovery copy could not be removed from this device.'); }
  };
  const currentCopy = (): RecoveryCopy | null => {
    const context = latest.current;
    if (!context.project || !context.baseline || !context.route.area) return null;
    return { version: 1, id: session.current.id || crypto.randomUUID(), revision: crypto.randomUUID(), route: context.route, baseSha: context.baseline.sha || null, savedAt: new Date().toISOString(), fields: recoveryFields(context.project) };
  };
  return { copies, status, savedAt, storageError, hasChanges, flush, refresh, restored, saved, discard, currentCopy };
}
export type EditorRecovery = ReturnType<typeof useEditorRecovery>;

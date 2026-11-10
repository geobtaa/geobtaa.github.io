import { useEffect, useRef } from 'react';
import { CONTENT_AREAS } from '../../../editor-prototype/contentAreas.mjs';

export type EditorRoute = { area: keyof typeof CONTENT_AREAS | null; filename?: string; draftId?: string };
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
export function validEditorRoute(route: EditorRoute) {
  if (route.area === null) return !route.filename && !route.draftId;
  if (!Object.hasOwn(CONTENT_AREAS, route.area) || (route.filename && route.draftId)) return false;
  if (route.draftId && !idPattern.test(route.draftId)) return false;
  return !route.filename || (/^[A-Za-z0-9][A-Za-z0-9._/-]*\.mdx?$/.test(route.filename) && !route.filename.includes('..') && !route.filename.includes('//'));
}
export function parseEditorRoute(url: string): EditorRoute {
  const params = new URL(url).searchParams;
  for (const name of ['area', 'file', 'new']) if (params.getAll(name).length > 1) throw new Error('This editor link is invalid. Choose a content area below.');
  const route = { area: params.get('area') as EditorRoute['area'], ...(params.has('file') ? { filename: params.get('file')! } : {}), ...(params.has('new') ? { draftId: params.get('new')! } : {}) };
  if (!validEditorRoute(route) || (params.has('file') && !route.filename) || (params.has('new') && !route.draftId)) throw new Error('This editor link is invalid. Choose a content area below.');
  return route;
}
export function routeKey(route: EditorRoute) { return JSON.stringify([route.area, route.filename || '', route.draftId || '']); }
export function editorUrl(route: EditorRoute, base: string) {
  if (!validEditorRoute(route)) throw new Error('Invalid editor destination.');
  const url = new URL(base);
  ['area', 'file', 'new'].forEach(name => url.searchParams.delete(name));
  if (route.area) url.searchParams.set('area', route.area);
  if (route.filename) url.searchParams.set('file', route.filename);
  if (route.draftId) url.searchParams.set('new', route.draftId);
  return url.pathname + url.search + url.hash;
}

type HistoryEntry = { session: string; index: number };
export function useEditorNavigation({ enabled, activate, canLeave, onError }: { enabled: boolean; activate: (route: EditorRoute) => void; canLeave: () => boolean; onError: (message: string) => void }) {
  const callbacks = useRef({ activate, canLeave, onError });
  callbacks.current = { activate, canLeave, onError };
  const current = useRef<{ route: EditorRoute; entry: HistoryEntry } | null>(null);
  const restoring = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let route: EditorRoute = { area: null };
    let initialError = '';
    try { route = parseEditorRoute(window.location.href); } catch (error) { initialError = (error as Error).message; }
    const stored = window.history.state?.editorNavigation;
    const entry: HistoryEntry = stored && typeof stored.session === 'string' && Number.isSafeInteger(stored.index) ? stored : { session: crypto.randomUUID(), index: 0 };
    current.current = { route, entry };
    window.history.replaceState({ ...window.history.state, editorNavigation: entry }, '', editorUrl(route, window.location.href));
    callbacks.current.activate(route);
    if (initialError) callbacks.current.onError(initialError);
    const pop = (event: PopStateEvent) => {
      const active = current.current;
      if (!active) return;
      const target = event.state?.editorNavigation as HistoryEntry | undefined;
      // Entries created by this editor have positions, so canceling traversal
      // restores the original entry without adding dummy history entries.
      if (!target || target.session !== active.entry.session || !Number.isSafeInteger(target.index)) return;
      if (restoring.current !== null) {
        if (target.index === restoring.current) restoring.current = null;
        else window.history.go(restoring.current - target.index);
        return;
      }
      if (!callbacks.current.canLeave()) {
        restoring.current = active.entry.index;
        window.history.go(active.entry.index - target.index);
        return;
      }
      let next: EditorRoute;
      try { next = parseEditorRoute(window.location.href); }
      catch (error) {
        callbacks.current.onError((error as Error).message);
        restoring.current = active.entry.index; window.history.go(active.entry.index - target.index); return;
      }
      current.current = { route: next, entry: target };
      callbacks.current.activate(next);
    };
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('popstate', pop); current.current = null; restoring.current = null; };
  }, [enabled]);
  const navigate = (route: EditorRoute) => {
    const active = current.current;
    if (!active || restoring.current !== null || routeKey(route) === routeKey(active.route) || !callbacks.current.canLeave()) return false;
    const entry = { session: active.entry.session, index: active.entry.index + 1 };
    window.history.pushState({ editorNavigation: entry }, '', editorUrl(route, window.location.href));
    current.current = { route, entry };
    callbacks.current.activate(route);
    return true;
  };
  const replace = (route: EditorRoute) => {
    if (!current.current) return;
    current.current = { ...current.current, route };
    window.history.replaceState({ ...window.history.state, editorNavigation: current.current.entry }, '', editorUrl(route, window.location.href));
  };
  return { navigate, replace };
}

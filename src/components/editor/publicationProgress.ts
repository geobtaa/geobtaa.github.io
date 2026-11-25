import { useEffect, useRef, useState } from 'react';
export type PublicationState = { state: string; checks?: string; message?: string; selectedHead?: string; snapshotHead?: string; mergeHead?: string; number?: number; url?: string; newerDraft?: boolean; action?: 'publish' | 'unpublish'; autoMerge?: boolean | null; autoMergeEnabled?: boolean; mergeState?: string; reviewDecision?: string; checksState?: string; mainDraft?: boolean | null; unpublishEnabled?: boolean; website?: { deployedBlob?: string; liveUrl?: string; publication: string; requestApplied?: boolean; message?: string }; verificationPending?: boolean; deployment?: { state: string; url?: string } };
export function publicationLink(status: PublicationState) {
  return Number.isInteger(status.number) && status.url === `https://github.com/geobtaa/geobtaa.github.io/pull/${status.number}` ? status.url : undefined;
}
export function publicationApplied(status: PublicationState) {
  return status.state === 'merged' && status.website?.requestApplied === true && status.website.publication === (status.action === 'unpublish' ? 'unpublished' : 'published');
}
// Shared vocabulary for the document and content list. Website visibility alone
// never certifies that the selected update was deployed.
export function publicationProgress(status: PublicationState): string {
  if (['conflict', 'reserved'].includes(status.state) || status.state === 'pr-open' && (status.checks === 'failed' || status.reviewDecision === 'CHANGES_REQUESTED' || status.autoMerge === false) || status.state === 'merged' && !publicationApplied(status) && status.deployment?.state === 'failed') return 'Needs attention';
  if (status.state === 'merged' && publicationApplied(status)) return status.action === 'unpublish' ? 'Unpublished' : 'Published';
  if (status.state === 'merged' || status.state === 'pr-open' && status.autoMerge === true || status.state === 'checking' && status.autoMerge === true) return status.action === 'unpublish' ? 'Unpublishing…' : 'Publishing…';
  if (status.state === 'checking' || status.state === 'pr-open') return 'Checking publication status…';
  return '';
}
export function publicationPending(status: PublicationState) {
  return status.state === 'checking' || status.state === 'pr-open' || status.state === 'conflict'
    || status.state === 'merged' && !publicationApplied(status);
}
// A failed or uncertain request still owns its saved revision. Recovery must
// explicitly select that revision, rather than start an overlapping request.
export function publicationBlocksNewRequest(status?: PublicationState) {
  return !status || ['checking', 'reserved', 'pr-open', 'conflict'].includes(status.state)
    || status.state === 'merged' && !publicationApplied(status);
}
export function publicationCanResume(status?: PublicationState) {
  return !!status && !status.verificationPending && (['reserved', 'closed', 'conflict'].includes(status.state) || status.state === 'pr-open' && status.autoMerge === false)
    && /^[a-f0-9]{40}$/.test(status.selectedHead || '') && status.autoMergeEnabled === true;
}
const states = new Set(['none', 'checking', 'reserved', 'pr-open', 'closed', 'merged', 'conflict']);
// Read-only progress checks with backoff while unresolved. GitHub owns the queue even after this tab closes.
export function usePublicationProgress(path: string, load: (path: string, signal: AbortSignal) => Promise<PublicationState>, { enabled = true, head, refreshVersion = 0, submitted }: { enabled?: boolean; head?: string; refreshVersion?: number; submitted?: PublicationState } = {}) {
  const [status, setStatus] = useState<PublicationState | null>(null);
  const lastSubmitted = useRef<PublicationState | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true, running = false, continuing = true, reads = 0, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    if (submitted && lastSubmitted.current !== submitted) { lastSubmitted.current = submitted; setStatus(previous => ({ ...previous, ...submitted, website: previous?.website ? { ...previous.website, requestApplied: undefined } : undefined, deployment: undefined })); }
    const check = async () => {
      if (!active || running || document.visibilityState === 'hidden') return;
      running = true; reads++;
      let pending = false;
      try {
        const result = await load(path, controller.signal);
        if (!states.has(result.state) || ['pr-open', 'closed', 'merged', 'conflict'].includes(result.state) && !publicationLink(result)) throw new Error('The publication response could not be verified.');
        if (active) setStatus(previous => result.state === 'checking' ? { ...previous, ...result, state: previous?.state || 'checking', verificationPending: true } : { ...result, verificationPending: result.website?.publication === 'unavailable' });
        failures = result.state === 'checking' || result.website?.publication === 'unavailable' ? failures + 1 : 0;
        pending = publicationPending(result) || result.website?.publication === 'unavailable';
      } catch (error) {
        failures++;
        if (active) setStatus(previous => ({ ...previous, state: previous?.state || 'checking', verificationPending: true, message: `Status unavailable. ${(error as Error).message} Your saved work is safe.` }));
        pending = true;
      } finally {
        running = false; continuing = pending;
        if (active && pending) timer = setTimeout(() => { void check(); }, Math.min(120_000, 20_000 * 2 ** Math.min(3, failures + Math.floor(reads / 15))));
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (!continuing || document.visibilityState === 'hidden') return;
      void check();
    };
    document.addEventListener('visibilitychange', resume);
    void check();
    return () => { active = false; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', resume); };
  }, [path, load, enabled, head, refreshVersion, retry, submitted]);
  return { status, checkAgain: () => setRetry(value => value + 1) };
}

// Only deployment-verified API data may provide this URL, never form metadata.
export function publishedPageUrl(status?: PublicationState) {
  if (status?.website?.publication !== 'published' || !status.website.liveUrl) return undefined;
  try {
    const url = new URL(status.website.liveUrl);
    if (url.origin !== 'https://gin.btaa.org' || url.username || url.password || url.search || url.hash) return undefined;
    return url.href;
  } catch { return undefined; }
}

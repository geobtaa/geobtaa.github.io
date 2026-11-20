import { useEffect, useState } from 'react';
export type PublicationState = { state: string; checks?: string; message?: string; selectedHead?: string; snapshotHead?: string; mergeHead?: string; number?: number; url?: string; newerDraft?: boolean; action?: 'publish' | 'unpublish'; autoMerge?: boolean | null; autoMergeEnabled?: boolean; mergeState?: string; reviewDecision?: string; checksState?: string; mainDraft?: boolean | null; unpublishEnabled?: boolean; website?: { publication: string; requestApplied?: boolean; message?: string }; deployment?: { state: string; url?: string } };
export function publicationLink(status: PublicationState) {
  return Number.isInteger(status.number) && status.url === `https://github.com/geobtaa/geobtaa.github.io/pull/${status.number}` ? status.url : undefined;
}
export function publicationApplied(status: PublicationState) {
  return status.state === 'merged' && status.website?.requestApplied === true && status.website.publication === (status.action === 'unpublish' ? 'unpublished' : 'published');
}
export function publicationProgress(status: PublicationState): string {
  if (status.state === 'conflict') return 'Needs attention: update this request';
  if (status.state === 'closed') return 'Request closed';
  if (status.state === 'reserved') return 'Needs attention: finish submitting';
  if (status.state === 'checking') return 'Checking publication progress…';
  if (status.state === 'merged') return publicationApplied(status) ? 'Update deployed' : status.deployment?.state === 'failed' ? 'Website update failed' : 'Updating website…';
  if (status.state === 'pr-open') {
    if (status.checks === 'failed') return 'Needs attention: checks failed';
    if (status.reviewDecision === 'CHANGES_REQUESTED') return 'Needs attention: review requested changes';
    if (status.reviewDecision === 'REVIEW_REQUIRED') return 'Waiting for review';
    return status.autoMerge === true ? status.action === 'unpublish' ? 'Unpublishing when checks pass' : 'Publishing when checks pass' : status.autoMerge === false ? 'Waiting for manual merge' : 'Checking publication authorization…';
  }
  return '';
}
export function publicationPending(status: PublicationState) {
  return status.state === 'checking' || status.state === 'pr-open' && (status.autoMerge === true || status.checks !== 'failed')
    || status.state === 'merged' && !publicationApplied(status) && status.deployment?.state !== 'failed';
}
const states = new Set(['none', 'checking', 'reserved', 'pr-open', 'closed', 'merged', 'conflict']);
// Bounded, read-only progress checks. GitHub owns the queue even after this tab closes.
export function usePublicationProgress(path: string, load: (path: string, signal: AbortSignal) => Promise<PublicationState>, { enabled = true, head, refreshVersion = 0, submitted }: { enabled?: boolean; head?: string; refreshVersion?: number; submitted?: PublicationState } = {}) {
  const [status, setStatus] = useState<PublicationState | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true, running = false, continuing = true, reads = 0, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    if (submitted) setStatus(previous => ({ ...previous, ...submitted, website: previous?.website ? { ...previous.website, requestApplied: undefined } : undefined, deployment: undefined }));
    const check = async () => {
      if (!active || running || reads >= 30 || document.visibilityState === 'hidden') return;
      running = true; reads++;
      let pending = false;
      try {
        const result = await load(path, controller.signal);
        if (!states.has(result.state) || ['pr-open', 'closed', 'merged', 'conflict'].includes(result.state) && !publicationLink(result)) throw new Error('The publication response could not be verified.');
        if (active) setStatus(previous => result.state === 'checking' ? { ...previous, ...result } : result);
        failures = result.state === 'checking' || result.website?.publication === 'unavailable' ? failures + 1 : 0;
        pending = publicationPending(result);
      } catch (error) {
        failures++;
        if (active) setStatus(previous => ({ ...previous, state: 'checking', website: { publication: 'unavailable' }, message: `Status unavailable. ${(error as Error).message} Your saved work is safe.` }));
        pending = true;
      } finally {
        running = false; continuing = pending && failures < 5 && reads < 30;
        if (active && pending && failures < 5 && reads < 30) timer = setTimeout(() => { void check(); }, Math.min(120_000, 20_000 * 2 ** failures));
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (!continuing || document.visibilityState === 'hidden') return;
      if (reads === 0) void check();
      else timer = setTimeout(() => { void check(); }, Math.min(120_000, 20_000 * 2 ** failures));
    };
    document.addEventListener('visibilitychange', resume);
    void check();
    return () => { active = false; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', resume); };
  }, [path, load, enabled, head, refreshVersion, retry, submitted]);
  return { status, checkAgain: () => setRetry(value => value + 1) };
}

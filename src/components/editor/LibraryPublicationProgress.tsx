import { useEffect, useRef, useState } from 'react';
import { publicationApplied, publicationProgress, usePublicationProgress, type PublicationState } from './publicationProgress';
// Limit list reads to two visible documents at a time. No content or status database.
let reading = 0;
const queue: (() => void)[] = [];
async function bounded(load: () => Promise<PublicationState>) {
  await new Promise<void>(resolve => { queue.push(() => { reading++; resolve(); }); drain(); });
  try { return await load(); } finally { reading--; drain(); }
}
function drain() { while (reading < 2 && queue.length) queue.shift()!(); }
export function LibraryPublicationProgress({ path, load, recent = false, onDeployed }: { onDeployed?: (status: PublicationState) => void; path: string; load: (path: string, signal: AbortSignal) => Promise<PublicationState>; recent?: boolean }) {
  const [element, setElement] = useState<HTMLSpanElement | null>(null), [visible, setVisible] = useState(false);
  const sawPending = useRef(recent);
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    observer.observe(element.closest('li') || element); return () => observer.disconnect();
  }, [element]);
  // Stable wrapper: rerendering a status must not restart its polling loop.
  const [read] = useState(() => (path: string, signal: AbortSignal) => bounded(() => signal.aborted ? Promise.reject(new Error('Cancelled')) : load(path, signal)));
  const { status } = usePublicationProgress(path, read, { enabled: visible });
  if (status && ['pr-open', 'reserved', 'conflict'].includes(status.state) || status?.state === 'merged' && !publicationApplied(status)) sawPending.current = true;
  const complete = status && publicationApplied(status);
  useEffect(() => {
    if (status && publicationApplied(status) && (sawPending.current || recent)) onDeployed?.(status);
  }, [status, recent, onDeployed]);
  const label = status && status.state !== 'closed' && (!complete || sawPending.current) ? publicationProgress(status) : '';
  return <span ref={setElement} className="library-publication-progress" role="status" aria-label="Publication progress">{label}</span>;
}

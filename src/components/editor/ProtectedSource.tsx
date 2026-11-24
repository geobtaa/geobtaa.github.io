import type { BodySegment } from './bodySegments';

export function ProtectedSource({ segment, preview = false }: { segment: BodySegment; preview?: boolean }) {
  return <details className={preview ? 'preview-protected' : 'protected-block'} data-protected-type={segment.protectedType || 'uncertain'}>
    <summary>{segment.sourceLabel || 'Existing source'} <span className="source-lock">{preview ? 'Not rendered' : 'Read-only'}</span></summary>
    {segment.protectedType === 'uncertain' && <p className="source-explanation">This source could not be classified safely and stays preserved as a whole.</p>}
    <pre>{segment.content}</pre>
  </details>;
}

export function PageSetup({ segments }: { segments: BodySegment[] }) {
  const setup = segments.filter(segment => segment.protectedType === 'setup');
  if (!setup.length) return null;
  return <details className="page-setup">
    <summary>Page setup <span className="source-lock">Locked · {setup.length} source {setup.length === 1 ? 'block' : 'blocks'}</span></summary>
    <p className="source-explanation">Imports and page code are preserved automatically in their original source positions. Inspect them here; editing, moving, and removal are unavailable.</p>
    <div className="page-setup-sources">{setup.map(segment => <ProtectedSource key={segment.id} segment={segment} />)}</div>
  </details>;
}

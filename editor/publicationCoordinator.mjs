import { publicationAction } from './publicationAction.mjs';
// Shared append-only coordinator verification; used unchanged by submission and CI.
const failure = (status, message) => Object.assign(new Error(message), { status });
export function publicationState(value, path) {
  const lines = value.message?.split('\n').filter(line => line.startsWith('CMS-Publication-State-v1: '));
  let state;
  try { if (lines?.length !== 1) throw new Error(); state = JSON.parse(lines[0].slice('CMS-Publication-State-v1: '.length)); } catch { throw failure(409, 'Publication coordinator is corrupt. Ask a maintainer; do not delete its lock.'); }
  if (state.path !== path || !/^[a-f0-9]{40}$/.test(state.selectedHead || '') || !Array.isArray(state.attempts) || !state.attempts.length || state.attempts.some((item, index) => !/^[a-f0-9]{40}$/.test(item.head || '') || !/^[a-f0-9]{40}$/.test(item.base || '') || typeof item.branch !== 'string' || item.attempt !== index + 1)) throw failure(409, 'Invalid publication coordinator history.');
  publicationAction(state.action);
  return state;
}
export async function readPublicationState(head, path, commit) {
  const latest = publicationState(await commit(head), path);
  let current = latest, value = await commit(head), steps = 0;
  while (true) {
    if (++steps > 100 || value.parents?.length !== 1) throw failure(409, 'Invalid publication coordinator ancestry.');
    const parent = await commit(value.parents[0].sha);
    if (!parent.message?.includes('CMS-Publication-State-v1: ')) {
      if (current.attempts.length !== 1) throw failure(409, 'Publication attempt history was removed.');
      break;
    }
    const previous = publicationState(parent, path);
    if (publicationAction(previous.action) !== publicationAction(latest.action) || previous.selectedHead !== latest.selectedHead || previous.attempts.length !== current.attempts.length - 1 || JSON.stringify(previous.attempts) !== JSON.stringify(current.attempts.slice(0, -1))) throw failure(409, 'Publication attempt history was rewritten.');
    current = previous; value = parent;
  }
  return latest;
}

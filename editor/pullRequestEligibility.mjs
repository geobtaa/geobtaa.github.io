// CI-only: do not import the TypeScript/source scanner into the hosted Functions.
import { validateSourcePullRequest } from './sourcePullRequest.mjs';
const blocked = message => Object.assign(new Error(message), { status: 403 });
export async function verifyPullRequestEligibility({ request, store, pr, repository, report = () => {} }) {
  if (!pr || pr.base?.ref !== 'main' || !/^[a-f0-9]{40}$/.test(pr.head?.sha || '')) throw blocked('Invalid PR revision.');
  let kind;
  if (pr.head.ref.startsWith('cms/')) {
    if (pr.head.repo?.full_name !== repository || !pr.head.ref.startsWith('cms/publish/')) throw blocked('Reserved CMS PRs must be same-repository publication snapshots.');
    await store.verifyPublication(pr.head.ref, pr.head.sha);
    kind = 'cms-snapshot';
  } else {
    report(await validateSourcePullRequest({ request, pr }));
    kind = 'validated-source';
  }
  const current = await request(`/pulls/${pr.number}`);
  if (current.head?.sha !== pr.head.sha || current.head?.ref !== pr.head.ref || current.base?.ref !== 'main' || current.state !== 'open') throw blocked('PR changed during eligibility validation.');
  return kind;
}

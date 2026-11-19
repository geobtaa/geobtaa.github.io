import { createDraftStore } from './draftStorage.mjs';
import { preparePublicationCandidate } from './publicationCandidate.mjs';
// Exercise the same two-phase preparation/submission as the browser. The proposal
// is deliberately untrusted; publication tests separately invoke independent CI.
export function publicationTestClient(options) {
  const store = createDraftStore(options);
  return { ...store, async publishContent(input) {
    const prepared = await store.preparePublication(input);
    return store.publishContent({ ...input, candidate: preparePublicationCandidate(prepared, input.filename) });
  } };
}

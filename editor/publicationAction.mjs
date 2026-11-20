import { patchFrontmatter } from './pageMetadata.mjs';
export function publicationAction(value = 'publish') {
  if (!['publish', 'unpublish'].includes(value)) throw Object.assign(new Error('Choose publish or unpublish.'), { status: 400 });
  return value;
}
// Preserve legacy snapshot/coordinator identities for publish requests.
export function actionMetadata(action) {
  return publicationAction(action) === 'unpublish' ? { action: 'unpublish' } : {};
}
export function publicationContent({ action = 'publish', saved, original }) {
  publicationAction(action);
  if (action === 'unpublish' && !original) throw Object.assign(new Error('This page has not been published.'), { status: 409 });
  return patchFrontmatter(action === 'unpublish' ? original : saved, { draft: action === 'unpublish' });
}

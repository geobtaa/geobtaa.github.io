import { SafeLink } from './MdxMarkdown.ts';
import { isSafeComponentHref } from './componentLinkSafety.ts';

export const previewLinkAttributes = { target: '_blank', rel: 'noopener noreferrer' };

export function previewComponentLink(href: string) {
  return { ...previewLinkAttributes, href: href.trim() && isSafeComponentHref(href) ? href : undefined };
}

// Force the policy after rendering so stored target/rel attributes cannot send
// a read-only preview link back into the editor tab. Keep SafeLink's URI checks.
export const PreviewLink = SafeLink.extend({
  renderHTML(props) {
    const rendered = this.parent!(props) as [string, Record<string, unknown>, number];
    return [rendered[0], { ...rendered[1], ...previewLinkAttributes }, rendered[2]];
  },
});

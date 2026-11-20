import { SafeLink } from './MdxMarkdown.ts';
import { isSafeComponentHref } from './componentLinkSafety.ts';

export const previewLinkAttributes = { target: '_blank', rel: 'noopener noreferrer' };

// Only the CMS-only build sets this origin. Preserve source hrefs and the public build.
export function previewHref(href: string, site = import.meta.env?.PUBLIC_PROJECT_EDITOR_SITE_URL) {
  const value = href.trim();
  return site && /^\/(?![/\\])/.test(value) && !/[\u0000-\u001f\u007f]/.test(value)
    ? new URL(value, site).href
    : href;
}

export function previewComponentLink(href: string) {
  return { ...previewLinkAttributes, href: href.trim() && isSafeComponentHref(href) ? previewHref(href) : undefined };
}

// Force the policy after rendering so stored target/rel attributes cannot send
// a read-only preview link back into the editor tab. Keep SafeLink's URI checks.
export const PreviewLink = SafeLink.extend({
  renderHTML(props) {
    const rendered = this.parent!(props) as [string, Record<string, unknown>, number];
    const href = rendered[1].href;
    return [rendered[0], { ...rendered[1], ...previewLinkAttributes,
      ...(typeof href === 'string' ? { href: previewHref(href) } : {}),
    }, rendered[2]];
  },
});

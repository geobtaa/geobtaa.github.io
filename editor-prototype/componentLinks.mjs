import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { parseLinkCardMdx } from '../src/components/editor-prototype/linkCardMdx.ts';
import { parseLinkButtonMdx } from '../src/components/editor-prototype/linkButtonMdx.ts';
import { COMPONENT_LINK_ERROR, isSafeComponentHref } from '../src/components/editor-prototype/componentLinkSafety.ts';

export function validateComponentLinks(body) {
  for (const segment of splitBody(body)) {
    if (segment.kind !== 'structured') continue;
    const link = parseLinkCardMdx(segment.content) || parseLinkButtonMdx(segment.content);
    if (link && !isSafeComponentHref(link.href)) throw Object.assign(new Error(COMPONENT_LINK_ERROR), { status: 400 });
  }
}

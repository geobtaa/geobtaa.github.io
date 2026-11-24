import { BulletList, OrderedList } from '@tiptap/extension-list';
import { parseBodySyntax } from './contentSyntax.ts';

// The legacy component renders Markdown directly. Keep loose-list spacing
// through visual edits instead of silently dropping its paragraph wrappers.
export const LegacyCardLists = [BulletList, OrderedList].map(extension => extension.extend({
  addAttributes() { return { ...this.parent?.(), legacyLoose: { default: false, rendered: false } }; },
  parseMarkdown(token, helpers) {
    const parsed = extension.config.parseMarkdown?.call(this, token, helpers);
    if (!parsed || Array.isArray(parsed)) return parsed || [];
    let loose = !!token.loose;
    // Tiptap's ordered-list tokenizer omits the loose flag on its tokens.
    try { loose ||= parseBodySyntax(String(token.raw || ''), 'md').children.some(node => node.type === 'list' && node.spread); } catch { /* Keep the tokenizer's flag. */ }
    return { ...parsed, attrs: { ...parsed.attrs, legacyLoose: loose } };
  },
  renderMarkdown(node, helpers) { return node.content ? helpers.renderChildren(node.content, node.attrs?.legacyLoose ? '\n\n' : '\n') : ''; },
}));

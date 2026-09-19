import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { mergeAttributes, type Editor, type EditorOptions } from '@tiptap/core';

export function repositoryImage(previewBase = '') {
  return Image.extend({
    renderHTML({ HTMLAttributes }) {
      const source = String(HTMLAttributes.src || '');
      const match = source.match(/^@images\/(.+)$/);
      const src = match ? `${previewBase}/api/images/file/${match[1].split('/').map(encodeURIComponent).join('/')}` : source;
      return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src })];
    },
  });
}

export function richTextEditorOptions(initialContent: string, onChange: (markdown: string) => void, previewBase = ''): Partial<EditorOptions> {
  return {
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TableKit,
      repositoryImage(previewBase),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initialContent,
    contentType: 'markdown',
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getMarkdown()),
  };
}

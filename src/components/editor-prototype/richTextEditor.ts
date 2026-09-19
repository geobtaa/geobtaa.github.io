import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import type { Editor, EditorOptions } from '@tiptap/core';

export function richTextEditorOptions(initialContent: string, onChange: (markdown: string) => void): Partial<EditorOptions> {
  return {
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TableKit,
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initialContent,
    contentType: 'markdown',
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getMarkdown()),
  };
}

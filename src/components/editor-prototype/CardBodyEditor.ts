import { createElement as h, useEffect, useRef } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { normalizeLinkAddress } from './linkAddress.ts';
import { ToolbarButton } from './ToolbarButton.ts';
import type { ToolbarAction } from './toolbarIcons.ts';

export function CardBodyEditor({ body, label, onChange, readOnly = false }: { body: string; label: string; onChange: (body: string) => void; readOnly?: boolean }) {
  const lastBody = useRef(body);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false }, underline: false }), Markdown.configure({ markedOptions: { gfm: true } })],
    content: body, contentType: 'markdown', immediatelyRender: false, editable: !readOnly,
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => { const value = editor.getMarkdown(); lastBody.current = value; onChange(value); },
  });
  const active = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'), bulletList: editor?.isActive('bulletList'), orderedList: editor?.isActive('orderedList'),
    canUndo: editor?.can().undo(), canRedo: editor?.can().redo(),
  }) });
  useEffect(() => {
    if (!editor || body === lastBody.current) return;
    lastBody.current = body;
    if (editor.getMarkdown() !== body) editor.commands.setContent(body, { contentType: 'markdown', emitUpdate: false });
  }, [body, editor]);
  if (!editor) return null;
  const link = () => {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('Link URL (example.com or /path/)', previous);
    if (href === null) return;
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href === previous ? href : normalizeLinkAddress(href) }).run();
  };
  const button = (text: ToolbarAction, action: () => unknown, pressed?: boolean, disabled = false) => h(ToolbarButton, { key: text, action: text, onClick: action, 'aria-pressed': pressed, disabled });
  return h('div', { className: 'rich-editor card-body' },
    !readOnly && h('div', { className: 'toolbar', role: 'toolbar', 'aria-label': `${label} formatting`, onMouseDown: (event) => event.preventDefault() },
      button('Undo', () => editor.chain().focus().undo().run(), undefined, !active?.canUndo),
      button('Redo', () => editor.chain().focus().redo().run(), undefined, !active?.canRedo),
      button('Bold', () => editor.chain().focus().toggleBold().run(), active?.bold),
      button('Italic', () => editor.chain().focus().toggleItalic().run(), active?.italic),
      button('Link', link),
      button('Bullets', () => editor.chain().focus().toggleBulletList().run(), active?.bulletList),
      button('Numbered', () => editor.chain().focus().toggleOrderedList().run(), active?.orderedList),
    ),
    h(EditorContent, { editor }),
  );
}

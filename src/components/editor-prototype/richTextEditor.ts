import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { mergeAttributes, type Editor, type EditorOptions } from '@tiptap/core';
import { SimpleComponentBlocks } from './SimpleComponentBlock.ts';
import { LinkButtonBlock } from './LinkButtonBlock.ts';
import { LinkCardBlock } from './LinkCardBlock.ts';

type EditImage = (position: number, image: { src: string; alt: string; title: string }) => void;

export function repositoryImage(previewBase = '', onEditImage?: EditImage) {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        originalMarkdown: { default: null, rendered: false },
        originalFields: { default: null, rendered: false },
      };
    },
    parseMarkdown(token, helpers) {
      const fields = { src: token.href, alt: token.text, title: token.title };
      return helpers.createNode('image', { ...fields, originalMarkdown: token.raw, originalFields: fields });
    },
    renderMarkdown(node) {
      const { src = '', alt = '', title = '', originalMarkdown, originalFields } = node.attrs || {};
      if (originalMarkdown && originalFields && ['src', 'alt', 'title'].every((key) => (node.attrs?.[key] || '') === (originalFields[key] || ''))) return originalMarkdown;
      const escapedAlt = String(alt).replace(/[\\\[\]]/g, '\\$&');
      const escapedTitle = String(title || '').replace(/[\\"]/g, '\\$&');
      const destination = /[\s()]/.test(src) ? `<${String(src).replace(/</g, '%3C').replace(/>/g, '%3E')}>` : src;
      return `![${escapedAlt}](${destination}${escapedTitle ? ` "${escapedTitle}"` : ''})`;
    },
    renderHTML({ HTMLAttributes }) {
      const source = String(HTMLAttributes.src || '');
      const src = imagePreviewUrl(source, previewBase);
      return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src })];
    },
    // A display-only node view: storage and clipboard markup remain ordinary images.
    addNodeView() {
      return ({ node, getPos, editor }) => {
        const figure = document.createElement('figure');
        figure.className = 'editor-image';
        figure.contentEditable = 'false';
        const image = document.createElement('img');
        const caption = document.createElement('figcaption');
        figure.append(image, caption);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'image-edit-action';
        edit.textContent = 'Edit image';
        edit.addEventListener('mousedown', (event) => event.preventDefault());
        edit.addEventListener('click', () => {
          const position = getPos();
          if (position === undefined) return;
          const current = editor.state.doc.nodeAt(position);
          if (!current) return;
          onEditImage?.(position, { src: current.attrs.src || '', alt: current.attrs.alt || '', title: current.attrs.title || '' });
        });
        if (onEditImage) figure.append(edit);
        const render = (attrs: typeof node.attrs) => {
          image.setAttribute('src', imagePreviewUrl(String(attrs.src || ''), previewBase));
          image.setAttribute('alt', String(attrs.alt || ''));
          if (attrs.title) image.setAttribute('title', attrs.title);
          else image.removeAttribute('title');
          caption.textContent = attrs.title || '';
          caption.hidden = !attrs.title;
        };
        render(node.attrs);
        return {
          dom: figure,
          stopEvent: (event) => edit.contains(event.target as globalThis.Node),
          update(updated) {
            if (updated.type !== node.type) return false;
            render(updated.attrs);
            return true;
          },
        };
      };
    },
  });
}

export function imagePreviewUrl(source: string, previewBase = ''): string {
  const match = source.match(/^(?:@images\/|\/?src\/assets\/images\/|(?:\.\.\/)+assets\/images\/)(.+)$/);
  if (!match) return source;
  const path = match[1].split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${previewBase}/api/images/file/${path}`;
}

export function richTextEditorOptions(initialContent: string, onChange: (markdown: string) => void, previewBase = '', onEditImage?: EditImage): Partial<EditorOptions> {
  return {
    extensions: [
      StarterKit.configure({ link: { openOnClick: false }, trailingNode: { notAfter: ['linkCardBlock', 'linkButtonBlock', ...SimpleComponentBlocks.map((block) => block.name)] } }),
      TableKit,
      repositoryImage(previewBase, onEditImage),
      LinkCardBlock,
      LinkButtonBlock,
      ...SimpleComponentBlocks,
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: initialContent,
    contentType: 'markdown',
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getMarkdown()),
  };
}

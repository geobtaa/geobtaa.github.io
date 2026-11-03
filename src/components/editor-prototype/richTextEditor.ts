import { formatImage, matchFormattedImage } from './formattedImage.ts';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { mergeAttributes, ResizableNodeView, type Editor, type EditorOptions } from '@tiptap/core';
import { SimpleComponentBlocks } from './SimpleComponentBlock.ts';
import { LinkButtonBlock } from './LinkButtonBlock.ts';
import { LinkCardBlock } from './LinkCardBlock.ts';

type EditImage = (position: number, image: { src: string; alt: string; title: string }) => void;

export function repositoryImage(previewBase = '', onEditImage?: EditImage) {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        align: { default: null, rendered: false },
        originalFormatted: { default: null, rendered: false },
        originalMarkdown: { default: null, rendered: false },
        originalFields: { default: null, rendered: false },
      };
    },
    parseMarkdown(token, helpers) {
      const fields = { src: token.href, alt: token.text, title: token.title };
      if (token.formatted) return helpers.createNode('image', { ...fields, ...token.formatted, originalFormatted: token.raw, originalMarkdown: token.imageMarkdown, originalFields: { ...fields, ...token.formatted } });
      return helpers.createNode('image', { ...fields, originalMarkdown: token.raw, originalFields: fields });
    },
    markdownTokenizer: {
      name: 'image', level: 'block',
      start(source) { return source.indexOf('<figure data-cms-image="true"'); },
      tokenize(source, _tokens, lexer) {
        const formatted = matchFormattedImage(source);
        if (!formatted) return;
        const tokens = lexer.inlineTokens(formatted.markdown);
        if (tokens.length !== 1 || tokens[0].type !== 'image' || tokens[0].raw !== formatted.markdown) return;
        return { ...tokens[0], type: 'image', raw: formatted.raw, imageMarkdown: formatted.markdown, formatted: { align: formatted.align, width: formatted.width } };
      },
    },
    renderMarkdown(node) {
      const { src = '', alt = '', title = '', align, width, originalFormatted, originalMarkdown, originalFields } = node.attrs || {};
      const unchanged = originalFields && ['src', 'alt', 'title'].every((key) => (node.attrs?.[key] || '') === (originalFields[key] || ''));
      if (unchanged && originalFormatted && align === originalFields.align && width === originalFields.width) return originalFormatted;
      const escapedAlt = String(alt).replace(/[\\\[\]]/g, '\\$&');
      const escapedTitle = String(title || '').replace(/[\\"]/g, '\\$&');
      const destination = /[\s()]/.test(src) ? `<${String(src).replace(/</g, '%3C').replace(/>/g, '%3E')}>` : src;
      const canonical = `![${escapedAlt}](${destination}${escapedTitle ? ` "${escapedTitle}"` : ''})`;
      const markdown = unchanged && originalMarkdown ? originalMarkdown : canonical;
      const formatted = formatImage(markdown, align, width);
      // Reference-style and parenthesized destinations need inline syntax inside our narrow wrapper.
      return (align || width) && !matchFormattedImage(formatted) ? formatImage(canonical, align, width) : formatted;
    },
    renderHTML({ HTMLAttributes }) {
      const source = String(HTMLAttributes.src || '');
      const src = imagePreviewUrl(source, previewBase);
      return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src })];
    },
    // Reuse the existing caption/edit controls and Tiptap’s aspect-ratio-preserving resize view.
    addNodeView() {
      return ({ node, getPos, editor }) => {
        const figure = document.createElement('figure');
        figure.className = 'editor-image';
        figure.contentEditable = 'false';
        const image = document.createElement('img');
        const caption = document.createElement('figcaption');
        const controls = document.createElement('div');
        controls.className = 'image-format-controls';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Image formatting');
        const commit = (attrs: Record<string, unknown>) => {
          const pos = getPos();
          if (pos !== undefined) editor.chain().setNodeSelection(pos).updateAttributes('image', attrs).run();
        };
        for (const align of ['left', 'center', 'right']) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = align[0].toUpperCase() + align.slice(1);
          button.dataset.align = align;
          button.addEventListener('click', () => commit({ align }));
          controls.append(button);
        }
        const widthLabel = document.createElement('label');
        widthLabel.textContent = 'Width (px)';
        const widthInput = document.createElement('input');
        widthInput.type = 'number'; widthInput.min = '50'; widthInput.max = '10000'; widthInput.step = '1';
        widthInput.addEventListener('change', () => {
          if (widthInput.value && widthInput.checkValidity()) commit({ width: Number(widthInput.value), height: null, align: figure.dataset.align || 'center' });
        });
        widthLabel.append(widthInput); controls.append(widthLabel);
        const reset = document.createElement('button');
        reset.type = 'button'; reset.textContent = 'Reset formatting';
        reset.addEventListener('click', () => commit({ align: null, width: null, height: null }));
        controls.append(reset);
        controls.addEventListener('mousedown', event => { if ((event.target as HTMLElement).tagName === 'BUTTON') event.preventDefault(); });
        const resizeView = new ResizableNodeView({
          element: image, editor, node, getPos,
          options: { directions: ['bottom-right'], min: { width: 50, height: 1 }, preserveAspectRatio: true, className: { handle: 'image-resize-handle' } },
          onResize: (width) => { figure.style.width = `${Math.round(width)}px`; image.style.height = 'auto'; },
          onCommit: (width) => commit({ width: Math.min(10000, Math.max(50, Math.round(width))), height: null, align: figure.dataset.align || 'center' }),
          onUpdate: updated => { render(updated.attrs); return true; },
        });
        figure.append(resizeView.dom, caption, controls);
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
        let currentAttrs = node.attrs;
        const render = (attrs: typeof node.attrs) => {
          currentAttrs = attrs;
          const src = imagePreviewUrl(String(attrs.src || ''), previewBase);
          if (image.getAttribute('src') !== src) image.setAttribute('src', src);
          figure.dataset.align = attrs.align || '';
          figure.dataset.formatted = String(!!(attrs.align || attrs.width));
          const displayWidth = attrs.width || (attrs.align ? image.naturalWidth : 0);
          figure.style.width = displayWidth ? `${displayWidth}px` : '';
          image.style.width = ''; image.style.height = 'auto';
          widthInput.value = attrs.width ? String(attrs.width) : '';
          controls.querySelectorAll<HTMLButtonElement>('[data-align]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.align === (attrs.align || 'center'))));
          image.setAttribute('alt', String(attrs.alt || ''));
          if (attrs.title) image.setAttribute('title', attrs.title);
          else image.removeAttribute('title');
          caption.textContent = attrs.title || '';
          caption.hidden = !attrs.title;
        };
        image.addEventListener('load', () => render(currentAttrs));
        render(node.attrs);
        return {
          dom: figure,
          stopEvent: (event) => controls.contains(event.target as globalThis.Node) || edit.contains(event.target as globalThis.Node) || (event.target as HTMLElement).classList?.contains('image-resize-handle'),
          ignoreMutation: () => true,
          destroy: () => resizeView.destroy(),
          update(updated, decorations, innerDecorations) {
            if (updated.type !== node.type) return false;
            return resizeView.update(updated, decorations, innerDecorations);
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

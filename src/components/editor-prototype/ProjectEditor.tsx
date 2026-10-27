import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SimpleComponentFields } from './SimpleComponentBlock';
import { SIMPLE_COMPONENTS, SIMPLE_KINDS, createSimpleComponentMdx, emptySimpleFields, ensureSimpleComponentImport, simpleKindForNode, type SimpleKind } from './simpleComponents';
import { LinkAddressField } from './LinkAddressField';
import { normalizeLinkAddress } from './linkAddress';
import { splitBody, visibleBodySegments, moveBodySegment } from './bodySegments';
import { richTextEditorOptions } from './richTextEditor';
import { createLinkCardMdx, ensureLinkCardImport } from './linkCardMdx';
import { createLinkButtonMdx, ensureLinkButtonImport, type LinkButtonFields } from './linkButtonMdx';
import { todayCalendar } from '../../../editor-prototype/blog.mjs';
import { CONTENT_AREAS } from '../../../editor-prototype/contentAreas.mjs';

const API = import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const CONFLICT = 'This page has changed in GitHub since you opened it. Reload the latest version before saving.';

type ProjectListItem = { name: string; path: string; sha: string; draft?: boolean; sidebarHidden?: boolean; visibilityKnown?: boolean };
type ImageListItem = { name: string; path: string; sha: string; size?: number };
type AreaName = keyof typeof CONTENT_AREAS;
type PageMetadata = {
  year?: number | string | null;
  committee?: string | null;
  lead?: string | null;
  members?: string[] | null;
  dates_active?: string | null;
  template?: string | null;
  hidePageTitle?: boolean | null;
  pagefind?: boolean | null;
  tableOfContents?: boolean | { minHeadingLevel?: number; maxHeadingLevel?: number; [key: string]: unknown } | null;
  sidebar?: { label?: string; order?: number; hidden?: boolean; [key: string]: unknown } | null;
  banner?: { content: string; [key: string]: unknown } | null;
  head?: { tag: string; attrs?: Record<string, string | number | boolean>; [key: string]: unknown }[] | null;
};
type Project = {
  filename: string;
  sha?: string;
  content: string;
  title: string;
  description: string;
  draft: boolean;
  sidebarHidden?: boolean;
  body: string;
  branch?: string;
  metadata?: PageMetadata;
  frontmatterFields?: string[];
  date?: string;
  excerpt?: string;
  authors?: (string | { name: string; [key: string]: unknown })[];
  tags?: string[];
  cover?: { image?: string; light?: string; dark?: string; alt: string; caption?: string; [key: string]: unknown } | null;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status}).`), { suggestedFilename: data.suggestedFilename });
  return data;
}


function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type ImageFields = { src: string; alt: string; title?: string | null };

function RepositoryImagePicker({ initialImage, showCaption = true, onSelect, onClose }: { initialImage?: ImageFields; showCaption?: boolean; onSelect: (src: string, alt: string, title: string) => void; onClose: () => void }) {
  const [images, setImages] = useState<ImageListItem[]>([]);
  const [imageQuery, setImageQuery] = useState('');
  const [imagePage, setImagePage] = useState(0);
  const [imageSource, setImageSource] = useState(initialImage?.src || '');
  const [imageAlt, setImageAlt] = useState(initialImage?.alt || '');
  const [imageCaption, setImageCaption] = useState(initialImage?.title || '');
  const [decorative, setDecorative] = useState(initialImage ? !initialImage.alt : false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const imageUrl = (path: string) => `${API}/api/images/file/${path.split('/').map(encodeURIComponent).join('/')}`;
  const openImagePicker = async () => {
    setImageError('');
    if (images.length) return;
    setImageBusy(true);
    try {
      const data = await api<{ images: ImageListItem[] }>('/api/images');
      setImages(data.images.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) { setImageError((err as Error).message); }
    finally { setImageBusy(false); }
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    setImageBusy(true); setImageError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const uploaded = await api<ImageListItem & { commitSha: string }>('/api/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, content: dataUrl.slice(dataUrl.indexOf(',') + 1) }),
      });
      setImages((current) => [...current.filter((image) => image.name !== uploaded.path), { ...uploaded, name: uploaded.path }].sort((a, b) => a.name.localeCompare(b.name)));
      setImageSource(`@images/${uploaded.path}`); setImageQuery(uploaded.path);
    } catch (err) { setImageError((err as Error).message); }
    finally { setImageBusy(false); }
  };
  const insertImage = () => {
    if (!imageSource.trim()) return setImageError('Select, upload, or enter an image source.');
    if (!decorative && !imageAlt.trim()) return setImageError('Enter alt text, or mark the image as decorative.');
    onSelect(imageSource, decorative ? '' : imageAlt, imageCaption);
    onClose();
  };
  useEffect(() => { void openImagePicker(); }, []);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const visibleImages = images.filter((image) => image.name.toLowerCase().includes(imageQuery.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(visibleImages.length / 6));
  const currentPage = Math.min(imagePage, pageCount - 1);
  const pageImages = visibleImages.slice(currentPage * 6, (currentPage + 1) * 6);
  useEffect(() => { setImagePage(0); }, [imageQuery]);
  return (
      <div ref={dialogRef} className="image-picker" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
          const first = items[0]; const last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }} role="dialog" aria-modal="true" aria-labelledby="image-picker-title">
        <div className="image-picker-header"><h3 id="image-picker-title">{initialImage ? 'Edit image' : 'Insert repository image'}</h3><button type="button" onClick={() => onClose()} aria-label="Close image picker">×</button></div>
        <div className="image-picker-body">
          <section className="image-picker-fields" aria-label="Image details">
            <label>Image source<input value={imageSource} onChange={(event) => setImageSource(event.target.value)} placeholder="@images/example.png or https://…" /></label>
            {showCaption && <label>Caption (optional)<input value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} /></label>}
            <label>Alt text<input value={imageAlt} disabled={decorative} onChange={(event) => setImageAlt(event.target.value)} /></label>
            <label className="checkbox"><input type="checkbox" checked={decorative} onChange={(event) => setDecorative(event.target.checked)} /> This image is decorative</label>
          </section>
          <section className="image-picker-library" aria-label="Choose image">
            <label>Upload a new image <span>PNG, JPEG, GIF, or WebP; maximum 5 MB</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={imageBusy} onChange={(event) => void uploadImage(event.target.files?.[0])} /></label>
            <label>Find an existing image<input type="search" value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} placeholder="Filter by filename" /></label>
            {imageBusy && <p>Loading images…</p>}
            {!imageBusy && <div className="image-grid">{pageImages.map((image) => <button type="button" className={imageSource === `@images/${image.name}` ? 'selected' : ''} key={image.path} onClick={() => setImageSource(`@images/${image.name}`)}><img loading="lazy" src={imageUrl(image.name)} alt="" /><span>{image.name}</span></button>)}</div>}
            {!imageBusy && !visibleImages.length && <p>No matching images.</p>}
            {!imageBusy && pageCount > 1 && <nav className="image-pagination" aria-label="Image library pages">
              <button type="button" disabled={currentPage === 0} onClick={() => setImagePage(currentPage - 1)}>Previous</button>
              <span aria-live="polite">Page {currentPage + 1} of {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount - 1} onClick={() => setImagePage(currentPage + 1)}>Next</button>
            </nav>}
          </section>
        </div>
        {imageError && <p className="message error" role="alert">{imageError}</p>}
        <div className="actions image-picker-actions"><button type="button" onClick={() => onClose()}>Cancel</button><button className="primary" type="button" disabled={imageBusy} onClick={insertImage}>{initialImage ? 'Apply Changes' : 'Insert image'}</button></div>
      </div>
  );
}

type InsertedComponent = 'LinkCard' | 'LinkButton' | SimpleKind;

function BlockInserter({ onInsert, onAddText }: { onInsert: (component: InsertedComponent, raw: string) => string | undefined; onAddText: () => void }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Dismiss outside presses directly: Safari can blur a menu button with a
    // null relatedTarget before firing its click, even for an inside press.
    const dismissOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as globalThis.Node)) menu.open = false;
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, []);
  const [simpleDialog, setSimpleDialog] = useState<SimpleKind | null>(null);
  const [simpleFields, setSimpleFields] = useState(emptySimpleFields);
  const [simpleError, setSimpleError] = useState('');
  const [linkButtonDialog, setLinkButtonDialog] = useState(false);
  const [linkButtonFields, setLinkButtonFields] = useState<LinkButtonFields>({ text: '', href: '', variant: 'primary' });
  const [linkButtonError, setLinkButtonError] = useState('');
  const [linkCardDialog, setLinkCardDialog] = useState(false);
  const [linkCardTitle, setLinkCardTitle] = useState('');
  const [linkCardDescription, setLinkCardDescription] = useState('');
  const [linkCardHref, setLinkCardHref] = useState('');
  const [linkCardError, setLinkCardError] = useState('');

  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const restoreFocus = () => menuRef.current?.querySelector('summary')?.focus({ preventScroll: true });
  const closeSimple = () => { setSimpleDialog(null); restoreFocus(); };
  const closeButton = () => { setLinkButtonDialog(false); restoreFocus(); };
  const closeCard = () => { setLinkCardDialog(false); restoreFocus(); };
  const insertSimpleComponent = () => {
    if (!simpleDialog) return;
    if (!simpleFields.text.trim() || (simpleDialog === 'card' && !simpleFields.title.trim())) return setSimpleError(simpleDialog === 'card' ? 'Enter a title and message.' : simpleDialog === 'badge' ? 'Enter badge text.' : 'Enter a message.');
    const error = onInsert(simpleDialog, createSimpleComponentMdx(simpleDialog, simpleFields));
    if (error) return setSimpleError(error);
    setSimpleDialog(null); setSimpleFields(emptySimpleFields()); setSimpleError('');
  };
  const insertLinkButton = () => {
    const fields = { ...linkButtonFields, text: linkButtonFields.text.trim(), href: normalizeLinkAddress(linkButtonFields.href) };
    if (!fields.text || !fields.href) return setLinkButtonError('Enter button text and a URL.');
    const error = onInsert('LinkButton', createLinkButtonMdx(fields));
    if (error) return setLinkButtonError(error);
    setLinkButtonDialog(false); setLinkButtonFields({ text: '', href: '', variant: 'primary' }); setLinkButtonError('');
  };
  const insertLinkCard = () => {
    const fields = { title: linkCardTitle.trim(), description: linkCardDescription.trim(), href: normalizeLinkAddress(linkCardHref) };
    if (!fields.title || !fields.href) return setLinkCardError('Enter a title and URL.');
    const error = onInsert('LinkCard', createLinkCardMdx(fields));
    if (error) return setLinkCardError(error);
    setLinkCardDialog(false); setLinkCardTitle(''); setLinkCardDescription(''); setLinkCardHref(''); setLinkCardError('');
  };
  return <aside className="block-inserter" aria-label="Add a new block after this block">
    <details ref={menuRef} name="add-content-block" className="block-inserter-menu" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); restoreFocus(); }
    }} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as globalThis.Node)) closeMenu(); }}>
      <summary>＋ Add block</summary>
      <div className="block-menu-list">
        <button type="button" onClick={() => { closeMenu(); onAddText(); }}>Text</button>
        <button type="button" onClick={() => { closeMenu(); setLinkCardDialog(true); setLinkCardError(''); }}>Link Card</button>
        <button type="button" onClick={() => { closeMenu(); setLinkButtonDialog(true); setLinkButtonError(''); }}>Link Button</button>
        {SIMPLE_KINDS.map((kind) => <button key={kind} type="button" onClick={() => { closeMenu(); setSimpleDialog(kind); setSimpleFields(emptySimpleFields()); setSimpleError(''); }}>{SIMPLE_COMPONENTS[kind].label}</button>)}
      </div>
    </details>
      {simpleDialog && <div className="link-card-dialog simple-component-dialog" role="dialog" aria-modal="true" aria-labelledby="simple-component-dialog-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeSimple(); }
        if (event.key === 'Tab') {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea'));
          if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
        }
      }}>
        <div className="dialog-header"><h3 id="simple-component-dialog-title">Insert {SIMPLE_COMPONENTS[simpleDialog].label}</h3><button type="button" onClick={closeSimple} aria-label="Close component dialog">×</button></div>
        <SimpleComponentFields autoFocus kind={simpleDialog} fields={simpleFields} onChange={(key, value) => setSimpleFields((current) => ({ ...current, [key]: value }))} />
        {simpleError && <p className="message error" role="alert">{simpleError}</p>}
        <div className="actions"><button type="button" onClick={closeSimple}>Cancel</button><button className="primary" type="button" onClick={insertSimpleComponent}>Insert {SIMPLE_COMPONENTS[simpleDialog].label}</button></div>
      </div>}
      {linkButtonDialog && <div className="link-card-dialog" role="dialog" aria-modal="true" aria-labelledby="link-button-dialog-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeButton(); }
        if (event.key === 'Tab') {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select'));
          if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
        }
      }}>
        <div className="dialog-header"><h3 id="link-button-dialog-title">Insert Link Button</h3><button type="button" onClick={closeButton} aria-label="Close Link Button dialog">×</button></div>
        <label>Button text<input autoFocus required value={linkButtonFields.text} onChange={(event) => setLinkButtonFields({ ...linkButtonFields, text: event.target.value })} /></label>
        <LinkAddressField required value={linkButtonFields.href} onChange={(href) => setLinkButtonFields((current) => ({ ...current, href }))} />
        <label>Appearance<select value={linkButtonFields.variant} onChange={(event) => setLinkButtonFields({ ...linkButtonFields, variant: event.target.value as LinkButtonFields['variant'] })}>
          <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="minimal">Minimal</option>
        </select></label>
        {linkButtonError && <p className="message error" role="alert">{linkButtonError}</p>}
        <div className="actions"><button type="button" onClick={closeButton}>Cancel</button><button className="primary" type="button" onClick={insertLinkButton}>Insert Link Button</button></div>
      </div>}
      {linkCardDialog && <div className="link-card-dialog" role="dialog" aria-modal="true" aria-labelledby="link-card-dialog-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeCard(); }
        if (event.key === 'Tab') {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, textarea'));
          if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
        }
      }}>
        <div className="dialog-header"><h3 id="link-card-dialog-title">Insert Link Card</h3><button type="button" onClick={closeCard} aria-label="Close Link Card dialog">×</button></div>
        <label>Title<input autoFocus required value={linkCardTitle} onChange={(event) => setLinkCardTitle(event.target.value)} /></label>
        <label>Description <span>(optional)</span><textarea rows={3} value={linkCardDescription} onChange={(event) => setLinkCardDescription(event.target.value)} /></label>
        <LinkAddressField required value={linkCardHref} onChange={setLinkCardHref} />
        {linkCardError && <p className="message error" role="alert">{linkCardError}</p>}
        <div className="actions"><button type="button" onClick={closeCard}>Cancel</button><button className="primary" type="button" onClick={insertLinkCard}>Insert Link Card</button></div>
      </div>}
  </aside>;
}

function RichTextEditor({ initialValue, onChange, structured = false, onRemove }: { onRemove?: () => void; structured?: boolean; initialValue: string; onChange: (value: string) => void }) {
  const [imagePicker, setImagePicker] = useState<{ image?: ImageFields; position?: number } | null>(null);
  const editor = useEditor({ ...richTextEditorOptions(initialValue, onChange, API, (position, image) => setImagePicker({ position, image })), editable: !structured, immediatelyRender: false });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => {
      const headingLevel = ([1, 2, 3, 4, 5, 6] as const).find((level) => editor?.isActive('heading', { level }));
      return {
        textStyle: headingLevel ? `heading-${headingLevel}` : 'paragraph',
        bold: editor?.isActive('bold') ?? false,
        italic: editor?.isActive('italic') ?? false,
        underline: editor?.isActive('underline') ?? false,
        strike: editor?.isActive('strike') ?? false,
        code: editor?.isActive('code') ?? false,
        link: editor?.isActive('link') ?? false,
        blockquote: editor?.isActive('blockquote') ?? false,
        codeBlock: editor?.isActive('codeBlock') ?? false,
        bulletList: editor?.isActive('bulletList') ?? false,
        orderedList: editor?.isActive('orderedList') ?? false,
        table: editor?.isActive('table') ?? false,
        canUndo: editor?.can().undo() ?? false,
        canRedo: editor?.can().redo() ?? false,
      };
    },
  });

  if (!editor) return null;
  const simpleKind = simpleKindForNode(editor.state.doc.firstChild?.type.name || '');
  const link = () => {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('Link URL (example.com or /path/)', previous);
    if (href === null) return;
    if (!href) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href === previous ? href : normalizeLinkAddress(href) }).run();
  };
  const setTextStyle = (value: string) => {
    if (value === 'paragraph') return editor.chain().focus().setParagraph().run();
    const level = Number(value.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6;
    return editor.chain().focus().setHeading({ level }).run();
  };

  return (
    <div className={structured ? 'component-editor' : 'rich-editor'}>
      {!structured && <div className="toolbar" role="toolbar" aria-label="Rich text formatting">
        <span className="toolbar-label">In this block</span>
        <button type="button" disabled={!active?.canUndo} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" disabled={!active?.canRedo} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
        <span className="toolbar-separator" aria-hidden="true" />
        <select aria-label="Text style" value={active?.textStyle || 'paragraph'} onChange={(event) => setTextStyle(event.target.value)}>
          <option value="paragraph">Paragraph</option>
          <option value="heading-1">Heading 1</option>
          <option value="heading-2">Heading 2</option>
          <option value="heading-3">Heading 3</option>
          <option value="heading-4">Heading 4</option>
          <option value="heading-5">Heading 5</option>
          <option value="heading-6">Heading 6</option>
        </select>
        <button type="button" aria-pressed={active?.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>Bold</strong></button>
        <button type="button" aria-pressed={active?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>Italic</em></button>
        <button type="button" aria-pressed={active?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>Underline</u></button>
        <button type="button" aria-pressed={active?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><s>Strike</s></button>
        <button type="button" aria-pressed={active?.code} onClick={() => editor.chain().focus().toggleCode().run()}><code>Code</code></button>
        <button type="button" aria-pressed={active?.link} onClick={link}>Link</button>
        <button type="button" aria-pressed={active?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" aria-pressed={active?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>Numbered</button>
        <button type="button" aria-pressed={active?.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button type="button" aria-pressed={active?.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code block</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>Divider</button>
        <button type="button" onClick={() => editor.chain().focus().setHardBreak().run()}>Line break</button>
        <button type="button" onClick={() => setImagePicker({})}>Image</button>
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</button>
        {active?.table && <>
          <span className="toolbar-separator" aria-hidden="true" />
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </>}
      </div>}
      <EditorContent editor={editor} />
      {structured && <button type="button" className="link-button component-remove" onClick={onRemove}>Remove {simpleKind ? SIMPLE_COMPONENTS[simpleKind].label : editor.state.doc.firstChild?.type.name === 'linkButtonBlock' ? 'Link Button' : 'Link Card'}</button>}
      {imagePicker && <RepositoryImagePicker initialImage={imagePicker.image} onClose={() => setImagePicker(null)} onSelect={(src, alt, title) => {
        if (imagePicker.position !== undefined) editor.chain().focus().setNodeSelection(imagePicker.position).updateAttributes('image', { src, alt, title }).run();
        else editor.chain().focus().insertContentAt(editor.state.selection.to, { type: 'image', attrs: { src, alt, title } }).run();
      }} />}

    </div>
  );
}

function BodyEditor({ initialValue, onChange }: { initialValue: string; onChange: (value: string) => void }) {
  const [segments, setSegments] = useState(() => splitBody(initialValue));
  const [segmentSession, setSegmentSession] = useState(0);
  const [emptyEditorId, setEmptyEditorId] = useState<number | null>(initialValue.trim() ? null : 0);
  const segmentsRef = useRef(segments);
  const blockRows = useRef(new Map<number, HTMLDivElement>());
  const pendingMove = useRef<{ id: number; direction: -1 | 1 } | null>(null);
  const [moveNotice, setMoveNotice] = useState('');
  useEffect(() => {
    const moved = pendingMove.current;
    if (!moved) return;
    const row = blockRows.current.get(moved.id);
    const button = row?.querySelector<HTMLButtonElement>(`[data-move="${moved.direction}"]`);
    (button && !button.disabled ? button : row)?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
    pendingMove.current = null;
  }, [segments]);
  const move = (id: number, direction: -1 | 1) => {
    const next = moveBodySegment(segmentsRef.current, id, direction, emptyEditorId);
    if (next === segmentsRef.current) return;
    pendingMove.current = { id, direction };
    segmentsRef.current = next; setSegments(next);
    onChange(next.map((segment) => segment.content).join(''));
    const visible = visibleBodySegments(next, emptyEditorId);
    setMoveNotice(`Block moved ${direction === -1 ? 'up' : 'down'} to position ${visible.findIndex((segment) => segment.id === id) + 1} of ${visible.length}.`);
  };
  const update = (id: number, content: string) => {
    const current = segmentsRef.current;
    if (!content.trim() && current.find((segment) => segment.id === id)?.kind === 'markdown') setEmptyEditorId(id);
    const previous = current.find((segment) => segment.id === id)?.content || '';
    const leading = previous.match(/^(?:\r?\n)+/)?.[0] || '';
    const trailing = previous.match(/(?:\r?\n)+$/)?.[0] || '';
    const bounded = `${content.startsWith('\n') ? '' : leading}${content}${content.endsWith('\n') ? '' : trailing}`;
    const next = current.map((segment) => segment.id === id ? { ...segment, content: bounded } : segment);
    segmentsRef.current = next;
    setSegments(next);
    onChange(next.map((segment) => segment.content).join(''));
  };
  const insertComponent = (afterId: number, component: InsertedComponent, raw: string): string | undefined => {
    const current = segmentsRef.current;
    const index = current.findIndex((segment) => segment.id === afterId);
    const before = current.slice(0, index + 1).map((segment) => segment.content).join('');
    const after = current.slice(index + 1).map((segment) => segment.content).join('');
    const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const body = `${before}${prefix}${raw}${suffix}${after}`;
    const ensured = component === 'LinkButton' ? ensureLinkButtonImport(body) : component === 'LinkCard' ? ensureLinkCardImport(body) : ensureSimpleComponentImport(body, component);
    if ('error' in ensured && typeof ensured.error === 'string') return ensured.error;
    const next = splitBody(ensured.content);
    setEmptyEditorId(null); segmentsRef.current = next; setSegments(next);
    setSegmentSession((session) => session + 1);
    onChange(ensured.content);
  };
  const removeComponent = (id: number) => {
    const next = segmentsRef.current.filter((segment) => segment.id !== id);
    segmentsRef.current = next; setSegments(next);
    onChange(next.map((segment) => segment.content).join(''));
  };
  const addTextBlock = (afterId: number) => {
    const current = segmentsRef.current;
    const id = Math.max(-1, ...current.map((segment) => segment.id)) + 1;
    const index = current.findIndex((segment) => segment.id === afterId);
    const next = [...current.slice(0, index + 1), { id, kind: 'markdown' as const, content: current.length ? '\n\n' : '' }, ...current.slice(index + 1)];
    segmentsRef.current = next; setSegments(next); setEmptyEditorId(id);
  };
  // Keep whitespace separators in the source without displaying them as empty editors.
  const visibleSegments = visibleBodySegments(segments, emptyEditorId);
  return <div className="body-editor">
    <p className="block-move-note">Move blocks with the arrow buttons. Adjacent text blocks may merge into one text block when you reopen the page; their content stays in order. Read-only blocks stay in place.</p>
    <p className="block-move-status" role="status">{moveNotice}</p>
    {visibleSegments.map((segment, index) => <div className="block-row" tabIndex={-1} ref={(row) => { if (row) blockRows.current.set(segment.id, row); else blockRows.current.delete(segment.id); }} key={`${segmentSession}:${segment.id}`}>
      {segment.kind === 'protected'
        ? <details className="protected-block"><summary>Existing MDX block (preserved, read-only)</summary><pre>{segment.content}</pre></details>
        : <RichTextEditor onRemove={() => removeComponent(segment.id)} structured={segment.kind === 'structured'} initialValue={segment.content} onChange={(content) => update(segment.id, content)} />}
      <div className="block-controls">
        {segment.kind !== 'protected' && <div className="block-move-buttons" role="group" aria-label={`Move block ${index + 1}`}>
          <button type="button" data-move="-1" disabled={!visibleSegments[index - 1] || visibleSegments[index - 1].kind === 'protected'} onClick={() => move(segment.id, -1)}>↑ Move up</button>
          <button type="button" data-move="1" disabled={!visibleSegments[index + 1] || visibleSegments[index + 1].kind === 'protected'} onClick={() => move(segment.id, 1)}>↓ Move down</button>
        </div>}
        <BlockInserter onInsert={(component, raw) => insertComponent(segment.id, component, raw)} onAddText={() => addTextBlock(segment.id)} />
      </div>
    </div>)}
    {!visibleSegments.length && <BlockInserter onInsert={(component, raw) => insertComponent(-1, component, raw)} onAddText={() => addTextBlock(-1)} />}
  </div>;
}

function parseTagsInput(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function BlogMetadata({ project, onChange, fields, blog = false }: { project: Project; onChange: (project: Project) => void; fields: readonly string[]; blog?: boolean }) {
  const show = (field: string) => fields.includes(field);
  const [coverPicker, setCoverPicker] = useState<string | null>(null);
  const authors = project.authors || [];
  const tags = project.tags || [];
  const [tagsText, setTagsText] = useState(() => tags.join(', '));
  const tagsKey = JSON.stringify(tags);
  useEffect(() => {
    // Preserve the draft's commas and spaces while typing so React does not
    // remove the delimiter or move the caret between consecutive keystrokes.
    setTagsText((current) => JSON.stringify(parseTagsInput(current)) === tagsKey ? current : tags.join(', '));
  }, [tagsKey]);
  const cover = project.cover;
  return <>
    {show('date') && <label>{blog ? 'Publication date' : 'Date (optional)'}<input type="date" value={project.date || ''} onChange={(event) => onChange({ ...project, date: event.target.value })} /></label>}
    {show('excerpt') && <label>Excerpt <span>(optional)</span><textarea rows={3} value={project.excerpt || ''} onChange={(event) => onChange({ ...project, excerpt: event.target.value })} /></label>}
    {show('authors') && <fieldset className="metadata-group"><legend>Authors (optional)</legend>
      {authors.map((author, index) => <div className="metadata-row" key={index}>
        <label>Author {index + 1}<input value={typeof author === 'string' ? author : author.name} onChange={(event) => onChange({ ...project, authors: authors.map((item, at) => at === index ? typeof item === 'string' ? event.target.value : { ...item, name: event.target.value } : item) })} /></label>
        <button type="button" onClick={() => onChange({ ...project, authors: authors.filter((_, at) => at !== index) })}>Remove author {index + 1}</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...project, authors: [...authors, { name: '' }] })}>Add author</button>
    </fieldset>}
    {show('tags') && <label>Tags <span>(optional)</span><input value={tagsText} placeholder="maps, history, aerial imagery" onChange={(event) => {
      setTagsText(event.target.value);
      onChange({ ...project, tags: parseTagsInput(event.target.value) });
    }} onBlur={() => setTagsText(tags.join(', '))} /><span>Separate tags with commas.</span></label>}
    {show('cover') && <fieldset className="metadata-group"><legend>Cover image (optional)</legend>
      {cover ? <>
        {('light' in cover && !('image' in cover) ? ['light', 'dark'] : ['image']).map((field) => <div key={field}>
          <label>{field === 'image' ? 'Image' : `${field} image`} URL or repository path<input value={String(cover[field] || '')} placeholder="@images/example.png or https://…" onChange={(event) => onChange({ ...project, cover: { ...cover, [field]: event.target.value } })} /></label>
          <button type="button" onClick={() => setCoverPicker(field)}>Choose or upload {field === 'image' ? 'image' : `${field} image`}</button>
        </div>)}
        <label>Cover alt text<input value={cover.alt || ''} onChange={(event) => onChange({ ...project, cover: { ...cover, alt: event.target.value } })} /></label>
        <label>Cover caption <span>(optional)</span><input value={cover.caption || ''} onChange={(event) => onChange({ ...project, cover: { ...cover, caption: event.target.value } })} /></label>
        <button type="button" onClick={() => onChange({ ...project, cover: null })}>Remove cover</button>
      </> : <button type="button" onClick={() => onChange({ ...project, cover: { image: '', alt: '' } })}>Add cover image</button>}
      <p>Uploads are saved to staging immediately, even if you discard the page.</p>
    </fieldset>}
    {coverPicker && <RepositoryImagePicker showCaption={false} onClose={() => setCoverPicker(null)} onSelect={(image, alt) => { onChange({ ...project, cover: { ...cover, [coverPicker]: image, alt } }); setCoverPicker(null); }} />}
  </>;
}

function PageMetadataControls({ area, project, onChange }: { area: AreaName; project: Project; onChange: (project: Project) => void }) {
  const metadata = project.metadata || {};
  const sidebar = metadata.sidebar || {};
  const toc = metadata.tableOfContents;
  const set = <K extends keyof PageMetadata>(key: K, value: PageMetadata[K]) => onChange({ ...project, metadata: { ...metadata, [key]: value }, ...(key === 'sidebar' ? { sidebarHidden: (value as PageMetadata['sidebar'])?.hidden === true } : {}) });
  const setSidebar = (key: 'label' | 'order' | 'hidden', value: string | number | boolean | undefined) => set('sidebar', { ...sidebar, [key]: value });
  const isYearArea = ['library', 'scholarship'].includes(area) || metadata.year != null;
  const sharing = (metadata.head || []).map((item, index) => ({ item, index })).filter(({ item }) => item.tag === 'meta' && (item.attrs?.property === 'og:image' || item.attrs?.name === 'twitter:image'));
  return <>
    {isYearArea && <label>Year (optional)<input type="number" min={1800} max={2100} value={metadata.year ?? ''} onChange={(event) => set('year', event.target.value === '' ? null : Number(event.target.value))} /></label>}
    {(area === 'workgroups' || metadata.committee != null || metadata.members != null) && <fieldset className="metadata-group"><legend>Working group</legend>
      <label>Committee<input value={metadata.committee || ''} onChange={(event) => set('committee', event.target.value || null)} /></label>
      <label>Lead<input value={metadata.lead || ''} onChange={(event) => set('lead', event.target.value || null)} /></label>
      <label>Active dates<input value={metadata.dates_active || ''} onChange={(event) => set('dates_active', event.target.value || null)} placeholder="May 2025 – October 2026" /></label>
      {(metadata.members || []).map((member, index) => <div className="metadata-row" key={index}>
        <label>Member {index + 1}<input value={member} onChange={(event) => set('members', metadata.members!.map((value, at) => at === index ? event.target.value : value))} /></label>
        <button type="button" onClick={() => set('members', metadata.members!.filter((_, at) => at !== index))}>Remove member {index + 1}</button>
      </div>)}
      <button type="button" onClick={() => set('members', [...(metadata.members || []), ''])}>Add member</button>
    </fieldset>}
    <details className="metadata-group page-settings"><summary>Page settings</summary>
      <p>Options marked “site default” follow the site’s settings. Choosing the matching option without that label fixes the setting for this page, even if the site default changes.</p>
      <label>Page layout<select value={metadata.template ?? ''} onChange={(event) => set('template', event.target.value || null)}>
        <option value="">Document (site default)</option><option value="doc">Document</option><option value="splash">Splash</option>
      </select></label>
      <label>Page heading<select value={metadata.hidePageTitle == null ? '' : String(metadata.hidePageTitle)} onChange={(event) => set('hidePageTitle', event.target.value === '' ? null : event.target.value === 'true')}>
        <option value="">Show (site default)</option><option value="false">Show</option><option value="true">Hide</option>
      </select></label>
      <label>Table of contents<select value={toc == null ? '' : typeof toc === 'object' ? 'custom' : String(toc)} onChange={(event) => set('tableOfContents', event.target.value === '' ? null : event.target.value === 'custom' ? { minHeadingLevel: 2, maxHeadingLevel: 3 } : event.target.value === 'true')}>
        <option value="">{metadata.template === 'splash' ? 'Hide (splash layout)' : 'Show (site default)'}</option><option value="true">Show</option><option value="false">Hide</option><option value="custom">Choose heading levels</option>
      </select></label>
      {toc && typeof toc === 'object' && <div className="metadata-row">
        <label>Minimum heading level<input type="number" min={1} max={6} value={toc.minHeadingLevel ?? 2} onChange={(event) => set('tableOfContents', { ...toc, minHeadingLevel: Number(event.target.value) })} /></label>
        <label>Maximum heading level<input type="number" min={1} max={6} value={toc.maxHeadingLevel ?? 3} onChange={(event) => set('tableOfContents', { ...toc, maxHeadingLevel: Number(event.target.value) })} /></label>
      </div>}
      <label>Site search<select value={metadata.pagefind == null ? '' : String(metadata.pagefind)} onChange={(event) => set('pagefind', event.target.value === '' ? null : event.target.value === 'true')}>
        <option value="">Include (site default)</option><option value="true">Include</option><option value="false">Exclude</option>
      </select></label>
      <fieldset className="metadata-group"><legend>Navigation</legend>
        <label>Navigation label<input value={sidebar.label ?? ''} onChange={(event) => setSidebar('label', event.target.value || undefined)} /></label>
        <label>Navigation order<input type="number" value={sidebar.order ?? ''} onChange={(event) => setSidebar('order', event.target.value === '' ? undefined : Number(event.target.value))} /></label>
        <label>Navigation visibility<select value={sidebar.hidden === undefined ? '' : String(sidebar.hidden)} onChange={(event) => setSidebar('hidden', event.target.value === '' ? undefined : event.target.value === 'true')}>
          <option value="">Show in navigation (site default)</option><option value="false">Show in navigation</option><option value="true">Hide from navigation</option>
        </select></label>
      </fieldset>
      {(area === 'conference' || metadata.banner != null) && <fieldset className="metadata-group"><legend>Announcement banner</legend>
        {metadata.banner ? <>
          <label>Banner content (HTML supported)<textarea rows={3} value={metadata.banner.content} onChange={(event) => set('banner', { ...metadata.banner!, content: event.target.value })} /></label>
          <button type="button" onClick={() => set('banner', null)}>Remove banner</button>
        </> : <button type="button" onClick={() => set('banner', { content: '' })}>Add banner</button>}
      </fieldset>}
      {(area === 'conference' || sharing.length > 0) && <fieldset className="metadata-group"><legend>Social sharing images</legend>
        {sharing.map(({ item, index }) => <div key={index}>
          <label>{item.attrs?.property === 'og:image' ? 'Open Graph image URL' : 'Twitter image URL'}<input value={String(item.attrs?.content || '')} onChange={(event) => set('head', metadata.head!.map((tag, at) => at === index ? { ...tag, attrs: { ...tag.attrs, content: event.target.value } } : tag))} /></label>
          <button type="button" onClick={() => set('head', metadata.head!.filter((_, at) => at !== index))}>Remove sharing image {index + 1}</button>
        </div>)}
        {!sharing.length && <button type="button" onClick={() => set('head', [...(metadata.head || []), { tag: 'meta', attrs: { property: 'og:image', content: '' } }, { tag: 'meta', attrs: { name: 'twitter:image', content: '' } }])}>Add social sharing images</button>}
      </fieldset>}
    </details>
  </>;
}

export default function ProjectEditor() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [area, setArea] = useState<AreaName | null>(null);
  const [branch, setBranch] = useState('custom-cms');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<string | null | undefined>(undefined);
  const [bodyEditorSession, setBodyEditorSession] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [suggestedFilename, setSuggestedFilename] = useState('');
  const dirty = project !== null && JSON.stringify(project) !== savedSnapshot;
  const isBlog = area === 'posts';
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const canLeave = () => !dirty || window.confirm('Discard unsaved changes? Choose Cancel to return to the editor and save your work.');

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const config = area ? CONTENT_AREAS[area] : null;
  const loadList = async (nextArea: AreaName) => {
    setBusy(true); setError('');
    try {
      const data = await api<{ entries: ProjectListItem[]; branch: string }>(`/api/content/${nextArea}`);
      setProjects(data.entries); setBranch(data.branch);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    void api<{ authenticated: boolean; login?: string }>('/api/session')
      .then((session) => {
        setViewer(session.authenticated ? (session.login || 'GitHub user') : null);
      })
      .catch((err) => { setViewer(null); setError((err as Error).message); });
  }, []);

  const logout = async () => {
    if (!canLeave()) return;
    await api('/api/auth/logout', { method: 'POST' });
    setArea(null); setProject(null); setProjects([]); setViewer(null); setNotice(''); setError('');
  };

  if (viewer === undefined) return <main className="editor-shell"><p>Checking GitHub sign-in…</p></main>;
  if (viewer === null) return (
    <main className="editor-shell">
      <p className="eyebrow">Staging</p><h1>Content editor</h1>
      <p>Sign in with a GitHub account that can write to <code>geobtaa/geobtaa.github.io</code>.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <a className="button primary" href={`${API}/api/auth/login`}>Sign in with GitHub</a>
    </main>
  );

  const open = async (filename: string) => {
    if (!area || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const loaded = await api<Project>(`/api/content/${area}/${encodeURIComponent(filename)}`);
      setProject(loaded); setSavedSnapshot(JSON.stringify(loaded)); setSuggestedFilename('');
      setBodyEditorSession((session) => session + 1);
    }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const create = () => {
    if (!area || busy) return;
    setError(''); setNotice('');
    setProject({ filename: '', content: '', title: '', description: '', draft: isBlog, body: '', date: isBlog ? todayCalendar() : '', excerpt: '', authors: [], tags: [], cover: null, metadata: {}, frontmatterFields: [] });
    setSuggestedFilename(''); setSavedSnapshot('');
    setBodyEditorSession((session) => session + 1);
  };

  const selectArea = (nextArea: AreaName | null) => {
    if (busy || !canLeave()) return false;
    setArea(nextArea); setProject(null); setProjects([]); setNotice(''); setError('');
    if (nextArea) void loadList(nextArea);
    return true;
  };

  const save = async (alternative?: string) => {
    if (!project || !area || !config || busy) return;
    if (!project.title.trim()) return setError('Title is required.');
    const slug = project.sha ? project.filename.replace(/\.mdx?$/, '') : slugify(project.filename || project.title);
    if (!isBlog && !slug) return setError('Enter a title or filename before saving.');
    const filename = project.sha ? project.filename : `${slug}.mdx`;
    const creatingBlog = isBlog && !project.sha;
    const publish = config.publishing && !project.draft;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Project & { commitSha: string }>(creatingBlog ? '/api/content/posts' : `/api/content/${area}/${encodeURIComponent(filename)}`, {
        method: creatingBlog ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: project.date ?? '', excerpt: project.excerpt ?? '', authors: project.authors ?? [], tags: project.tags ?? [], cover: project.cover ?? null, draft: project.draft, metadata: project.metadata,
          ...(isBlog ? { suggestedFilename: alternative } : {}),
          title: project.title,
          description: project.description,
          body: project.body,
          publish,
          sha: project.sha,
          originalContent: project.content,
        }),
      });
      const next = { ...project, ...saved, filename: saved.filename || filename, draft: saved.draft ?? project.draft };
      setProject(next); setSavedSnapshot(JSON.stringify(next)); setSuggestedFilename('');
      setBranch(saved.branch || 'custom-cms');
      setNotice(`Changes saved to staging (commit ${saved.commitSha.slice(0, 7)}).`);
      await loadList(area);
    } catch (err) {
      setSuggestedFilename((err as Error & { suggestedFilename?: string }).suggestedFilename || '');
      const message = (err as Error).message;
      setError(!isBlog && message.includes('changed in GitHub') ? CONFLICT : message);
    } finally { setBusy(false); }
  };

  const accountHeader = <header className="editor-header">
    <div><p className="eyebrow">Staging</p><h1>{area ? 'Content editor' : 'Editor dashboard'}</h1><p>Signed in as <strong>{viewer}</strong>.</p></div>
    <button className="link-button" type="button" disabled={busy} onClick={logout}>Sign out</button>
  </header>;

  if (!area || !config) return (
    <main className="editor-shell">
      {accountHeader}
      <p className="dashboard-intro">Choose a content area to create a page or edit existing content.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <nav className="dashboard-grid" aria-label="Content areas">
        {Object.entries(CONTENT_AREAS).map(([name, item]) => <button className="dashboard-card" type="button" key={name} onClick={() => selectArea(name as AreaName)}>
          <span className="dashboard-card-title">{item.label}<span aria-hidden="true"> →</span></span>
        </button>)}
      </nav>
    </main>
  );

  const backToList = () => {
    if (busy || !canLeave()) return;
    setProject(null); setNotice(''); setError(''); setSuggestedFilename('');
    window.scrollTo({ top: 0 });
  };
  const backToDashboard = () => { if (selectArea(null)) window.scrollTo({ top: 0 }); };

  if (!project) return (
    <main className="editor-shell">
      <nav className="editor-navigation" aria-label="Editor navigation">
        <button className="back" type="button" disabled={busy} onClick={backToDashboard}>← Back to dashboard</button>
        <span className="navigation-location">{config.label}</span>
      </nav>
      {accountHeader}
      <p>Files are read from <code>{branch}</code>{branch === 'main' ? ' until the prototype branch is created by the first save' : ''}.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <label className="area-selector">Content area<select disabled={busy} value={area} onChange={(event) => selectArea((event.target.value || null) as AreaName | null)}><option value="">Dashboard — choose a content area</option>{Object.entries(CONTENT_AREAS).map(([name, item]) => <option key={name} value={name}>{item.label}</option>)}</select></label>
      <div className="list-heading"><h2>{config.label}</h2>{config.create && <button className="primary" type="button" disabled={busy} onClick={create}>New {config.itemLabel}</button>}</div>
      {busy ? <p role="status">Loading…</p> : <ul className="project-list">{sortedProjects.map((item) => <li className={item.draft && item.visibilityKnown ? 'draft-entry' : ''} key={item.path}><button type="button" onClick={() => open(item.name)}>
        <span className="content-name">{item.name.replace(/\.mdx?$/, '')}</span>
        {item.draft && item.visibilityKnown === true && <span className="visibility-badge status-draft">Draft</span>}
      </button></li>)}</ul>}
    </main>
  );

  return (
    <main className="editor-shell editor-workspace">
      <nav className="editor-navigation" aria-label="Editor navigation">
        <button className="back" type="button" disabled={busy} onClick={backToList}>← Back to {config.label}</button>
        <div className="navigation-actions"><button className="dashboard-link" type="button" disabled={busy} onClick={backToDashboard}>Dashboard</button><button className="primary top-save" type="button" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </nav>
      <h1>{project.sha ? `Edit ${config.itemLabel}` : `New ${config.itemLabel}`}</h1>
      <section className={`visibility-panel ${project.draft ? 'is-draft' : 'is-ready'}`} aria-label="Page visibility" aria-live="polite">
        <div className="visibility-heading">
          <div className="content-badges">
            <button className="visibility-control visibility-switch" type="button" role="switch" aria-label="Published" aria-checked={!project.draft} disabled={busy} onClick={() => setProject({ ...project, draft: !project.draft })} onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setProject({ ...project, draft: event.key === 'ArrowLeft' });
              }
            }}><span className="draft-label" aria-hidden="true">Draft</span><span className="published-label" aria-hidden="true">Published</span></button>
            {project.sidebarHidden && <span className="visibility-badge status-navigation">Hidden from navigation</span>}
          </div>
          <span className="save-state">{busy ? 'Saving…' : !project.sha ? 'Not saved yet' : dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
        </div>
      </section>
      {notice && <p className="message success" role="status">{notice}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      {isBlog && project.sha && <p>Saved URL: /posts/{project.filename.replace(/\.mdx?$/, '').replace(/\/index$/, '')}/</p>}
      {suggestedFilename && !project.sha && <button type="button" disabled={busy} onClick={() => save(suggestedFilename)}>Create as {suggestedFilename.replace(/\.mdx$/, '')}</button>}
      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset className="editor-fields" disabled={busy}>
        {!project.sha && !isBlog && <label>Filename <span>(optional; generated from title)</span><input value={project.filename} onChange={(event) => setProject({ ...project, filename: slugify(event.target.value) })} placeholder="example-project" /></label>}
        <label>Title<input required value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} /></label>
        {(config.description || project.frontmatterFields?.includes('description')) && <label>Description<textarea rows={3} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></label>}
        <BlogMetadata project={project} onChange={setProject} blog={isBlog} fields={[...new Set([...config.metadataFields, ...(project.frontmatterFields || []).filter((field) => ['date', 'excerpt', 'authors', 'tags', 'cover'].includes(field))])]} />
        <PageMetadataControls area={area} project={project} onChange={setProject} />
        <label>Body</label>
        <div inert={busy}><BodyEditor key={bodyEditorSession} initialValue={project.body} onChange={(body) => setProject((current) => current ? { ...current, body } : current)} /></div>
        <div className="actions editor-actions"><button className="back" disabled={busy} type="button" onClick={backToList}>← Back to {config.label}</button><button disabled={busy} className="primary" type="button" onClick={() => save()}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </fieldset>
      </form>
    </main>
  );
}

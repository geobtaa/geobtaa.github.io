import type { Project, PageMetadata } from './editorTypes';
import { useEditorNavigation, routeKey, type EditorRoute } from './editorNavigation';
import { useEditorRecovery, type EditorRecovery } from './useEditorRecovery';
import { downloadRecovery, parseRecovery, recoveryKey, restoreRecovery, type RecoveryCopy } from './editorRecovery';
import { ToolbarButton } from './ToolbarButton';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SimpleComponentFields } from './SimpleComponentBlock';
import { SIMPLE_COMPONENTS, SIMPLE_KINDS, createSimpleComponentMdx, emptySimpleFields, ensureSimpleComponentImport, simpleKindForNode, type SimpleKind } from './simpleComponents';
import { LinkAddressField } from './LinkAddressField';
import { normalizeLinkAddress } from './linkAddress';
import { splitBody, visibleBodySegments, moveBodySegment, type BodySegment } from './bodySegments';
import { richTextEditorOptions } from './richTextEditor';
import { createLinkCardMdx, ensureLinkCardImport } from './linkCardMdx';
import { createLinkButtonMdx, ensureLinkButtonImport, type LinkButtonFields } from './linkButtonMdx';
import { todayCalendar } from '../../../editor-prototype/blog.mjs';
import { parseContent } from '../../../editor-prototype/content.mjs';
import { CONTENT_AREAS } from '../../../editor-prototype/contentAreas.mjs';
import { PROGRAM_UPDATE_OUTLINE } from '../../../editor-prototype/programUpdates.mjs';
import { COLLECTION_BLOCKS, COLLECTION_KINDS, collectionKindForNode, createCollectionMdx, ensureCollectionImport, type CollectionKind } from './collectionMdx';

const API = import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const CONFLICT = 'This page has changed in GitHub since you opened it. Reload the latest version before saving.';

type ProjectListItem = { name: string; path: string; sha: string; draft?: boolean; sidebarHidden?: boolean; visibilityKnown?: boolean };
type ImageListItem = { name: string; path: string; sha: string; size?: number };
type AreaName = keyof typeof CONTENT_AREAS;

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

type InsertedComponent = 'LinkCard' | 'LinkButton' | SimpleKind | CollectionKind;

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
  const [collectionError, setCollectionError] = useState('');

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
      <div className="block-menu-list" onMouseDown={(event) => {
        // WebKit can return focus to the text editor before an option's click.
        // Keep focus here so onBlur does not close the menu before activation.
        event.preventDefault();
      }}>
        <button type="button" onClick={() => { closeMenu(); onAddText(); }}>Text</button>
        <button type="button" onClick={() => { closeMenu(); setLinkCardDialog(true); setLinkCardError(''); }}>Link Card</button>
        <button type="button" onClick={() => { closeMenu(); setLinkButtonDialog(true); setLinkButtonError(''); }}>Link Button</button>
        {SIMPLE_KINDS.map((kind) => <button key={kind} type="button" onClick={() => { closeMenu(); setSimpleDialog(kind); setSimpleFields(emptySimpleFields()); setSimpleError(''); }}>{SIMPLE_COMPONENTS[kind].label}</button>)}
        {COLLECTION_KINDS.map(kind => <button key={kind} type="button" onClick={() => {
          closeMenu();
          const data = kind === 'chipList' ? [''] : [{ title: '', body: '' }, { title: '', body: '' }];
          setCollectionError(onInsert(kind, createCollectionMdx(kind, data)) || '');
        }}>{COLLECTION_BLOCKS[kind].label}</button>)}
      </div>
    </details>
      {collectionError && <p className="message error" role="alert">{collectionError}</p>}
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
        empty: editor?.isEmpty ?? true,
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
  const collectionKind = collectionKindForNode(editor.state.doc.firstChild?.type.name || '');
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
        <ToolbarButton action="Undo" disabled={!active?.canUndo} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton action="Redo" disabled={!active?.canRedo} onClick={() => editor.chain().focus().redo().run()} />
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
        <ToolbarButton action="Bold" aria-pressed={active?.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton action="Italic" aria-pressed={active?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton action="Underline" aria-pressed={active?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarButton action="Strike" aria-pressed={active?.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton action="Code" aria-pressed={active?.code} onClick={() => editor.chain().focus().toggleCode().run()} />
        <ToolbarButton action="Link" aria-pressed={active?.link} onClick={link} />
        <ToolbarButton action="Bullets" aria-pressed={active?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton action="Numbered" aria-pressed={active?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton action="Quote" aria-pressed={active?.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton action="Code block" aria-pressed={active?.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolbarButton action="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <ToolbarButton action="Line break" onClick={() => editor.chain().focus().setHardBreak().run()} />
        <ToolbarButton action="Image" onClick={() => setImagePicker({})} />
        <ToolbarButton action="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        {active?.table && <>
          <span className="toolbar-separator" aria-hidden="true" />
          <ToolbarButton action="Add row" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <ToolbarButton action="Delete row" onClick={() => editor.chain().focus().deleteRow().run()} />
          <ToolbarButton action="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <ToolbarButton action="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()} />
          <ToolbarButton action="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} />
        </>}
      </div>}
      <EditorContent editor={editor} />
      {!structured && <div className="text-block-footer">
        {active?.empty && <p className="text-block-empty">Empty Text block.</p>}
        <button type="button" className="link-button component-remove" title="Remove this Text block and all its content" onClick={onRemove}>Remove Text block</button>
      </div>}
      {structured && <button type="button" className="link-button component-remove" onClick={onRemove}>Remove {collectionKind ? COLLECTION_BLOCKS[collectionKind].label : simpleKind ? SIMPLE_COMPONENTS[simpleKind].label : editor.state.doc.firstChild?.type.name === 'linkButtonBlock' ? 'Link Button' : 'Link Card'}</button>}
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
  const bodyRoot = useRef<HTMLDivElement>(null);
  const blockRows = useRef(new Map<number, HTMLDivElement>());
  const pendingMove = useRef<{ id: number; direction: -1 | 1 } | null>(null);
  const pendingRemovalFocus = useRef<{ id: number | null } | null>(null);
  const [removedBlock, setRemovedBlock] = useState<{ segment: BodySegment } | null>(null);
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
  useEffect(() => {
    const focus = pendingRemovalFocus.current;
    if (!focus) return;
    pendingRemovalFocus.current = null;
    const row = focus.id === null ? null : blockRows.current.get(focus.id);
    const target = row || bodyRoot.current?.querySelector<HTMLElement>('.empty-body summary');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }, [segments]);
  const move = (id: number, direction: -1 | 1) => {
    const next = moveBodySegment(segmentsRef.current, id, direction, emptyEditorId);
    if (next === segmentsRef.current) return;
    setRemovedBlock(null);
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
    const ensured = COLLECTION_KINDS.includes(component as CollectionKind) ? ensureCollectionImport(body, component as CollectionKind) : component === 'LinkButton' ? ensureLinkButtonImport(body) : component === 'LinkCard' ? ensureLinkCardImport(body) : ensureSimpleComponentImport(body, component as SimpleKind);
    if ('error' in ensured && typeof ensured.error === 'string') return ensured.error;
    setRemovedBlock(null);
    const next = splitBody(ensured.content);
    setEmptyEditorId(null); segmentsRef.current = next; setSegments(next);
    setMoveNotice('Block added.');
    setSegmentSession((session) => session + 1);
    onChange(ensured.content);
  };
  const removeBlock = (id: number) => {
    const current = segmentsRef.current;
    const index = current.findIndex(segment => segment.id === id);
    const segment = current[index];
    if (!segment || segment.kind === 'protected') return;
    const visible = visibleBodySegments(current, emptyEditorId);
    const visibleIndex = visible.findIndex(segment => segment.id === id);
    const neighbor = visible[visibleIndex + 1] || visible[visibleIndex - 1];
    pendingRemovalFocus.current = { id: neighbor?.id ?? null };
    setRemovedBlock({ segment });
    if (emptyEditorId === id) setEmptyEditorId(null);
    // Preserve a Markdown separator so imports, components, and paragraphs on
    // either side cannot run together when the removed block held their spacing.
    const newline = current.some(segment => segment.content.includes('\r\n')) ? '\r\n' : '\n';
    const next = current.map(segment => segment.id === id ? { id, kind: 'markdown' as const, content: newline.repeat(2) } : segment);
    segmentsRef.current = next; setSegments(next);
    setMoveNotice(`${segment.kind === 'markdown' ? 'Text block' : 'Block'} removed. Undo removal is available.`);
    onChange(next.map((segment) => segment.content).join(''));
  };
  const undoRemoval = () => {
    if (!removedBlock) return;
    const current = segmentsRef.current;
    const { segment } = removedBlock;
    const next = current.map(currentSegment => currentSegment.id === segment.id ? segment : currentSegment);
    if (segment.kind === 'markdown' && !segment.content.trim()) setEmptyEditorId(segment.id);
    pendingRemovalFocus.current = { id: segment.id };
    segmentsRef.current = next; setSegments(next); setRemovedBlock(null);
    setMoveNotice('Block restored.');
    onChange(next.map((segment) => segment.content).join(''));
  };
  const addTextBlock = (afterId: number) => {
    const current = segmentsRef.current;
    setRemovedBlock(null);
    const id = Math.max(-1, ...current.map((segment) => segment.id)) + 1;
    const index = current.findIndex((segment) => segment.id === afterId);
    const next = [...current.slice(0, index + 1), { id, kind: 'markdown' as const, content: current.length ? '\n\n' : '' }, ...current.slice(index + 1)];
    segmentsRef.current = next; setSegments(next); setEmptyEditorId(id);
    setMoveNotice('Text block added.');
  };
  // Keep whitespace separators in the source without displaying them as empty editors.
  const visibleSegments = visibleBodySegments(segments, emptyEditorId);
  return <div className="body-editor" ref={bodyRoot}>
    <p className="block-move-note">Move blocks with the arrow buttons. Adjacent text blocks may merge into one text block when you reopen the page; their content stays in order. Read-only blocks stay in place.</p>
    <p className="block-move-status" role="status">{moveNotice}</p>
    {removedBlock && <div className="block-removal-notice">
      <span>{removedBlock.segment.kind === 'markdown' ? 'Text block' : 'Block'} removed.</span>
      <button type="button" onClick={undoRemoval}>Undo removal</button>
    </div>}
    {visibleSegments.map((segment, index) => <div className="block-row" tabIndex={-1} ref={(row) => { if (row) blockRows.current.set(segment.id, row); else blockRows.current.delete(segment.id); }} key={`${segmentSession}:${segment.id}`}>
      {segment.kind === 'protected'
        ? <details className="protected-block"><summary>Existing MDX block (preserved, read-only)</summary><pre>{segment.content}</pre></details>
        : <RichTextEditor onRemove={() => removeBlock(segment.id)} structured={segment.kind === 'structured'} initialValue={segment.content} onChange={(content) => update(segment.id, content)} />}
      <div className="block-controls">
        {segment.kind !== 'protected' && <div className="block-move-buttons" role="group" aria-label={`Move block ${index + 1}`}>
          <button type="button" data-move="-1" disabled={!visibleSegments[index - 1] || visibleSegments[index - 1].kind === 'protected'} onClick={() => move(segment.id, -1)}>↑ Move up</button>
          <button type="button" data-move="1" disabled={!visibleSegments[index + 1] || visibleSegments[index + 1].kind === 'protected'} onClick={() => move(segment.id, 1)}>↓ Move down</button>
        </div>}
        <BlockInserter onInsert={(component, raw) => insertComponent(segment.id, component, raw)} onAddText={() => addTextBlock(segment.id)} />
      </div>
    </div>)}
    {!visibleSegments.length && <div className="empty-body">
      <p>No content blocks. Add a block to continue.</p>
      <BlockInserter onInsert={(component, raw) => insertComponent(-1, component, raw)} onAddText={() => addTextBlock(-1)} />
    </div>}
  </div>;
}

function ConversionPreviewBlock({ content, protectedBlock }: { content: string; protectedBlock: boolean }) {
  const editor = useEditor({ ...richTextEditorOptions(protectedBlock ? '' : content, () => {}, API, undefined, true), editable: false, immediatelyRender: false });
  return protectedBlock
    ? <details className="protected-block"><summary>Existing MDX block (will remain read-only)</summary><pre>{content}</pre></details>
    : <div className="rich-editor"><EditorContent editor={editor} /></div>;
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

function freshEntry(area: AreaName): Project {
  const article = area === 'posts' || area === 'updates';
  return { filename: '', content: '', title: '', description: '', draft: article, body: '', date: article ? todayCalendar() : '', excerpt: '', authors: area === 'updates' ? [{ name: 'BTAA-GIN Staff' }] : [], tags: area === 'updates' ? ['Program Updates'] : [], cover: null, metadata: {}, frontmatterFields: [] };
}

export default function ProjectEditor() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [area, setArea] = useState<AreaName | null>(null);
  const [branch, setBranch] = useState('custom-cms');
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  const setBusy = (value: boolean) => { busyRef.current = value; setBusyState(value); };
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<string | null | undefined>(undefined);
  const [workspace, setWorkspace] = useState('');
  const [route, setRoute] = useState<EditorRoute>({ area: null });
  const [baseline, setBaseline] = useState<Project | null>(null);
  const [selectedRecovery, setSelectedRecovery] = useState('');
  const recoveryRef = useRef<EditorRecovery | null>(null);
  const requestSequence = useRef(0);
  const [bodyEditorSession, setBodyEditorSession] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [suggestedFilename, setSuggestedFilename] = useState('');
  const [showUpdateStarter, setShowUpdateStarter] = useState(false);
  const [showConversionPreview, setShowConversionPreview] = useState(false);
  const dirty = project !== null && JSON.stringify(project) !== savedSnapshot;
  const isBlog = area === 'posts';
  const isUpdate = area === 'updates';
  const isArticle = isBlog || isUpdate;
  const canLeave = () => {
    if (busyRef.current && project) return false;
    const backedUp = recoveryRef.current?.flush();
    if (!dirty) return true;
    if (!recoveryRef.current?.hasChanges) return window.confirm('Leave this new entry? Nothing has been saved to GitHub. Choose Cancel to keep editing.');
    return window.confirm(backedUp
      ? 'Leave this entry? Your changes have not been saved to GitHub. A recovery copy is kept in this browser. Choose Cancel to keep editing.'
      : 'Leave this entry? Unsaved changes may be lost because a recovery copy could not be saved. Choose Cancel to keep editing.');
  };
  const activateRoute = async (next: EditorRoute) => {
    const sequence = ++requestSequence.current;
    setArea(next.area); setRoute(next); setProject(null); setBaseline(null); setProjects([]);
    setNotice(''); setError(''); setSuggestedFilename(''); setSelectedRecovery(''); setShowConversionPreview(false); setShowUpdateStarter(false);
    if (!next.area) { setBusy(false); return; }
    setBusy(true);
    try {
      const [list, loaded] = await Promise.all([
        api<{ entries: ProjectListItem[]; branch: string }>(`/api/content/${next.area}`),
        next.filename ? api<Project>(`/api/content/${next.area}/${encodeURIComponent(next.filename)}`) : Promise.resolve(null),
      ]);
      if (sequence !== requestSequence.current) return;
      setProjects(list.entries); setBranch(list.branch);
      const entry = loaded || (next.draftId ? freshEntry(next.area) : null);
      if (entry) {
        setProject(entry); setBaseline(entry); setSavedSnapshot(loaded ? JSON.stringify(entry) : '');
        setShowUpdateStarter(!loaded && next.area === 'updates');
        setBodyEditorSession(session => session + 1);
      }
    } catch (error) { if (sequence === requestSequence.current) setError((error as Error).message); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  };
  const navigation = useEditorNavigation({ enabled: typeof viewer === 'string', activate: next => { void activateRoute(next); }, canLeave, onError: setError });
  const recoveryScope = typeof viewer === 'string' ? JSON.stringify([API, workspace, viewer.toLowerCase()]) : null;
  const recovery = useEditorRecovery({ scope: recoveryScope, route, project, baseline });
  recoveryRef.current = recovery;
  useEffect(() => {
    if (!dirty && !(busy && project)) return;
    // returnValue also supports browsers that still require the legacy signal.
    const warn = (event: BeforeUnloadEvent) => { recoveryRef.current?.flush(); event.preventDefault(); event.returnValue = true; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy, !!project]);

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
    void api<{ authenticated: boolean; login?: string; workspace?: string }>('/api/session')
      .then((session) => {
        setWorkspace(session.workspace || 'geobtaa/geobtaa.github.io#custom-cms');
        setViewer(session.authenticated ? (session.login || 'GitHub user') : null);
      })
      .catch((err) => { setViewer(null); setError((err as Error).message); });
  }, []);

  const logout = async () => {
    if (!canLeave()) return;
    try { await api('/api/auth/logout', { method: 'POST' }); }
    catch (error) { setError((error as Error).message); return; }
    navigation.replace({ area: null });
    setArea(null); setRoute({ area: null }); setProject(null); setBaseline(null); setProjects([]); setViewer(null); setNotice(''); setError('');
  };

  if (viewer === undefined) return <main className="editor-shell"><p>Checking GitHub sign-in…</p></main>;
  if (viewer === null) return (
    <main className="editor-shell">
      <p className="eyebrow">Staging</p><h1>Content editor</h1>
      <p>Sign in with a GitHub account that can write to <code>geobtaa/geobtaa.github.io</code>.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <a className="button primary" href={`${API}/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`}>Sign in with GitHub</a>
    </main>
  );

  const open = (filename: string) => { if (area) navigation.navigate({ area, filename }); };
  const create = () => { if (area) navigation.navigate({ area, draftId: crypto.randomUUID() }); };
  const selectArea = (nextArea: AreaName | null) => navigation.navigate({ area: nextArea });

  const save = async (alternative?: string) => {
    if (!project || !area || !config || busy) return;
    if (!project.title.trim()) return setError('Title is required.');
    const slug = project.sha ? project.filename.replace(/\.mdx?$/, '') : slugify(project.filename || project.title);
    if (!isArticle && !slug) return setError('Enter a title or filename before saving.');
    const filename = project.sha ? project.filename : `${slug}.mdx`;
    const creatingArticle = isArticle && !project.sha;
    const publish = config.publishing && !project.draft;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Project & { commitSha: string }>(creatingArticle ? `/api/content/${area}` : `/api/content/${area}/${encodeURIComponent(filename)}`, {
        method: creatingArticle ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: project.date ?? '', excerpt: project.excerpt ?? '', authors: project.authors ?? [], tags: project.tags ?? [], cover: project.cover ?? null, draft: project.draft, metadata: project.metadata,
          ...(isArticle ? { suggestedFilename: alternative } : {}),
          ...(isUpdate ? { convertProgramUpdate: project.convertProgramUpdate === true } : {}),
          title: project.title,
          description: project.description,
          body: project.body,
          publish,
          sha: project.sha,
          originalContent: project.content,
        }),
      });
      const next = { ...project, ...saved, filename: saved.filename || filename, draft: saved.draft ?? project.draft };
      recovery.saved();
      const savedRoute: EditorRoute = { area, filename: next.filename };
      navigation.replace(savedRoute); setRoute(savedRoute);
      setProject(next); setBaseline(next); setSavedSnapshot(JSON.stringify(next)); setSuggestedFilename('');
      setShowConversionPreview(false); setShowUpdateStarter(false);
      setBranch(saved.branch || 'custom-cms');
      setNotice(`Changes saved to staging (commit ${saved.commitSha.slice(0, 7)}).`);
      await loadList(area);
    } catch (err) {
      setSuggestedFilename((err as Error & { suggestedFilename?: string }).suggestedFilename || '');
      const message = (err as Error).message;
      setError(!isArticle && message.includes('changed in GitHub') ? CONFLICT : message);
    } finally { setBusy(false); }
  };

  const entryCopies = recovery.copies.filter(copy => routeKey(copy.route) === routeKey(route));
  const candidate = entryCopies.find(copy => copy.id === selectedRecovery) || entryCopies[0];
  const staleRecovery = !!candidate && (candidate.baseSha !== (project?.sha || null));
  const restore = async (copy: RecoveryCopy) => {
    if (!project || !area || busyRef.current || recovery.hasChanges || !recoveryScope) return;
    setBusy(true); setError('');
    try {
      const stored = parseRecovery(window.localStorage.getItem(recoveryKey(recoveryScope, copy.id)) || '');
      if (!stored || stored.revision !== copy.revision) { recovery.refresh(); throw new Error('That recovery copy changed. Review its latest version before restoring.'); }
      const fresh = route.filename ? await api<Project>(`/api/content/${area}/${encodeURIComponent(route.filename)}`) : project;
      if (!route.filename) await api(`/api/content/${area}`);
      if ((fresh.sha || null) !== copy.baseSha) {
        setProject(fresh); setBaseline(fresh); setSavedSnapshot(JSON.stringify(fresh)); setBodyEditorSession(session => session + 1);
        throw new Error('The repository version changed. The latest version is open below; download the recovery copy to compare and reapply your changes.');
      }
      const recovered = restoreRecovery(fresh, route, copy);
      recovery.restored(copy);
      setBaseline(fresh); setSavedSnapshot(fresh.sha ? JSON.stringify(fresh) : ''); setProject(recovered);
      setShowUpdateStarter(false); setShowConversionPreview(false); setBodyEditorSession(session => session + 1);
      setNotice('Unsaved edits restored from this device. Review them, then use Save changes to save to GitHub.');
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const discardRecovery = (copy: RecoveryCopy) => {
    if (window.confirm('Permanently discard this local recovery copy? This does not change the repository.')) recovery.discard(copy);
  };
  const storageWarning = recovery.storageError && <p className="message error" role="alert">{recovery.storageError}{recovery.hasChanges && <button type="button" className="link-button" onClick={() => { const copy = recovery.currentCopy(); if (copy) downloadRecovery(copy); }}>Download unsaved edits</button>}</p>;
  const localDocuments = recovery.copies;
  const recoveryList = <>
    {storageWarning}
    {!busy && localDocuments.length > 0 && <aside className="recovery-panel" aria-label="Local recovery copies">
      <h2>Recovery copies on this device</h2>
      <p>These edits have not been confirmed saved to GitHub. Open an entry to review its recovery copies.</p>
      <ul>{localDocuments.map(copy => <li key={copy.id}>
        <button type="button" onClick={() => navigation.navigate(copy.route)}>{copy.fields.title || copy.route.filename || `Untitled ${CONTENT_AREAS[copy.route.area!].itemLabel}`}</button>
        <span>{CONTENT_AREAS[copy.route.area!].label} · <time dateTime={copy.savedAt}>{new Date(copy.savedAt).toLocaleString()}</time></span>
        <div className="recovery-copy-actions">
          <button type="button" onClick={() => downloadRecovery(copy)}>Download recovery copy</button>
          <button type="button" onClick={() => discardRecovery(copy)}>Discard recovery copy</button>
        </div>
      </li>)}</ul>
    </aside>}
  </>;
  const recoveryPanel = <>
    {storageWarning}
    {recovery.hasChanges && <div className="recovery-status">
      <span role="status">{recovery.status === 'saved' ? 'Recovery copy saved on this device.' : recovery.status === 'error' ? 'Local recovery is unavailable.' : 'Saving a recovery copy on this device…'}</span>
      {recovery.status === 'saved' && recovery.savedAt && <time dateTime={recovery.savedAt}>{new Date(recovery.savedAt).toLocaleTimeString()}</time>}
      <span>Use Save changes to save to GitHub.</span>
    </div>}
    {candidate && <aside className="recovery-panel" aria-label="Recover unsaved edits">
      <h2>Unsaved edits found on this device</h2>
      <p>Recovery copy from <time dateTime={candidate.savedAt}>{new Date(candidate.savedAt).toLocaleString()}</time>.</p>
      {entryCopies.length > 1 && <label>Recovery copy<select value={candidate.id} onChange={event => setSelectedRecovery(event.target.value)}>{entryCopies.map(copy => <option key={copy.id} value={copy.id}>{new Date(copy.savedAt).toLocaleString()} — {copy.fields.title || 'Untitled entry'}</option>)}</select></label>}
      {staleRecovery ? <p>The repository version has changed since this copy was made. The latest version is open below. Download the copy to compare and reapply your changes.</p> : recovery.hasChanges ? <p>You already have unsaved edits open. Download this earlier copy to compare, or return to this entry before making further edits to restore it.</p> : <p>Restore these edits into the editor, then review and save them.</p>}
      <div className="actions">
        {!staleRecovery && <button type="button" className="primary" disabled={busy || recovery.hasChanges} onClick={() => restore(candidate)}>Restore unsaved edits</button>}
        <button type="button" disabled={busy} onClick={() => downloadRecovery(candidate)}>Download recovery copy</button>
        <button type="button" disabled={busy} onClick={() => discardRecovery(candidate)}>Discard recovery copy</button>
      </div>
    </aside>}
  </>;

  const accountHeader = <header className="editor-header">
    <div><p className="eyebrow">Staging</p><h1>{area ? 'Content editor' : 'Editor dashboard'}</h1><p>Signed in as <strong>{viewer}</strong>.</p></div>
    <button className="link-button" type="button" disabled={busy} onClick={logout}>Sign out</button>
  </header>;

  if (!area || !config) return (
    <main className="editor-shell">
      {accountHeader}
      {recoveryList}
      <p className="dashboard-intro">Choose a content area to create a page or edit existing content.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <nav className="dashboard-grid" aria-label="Content areas">
        {Object.entries(CONTENT_AREAS).map(([name, item]) => <button className="dashboard-card" type="button" key={name} onClick={() => selectArea(name as AreaName)}>
          <span className="dashboard-card-title">{item.label}<span aria-hidden="true"> →</span></span>
        </button>)}
      </nav>
    </main>
  );

  const backToList = () => { if (area && navigation.navigate({ area })) window.scrollTo({ top: 0 }); };
  const backToDashboard = () => { if (selectArea(null)) window.scrollTo({ top: 0 }); };

  if (!project) return (
    <main className="editor-shell">
      <nav className="editor-navigation" aria-label="Editor navigation">
        <button className="back" type="button" disabled={busy} onClick={backToDashboard}>← Back to dashboard</button>
        <span className="navigation-location">{config.label}</span>
      </nav>
      {accountHeader}
      {recoveryList}
      <p>Files are read from <code>{branch}</code>{branch === 'main' ? ' until the prototype branch is created by the first save' : ''}.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      {error && (route.filename || route.draftId) && <button type="button" disabled={busy} onClick={() => { void activateRoute(route); }}>Retry opening entry</button>}
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
      {recoveryPanel}
      {notice && <p className="message success" role="status">{notice}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      {isArticle && project.sha && <p>Saved URL: /{area}/{project.filename.replace(/\.mdx?$/, '').replace(/\/index$/, '')}/</p>}
      {suggestedFilename && !project.sha && <button type="button" disabled={busy} onClick={() => save(suggestedFilename)}>Create as {suggestedFilename.replace(/\.mdx$/, '')}</button>}
      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset className="editor-fields" disabled={busy}>
        {!project.sha && !isArticle && <label>Filename <span>(optional; generated from title)</span><input value={project.filename} onChange={(event) => setProject({ ...project, filename: slugify(event.target.value) })} placeholder="example-project" /></label>}
        <label>Title<input required value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} /></label>
        {(config.description || project.frontmatterFields?.includes('description')) && <label>Description<textarea rows={3} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></label>}
        <BlogMetadata project={project} onChange={setProject} blog={isArticle} fields={[...new Set([...config.metadataFields, ...(project.frontmatterFields || []).filter((field) => ['date', 'excerpt', 'authors', 'tags', 'cover'].includes(field))])]} />
        <PageMetadataControls area={area} project={project} onChange={setProject} />
        <label>Body</label>
        {isUpdate && <p className="update-help">Use headings, text, links, images, lists, and tables. Include only the sections you need; all headings and their order are editable.</p>}
        {isUpdate && showUpdateStarter && <section className="update-options" aria-label="Choose an update starting point">
          <p>Start with familiar monthly headings or write your own update.</p>
          <div className="actions"><button type="button" onClick={() => {
            setProject({ ...project, body: PROGRAM_UPDATE_OUTLINE }); setShowUpdateStarter(false); setBodyEditorSession((session) => session + 1);
          }}>Start with monthly outline</button><button type="button" onClick={() => setShowUpdateStarter(false)}>Start blank</button></div>
        </section>}
        {isUpdate && project.conversion && !project.convertProgramUpdate && <section className="update-options" aria-label="Existing update conversion">
          {project.conversion.error ? <p>{project.conversion.error} You can still edit metadata and the editable text below. Existing MDX stays preserved.</p> : <>
            <p>This update uses an older layout. Preview a single-column version to make its supported content editable. Unfamiliar components will stay read-only.</p>
            <button type="button" disabled={showConversionPreview} onClick={() => {
              if (project.body !== parseContent(project.content).body) return setError('Save your text changes before previewing a conversion so they are included.');
              setError(''); setShowConversionPreview(true);
            }}>Preview editable version</button>
          </>}
        </section>}
        {showConversionPreview && project.conversion?.body != null ? <section className="update-conversion-preview" aria-label="Conversion preview">
          <h2>Conversion preview</h2>
          <p>Cards become headings, search chips become lists, and chart layouts become a single column. Text, links, images, captions, and tables are retained. This preview has not changed the file.</p>
          <div className="actions"><button className="primary" type="button" onClick={() => {
            setProject({ ...project, body: project.conversion!.body!, convertProgramUpdate: true }); setShowConversionPreview(false); setBodyEditorSession((session) => session + 1);
          }}>Use editable version</button><button type="button" onClick={() => setShowConversionPreview(false)}>Cancel preview</button></div>
          <fieldset disabled className="conversion-preview-content" aria-label="Read-only converted content">{splitBody(project.conversion.body).filter((segment) => segment.content.trim()).map((segment) => <ConversionPreviewBlock key={segment.id} content={segment.content} protectedBlock={segment.kind === 'protected'} />)}</fieldset>
        </section> : <>
          {project.convertProgramUpdate && <p className="message" role="status">The editable version is ready. Save changes to keep this conversion.</p>}
          <div inert={busy}><BodyEditor key={bodyEditorSession} initialValue={project.body} onChange={(body) => { setShowUpdateStarter(false); setProject((current) => current ? { ...current, body } : current); }} /></div>
        </>}
        <div className="actions editor-actions"><button className="back" disabled={busy} type="button" onClick={backToList}>← Back to {config.label}</button><button disabled={busy} className="primary" type="button" onClick={() => save()}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </fieldset>
      </form>
    </main>
  );
}

import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { splitBody } from './bodySegments';
import { richTextEditorOptions } from './richTextEditor';
import { createLinkCardMdx, ensureLinkCardImport } from './linkCardMdx';
import { todayCalendar } from '../../../editor-prototype/blog.mjs';
import { CONTENT_AREAS } from '../../../editor-prototype/contentAreas.mjs';

const API = import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const CONFLICT = 'This page has changed in GitHub since you opened it. Reload the latest version before saving.';

type ProjectListItem = { name: string; path: string; sha: string };
type ImageListItem = { name: string; path: string; sha: string; size?: number };
type AreaName = keyof typeof CONTENT_AREAS;
type Project = {
  filename: string;
  sha?: string;
  content: string;
  title: string;
  description: string;
  draft: boolean;
  body: string;
  branch?: string;
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

function RepositoryImagePicker({ onSelect, onClose }: { onSelect: (src: string, alt: string) => void; onClose: () => void }) {
  const [images, setImages] = useState<ImageListItem[]>([]);
  const [imageQuery, setImageQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [decorative, setDecorative] = useState(false);
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
      setSelectedImage(uploaded.path); setImageQuery(uploaded.path);
    } catch (err) { setImageError((err as Error).message); }
    finally { setImageBusy(false); }
  };
  const insertImage = () => {
    if (!selectedImage) return setImageError('Select or upload an image.');
    if (!decorative && !imageAlt.trim()) return setImageError('Enter alt text, or mark the image as decorative.');
    onSelect(`@images/${selectedImage}`, decorative ? '' : imageAlt.trim());
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
        <div className="image-picker-header"><h3 id="image-picker-title">Insert repository image</h3><button type="button" onClick={() => onClose()} aria-label="Close image picker">×</button></div>
        <label>Upload a new image <span>PNG, JPEG, GIF, or WebP; maximum 5 MB</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={imageBusy} onChange={(event) => void uploadImage(event.target.files?.[0])} /></label>
        <label>Find an existing image<input type="search" value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} placeholder="Filter by filename" /></label>
        {imageBusy && <p>Loading images…</p>}
        {!imageBusy && <div className="image-grid">{visibleImages.map((image) => <button type="button" className={selectedImage === image.name ? 'selected' : ''} key={image.path} onClick={() => setSelectedImage(image.name)}><img loading="lazy" src={imageUrl(image.name)} alt="" /><span>{image.name}</span></button>)}</div>}
        <label>Alt text<input value={imageAlt} disabled={decorative} onChange={(event) => setImageAlt(event.target.value)} /></label>
        <label className="checkbox"><input type="checkbox" checked={decorative} onChange={(event) => setDecorative(event.target.checked)} /> This image is decorative</label>
        {imageError && <p className="message error" role="alert">{imageError}</p>}
        <div className="actions"><button type="button" onClick={() => onClose()}>Cancel</button><button className="primary" type="button" disabled={imageBusy} onClick={insertImage}>Insert image</button></div>
      </div>
  );
}

function RichTextEditor({ initialValue, onChange, onLinkCardInserted }: { initialValue: string; onChange: (value: string) => void; onLinkCardInserted: () => void }) {
  const editor = useEditor({ ...richTextEditorOptions(initialValue, onChange, API), immediatelyRender: false });
  const [imagePicker, setImagePicker] = useState(false);
  const [linkCardDialog, setLinkCardDialog] = useState(false);
  const [linkCardTitle, setLinkCardTitle] = useState('');
  const [linkCardDescription, setLinkCardDescription] = useState('');
  const [linkCardHref, setLinkCardHref] = useState('');
  const [linkCardError, setLinkCardError] = useState('');
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
  const link = () => {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('Link URL', previous);
    if (href === null) return;
    if (!href) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };
  const setTextStyle = (value: string) => {
    if (value === 'paragraph') return editor.chain().focus().setParagraph().run();
    const level = Number(value.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6;
    return editor.chain().focus().setHeading({ level }).run();
  };
  const insertLinkCard = () => {
    const fields = {
      title: linkCardTitle.trim(),
      description: linkCardDescription.trim(),
      href: linkCardHref.trim(),
    };
    if (!fields.title || !fields.href) return setLinkCardError('Enter a title and URL.');
    const raw = createLinkCardMdx(fields);
    const position = editor.state.selection.to;
    const inserted = editor.chain().focus().insertContentAt(position, { type: 'linkCardBlock', attrs: { ...fields, raw } }).run();
    if (!inserted) return setLinkCardError('The Link Card could not be inserted at this position.');
    setLinkCardDialog(false); setLinkCardTitle(''); setLinkCardDescription(''); setLinkCardHref(''); setLinkCardError('');
    onLinkCardInserted();
  };

  return (
    <div className="rich-editor">
      <div className="toolbar" role="toolbar" aria-label="Rich text formatting">
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
        <button type="button" onClick={() => setImagePicker(true)}>Insert image</button>
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert table</button>
        <button type="button" onClick={() => { setLinkCardDialog(true); setLinkCardError(''); }}>Insert → Link Card</button>
        {active?.table && <>
          <span className="toolbar-separator" aria-hidden="true" />
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </>}
      </div>
      <EditorContent editor={editor} />
      {imagePicker && <RepositoryImagePicker onClose={() => setImagePicker(false)} onSelect={(src, alt) => editor.chain().focus().setImage({ src, alt }).run()} />}
      {linkCardDialog && <div className="link-card-dialog" role="dialog" aria-modal="true" aria-labelledby="link-card-dialog-title">
        <div className="dialog-header"><h3 id="link-card-dialog-title">Insert Link Card</h3><button type="button" onClick={() => setLinkCardDialog(false)} aria-label="Close Link Card dialog">×</button></div>
        <label>Title<input required value={linkCardTitle} onChange={(event) => setLinkCardTitle(event.target.value)} /></label>
        <label>Description <span>(optional)</span><textarea rows={3} value={linkCardDescription} onChange={(event) => setLinkCardDescription(event.target.value)} /></label>
        <label>URL<input required value={linkCardHref} onChange={(event) => setLinkCardHref(event.target.value)} placeholder="https://… or /path/" /></label>
        {linkCardError && <p className="message error" role="alert">{linkCardError}</p>}
        <div className="actions"><button type="button" onClick={() => setLinkCardDialog(false)}>Cancel</button><button className="primary" type="button" onClick={insertLinkCard}>Insert Link Card</button></div>
      </div>}
    </div>
  );
}

function BodyEditor({ initialValue, onChange }: { initialValue: string; onChange: (value: string) => void }) {
  const [segments, setSegments] = useState(() => splitBody(initialValue));
  const [segmentSession, setSegmentSession] = useState(0);
  const segmentsRef = useRef(segments);
  const update = (id: number, content: string) => {
    const current = segmentsRef.current;
    const previous = current.find((segment) => segment.id === id)?.content || '';
    const leading = previous.match(/^(?:\r?\n)+/)?.[0] || '';
    const trailing = previous.match(/(?:\r?\n)+$/)?.[0] || '';
    const bounded = `${content.startsWith('\n') ? '' : leading}${content}${content.endsWith('\n') ? '' : trailing}`;
    const next = current.map((segment) => segment.id === id ? { ...segment, content: bounded } : segment);
    segmentsRef.current = next;
    setSegments(next);
    onChange(next.map((segment) => segment.content).join(''));
  };
  const finishLinkCardInsertion = () => {
    const body = segmentsRef.current.map((segment) => segment.content).join('');
    const ensured = ensureLinkCardImport(body);
    const next = splitBody(ensured.content);
    segmentsRef.current = next;
    setSegments(next);
    setSegmentSession((session) => session + 1);
    onChange(ensured.content);
  };
  return <div className="body-editor">
    {segments.map((segment) => segment.kind === 'protected'
      ? <details className="protected-block" key={`${segmentSession}:${segment.id}`}><summary>Existing MDX block (preserved, read-only)</summary><pre>{segment.content}</pre></details>
      : <RichTextEditor key={`${segmentSession}:${segment.id}`} initialValue={segment.content} onChange={(content) => update(segment.id, content)} onLinkCardInserted={finishLinkCardInsertion} />)}
  </div>;
}

function BlogMetadata({ project, onChange }: { project: Project; onChange: (project: Project) => void }) {
  const [coverPicker, setCoverPicker] = useState<string | null>(null);
  const authors = project.authors || [];
  const tags = project.tags || [];
  const cover = project.cover;
  return <>
    <label>Publication date<input type="date" value={project.date || ''} onChange={(event) => onChange({ ...project, date: event.target.value })} /></label>
    <label>Excerpt <span>(optional)</span><textarea rows={3} value={project.excerpt || ''} onChange={(event) => onChange({ ...project, excerpt: event.target.value })} /></label>
    <fieldset className="metadata-group"><legend>Authors (optional)</legend>
      {authors.map((author, index) => <div className="metadata-row" key={index}>
        <label>Author {index + 1}<input value={typeof author === 'string' ? author : author.name} onChange={(event) => onChange({ ...project, authors: authors.map((item, at) => at === index ? typeof item === 'string' ? event.target.value : { ...item, name: event.target.value } : item) })} /></label>
        <button type="button" onClick={() => onChange({ ...project, authors: authors.filter((_, at) => at !== index) })}>Remove author {index + 1}</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...project, authors: [...authors, { name: '' }] })}>Add author</button>
    </fieldset>
    <fieldset className="metadata-group"><legend>Tags (optional)</legend>
      {tags.map((tag, index) => <div className="metadata-row" key={index}>
        <label>Tag {index + 1}<input value={tag} onChange={(event) => onChange({ ...project, tags: tags.map((item, at) => at === index ? event.target.value : item) })} /></label>
        <button type="button" onClick={() => onChange({ ...project, tags: tags.filter((_, at) => at !== index) })}>Remove tag {index + 1}</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...project, tags: [...tags, ''] })}>Add tag</button>
    </fieldset>
    <fieldset className="metadata-group"><legend>Cover image (optional)</legend>
      {cover ? <>
        {('light' in cover && !('image' in cover) ? ['light', 'dark'] : ['image']).map((field) => <div key={field}>
          <label>{field === 'image' ? 'Image' : `${field} image`} URL or repository path<input value={String(cover[field] || '')} placeholder="@images/example.png or https://…" onChange={(event) => onChange({ ...project, cover: { ...cover, [field]: event.target.value } })} /></label>
          <button type="button" onClick={() => setCoverPicker(field)}>Choose or upload {field === 'image' ? 'image' : `${field} image`}</button>
        </div>)}
        <label>Cover alt text<input value={cover.alt || ''} onChange={(event) => onChange({ ...project, cover: { ...cover, alt: event.target.value } })} /></label>
        <label>Cover caption <span>(optional)</span><input value={cover.caption || ''} onChange={(event) => onChange({ ...project, cover: { ...cover, caption: event.target.value } })} /></label>
        <button type="button" onClick={() => onChange({ ...project, cover: null })}>Remove cover</button>
      </> : <button type="button" onClick={() => onChange({ ...project, cover: { image: '', alt: '' } })}>Add cover image</button>}
      <p>Uploads are saved to staging immediately, even if you discard the post.</p>
    </fieldset>
    {coverPicker && <RepositoryImagePicker onClose={() => setCoverPicker(null)} onSelect={(image, alt) => { onChange({ ...project, cover: { ...cover, [coverPicker]: image, alt } }); setCoverPicker(null); }} />}
  </>;
}

export default function ProjectEditor() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [area, setArea] = useState<AreaName>('projects');
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
  const canLeave = () => !dirty || window.confirm('Discard unsaved changes? Download a recovery copy first if you need to keep them.');

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const config = CONTENT_AREAS[area];
  const loadList = async (nextArea: AreaName = area) => {
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
        if (session.authenticated) void loadList();
      })
      .catch((err) => { setViewer(null); setError((err as Error).message); });
  }, []);

  const logout = async () => {
    if (!canLeave()) return;
    await api('/api/auth/logout', { method: 'POST' });
    setProject(null); setProjects([]); setViewer(null); setNotice(''); setError('');
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
    setError(''); setNotice('');
    setProject({ filename: '', content: '', title: '', description: '', draft: isBlog, body: '', ...(isBlog ? { date: todayCalendar(), excerpt: '', authors: [], tags: [], cover: null } : {}) });
    setSuggestedFilename(''); setSavedSnapshot('');
    setBodyEditorSession((session) => session + 1);
  };

  const selectArea = (nextArea: AreaName) => {
    if (!canLeave()) return;
    setArea(nextArea); setProject(null); setProjects([]); setNotice(''); setError('');
    void loadList(nextArea);
  };

  const save = async (publish: boolean, alternative?: string) => {
    if (!project) return;
    if (!project.title.trim()) return setError('Title is required.');
    const slug = project.sha ? project.filename.replace(/\.mdx?$/, '') : slugify(project.filename || project.title);
    if (!isBlog && !slug) return setError('Enter a title or filename before saving.');
    const filename = project.sha ? project.filename : `${slug}.mdx`;
    const creatingBlog = isBlog && !project.sha;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Project & { commitSha: string }>(creatingBlog ? '/api/content/posts' : `/api/content/${area}/${encodeURIComponent(filename)}`, {
        method: creatingBlog ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isBlog ? { date: project.date, excerpt: project.excerpt, authors: project.authors, tags: project.tags, cover: project.cover, draft: project.draft, suggestedFilename: alternative } : {}),
          title: project.title,
          description: project.description,
          body: project.body,
          publish,
          sha: project.sha,
          originalContent: project.content,
        }),
      });
      const next = { ...project, ...saved, filename: saved.filename || filename, draft: config.publishing ? !publish : project.draft };
      setProject(next); setSavedSnapshot(JSON.stringify(next)); setSuggestedFilename('');
      setBranch(saved.branch || 'custom-cms');
      setNotice(`${config.publishing ? (publish ? 'Published' : 'Draft saved') : 'Changes saved'} on custom-cms (commit ${saved.commitSha.slice(0, 7)}).`);
      await loadList();
    } catch (err) {
      setSuggestedFilename((err as Error & { suggestedFilename?: string }).suggestedFilename || '');
      const message = (err as Error).message;
      setError(!isBlog && message.includes('changed in GitHub') ? CONFLICT : message);
    } finally { setBusy(false); }
  };

  if (!project) return (
    <main className="editor-shell">
      <header><p className="eyebrow">Staging</p><h1>Content editor</h1><p>Signed in as <strong>{viewer}</strong>. Files are read from <code>{branch}</code>{branch === 'main' ? ' until the prototype branch is created by the first save' : ''}.</p><button className="link-button" type="button" onClick={logout}>Sign out</button></header>
      {error && <p className="message error" role="alert">{error}</p>}
      <label className="area-selector">Content area<select value={area} onChange={(event) => selectArea(event.target.value as AreaName)}>{Object.entries(CONTENT_AREAS).map(([name, item]) => <option key={name} value={name}>{item.label}</option>)}</select></label>
      <div className="list-heading"><h2>{config.label}</h2>{config.create && <button className="primary" type="button" onClick={create}>New {config.itemLabel}</button>}</div>
      {busy ? <p>Loading…</p> : <ul className="project-list">{sortedProjects.map((item) => <li key={item.path}><button type="button" onClick={() => open(item.name)}>{item.name.replace(/\.mdx?$/, '')}</button></li>)}</ul>}
    </main>
  );

  return (
    <main className="editor-shell">
      <button className="back" type="button" disabled={busy} onClick={() => { if (!canLeave()) return; setProject(null); setNotice(''); setError(''); }}>← All {config.label}</button>
      <h1>{project.sha ? `Edit ${config.itemLabel}` : `New ${config.itemLabel}`}</h1>
      {notice && <p className="message success" role="status">{notice}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      {isBlog && <p>{project.sha ? `Saved URL: /posts/${project.filename.replace(/\.mdx?$/, '').replace(/\/index$/, '')}/` : 'The URL is generated from the title on first save and stays permanent.'} Saves go to staging. Publishing to the live site requires review and merge.</p>}
      {suggestedFilename && !project.sha && <button type="button" disabled={busy} onClick={() => save(false, suggestedFilename)}>Create as {suggestedFilename.replace(/\.mdx$/, '')}</button>}
      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset className="editor-fields" disabled={busy}>
        {!project.sha && !isBlog && <label>Filename <span>(optional; generated from title)</span><input value={project.filename} onChange={(event) => setProject({ ...project, filename: slugify(event.target.value) })} placeholder="example-project" /></label>}
        {(config.publishing || isBlog) && <label className="checkbox"><input type="checkbox" checked={project.draft} onChange={(event) => setProject({ ...project, draft: event.target.checked })} /> Hide from site</label>}
        <label>Title<input required value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} /></label>
        {config.description && <label>Description<textarea required rows={3} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></label>}
        {isBlog && <BlogMetadata project={project} onChange={setProject} />}
        <label>Body</label>
        <div inert={busy}><BodyEditor key={bodyEditorSession} initialValue={project.body} onChange={(body) => setProject((current) => current ? { ...current, body } : current)} /></div>
        <div className="actions">{config.publishing ? <><button disabled={busy} type="button" onClick={() => save(false)}>Save draft</button><button disabled={busy} className="primary" type="button" onClick={() => save(true)}>Publish</button></> : <button disabled={busy} className="primary" type="button" onClick={() => save(false)}>Save changes</button>}</div>
        </fieldset>
      </form>
      {isBlog && <button type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'blog-recovery.json'; link.click(); URL.revokeObjectURL(url);
      }}>Download recovery copy</button>}

    </main>
  );
}

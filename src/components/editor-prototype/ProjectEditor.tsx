import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { splitBody } from './bodySegments';
import { richTextEditorOptions } from './richTextEditor';
import { CONTENT_AREAS } from '../../../editor-prototype/contentAreas.mjs';

const API = import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const CONFLICT = 'This page has changed in GitHub since you opened it. Reload the latest version before saving.';

type ProjectListItem = { name: string; path: string; sha: string };
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
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function RichTextEditor({ initialValue, onChange }: { initialValue: string; onChange: (value: string) => void }) {
  const editor = useEditor({ ...richTextEditorOptions(initialValue, onChange), immediatelyRender: false });
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
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert table</button>
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
    </div>
  );
}

function BodyEditor({ initialValue, onChange }: { initialValue: string; onChange: (value: string) => void }) {
  const [segments, setSegments] = useState(() => splitBody(initialValue));
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
  return <div className="body-editor">
    {segments.map((segment) => segment.kind === 'protected'
      ? <details className="protected-block" key={segment.id}><summary>Existing MDX block (preserved, read-only)</summary><pre>{segment.content}</pre></details>
      : <RichTextEditor key={segment.id} initialValue={segment.content} onChange={(content) => update(segment.id, content)} />)}
  </div>;
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
      setProject(await api<Project>(`/api/content/${area}/${encodeURIComponent(filename)}`));
      setBodyEditorSession((session) => session + 1);
    }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const create = () => {
    setError(''); setNotice('');
    setProject({ filename: '', content: '', title: '', description: '', draft: true, body: '' });
    setBodyEditorSession((session) => session + 1);
  };

  const selectArea = (nextArea: AreaName) => {
    setArea(nextArea); setProject(null); setProjects([]); setNotice(''); setError('');
    void loadList(nextArea);
  };

  const save = async (publish: boolean) => {
    if (!project) return;
    const slug = project.sha ? project.filename.replace(/\.mdx?$/, '') : slugify(project.filename || project.title);
    if (!slug) return setError('Enter a title or filename before saving.');
    const filename = `${slug}.mdx`;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Project & { commitSha: string }>(`/api/content/${area}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          description: project.description,
          body: project.body,
          publish,
          sha: project.sha,
          originalContent: project.content,
        }),
      });
      setProject({ ...project, ...saved, filename, draft: config.publishing ? !publish : project.draft });
      setBranch(saved.branch || 'custom-cms');
      setNotice(`${config.publishing ? (publish ? 'Published' : 'Draft saved') : 'Changes saved'} on custom-cms (commit ${saved.commitSha.slice(0, 7)}).`);
      await loadList();
    } catch (err) {
      const message = (err as Error).message;
      setError(message.includes('changed in GitHub') ? CONFLICT : message);
    } finally { setBusy(false); }
  };

  if (!project) return (
    <main className="editor-shell">
      <header><p className="eyebrow">Staging</p><h1>Content editor</h1><p>Signed in as <strong>{viewer}</strong>. Files are read from <code>{branch}</code>{branch === 'main' ? ' until the prototype branch is created by the first save' : ''}.</p><button className="link-button" type="button" onClick={logout}>Sign out</button></header>
      {error && <p className="message error" role="alert">{error}</p>}
      <label className="area-selector">Content area<select value={area} onChange={(event) => selectArea(event.target.value as AreaName)}>{Object.entries(CONTENT_AREAS).map(([name, item]) => <option key={name} value={name}>{item.label}</option>)}</select></label>
      <div className="list-heading"><h2>{config.label}</h2>{config.create && <button className="primary" type="button" onClick={create}>New Project</button>}</div>
      {busy ? <p>Loading…</p> : <ul className="project-list">{sortedProjects.map((item) => <li key={item.path}><button type="button" onClick={() => open(item.name)}>{item.name.replace(/\.mdx?$/, '')}</button></li>)}</ul>}
    </main>
  );

  return (
    <main className="editor-shell">
      <button className="back" type="button" onClick={() => { setProject(null); setNotice(''); setError(''); }}>← All {config.label}</button>
      <h1>{project.sha ? `Edit ${config.label}` : 'New Project'}</h1>
      {notice && <p className="message success" role="status">{notice}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      <form onSubmit={(event) => event.preventDefault()}>
        {!project.sha && <label>Filename <span>(optional; generated from title)</span><input value={project.filename} onChange={(event) => setProject({ ...project, filename: slugify(event.target.value) })} placeholder="example-project" /></label>}
        <label>Title<input required value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} /></label>
        {config.description && <label>Description<textarea required rows={3} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></label>}
        <label>Body</label>
        <BodyEditor key={bodyEditorSession} initialValue={project.body} onChange={(body) => setProject((current) => current ? { ...current, body } : current)} />
        {config.publishing && <label className="checkbox"><input type="checkbox" checked={project.draft} onChange={(event) => setProject({ ...project, draft: event.target.checked })} /> Hide from site</label>}
        <div className="actions">{config.publishing ? <><button disabled={busy} type="button" onClick={() => save(false)}>Save draft</button><button disabled={busy} className="primary" type="button" onClick={() => save(true)}>Publish</button></> : <button disabled={busy} className="primary" type="button" onClick={() => save(false)}>Save changes</button>}</div>
      </form>
    </main>
  );
}

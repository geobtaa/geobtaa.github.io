import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');
const CONFLICT = 'This page has changed in GitHub since you opened it. Reload the latest version before saving.';

type ProjectListItem = { name: string; path: string; sha: string };
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
type BodySegment = { id: number; kind: 'markdown' | 'protected'; content: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function splitBody(body: string): BodySegment[] {
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) || [];
  const segments: BodySegment[] = [];
  let markdown = '';
  const push = (kind: BodySegment['kind'], content: string) => {
    if (!content) return;
    const previous = segments.at(-1);
    if (previous?.kind === kind) previous.content += content;
    else segments.push({ id: segments.length, kind, content });
  };
  const flushMarkdown = () => { push('markdown', markdown); markdown = ''; };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (/^\s*(import|export)\s/.test(line)) {
      flushMarkdown(); push('protected', line); index += 1; continue;
    }
    if (/^\s*:::/.test(line)) {
      flushMarkdown(); let block = line; index += 1;
      while (index < lines.length) { block += lines[index]; if (/^\s*:::\s*$/.test(lines[index])) { index += 1; break; } index += 1; }
      push('protected', block); continue;
    }
    const tag = line.match(/<([A-Za-z][\w.-]*)\b/);
    if (tag && (/^\s*</.test(line) || /^[A-Z]/.test(tag[1]))) {
      flushMarkdown(); let block = line; index += 1;
      const closing = new RegExp(`</${tag[1]}\\s*>`);
      if (!line.includes('/>') && !closing.test(line)) {
        const startsBlock = line.includes('>');
        while (index < lines.length) {
          block += lines[index];
          const done = startsBlock ? closing.test(lines[index]) : lines[index].includes('/>');
          index += 1;
          if (done) break;
        }
      }
      push('protected', block); continue;
    }
    markdown += line; index += 1;
  }
  flushMarkdown();
  return segments.length ? segments : [{ id: 0, kind: 'markdown', content: '' }];
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown],
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });

  useEffect(() => {
    if (editor && editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: 'markdown' });
  }, [editor, value]);

  if (!editor) return null;
  const link = () => {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('Link URL', previous);
    if (href === null) return;
    if (!href) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="rich-editor">
      <div className="toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" onClick={() => editor.chain().focus().setParagraph().run()}>Paragraph</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
        <button type="button" aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>Bold</strong></button>
        <button type="button" aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>Italic</em></button>
        <button type="button" onClick={link}>Link</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>Numbered</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function BodyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [segments, setSegments] = useState(() => splitBody(value));
  const update = (id: number, content: string) => {
    setSegments((current) => {
      const previous = current.find((segment) => segment.id === id)?.content || '';
      const leading = previous.match(/^(?:\r?\n)+/)?.[0] || '';
      const trailing = previous.match(/(?:\r?\n)+$/)?.[0] || '';
      const bounded = `${content.startsWith('\n') ? '' : leading}${content}${content.endsWith('\n') ? '' : trailing}`;
      const next = current.map((segment) => segment.id === id ? { ...segment, content: bounded } : segment);
      onChange(next.map((segment) => segment.content).join(''));
      return next;
    });
  };
  return <div className="body-editor">
    {segments.map((segment) => segment.kind === 'protected'
      ? <details className="protected-block" key={segment.id}><summary>Existing MDX block (preserved, read-only)</summary><pre>{segment.content}</pre></details>
      : <RichTextEditor key={segment.id} value={segment.content} onChange={(content) => update(segment.id, content)} />)}
  </div>;
}

export default function ProjectEditor() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [branch, setBranch] = useState('custom-cms');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<string | null | undefined>(undefined);

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const loadList = async () => {
    setBusy(true); setError('');
    try {
      const data = await api<{ projects: ProjectListItem[]; branch: string }>('/api/projects');
      setProjects(data.projects); setBranch(data.branch);
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
      <p className="eyebrow">Staging</p><h1>Project editor</h1>
      <p>Sign in with a GitHub account that can write to <code>geobtaa/geobtaa.github.io</code>.</p>
      {error && <p className="message error" role="alert">{error}</p>}
      <a className="button primary" href={`${API}/api/auth/login`}>Sign in with GitHub</a>
    </main>
  );

  const open = async (filename: string) => {
    setBusy(true); setError(''); setNotice('');
    try { setProject(await api<Project>(`/api/projects/${encodeURIComponent(filename)}`)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const create = () => {
    setError(''); setNotice('');
    setProject({ filename: '', content: '', title: '', description: '', draft: true, body: '' });
  };

  const save = async (publish: boolean) => {
    if (!project) return;
    const slug = project.sha ? project.filename.replace(/\.mdx?$/, '') : slugify(project.filename || project.title);
    if (!slug) return setError('Enter a title or filename before saving.');
    const filename = `${slug}.mdx`;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api<Project & { commitSha: string }>(`/api/projects/${encodeURIComponent(filename)}`, {
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
      setProject({ ...project, ...saved, filename, draft: !publish });
      setBranch(saved.branch || 'custom-cms');
      setNotice(`${publish ? 'Published' : 'Draft saved'} on custom-cms (commit ${saved.commitSha.slice(0, 7)}).`);
      await loadList();
    } catch (err) {
      const message = (err as Error).message;
      setError(message.includes('changed in GitHub') ? CONFLICT : message);
    } finally { setBusy(false); }
  };

  if (!project) return (
    <main className="editor-shell">
      <header><p className="eyebrow">Staging</p><h1>Project editor</h1><p>Signed in as <strong>{viewer}</strong>. Files are read from <code>{branch}</code>{branch === 'main' ? ' until the prototype branch is created by the first save' : ''}.</p><button className="link-button" type="button" onClick={logout}>Sign out</button></header>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="list-heading"><h2>Projects</h2><button className="primary" type="button" onClick={create}>New Project</button></div>
      {busy ? <p>Loading…</p> : <ul className="project-list">{sortedProjects.map((item) => <li key={item.path}><button type="button" onClick={() => open(item.name)}>{item.name.replace(/\.mdx?$/, '')}</button></li>)}</ul>}
    </main>
  );

  return (
    <main className="editor-shell">
      <button className="back" type="button" onClick={() => { setProject(null); setNotice(''); setError(''); }}>← All Projects</button>
      <h1>{project.sha ? 'Edit Project' : 'New Project'}</h1>
      {notice && <p className="message success" role="status">{notice}</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      <form onSubmit={(event) => event.preventDefault()}>
        {!project.sha && <label>Filename <span>(optional; generated from title)</span><input value={project.filename} onChange={(event) => setProject({ ...project, filename: slugify(event.target.value) })} placeholder="example-project" /></label>}
        <label>Title<input required value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} /></label>
        <label>Description<textarea required rows={3} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></label>
        <label>Body</label>
        <BodyEditor key={`${project.filename}:${project.sha || 'new'}`} value={project.body} onChange={(body) => setProject((current) => current ? { ...current, body } : current)} />
        <label className="checkbox"><input type="checkbox" checked={project.draft} onChange={(event) => setProject({ ...project, draft: event.target.checked })} /> Hide from site</label>
        <div className="actions"><button disabled={busy} type="button" onClick={() => save(false)}>Save draft</button><button disabled={busy} className="primary" type="button" onClick={() => save(true)}>Publish</button></div>
      </form>
    </main>
  );
}

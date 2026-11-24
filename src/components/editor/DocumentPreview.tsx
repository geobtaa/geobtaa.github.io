import { ProtectedSource } from './ProtectedSource';
import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { splitBody } from './bodySegments';
import { richTextEditorOptions } from './richTextEditor';
import type { Project } from './editorTypes';
import './preview.css';
import { ContainedLinkCardsEditor } from './ContainedLinkCardsEditor';

function PreviewText({ content, apiBase, article }: { content: string; apiBase: string; article: boolean }) {
  const editor = useEditor({
    ...richTextEditorOptions(content, () => {}, apiBase, undefined, true, article),
    immediatelyRender: false,
  });
  useEffect(() => {
    editor?.commands.setContent(content, { contentType: 'markdown', emitUpdate: false });
  }, [content, editor]);
  return <EditorContent editor={editor} />;
}

function calendarDate(value?: string) {
  const calendar = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!calendar) return '';
  const date = new Date(`${calendar}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? calendar : new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function DocumentPreview({ project, area, apiBase }: { project: Project; area: string; apiBase: string }) {
  const segments = useMemo(() => splitBody(project.body, { format: project.filename.endsWith('.md') ? 'md' : 'mdx' }).filter(segment => segment.content.trim() && segment.protectedType !== 'setup'), [project.body, project.filename]);
  const article = area === 'posts' || area === 'updates';
  const showMeta = article || area === 'library';
  const authors = (project.authors || []).map(author => typeof author === 'string' ? author : author.name).filter(name => name.trim());
  const date = calendarDate(project.date);
  return <section id="document-preview" aria-label="Document preview">
    <p className="preview-notice">Preview of current content, including unsaved changes. Protected Markdown and components appear as placeholders. Page setup is preserved and omitted from this preview. Links open in a new tab.</p>
    <article className="cms-preview">
      <header className="preview-header">
        {project.metadata?.hidePageTitle
          ? <p className="preview-meta">Page title hidden: {project.title || 'Untitled page'}</p>
          : <h1>{project.title || 'Untitled page'}</h1>}
        {showMeta && <div className="preview-meta">
          {authors.length > 0 && <span>By: {authors.join(', ')}</span>}
          {date && <time dateTime={project.date?.slice(0, 10)}>{date}</time>}
          {area === 'library' && project.metadata?.year && <span>Created: {project.metadata.year}</span>}
          {!!project.tags?.length && <ul className="preview-tags">{project.tags.map((tag, index) => <li key={index}>{tag}</li>)}</ul>}
        </div>}
        {area === 'library' && project.description && <p className="preview-summary">Summary: {project.description}</p>}
      </header>
      {segments.map(segment => segment.kind === 'protected'
        ? segment.legacyChipList || segment.legacyCardGrid ? <PreviewText key={segment.id} content={segment.content} apiBase={apiBase} article={article} /> : segment.containedLinkCards ? <ContainedLinkCardsEditor key={segment.id} source={segment.content} readOnly /> : <ProtectedSource key={segment.id} segment={segment} preview />
        : <PreviewText key={segment.id} content={segment.content} apiBase={apiBase} article={article} />)}
      {!segments.length && <p className="preview-meta">No body content yet.</p>}
    </article>
  </section>;
}

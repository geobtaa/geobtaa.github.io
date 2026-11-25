export const BLOG_PAGE_SIZE = 12;
export const archivePageUrl = (page: number) => page <= 1 ? '/blog/' : `/blog/page/${page}/`;

export type ArchiveSelection = { query: string; type: string; year: string; shown: number };

export function readArchiveSelection(params: URLSearchParams, page = 1): ArchiveSelection {
  const shown = Number(params.get('shown'));
  return {
    query: params.get('q')?.trim() ?? '',
    type: ['post', 'update'].includes(params.get('type') ?? '') ? params.get('type')! : 'all',
    year: /^\d{4}$/.test(params.get('year') ?? '') ? params.get('year')! : '',
    shown: Number.isSafeInteger(shown) && shown > 0 ? Math.max(BLOG_PAGE_SIZE, shown) : page * BLOG_PAGE_SIZE,
  };
}

export function matchesArchiveItem(item: { category: string; year: string; search: string }, selection: ArchiveSelection) {
  const terms = selection.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (selection.type === 'all' || item.category === selection.type)
    && (!selection.year || item.year === selection.year)
    && terms.every((term) => item.search.toLocaleLowerCase().includes(term));
}

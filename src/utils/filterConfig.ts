import { loadBlogContent } from './blogContent';
import { loadLibraryContent } from './libraryContent';

export type FilterPanelProps = {
  tags: string[];
  authors: string[];
  years: string[];
  selectedTags: string[];
  selectedAuthors: string[];
  selectedYears: string[];
  context?: string;
  query?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  tagsLabel?: string;
  authorsEnabled?: boolean;
};

export type FilterPlacement = 'sidebar' | 'top';

export type FilterConfig = {
  heading: string;
  resetLabel: string;
  context: string;
  props: FilterPanelProps;
  placement: FilterPlacement;
};

type BlogContent = Awaited<ReturnType<typeof loadBlogContent>>;
type LibraryContent = Awaited<ReturnType<typeof loadLibraryContent>>;

type Options = {
  blogContent?: BlogContent;
  libraryContent?: LibraryContent;
};

const normalisePath = (pathname: string): string =>
  pathname.endsWith('/') ? pathname : `${pathname}/`;

const buildBlogFilterConfig = (
  data: BlogContent,
  params: URLSearchParams,
): FilterConfig => {
  const props: FilterPanelProps = {
    tags: data.tags,
    authors: data.authors,
    years: data.years.map((year) => String(year)),
    selectedTags: params.getAll('tag'),
    selectedAuthors: params.getAll('author'),
    selectedYears: params.getAll('year'),
    context: 'blog',
  };

  return {
    heading: 'Filter posts',
    resetLabel: 'Clear filters',
    context: 'blog',
    props,
    placement: 'top',
  };
};

const buildLibraryFilterConfig = (
  data: LibraryContent,
  params: URLSearchParams,
): FilterConfig => {
  const props: FilterPanelProps = {
    tags: data.tags,
    authors: [],
    years: data.years.map((year) => String(year)),
    selectedTags: params.getAll('tag'),
    selectedAuthors: [],
    selectedYears: params.getAll('year'),
    context: 'library',
    authorsEnabled: false,
    tagsLabel: 'Type',
  };

  return {
    heading: 'Filter documents',
    resetLabel: 'Clear filters',
    context: 'library',
    props,
    placement: 'top',
  };
};

export async function getFilterConfigForPath(
  pathname: string,
  searchParams: URLSearchParams,
  options: Options = {},
): Promise<FilterConfig | null> {
  const params = new URLSearchParams(searchParams);
  const normalised = normalisePath(pathname);

  if (normalised === '/blog/') {
    const data = options.blogContent ?? (await loadBlogContent());
    return buildBlogFilterConfig(data, params);
  }

  if (normalised === '/library/') {
    const data = options.libraryContent ?? (await loadLibraryContent());
    return buildLibraryFilterConfig(data, params);
  }

  return null;
}

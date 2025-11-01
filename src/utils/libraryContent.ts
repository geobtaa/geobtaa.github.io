import { getCollection, type CollectionEntry } from 'astro:content';

export type LibraryItem = {
  id: string;
  url: string;
  title: string;
  summary: string;
  tags: string[];
  authors: string[];
  year?: number;
  dateValue: number;
  searchIndex: string;
  order: number;
};

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const collectTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((tag) => toStringOrNull(tag))
        .filter(Boolean) as string[]
    : [];

const collectAuthorNames = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAuthorNames(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const normalised = value.trim();
    return normalised ? [normalised] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const name = toStringOrNull(record.name);
    return name ? [name] : [];
  }
  return [];
};

const deriveTitle = (entry: CollectionEntry<'docs'>, fallback: string | null) => {
  const slug = entry.id.split('/').pop();
  if (fallback) return fallback;
  if (slug) return slug.replace(/[-_]/g, ' ');
  return entry.id;
};

const parseYear = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

export async function loadLibraryContent() {
  const entries = (await getCollection('docs', ({ id }) => id.startsWith('library/'))) as CollectionEntry<'docs'>[];

  const filtered = entries.filter(
    (entry) => entry?.data?.draft !== true && entry?.data?.sidebar?.hidden !== true,
  );

  const itemsWithoutOrder = filtered.map((entry) => {
    const data = entry.data as Record<string, unknown>;
    const url = `/${entry.id.replace(/\/index$/, '')}/`;

    const titleValue = toStringOrNull(data.title);
    const title = deriveTitle(entry, titleValue);

    const descriptionValue = toStringOrNull(data.description);
    const summary = descriptionValue ?? '';

    const tags = collectTags((data as { tags?: unknown }).tags);
    const authors = [
      ...collectAuthorNames((data as { authors?: unknown }).authors),
      ...collectAuthorNames((data as { author?: unknown }).author),
    ];
    const uniqueAuthors = Array.from(new Set(authors));

    const primaryDate =
      toDate((data as { date?: unknown }).date) ??
      toDate((data as { lastUpdated?: unknown }).lastUpdated) ??
      undefined;

    const yearFromFrontmatter = parseYear((data as { year?: unknown }).year);
    const year = yearFromFrontmatter ?? primaryDate?.getFullYear();
    const dateValue =
      primaryDate?.getTime() ??
      (typeof year === 'number' ? new Date(year, 0, 1).getTime() : 0);

    const searchIndex = [
      title,
      summary,
      tags.join(' '),
      uniqueAuthors.join(' '),
      typeof year === 'number' ? String(year) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return {
      id: entry.id,
      url,
      title,
      summary,
      tags,
      authors: uniqueAuthors,
      year,
      dateValue,
      searchIndex,
    };
  });

  const sortedItems = itemsWithoutOrder
    .sort((a, b) => {
      if (b.dateValue !== a.dateValue) return b.dateValue - a.dateValue;
      return a.title.localeCompare(b.title);
    })
    .map((item, index) => ({ ...item, order: index }));

  const tags = Array.from(new Set(sortedItems.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
  const authors = Array.from(new Set(sortedItems.flatMap((item) => item.authors))).sort((a, b) =>
    a.localeCompare(b),
  );
  const years = Array.from(
    new Set(sortedItems.map((item) => item.year).filter((value): value is number => typeof value === 'number')),
  ).sort((a, b) => b - a);

  return {
    items: sortedItems satisfies LibraryItem[],
    tags,
    authors,
    years,
  };
}

import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogItem = {
  id: string;
  url: string;
  category: 'post' | 'update';
  title: string;
  excerpt: string;
  tags: string[];
  authors: string[];
  published?: Date;
  year?: number;
  cover?: {
    image: string;
    alt: string;
  };
};

const localImageModules = import.meta.glob('../assets/images/**/*', {
  eager: true,
  import: 'default',
});

const resolveCoverImage = (image: unknown): string | undefined => {
  if (!image) return undefined;
  if (image instanceof URL) {
    return image.toString();
  }
  if (typeof image === 'object' && image !== null && 'src' in image) {
    const src = (image as { src?: unknown }).src;
    if (typeof src === 'string') {
      return src;
    }
    if (src instanceof URL) {
      return src.toString();
    }
  }
  if (typeof image !== 'string') {
    return undefined;
  }
  if (image.startsWith('@images/')) {
    const path = image.slice('@images/'.length);
    const key = `../assets/images/${path}`;
    const resolved = localImageModules[key];
    if (typeof resolved === 'string') {
      return resolved;
    }
  }
  return image;
};

const extractCover = (cover: unknown): BlogItem['cover'] | undefined => {
  if (!cover || typeof cover !== 'object') return undefined;
  const record = cover as Record<string, unknown>;

  if ('image' in record) {
    const image = resolveCoverImage(record.image);
    if (!image) return undefined;
    const alt = typeof record.alt === 'string' ? record.alt : '';
    return { image, alt };
  }

  if ('light' in record) {
    const lightImage = resolveCoverImage(record.light);
    if (!lightImage) return undefined;
    const alt = typeof record.alt === 'string' ? record.alt : '';
    return { image: lightImage, alt };
  }

  return undefined;
};

const normalizeDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

const collectionFilter = ({ id, data }: CollectionEntry<'docs'>) =>
  (id.startsWith('posts/') || id.startsWith('updates/')) && data?.draft !== true;

export async function loadBlogContent() {
  const entries = (await getCollection('docs', collectionFilter)) as CollectionEntry<'docs'>[];

  const items: BlogItem[] = entries.map((entry) => {
    const data = entry.data as Record<string, unknown>;
    const published = normalizeDate((data as { date?: unknown }).date);
    const year = published?.getFullYear();
    const tagsRaw = (data as { tags?: unknown }).tags;
    const tags = Array.isArray(tagsRaw) ? tagsRaw.map((tag) => String(tag)) : [];
    const authorsRaw = (data as { authors?: unknown }).authors;
    const authors = Array.isArray(authorsRaw)
      ? authorsRaw
          .map((author: unknown) => {
            if (typeof author === 'string') return author;
            if (author && typeof author === 'object' && 'name' in author && typeof author.name === 'string') {
              return author.name;
            }
            return null;
          })
          .filter(Boolean) as string[]
      : [];
    const cover = extractCover((data as { cover?: unknown }).cover);
    const category: 'post' | 'update' = entry.id.startsWith('updates/') ? 'update' : 'post';
    const url = `/${entry.id.replace(/\/index$/, '')}/`;
    const titleValue = (data as { title?: unknown }).title;
    const title =
      typeof titleValue === 'string'
        ? titleValue
        : entry.id.split('/').pop()?.replace(/-/g, ' ') ?? entry.id;
    const excerptValue = (data as { excerpt?: unknown }).excerpt;
    const descriptionValue = (data as { description?: unknown }).description;
    const excerpt =
      typeof excerptValue === 'string'
        ? excerptValue
        : typeof descriptionValue === 'string'
          ? descriptionValue
          : '';

    return {
      id: entry.id,
      url,
      category,
      title,
      excerpt,
      tags,
      authors,
      published,
      year,
      cover,
    };
  });

  const tags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b)
  );
  const authors = Array.from(new Set(items.flatMap((item) => item.authors))).sort((a, b) =>
    a.localeCompare(b)
  );
  const years = Array.from(new Set(items.map((item) => item.year).filter(Boolean) as number[])).sort(
    (a, b) => b - a
  );

  return {
    items,
    tags,
    authors,
    years,
  };
}

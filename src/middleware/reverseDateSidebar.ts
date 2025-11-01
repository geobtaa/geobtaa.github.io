import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { getEntry } from 'astro:content';

import { SIDEBAR_AUTOGENERATE_SORTS } from '../../navigation.config';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;
type SidebarGroup = Extract<SidebarEntry, { type: 'group' }>;

const dateCache = new Map<string, Promise<Date | undefined>>();

const normalizeHref = (href: string) => href.split('#')[0]?.split('?')[0] ?? href;

const stripSlashes = (value: string) => value.replace(/^\/+/, '').replace(/\/+$/, '');

const buildCandidateIds = (href: string, locale: string | undefined): string[] => {
  const candidates = new Set<string>();
  const cleaned = stripSlashes(normalizeHref(href));
  if (!cleaned) return [];

  candidates.add(cleaned);
  if (cleaned.endsWith('/index')) {
    candidates.add(cleaned.slice(0, -'/index'.length));
  }

  const segments = cleaned.split('/');
  if (segments.length > 1) {
    candidates.add(segments.slice(1).join('/'));
  }

  if (locale && cleaned.startsWith(`${locale}/`)) {
    const withoutLocale = cleaned.slice(locale.length + 1);
    if (withoutLocale) {
      candidates.add(withoutLocale);
      if (withoutLocale.endsWith('/index')) {
        candidates.add(withoutLocale.slice(0, -'/index'.length));
      }
    }
  }

  return Array.from(candidates);
};

const loadDateForHref = async (href: string, locale: string | undefined): Promise<Date | undefined> => {
  const cacheKey = `${locale ?? ''}|${href}`;
  let cached = dateCache.get(cacheKey);
  if (!cached) {
    cached = (async () => {
      for (const candidate of buildCandidateIds(href, locale)) {
        try {
          const entry = await getEntry('docs', candidate);
          if (!entry) continue;
          const value = (entry.data as { date?: unknown }).date;
          if (!value) return undefined;
          if (value instanceof Date) return value;
          const parsed = new Date(String(value));
          if (!Number.isNaN(parsed.valueOf())) return parsed;
        } catch (error) {
          // Ignore lookup failures and try the next candidate.
          continue;
        }
      }
      return undefined;
    })();
    dateCache.set(cacheKey, cached);
  }
  return cached;
};

const sortEntriesByNewestDate = async (
  entries: SidebarEntry[],
  locale: string | undefined,
): Promise<SidebarEntry[]> => {
  const decorated = await Promise.all(
    entries.map(async (entry, index) => {
      if (entry.type !== 'link') return { entry, index, date: undefined, isLink: false } as const;
      const date = await loadDateForHref(entry.href, locale);
      return { entry, index, date, isLink: true } as const;
    }),
  );

  const links = decorated
    .filter((item) => item.isLink)
    .sort((a, b) => {
      if (a.date && b.date) return b.date.valueOf() - a.date.valueOf();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.index - b.index;
    })
    .map((item) => item.entry);

  let linkCursor = 0;
  return decorated.map((item) => {
    if (!item.isLink) return item.entry;
    const nextEntry = links[linkCursor];
    linkCursor += 1;
    return nextEntry;
  });
};

const flattenLinks = (entries: SidebarEntry[]): SidebarLink[] =>
  entries.flatMap((entry) => (entry.type === 'link' ? [entry] : flattenLinks(entry.entries)));

export const onRequest = defineRouteMiddleware(async ({ locals }) => {
  const { starlightRoute } = locals;
  if (!starlightRoute?.sidebar?.length) return;

  let nextLink: SidebarLink | undefined;
  let prevLink: SidebarLink | undefined;
  let paginationHandled = false;

  const applyAutogenerateSorting = async (entries: SidebarEntry[]): Promise<SidebarEntry[]> => {
    return Promise.all(
      entries.map(async (entry) => {
        if (entry.type !== 'group') {
          return entry;
        }

        let resolvedEntries = await applyAutogenerateSorting(entry.entries);
        const sortMode = SIDEBAR_AUTOGENERATE_SORTS.get(entry.label);

        if (sortMode === 'reverse-date') {
          resolvedEntries = await sortEntriesByNewestDate(resolvedEntries, starlightRoute.locale);

          if (!paginationHandled) {
            const flattened = flattenLinks(resolvedEntries);
            const currentIndex = flattened.findIndex((item) => item.isCurrent);
            if (currentIndex !== -1) {
              prevLink = flattened[currentIndex - 1];
              nextLink = flattened[currentIndex + 1];
              paginationHandled = true;
            }
          }
        }

        const group: SidebarGroup = {
          ...entry,
          entries: resolvedEntries,
        };

        return group;
      }),
    );
  };

  starlightRoute.sidebar = await applyAutogenerateSorting(starlightRoute.sidebar);

  if (paginationHandled && starlightRoute.pagination) {
    starlightRoute.pagination = {
      prev: prevLink,
      next: nextLink,
    };
  }
});

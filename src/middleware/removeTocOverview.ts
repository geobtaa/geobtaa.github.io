import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const OVERVIEW_SLUG = '_top';

interface TocItem {
  depth: number;
  slug: string;
  text: string;
  children: TocItem[];
}

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const buildProgramUpdateToc = (programUpdate: unknown): TocItem[] => {
  if (!programUpdate || typeof programUpdate !== 'object') return [];

  const update = programUpdate as Record<string, unknown>;
  const highlight = update.highlight as Record<string, unknown> | undefined;
  const highlightTitle = normalizeString(highlight?.title) || 'Monthly Highlight';

  return [
    {
      depth: 2,
      slug: 'monthly-highlight',
      text: highlightTitle,
      children: [],
    },
    {
      depth: 2,
      slug: 'program-activities',
      text: 'Program Activities',
      children: [
        {
          depth: 3,
          slug: 'committees',
          text: 'Committees',
          children: [],
        },
        {
          depth: 3,
          slug: 'workgroups',
          text: 'Workgroups',
          children: [],
        },
      ],
    },
    {
      depth: 2,
      slug: 'btaa-geoportal',
      text: 'BTAA Geoportal',
      children: [
        {
          depth: 3,
          slug: 'geoportal-metrics',
          text: 'This month by the numbers',
          children: [],
        },
        {
          depth: 3,
          slug: 'collections',
          text: 'Collections',
          children: [],
        },
        {
          depth: 3,
          slug: 'harvesting-activities',
          text: 'Harvesting Activities',
          children: [],
        },
        {
          depth: 3,
          slug: 'web-development',
          text: 'Web Development',
          children: [],
        },
      ],
    },
  ];
};

export const onRequest = defineRouteMiddleware(({ locals }) => {
  const route = locals.starlightRoute;
  const toc = route?.toc;
  if (!toc?.items?.length) return;

  const overviewIndex = toc.items.findIndex((item) => item.slug === OVERVIEW_SLUG);
  const nextItems =
    overviewIndex === -1
      ? toc.items
      : [
          ...toc.items.slice(0, overviewIndex),
          ...toc.items[overviewIndex].children,
          ...toc.items.slice(overviewIndex + 1),
        ];

  const programUpdateToc =
    nextItems.length === 0 ? buildProgramUpdateToc(route?.entry?.data?.programUpdate) : [];

  route.toc = {
    ...toc,
    items: programUpdateToc.length > 0 ? programUpdateToc : nextItems,
  };
});

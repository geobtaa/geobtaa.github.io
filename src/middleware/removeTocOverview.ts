import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const OVERVIEW_SLUG = '_top';

export const onRequest = defineRouteMiddleware(({ locals }) => {
  const toc = locals.starlightRoute?.toc;
  if (!toc?.items?.length) return;

  const overviewIndex = toc.items.findIndex((item) => item.slug === OVERVIEW_SLUG);
  if (overviewIndex === -1) return;

  const overview = toc.items[overviewIndex];
  const nextItems = [
    ...toc.items.slice(0, overviewIndex),
    ...overview.children,
    ...toc.items.slice(overviewIndex + 1),
  ];

  locals.starlightRoute.toc = {
    ...toc,
    items: nextItems,
  };
});

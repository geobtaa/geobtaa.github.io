import { loadConferenceYears } from '../utils/conferenceContent';
import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;

export const onRequest = defineRouteMiddleware(async ({ locals, url }) => {
  const route = locals.starlightRoute;
  if (!route || !/^\/conference(?:\/|$)/.test(url.pathname)) return;

  const pathname = url.pathname.replace(/\/?$/, '/');
  const link = (label: string, href: string): SidebarLink => ({
    type: 'link', label, href, isCurrent: pathname === href, attrs: {}, badge: undefined,
  });
  const years = await loadConferenceYears();

  route.sidebar = [
    link('Conference overview', '/conference/'),
    link('Map Gallery', '/conference/map-gallery/'),
    {
      type: 'group', label: 'Past Conferences', collapsed: false, badge: undefined,
      entries: years.map(year => link(year, `/conference/${year}/`)),
    },
  ];
  // Splash pages can retain their presentation while sharing conference navigation.
  route.hasSidebar = true;
});

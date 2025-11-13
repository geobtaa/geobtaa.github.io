import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightFullViewMode from 'starlight-fullview-mode';
import starlightLinksValidator from 'starlight-links-validator';
import react from '@astrojs/react';
import starlightImageZoom from 'starlight-image-zoom';
import icon from 'astro-icon';
import { NAV_GROUPS, type NavSidebarAutogenerate, type NavSidebarEntry, type NavSidebarGroupItem, type NavSidebarLink } from './navigation.config';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import reverseDateSidebar from './src/plugins/reverseDateSidebar';
import removeTocOverview from './src/plugins/removeTocOverview';

type SidebarItem = NonNullable<StarlightUserConfig['sidebar']>[number];

const mapAutogenerateEntry = (entry: NavSidebarAutogenerate): SidebarItem => ({
  label: entry.label,
  collapsed: entry.collapsed ?? true,
  autogenerate: { directory: entry.directory },
});

const mapLinkEntry = (entry: NavSidebarLink): SidebarItem => ({
  label: entry.label,
  link: entry.link,
});

const mapGroupItem = (item: NavSidebarGroupItem): SidebarItem => {
  switch (item.kind) {
    case 'autogenerate':
      return mapAutogenerateEntry(item);
    case 'link':
      return mapLinkEntry(item);
  }
};

const mapSidebarEntry = (entry: NavSidebarEntry): SidebarItem => {
  switch (entry.kind) {
    case 'autogenerate':
      return mapAutogenerateEntry(entry);
    case 'group':
      return {
        label: entry.label,
        collapsed: entry.collapsed ?? true,
        items: Array.from(entry.items, mapGroupItem),
      };
    case 'link':
      return mapLinkEntry(entry);
  }
};

const starlightSidebar: StarlightUserConfig['sidebar'] = NAV_GROUPS.flatMap((group) =>
  group.sidebar.map(mapSidebarEntry),
);

export default defineConfig({
  site: 'https://gin.btaa.org',
  redirects: {
    '/updates/': '/blog/',
    '/policies/': '/library/',
  },
  integrations: [
    starlight({
      title: 'BTAA-GIN',
      favicon: 'favicon.ico',
      logo: {
        src: '/src/assets/images/btaa-gin-logo.svg',
        alt: 'BTAA-GIN Logo',
        replacesTitle: true,
      },
      social: [
        { icon: 'email', label: 'Contact', href: 'https://geo.btaa.org/feedback' },
        { icon: 'github', label: 'GitHub', href: 'https://github.com/geobtaa' },
      ],
      customCss: ['./src/styles/global.css', './src/styles/tables.css'],
      components: {
        // Footer: './src/components/FooterWithBar.astro',
        Header: './src/components/Header.astro',
        Sidebar: './src/components/SidebarWithFilters.astro',
        PageTitle: './src/components/PageTitleWithMeta.astro',
      },
      plugins: [
        starlightImageZoom(),
        starlightFullViewMode({leftSidebarEnabled: false} ),
        starlightLinksValidator(),
        reverseDateSidebar(),
        removeTocOverview(),
        // starlightTocOverviewCustomizer({overviewTitle: "Back to top",})
      ],
      sidebar: starlightSidebar,
    }),
    react(),
    icon(),
  ],
});

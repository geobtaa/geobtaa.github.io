export type NavGroupId = 'about' | 'resources' | 'conference' | 'blog';

export type NavSidebarAutogenerateSort = 'reverse-date';

export interface NavSidebarAutogenerate {
  kind: 'autogenerate';
  label: string;
  directory: string;
  collapsed?: boolean;
  sort?: NavSidebarAutogenerateSort;
}

export interface NavSidebarLink {
  kind: 'link';
  label: string;
  link: string;
}

export type NavSidebarGroupItem = NavSidebarAutogenerate | NavSidebarLink;

export interface NavSidebarGroup {
  kind: 'group';
  label: string;
  collapsed?: boolean;
  items: ReadonlyArray<NavSidebarGroupItem>;
}

export type NavSidebarEntry = NavSidebarAutogenerate | NavSidebarGroup | NavSidebarLink;

export interface NavGroup {
  id: NavGroupId;
  label: string;
  landing: string;
  sidebar: ReadonlyArray<NavSidebarEntry>;
}

// NAV_GROUPS enumerates each primary navigation group with its landing page and sidebar setup.
export const NAV_GROUPS = [
  {
    id: 'about',
    label: 'About',
    landing: '/about/about-us/',
    sidebar: [
      { kind: 'autogenerate', label: 'About', directory: 'about', collapsed: false },
      { kind: 'autogenerate', label: 'Team', directory: 'team', collapsed: false },
      { kind: 'autogenerate', label: 'Projects', directory: 'projects', collapsed: false },
      { kind: 'autogenerate', label: 'Scholarship', directory: 'scholarship', collapsed: false },
      { kind: 'link', label: 'Reports', link: '/library/' },
    ],
  },
  // {
  //   id: 'blog',
  //   label: 'Program updates',
  //   landing: '/updates/',
  //   sidebar: [{  kind: 'autogenerate', label: 'Updates', directory: 'updates', collapsed: false },],
  // },

  {
    id: 'resources',
    label: 'Find & Use Data',
    landing: '/guides/',
    sidebar: [
      { kind: 'autogenerate', label: 'Find data', directory: 'guides', collapsed: false },
      { kind: 'autogenerate', label: 'Tutorials', directory: 'tutorials', collapsed: false },
    ],

  },
  {
    id: 'conference',
    label: 'Conference',
    landing: '/conference/',
    sidebar: [
      { kind: 'autogenerate', label: 'Conference', directory: 'conference', collapsed: false },
    ],
  },

  {
    id: 'blog',
    label: 'News & Stories',
    landing: '/blog/',
    sidebar: [
      {  kind: 'link', label: 'News & Stories', link: '/blog/' },
      {
        kind: 'autogenerate',
        label: 'Program Updates',
        directory: 'updates',
        collapsed: true,
        sort: 'reverse-date',
      },
      {
        kind: 'autogenerate',
        label: 'Blog Posts',
        directory: 'posts',
        collapsed: true,
        sort: 'reverse-date',
      },
    ],
  },
] satisfies ReadonlyArray<NavGroup>;

// PRIMARY_NAV_OPTIONS feeds the header/navigation bar with label + target pairs derived from NAV_GROUPS.
export const PRIMARY_NAV_OPTIONS = NAV_GROUPS.map(({ id, label, landing }) => ({
  group: id,
  label,
  target: landing,
})) satisfies ReadonlyArray<{ group: NavGroupId; label: string; target: string }>;

// SIDEBAR_LABEL_GROUPS links sidebar section labels back to their owning nav group for quick lookups.
export const SIDEBAR_LABEL_GROUPS = new Map<string, NavGroupId>(
  NAV_GROUPS.flatMap(({ id, sidebar }) => sidebar.map((item) => [item.label, id] as const)),
);

const collectAutogenerateSorts = (
  entries: ReadonlyArray<NavSidebarEntry | NavSidebarGroupItem>,
): ReadonlyArray<readonly [string, NavSidebarAutogenerateSort]> =>
  entries.flatMap((entry) => {
    if (entry.kind === 'autogenerate' && entry.sort) {
      return [[entry.label, entry.sort] as const];
    }

    if (entry.kind === 'group') {
      return collectAutogenerateSorts(entry.items);
    }

    return [] as const;
  });

export const SIDEBAR_AUTOGENERATE_SORTS = new Map<string, NavSidebarAutogenerateSort>(
  NAV_GROUPS.flatMap(({ sidebar }) => collectAutogenerateSorts(sidebar)),
);

// deriveGroupFromPath infers which nav group to activate based on the current URL path.
const startsWithAny = (normalizedPath: string, prefixes: ReadonlyArray<string>) =>
  prefixes.some((prefix) => normalizedPath.startsWith(prefix));

export const deriveGroupFromPath = (path: string): NavGroupId | undefined => {
  const normalized = path.toLowerCase();
  if (normalized === '/' || normalized === '') {
    return undefined;
  }

  if (startsWithAny(normalized, ['/about', '/team', '/projects', '/scholarship', '/workgroups', '/library'])) {
    return 'about';
  }


  if (startsWithAny(normalized, ['/resources', '/tutorials', '/discovery', '/guides'])) {
    return 'resources';
  }

  if (normalized.startsWith('/conference')) {
    return 'conference';
  }

  if (startsWithAny(normalized, ['/blog', '/posts', '/updates'])) {
    return 'blog';
  }

  // Default to the "About" collection when we cannot infer a more specific group.
  // return 'about';
};

export type PageMetadata = {
  year?: number | string | null;
  committee?: string | null;
  lead?: string | null;
  members?: string[] | null;
  dates_active?: string | null;
  template?: string | null;
  hidePageTitle?: boolean | null;
  pagefind?: boolean | null;
  tableOfContents?: boolean | { minHeadingLevel?: number; maxHeadingLevel?: number; [key: string]: unknown } | null;
  sidebar?: { label?: string; order?: number; hidden?: boolean; [key: string]: unknown } | null;
  banner?: { content: string; [key: string]: unknown } | null;
  head?: { tag: string; attrs?: Record<string, string | number | boolean>; [key: string]: unknown }[] | null;
};
export type Project = {
  filename: string;
  sha?: string;
  content: string;
  title: string;
  description: string;
  draft: boolean;
  sidebarHidden?: boolean;
  body: string;
  branch?: string;
  metadata?: PageMetadata;
  frontmatterFields?: string[];
  date?: string;
  excerpt?: string;
  authors?: (string | { name: string; [key: string]: unknown })[];
  tags?: string[];
  cover?: { image?: string; light?: string; dark?: string; alt: string; caption?: string; [key: string]: unknown } | null;
  conversion?: { body: string | null; kind: string; error: string | null } | null;
  convertProgramUpdate?: boolean;
};


# Cloudflare content editor prototype

The custom content editor is a staging prototype for editing the BTAA-GIN
website without working directly in GitHub or in raw MDX. It is available at
`/editor/` in the Cloudflare Pages staging project and is isolated from the
production site and the existing Decap CMS.

## What we implemented

- A React/Tiptap visual editor for content in `src/content/docs/`, currently
  covering About, Conference, Guides, Library, Metadata, Projects,
  Scholarship, Team, and Workgroups.
- Editing and creation of Markdown/MDX pages, including titles, descriptions,
  rich text, links, lists, tables, images, and Starlight Link Cards.
- Image selection and uploads to `src/assets/images/`, with required alt text
  or an explicit decorative-image option.
- Preservation of existing imports, Astro components, directives, and other
  complex MDX as read-only blocks so the visual editor does not rewrite them.
- Draft and publish controls for Projects. Other content areas save changes
  directly because they do not currently use the same draft field.
- Direct commits to the `custom-cms` staging branch through the GitHub Contents
  API. Saves include the file revision originally loaded, so concurrent edits
  produce a conflict instead of silently overwriting newer work.

## Cloudflare and authentication

Cloudflare Pages builds the Astro site from the `custom-cms` branch. The
same-origin Pages Function in `functions/api/` provides the editor API and
handles GitHub OAuth with PKCE. Access requires a GitHub account with push
permission to the repository and can be further restricted with the
`ALLOWED_GITHUB_USERS` environment variable.

The GitHub access token is never exposed to browser JavaScript. It is held in
an AES-GCM-encrypted, HttpOnly session cookie that expires after eight hours.
Write requests also require a matching request origin. Cloudflare runtime
configuration is stored in `wrangler.jsonc`; generated local `.wrangler/`
state is ignored by Git.

The staging project requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
`SESSION_SECRET`. Its GitHub OAuth callback is
`https://geobtaa-editor-staging.pages.dev/api/auth/callback`.

## Current status

This remains an evaluation prototype. Every save creates a Git commit and can
trigger another staging deployment. There is no editorial approval workflow,
revision browser, deletion interface, or production-branch publishing step in
the editor yet. Complex MDX can be preserved but not visually edited.

Implementation details, local setup, Cloudflare settings, and environment
variables are documented in [`editor-prototype/README.md`](../editor-prototype/README.md).

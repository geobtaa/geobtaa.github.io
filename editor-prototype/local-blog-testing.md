# Test Save Draft locally

The local Astro checkout and GitHub draft storage are different copies of content. The editor reads `main` and verified `cms/drafts/*` branches through its local API gateway; Save Draft does not edit the working tree, `main`, `custom-cms`, or the live website.

1. Configure a server-only `GITHUB_TOKEN` in ignored `.env.local`, using an authorized account. Never put it in a `PUBLIC_*` variable. Do not perform real write tests without explicit authorization for designated test documents.
2. Run `npm run editor` and `npm run dev` in separate terminals. Open `http://localhost:4321/editor/`. The gateway normally listens at `127.0.0.1:8787` and accepts the default Astro local origin.
3. For isolated validation without GitHub credentials or writes, run `npm run test:editor` and `npm run test:editor:browser`. Fixtures model immutable Git objects, independent refs, atomic updates, account changes, reload recovery, and pending images.
4. Use ordinary **Preview** to review unsaved or saved working content. Preview preserves the editor and performs no writes. It approximates supported content; protected components remain placeholders.
5. In a separately authorized live integration exercise, save a designated new document, upload an image after its first Save Draft, edit it, and Save Draft again. Reopen through another authorized account and verify the shared branch. Compare main's selected document and assets to confirm they are unchanged.
6. If a save fails, retain the tab, use browser recovery/download, and reopen the latest shared draft for comparison. Never force-update a draft ref or delete a route reservation to bypass a conflict.

For exact branch identities, image limits, branch-build exclusions, live OAuth checks, and remaining integration gates, see [CMS_SAVE_DRAFT.md](../docs/CMS_SAVE_DRAFT.md). Do not download drafts over this clean application branch to preview them; rendering saved drafts through isolated hosted builds is a later milestone.

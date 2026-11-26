# Conference Page Maintenance

This guide is for BTAA-GIN team members maintaining the conference pages. It is
stored in the repository and is not published on the website. For map submissions,
follow the [Conference map gallery maintenance guide](how-to-update-conf-map-gallery.md).

## Current event and past conferences

Keep the current event in [conference/index.mdx](../src/content/docs/conference/index.mdx).
This page is published at `/conference/`, the link to share for the upcoming
conference, registration, and agenda.

After the event, copy its agenda and other event-specific content into a
year-named archive, such as `src/content/docs/conference/2027.mdx`. That archive
will be published at `/conference/2027/`.

Keep `index.mdx` in place. Do not rename it to create the archive or move existing
year pages into a different folder. This preserves the links people already use.

## Updating the current event

1. In the Editor, open **Conference** and select `index.mdx`.
2. Update the announcement, introductory paragraphs, key dates, and topic lists.
3. Add the agenda to the same page when it is ready. Use headings, paragraphs,
   tables, and regular lists.
4. Keep the recordings button linked to the latest completed conference.
5. Preview the content, save your draft, and follow the publication steps in the
   [CMS user guide](CMS_USER_GUIDE.md).

The main content is ordinary Markdown and is editable in the visual Editor. The
recordings link uses the existing **Link button** block, so its label and URL can
also be edited.

The page layout is applied through this statement in **Page setup**:

```mdx
export const components = { wrapper: ConferenceLanding };
```

Leave the imports and this statement in place. Keep the main content outside
custom component tags; wrapping it in `<ConferenceLanding>...</ConferenceLanding>`
would make the Editor treat that whole section as a protected block again.

The banner, newsletter form, sharing controls, and automatic archive links are
maintained as components. They appear as page setup or protected content in the
Editor; the Editor preview does not reproduce the full public layout.

## Archiving a completed event

For the 2027 event:

1. Create `src/content/docs/conference/2027.mdx`.
2. Copy the event-specific content from `index.mdx`, including the final agenda.
   Do not copy the landing-page imports, wrapper export, or
   `<ConferenceArchiveLinks />` component. The archive should stand on its own
   without the current event's promotional panels.
3. Give it a year-specific title, such as `Big Ten GIS Conference 2027`.
4. Add a concluded-event callout, following the 2023, 2025, or 2026 page.
5. Add the session recordings when they are available. If they are not ready,
   say so rather than linking to another year's recordings.
6. Review and publish the archive. Then update the recordings button on
   `index.mdx` to point to it.

A minimal archive starts with:

```mdx
---
title: Big Ten GIS Conference 2027
description: Agenda and recordings from the 2027 Big Ten GIS Conference.
---

:::caution[The 2027 BTAA GIS Conference has concluded.]

Browse the agenda and session recordings below.
:::

## Conference Recordings

## Agenda
```

Fill in the recordings and agenda before publishing, or adjust the notice to
explain what is available.

Published year-named pages automatically appear under **Past Conferences** in
the sidebar and on the landing page, newest first. No manual list or sidebar
order update is needed. The year comes from the filename, not the page title.

A published `2027.mdx` would appear in **Past Conferences** even before the event:
the list does not check event dates. Keep the active agenda in `index.mdx` and
create the public year archive after the event. A repository page with
`draft: true` is excluded from the public site and archive lists; saving an
unpublished draft in the Editor also leaves the public site unchanged.

## Preparing for the next year

1. Preserve the completed event's content in its year archive before replacing
   the content on `index.mdx`.
2. Update `index.mdx` with the next conference's announcement, dates, and details.
3. Point its recordings button to the latest completed event, for example
   `/conference/2027/#conference-recordings`. Confirm that the archive has a
   **Conference Recordings** heading so that the link reaches that section.
4. Ask a maintainer to update the banner artwork, alternative text, and share-email
   date in [ConferenceLanding.astro](../src/components/ConferenceLanding.astro).
   Also check the social-preview images in the `index.mdx` frontmatter.

The banner and share-email date are separate from the editable announcement.
Changing the date in the main text does not update them automatically.

For repository changes, run `npm run build` and `npm run test:navigation` before
deployment. Check the landing page, recordings link, year archive, and sidebar
after deployment.

# Conference Map Gallery Maintenance

This document is for BTAA-GIN Team members maintaining the conference map gallery in this repository. It is intended to live in the repo only and not be published on the website.

This gallery is driven by two things:

- submission metadata in [submissions.csv](src/content/docs/conference/map-gallery/submissions.csv)
- thumbnail images in [public/map-gallery](public/map-gallery)

The map gallery file is at [conference/map-gallery/index.mdx](src/content/docs/conference/map-gallery/index.mdx), which renders the gallery component.

## Files and folders

- Metadata CSV: [src/content/docs/conference/map-gallery/submissions.csv](src/content/docs/conference/map-gallery/submissions.csv)
- Gallery page: [src/content/docs/conference/map-gallery/index.mdx](src/content/docs/conference/map-gallery/index.mdx)
- Submission guidelines page: [src/content/docs/conference/map-gallery/submission-guidelines.mdx](src/content/docs/conference/map-gallery/submission-guidelines.mdx)
- Thumbnail directory: [public/map-gallery](public/map-gallery)
- Thumbnail optimization script: [scripts/optimize-gallery.mjs](scripts/optimize-gallery.mjs)

## Updating `submissions.csv`

Add or update rows in [submissions.csv](src/content/docs/conference/map-gallery/submissions.csv).

Important columns:

- `image`: relative path to the thumbnail in `public/`. For gallery thumbnails, use `map-gallery/filename.webp`.
- `year`: gallery year shown in the filter.
- `number`: internal identifier for the submission.
- `publish_status`: use `published` for entries that should appear on the public site, or `draft` for entries that should stay hidden from the public gallery.
- `name`, `institution`, `kind`, `title`, `abstract`, `link`: displayed in the gallery card and modal.

Notes:

- The status value must be `published` or `draft`.
- `published` entries appear on the public gallery after the site is rebuilt and deployed.
- `draft` entries are hidden from the public gallery but can be loaded with the preview link.
- The `image` value must match the thumbnail filename exactly, including the `.webp` extension.

## Adding thumbnails

Place gallery thumbnails in [public/map-gallery](public/map-gallery).

Guidelines:

- Keep each thumbnail filename stable once it is referenced in `submissions.csv`.
- Prefer `.webp` images to keep the page load manageable.
- The CSV should reference thumbnails as `map-gallery/<filename>.webp`.

Example:

- File on disk: `public/map-gallery/LoneTree.webp`
- CSV `image` value: `map-gallery/LoneTree.webp`

## Using `optimize-gallery.mjs`

The optimizer converts gallery images to `.webp`, resizes them to a maximum width of 1600 pixels, and deletes the old source file if the source extension was different.

Default usage:

```sh
npm run optimize-gallery
```

That script targets:

```text
public/map-gallery
```

Direct usage with an explicit directory:

```sh
node scripts/optimize-gallery.mjs --dir public/map-gallery
```

You can also point it at another directory while preparing files:

```sh
node scripts/optimize-gallery.mjs --dir path/to/staging-folder
```

What the script does:

- scans the target directory recursively
- processes `.jpg`, `.jpeg`, `.png`, and `.webp`
- writes optimized `.webp` files
- removes the original file if it was not already `.webp`

Recommended workflow for thumbnails:

1. Save incoming image files into `public/map-gallery`.
2. Run `npm run optimize-gallery`.
3. Confirm the final filenames in `public/map-gallery`.
4. Update the `image` column in `submissions.csv` to match those filenames.

## Preview and publishing workflow

For new annual entries, you can upload thumbnails and add CSV rows before they are public.

1. Add the new rows to [submissions.csv](src/content/docs/conference/map-gallery/submissions.csv).
2. Set `publish_status` to `draft`.
3. Commit and deploy.
4. Review the hidden entries using:

```text
https://gin.btaa.org/conference/map-gallery/?preview=true
```

To preview a specific year directly:

```text
https://gin.btaa.org/conference/map-gallery/?preview=true&year=2026
```

When you are ready to publish:

1. Change the relevant rows from `draft` to `published`.
2. Commit and deploy again.

After deployment, that year will appear in the public year filter automatically.

## Typical update checklist

1. Add or update thumbnails in [public/map-gallery](public/map-gallery).
2. Run `npm run optimize-gallery`.
3. Add or update the matching rows in [submissions.csv](src/content/docs/conference/map-gallery/submissions.csv).
4. Use `draft` for entries that should not yet be public.
5. Build locally if needed with `npm run build`.
6. Commit and deploy.

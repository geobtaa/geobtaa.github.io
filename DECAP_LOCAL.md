# How to Test Decap Locally

This project uses Decap CMS with `local_backend: true` in `public/admin/config.yml`.

## Prerequisites

Run this once if you have not installed dependencies yet:

```zsh
npm install
```

## Start the local site

In one terminal, from the repo root, start Astro:

```zsh
npm run dev
```

This serves the site at `http://localhost:4321`.

## Start the Decap local backend

In a second terminal, from the repo root, start the Decap proxy server:

```zsh
npm run decap
```

This runs `decap-server` for the local CMS workflow.

## Open the Decap admin

Open this exact URL in your browser:

```text
http://localhost:4321/admin/index.html
```

Use `index.html` explicitly. In this project, `http://localhost:4321/admin/` may not load the Decap admin page during local development.

## Local test workflow

1. Start `npm run dev`.
2. Start `npm run decap`.
3. Open `http://localhost:4321/admin/index.html`.
4. Create or edit content in Decap.
5. Confirm the corresponding files change under `src/content/docs/...` or `src/assets/images/...`.

## Troubleshooting

- If the admin page loads but saving fails, make sure `npm run decap` is still running.
- If `npm run decap` fails because `npx` cannot find `decap-server`, run `npm install` and try again.
- If the site is not available, confirm Astro is still running at `http://localhost:4321`.

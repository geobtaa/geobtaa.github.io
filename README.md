# Starlight Starter Kit: Basics

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)


## 🚀 Project Structure

Inside of your Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   └── docs/
│   └── content.config.ts
├── astro.config.ts
├── navigation.config.ts
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run decap`           | Starts the Decap local backend proxy             |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Decap Local Testing

For local Decap CMS evaluation, use two terminals:

1. Run `npm run dev`
2. Run `npm run decap`
3. Open `http://localhost:4321/admin/index.html`

The exact admin URL matters here: use `/admin/index.html` during local development.

See [DECAP_LOCAL.md](/Users/olive/GitHub/geobtaa.github.io/DECAP_LOCAL.md) for the full workflow.

## 🔄 Updating Navigation

All primary navigation (desktop tabs, mobile drawer, and sidebar groupings) is defined in one place:

- `navigation.config.ts` — each entry in `NAV_GROUPS` describes a top-level section (`id`, `label`, `landing` page, and the sidebar items that belong to the group). Update this file when you add or remove a section.
- `astro.config.ts` consumes `NAV_GROUPS` to build Starlight’s sidebar automatically; no manual edits needed here unless you change config structure.
- UI components (`src/components/HeaderWithCompactSearch.astro` and `src/components/SidebarWithFilters.astro`) import the same data, so they reflect changes instantly.

Typical update flow:

1. Add your new docs pages under `src/content/docs/…`.
2. Edit `navigation.config.ts`:
   - Add or update a `NAV_GROUPS` entry.
   - Use `kind: 'autogenerate'` to point at a docs directory, or `kind: 'group'` / `kind: 'link'` for manual lists.
3. Run `npm run astro -- check` and `npm run dev` to verify the header tabs, mobile drawer, and sidebar all show the new structure.

Need a quick reference? Leave a comment near your new `NAV_GROUPS` entry noting the related content directory.

## 👀 Want to learn more?

Check out [Starlight’s docs](https://starlight.astro.build/), read [the Astro documentation](https://docs.astro.build), or jump into the [Astro Discord server](https://astro.build/chat).

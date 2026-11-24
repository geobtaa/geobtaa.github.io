# BTAA-GIN Program Website

This repository contains the program website for the **Big Ten Academic Alliance
Geospatial Information Network (BTAA-GIN)**, published at [gin.btaa.org](https://gin.btaa.org).

The site shares program news and updates, information about our team and
workgroups, geospatial guides, program documents, and conference resources. It
supports the geospatial research community and connects geospatial library
professionals.

## Run the site locally

You will need Git and **Node.js 24.13.1**, which includes npm. For help installing
the tools and cloning this repository, follow the [local setup guide](docs/LOCAL_SETUP.md).

Open a terminal in the repository folder and run:

```sh
npm ci
npm run dev
```

Open [localhost:4321](http://localhost:4321) in your browser. Changes to website
files appear automatically while the development server is running. Press
**Ctrl+C** in the terminal to stop it.

Starting the local site does not publish changes to the live website.

## Content and documentation

Website content is stored in `src/content/docs/`. Internal setup and maintenance
guides are stored separately in `docs/`.

- [CMS user guide](docs/CMS_USER_GUIDE.md): edit website content using the custom editor.
- [Editor development guide](editor/README.md): run and test the editor locally.
- [Project documentation](docs/README.md): setup, maintenance, feature guides, and technical references.

The website is built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

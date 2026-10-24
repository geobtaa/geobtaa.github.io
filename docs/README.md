# Project documentation

This directory contains documentation for people who develop and maintain the
BTAA-GIN website. These files are stored in the repository but are not
published as pages on the website.

This is different from `src/content/docs/`, which contains the website's public
content and is processed by Astro and Starlight into published pages.

## Setup and development

- [Local setup](LOCAL_SETUP.md): first-time installation and local development
- [Local Decap testing](DECAP_LOCAL.md): run and test the CMS locally

## Site maintenance

- [Conference map gallery maintenance](how-to-update-conf-map-gallery.md): add,
  preview, optimize, and publish gallery submissions

## Feature documentation

- [Cloudflare content editor prototype](CLOUDFLARE_EDITOR_PROTOTYPE.md): current
  architecture, implemented features, safeguards, and prototype limitations
- [Data Citation Generator overview](data-citation-generator.md): purpose,
  technology stack, architecture, safeguards, and development acknowledgment
- [Data Citation Generator autofill crosswalk](data-citation-autofill-crosswalk.md):
  detailed mappings from DOI and BTAA Geoportal metadata into citation fields

Add future developer, maintenance, and implementation guides to this directory.
Add content intended for publication on the website to `src/content/docs/`.

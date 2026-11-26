# Project documentation

This directory contains documentation for people who develop and maintain the
BTAA-GIN website. These files are stored in the repository but are not
published as pages on the website.

This is different from `src/content/docs/`, which contains the website's public
content and is processed by Astro and Starlight into published pages.

## Editing website content

- [Custom CMS user guide](CMS_USER_GUIDE.md): sign in, write with blocks, save
  drafts, submit pages for publication, and resolve common errors

## Setup and development

- [Local setup](LOCAL_SETUP.md): first-time installation and local development
- [Local Decap testing](DECAP_LOCAL.md): run and test the CMS locally

## Conference

- [Conference page maintenance](how-to-update-conference.md): edit the current
  event, archive its agenda and recordings, and prepare for the next year
- [Conference map gallery maintenance](how-to-update-conf-map-gallery.md): add,
  preview, optimize, and publish gallery submissions

## Site maintenance

- [Repository inventory](REPOSITORY_INVENTORY.md): application structure,
  compatibility support, tooling, documentation, cleanup review targets, and
  validation baseline

## Feature documentation

- [CMS editor development decisions](cms-editor/README.md): design, hosting,
  validation, operational limits, and recovery constraints

- [Data Citation Generator overview](data-citation-generator.md): purpose,
  technology stack, architecture, safeguards, and development acknowledgment
- [Data Citation Generator autofill crosswalk](data-citation-autofill-crosswalk.md):
  detailed mappings from DOI and BTAA Geoportal metadata into citation fields

Add future developer, maintenance, and implementation guides to this directory.
Add content intended for publication on the website to `src/content/docs/`.

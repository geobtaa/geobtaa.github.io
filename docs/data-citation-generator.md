# Data Citation Generator: technical overview

## What it does

The BTAA Geospatial Data Citation Generator helps users turn dataset
metadata into a citation. It supports APA, MLA, and Chicago styles. A user
can copy the finished citation or download it as an RIS or BibTeX file for use
in citation-management software.

Users can generate a citation in three ways:

- enter the information manually
- enter a DOI and retrieve available metadata
- enter a BTAA Geoportal resource page and retrieve its metadata


## Technology stack

- **Website framework:** Astro, using the Starlight documentation theme
- **Interactive interface:** React
- **Programming language:** TypeScript
- **Presentation:** HTML and CSS
- **Metadata services:** DataCite, Crossref, and the BTAA Geoportal APIs
- **Architecture:** A static website with citation processing performed in the
  user's browser; no dedicated application server or database is required

## How it works

The generator is a React component embedded in the BTAA-GIN website, which is
built with Astro and Starlight. It runs in the user's web browser; the website
does not store the citation information entered in the form.

When a DOI is supplied, the generator requests metadata from DataCite. If
DataCite has no usable record, it tries Crossref. For a BTAA Geoportal URL, it
requests the metadata from the Geoportal API. The
generator maps the returned values into common fields such as creator, title,
publisher, publication year, version, format, URL, and temporal coverage.

As the user edits those fields, the component applies its own formatting rules
to update the citation preview immediately. RIS and BibTeX downloads are also
created in the browser from the same form values.


## Where it is maintained

- User-facing page: `src/content/docs/guides/data-cite.mdx`
- Generator logic and interface: `src/components/DataCitation.tsx`
- Styling: `src/styles/data-citation.css`
- Autofill mapping: `docs/data-citation-autofill-crosswalk.md`

## Development acknowledgment

The generator is a BTAA Geospatial Information Network project. 

OpenAI Codex was used as a coding assistant during development and documentation; people
directed the work and reviewed the resulting code and content. 

Suggested reference:

> Big Ten Academic Alliance Geospatial Information Network. (2026). *BTAA
> Geospatial Data Citation Generator* [Web application].
> https://gin.btaa.org/citation

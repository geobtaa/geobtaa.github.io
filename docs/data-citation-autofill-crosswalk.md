# Data citation autofill crosswalk

`src/components/DataCitation.tsx` opens in manual-entry mode. A user can instead
prefill the citation form from either a DOI or a BTAA Geoportal resource landing
page. Autofill values are starting points only; every form field remains
editable.

## BTAA Geoportal

For a landing page in this form:

```text
https://geo.btaa.org/resources/{resource-id}
```

the citation tool requests:

```text
https://geo.btaa.org/api/v1/resources/{resource-id}?format=json
```

The API's GeoBlacklight metadata is located at `data.attributes.ogm`.

| Citation field               | Geoportal field and handling                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Dataset title                | First value from `dct_title_s`                                                                    |
| File type / format           | `dct_format_s`; when blank, use `gbl_resourceClass_sm`                                            |
| Version                      | No comparable field; leave blank                                                                  |
| Persistent identifier or URL | `http://schema.org/url` from `dct_references_s`; when absent, use the BTAA Geoportal landing page |
| Creator                      | Each value from `dct_creator_sm`                                                                  |
| Publisher or repository      | `dct_publisher_sm`; when blank, use `schema_provider_s`                                           |
| Year of publication          | Four-digit year from `dct_issued_s`                                                               |
| Temporal coverage            | Values from `dct_temporal_sm`, joined with semicolons                                             |

`dct_references_s` is normally a JSON-encoded object. The tool also supports an
API response that exposes `http://schema.org/url` directly.

Creator values written as `Family, Given Middle` are loaded as people. Creator
values without a comma are loaded as organizations so they can still be edited
using the existing author controls.

## DOI

DOI metadata is requested from DataCite first, with Crossref as a fallback.
Available creator, title, publication year, version, publisher, format, temporal
coverage, and persistent-identifier values are mapped to the corresponding
citation fields.

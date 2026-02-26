---

title: B1G Custom Fields
description: ""
sidebar:
  order: 3

---

## Access

|  |  |
| --- | --- |
| Field Label | Access |
| Field Name | b1g_access_s |
| Purpose | Links for accessing restricted resources |
| Entry Guidelines | Use the Licensed Data tab in the GeoBTAA Template. It has three columns: friendlier_id, institution_code, and access_URL. friendlier_id is the ID of the parent record. institution_code is a dropdown value for a BTAA institution. access_URL is the URL for the institution’s library catalog record for the database. |
| Example Value | https://search.lib.umich.edu/databases/record/39117 |
| Controlled Vocabulary? | FALSE |
| Vocabulary List | |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | This field is entered via a secondary spreadsheet and is serialized in output metadata as a JSON object (institution codes → URLs). Codes are used instead of full institution names to reduce field length and avoid spaces. Catalog records provide stable landing pages; users typically authenticate through their institution. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#access |

## Accrual Method

|  |  |
| --- | --- |
| Field Label | Accrual Method |
| Field Name | b1g_dct_accrualMethod_s |
| Purpose | Method used to obtain the metadata |
| Entry Guidelines | Select one controlled value that reflects how the metadata record was created or obtained. |
| Example Value | Manual curation |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | Automated retrieval; Mediated deposit; Manual curation |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | For programmatically harvested records, child records inherit this value from their parent source (e.g., a website). Parent records should reflect the method used to create or acquire the source-level metadata. |
| Namespace source | DCMI |
| Definition URI | https://gin.btaa.org/metadata/b1g/#accrual-method |

## Accrual Periodicity

|  |  |
| --- | --- |
| Field Label | Accrual Periodicity |
| Field Name | b1g_dct_accrualPeriodicity_s |
| Purpose | Frequency at which a website is harvested |
| Entry Guidelines | Select one controlled value that best represents how often the resource should be reviewed or reharvested. |
| Example Value | Quarterly |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://www.dublincore.org/specifications/dublin-core/collection-description/frequency/ |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Used to prioritize automated review and harvest workflows. When possible, prefer time-based values (e.g., “Annual”) over vague values (e.g., “As Needed”) to support regular validation. |
| Namespace source | DCMI |
| Definition URI | https://gin.btaa.org/metadata/b1g/#accrual-periodicity |

## Admin Notes

|  |  |
| --- | --- |
| Field Label | Admin Notes |
| Field Name | b1g_adminNote_sm |
| Purpose | Internal notes about status, issues, or enrichment |
| Entry Guidelines | Enter plain text as needed to support processing and tracking. |
| Example Value | Metadata enriched on 2025-10-01. Do not overwrite. |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Internal-only field for notes about issues, processing decisions, enrichment work, and other record-management context. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#admin-note |

## B1G Image

|  |  |
| --- | --- |
| Field Label | B1G Image |
| Field Name | b1g_image_ss |
| Purpose | Thumbnail displayed in search results |
| Entry Guidelines | Enter a secure (https) URL to an image file. Acceptable file types: JPEG or PNG. |
| Example Value | https://media.licdn.com/dms/image/C4E0BAQE10eK4JOVezg/company-logo_200_200/0?e=2159024400&v=beta&t=n-8vqGyWpJW--9v2NxOUwQ3UmPRWLQz36fj-XwEsPYY |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Can be populated programmatically by harvesting thumbnail URLs. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#image |

## Code

|  |  |
| --- | --- |
| Field Label | Code |
| Field Name | b1g_code_s |
| Purpose | Internal grouping or tracking code |
| Entry Guidelines | Do not enter manually. This value is assigned by GIN staff. |
| Example Value | 05a-01 |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://gin.btaa.org/metadata/codeNamingSchema/ |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Codes support internal tracking and sharable links for groups of records. They encode the provider, hosting type, and a sequence number. Avoid changing codes so existing links continue to work. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#code |

## Coordinate Reference System

|  |  |
| --- | --- |
| Field Label | Coordinate Reference System |
| Field Name | b1g_dct_conformsTo_sm |
| Purpose | Coordinate reference system of the resource |
| Entry Guidelines | Enter a resolvable URI (URL) for the coordinate reference system from a known registry. |
| Example Value | https://epsg.io/26915 |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://epsg.io |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | We link to CRS definitions rather than encoding them directly in the record (as some geospatial standards do). Prefer EPSG (epsg.io), but other reputable registries are acceptable when EPSG does not provide the CRS. |
| Namespace source | DCMI |
| Definition URI | https://gin.btaa.org/metadata/b1g/#conforms-to |

## Creator ID

|  |  |
| --- | --- |
| Field Label | Creator ID |
| Field Name | b1g_creatorID_sm |
| Purpose | URI identifying the creator (OCLC FAST) |
| Entry Guidelines | Enter a URI for an authority record from OCLC FAST (use the WorldCat FAST URL). |
| Example Value | http://id.worldcat.org/fast/549575 |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://fast.oclc.org/searchfast/ |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | May support linked-data use cases in the future. Currently useful for identifying which Creator values have FAST authority records and normalizing them to a consistent source. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#creator-id |

## Date Accessioned

|  |  |
| --- | --- |
| Field Label | Date Accessioned |
| Field Name | b1g_dateAccessioned_dt |
| Purpose | Date the record was added |
| Entry Guidelines | Enter the date the record was harvested or added to the geoportal, in yyyy-mm-dd format. |
| Example Value | 2025-01-01 |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Date |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Indicates when this record was added. It applies to the record itself and does not automatically apply to related records (e.g., child records). |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#date-accessioned |

## Date Retired

|  |  |
| --- | --- |
| Field Label | Date Retired |
| Field Name | b1g_dateRetired_dt |
| Purpose | Date the record was removed or unpublished |
| Entry Guidelines | Enter the date the record was removed/unpublished, in yyyy-mm-dd format. |
| Example Value | 2025-12-15 |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Date |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Indicates when a record was unpublished. Records are typically retained (not deleted) for analytics and auditing. In some cases, records may reappear at the source and be republished later. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#date-retired |

## Deprioritize

|  |  |
| --- | --- |
| Field Label | Deprioritize |
| Field Name | b1g_deprioritized_b |
| Purpose | Flag that lowers a record’s ranking in search results |
| Entry Guidelines | Enter true or false. |
| Example Value | true |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | True; False |
| Field Type | Boolean |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Use to lower a record’s ranking in search results. Note: there is no corresponding “prioritize” flag. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#child-record |

## Endpoint Description

|  |  |
| --- | --- |
| Field Label | Endpoint Description |
| Field Name | b1g_dcat_endpointDescription_s |
| Purpose | Type of API or link used to access the resource  |
| Entry Guidelines | Use an existing standardized value when possible. Enter "downloads page" for static web pages that provide downloads but no API or other programmatic access point. |
| Example Value | DCAT API |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | TBD |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Describes the functionality/behavior of the access or handoff point. For programmatically harvested records, child records inherit this value from their parent source entity (e.g., a website). |
| Namespace source | DCAT |
| Definition URI | https://gin.btaa.org/metadata/b1g/#endpoint-description |

## Endpoint URL

|  |  |
| --- | --- |
| Field Label | Endpoint URL |
| Field Name | b1g_dcat_endpointURL_s |
| Purpose | URL from which the resource was harvested |
| Entry Guidelines | Enter the full URL of the API endpoint, metadata feed, landing page, or query used to harvest the resource. |
| Example Value | https://opendata.minneapolismn.gov/api/feed/dcat-us/1.1.json |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Metadata feed URLs often end in .json. For programmatically harvested records, child records may inherit this value from their parent source entity. |
| Namespace source | DCAT |
| Definition URI | https://gin.btaa.org/metadata/b1g/##endpoint-url |

## GeoNames

|  |  |
| --- | --- |
| Field Label | GeoNames |
| Field Name | b1g_geonames_sm |
| Purpose | URI for a place name from the GeoNames database |
| Entry Guidelines | Enter a GeoNames Semantic Web Service URI in the form http://sws.geonames.org/<ID>/. |
| Example Value | http://sws.geonames.org/2988507 |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://www.geonames.org |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | May support linked-data use cases in the future. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#geonames |

## Harvest Workflow

|  |  |
| --- | --- |
| Field Label | Harvest Workflow |
| Field Name | b1g_harvestWorkflow_s |
| Purpose | Workflow that produced the record |
| Entry Guidelines | Enter the code/name for the corresponding harvest workflow used to generate the record. |
| Example Value | py_arcgis_hub |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://gin.btaa.org/metadata/harvest-workflows |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | For programmatically harvested records, child records inherit this value from their parent source entity (e.g., a website). |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#harvest-workflow |

## Is Harvested

|  |  |
| --- | --- |
| Field Label | Is Harvested |
| Field Name | b1g_isHarvested_b |
| Purpose | Whether the website is actively harvested |
| Entry Guidelines | Enter true or false. |
| Example Value | true |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | True; False |
| Field Type | Boolean |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Use for source-level records (websites/platforms) to indicate whether harvesting is active. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#is-harvested |

## Language String

|  |  |
| --- | --- |
| Field Label | Language String |
| Field Name | b1g_language_sm |
| Purpose | Human-readable language label |
| Entry Guidelines | Do not enter manually. |
| Example Value | eng |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://www.loc.gov/standards/iso639-2/php/code_list.php |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Automatically populated based on the Language code. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#language-string |

## Last Harvested

|  |  |
| --- | --- |
| Field Label | Last Harvested |
| Field Name | b1g_lastHarvested_dt |
| Purpose | Date the website was last harvested |
| Entry Guidelines | Enter a date in yyyy-mm-dd format. |
| Example Value | 2025-01-01 |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Date |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Intended for website/source records to track lifecycle and harvest schedules. Do not use for standalone item records without child records. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#last-harvested |

## Local Collection

|  |  |
| --- | --- |
| Field Label | Local Collection |
| Field Name | b1g_localCollectionLabel_sm |
| Purpose | Subcollection defined by the Publisher or Provider |
| Entry Guidelines | Enter plain text. |
| Example Value | Coastal |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Represents source-defined groupings/collections. In the UI it displays as a clickable facet value rather than as a structured relationship (e.g., Is Part Of). |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#local-collection |

## Mediator

|  |  |
| --- | --- |
| Field Label | Mediator |
| Field Name | b1g_dct_mediator_sm |
| Purpose | Institutions that provide authentication for licensed resources |
| Entry Guidelines | Enter the full BTAA institution name as listed on the Institutions page. |
| Example Value | University of Minneapolis |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | https://gin.btaa.org/team/institutions/ |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Used as a facet so users can filter to licensed resources accessible via their institution. Stored as plain text. |
| Namespace source | DCMI |
| Definition URI | https://gin.btaa.org/metadata/b1g/#mediator |

## Provenance

|  |  |
| --- | --- |
| Field Label | Provenance |
| Field Name | b1g_dct_provenance_sm |
| Purpose | Plain-language summary of how the record was obtained |
| Entry Guidelines | Enter complete sentences describing when, where, and how the record was obtained. Values may be entered manually or generated programmatically. |
| Example Value | The metadata for this resource was last retrieved from U.S. Fish and Wildlife Service Open Data on 2025-08-24. |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | This is the only provenance-related field visible to end users. It should summarize the information in other provenance fields in plain language. |
| Namespace source | DCMI |
| Definition URI | https://gin.btaa.org/metadata/b1g/#provenance-statement |

## Publication State

|  |  |
| --- | --- |
| Field Label | Publication State |
| Field Name | b1g_publication_state_s |
| Purpose | Whether the record is visible in the geoportal |
| Entry Guidelines | Enter one of the three allowed values. |
| Example Value | draft |
| Controlled Vocabulary? | TRUE |
| Vocabulary List | draft; published; unpublished  |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | TRUE |
| Commentary | Controls whether users can discover the record in the geoportal (search and relationship browsing). Regardless of state, the direct link to the resource will be accessible. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#publication-state |

## Spatial Resolution as Text

|  |  |
| --- | --- |
| Field Label | Spatial Resolution as Text |
| Field Name | b1g_dcat_spatialResolutionInMeters_s |
| Purpose | Human-readable description of spatial resolution |
| Entry Guidelines | Enter a scale, distance, or other descriptive free text. |
| Example Value | Scale [1:1,140,480] |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Analogous to scale for map records; may also convey recommended resolution for GIS datasets. |
| Namespace source | DCAT |
| Definition URI | https://gin.btaa.org/metadata/b1g/#spatial-resolution-as-text |

## Spatial Resolution in Meters

|  |  |
| --- | --- |
| Field Label | Spatial Resolution in Meters |
| Field Name | b1g_dcat_spatialResolutionInMeters_sm |
| Purpose | Numeric spatial resolution of a raster dataset |
| Entry Guidelines | Enter a numeric resolution in meters. |
| Example Value | 100 |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Intended for raster datasets only. |
| Namespace source | DCAT |
| Definition URI | https://gin.btaa.org/metadata/b1g/#spatial-resolution-in-meters |

## Tags

|  |  |
| --- | --- |
| Field Label | Tags |
| Field Name | b1g_adminTags_sm |
| Purpose | Administrative keywords for internal tracking |
| Entry Guidelines | Use tags only for internal categories. |
| Example Value | 2022-creator-sprint |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | Array of strings |
| Multivalued? | TRUE |
| Required? | FALSE |
| Commentary | Internal searchable tags for workflow tracking (e.g., cleanup sprints, batch updates). |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#admin-tags |

## Website Platform

|  |  |
| --- | --- |
| Field Label | Website Platform |
| Field Name | b1g_websitePlatform_s |
| Purpose | Technology platform used by the website |
| Entry Guidelines | Use a standardized platform value when possible. If unclear, use "custom data portal" or "other". |
| Example Value | ArcGIS Hub |
| Controlled Vocabulary? | FALSE |
| Vocabulary List |  |
| Field Type | String |
| Multivalued? | FALSE |
| Required? | FALSE |
| Commentary | Helps characterize the technology landscape across sources and supports selection of appropriate harvesting workflows. |
| Namespace source | Local |
| Definition URI | https://gin.btaa.org/metadata/b1g/#website-platform |

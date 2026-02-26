---
title: How to submit resources to the BTAA Geoportal
description: " "
sidebar:
  order: 12
---

# How to submit resources to the BTAA Geoportal

## 1. Identify Resources

!!! info "Places to find public domain collections"

    - State GIS clearinghouses
    - State agencies (especially DNRs and DOTs)
    - County or city GIS departments
    - Library digital collections
    - Research institutes
    - Nonprofit organizations

Review the [Curation Priorites](/metadata/curation-priorities/) and the [Collection Development Policy](/metadata/collection-development-policy/) for guidelines on selecting resources.

### Optional: Contact the organization

Use [this template](https://docs.google.com/document/d/1xqYbutgsrH5UTjKC9m5oBagIgk-8sSCpbYiZ5-tlZr8/edit?usp=sharing) to inform the organization that we plan to include their resources in our geoportal.

!!! tip

	If metadata for the resources are not readily available, the organization may be able to send you an API, metadata documents, or a spreadsheet export.

## 2. Investigate metadata harvesting options

Metadata records can be submitted directly or we can harvest it using parsing and transformation scripts. 

Here are the most common methods of obtaining metadata for the BTAA Geoportal:

### Spreadsheets

This method is preferred, because the submitters can control which metadata values are exported and because format transformations by UMN Staff are not necessary. The [GeoBTAA Metadata Template](https://z.umn.edu/b1g-template) shows all of the fields needed for the Geoportal.

### API Harvesting or HTML Parsing

Most data portals have APIs or HTML structures that can be programmatically parsed to obtain metadata for each record.

`DCAT enabled portals`

:	ArcGIS Open Data Portals (HUB), Socrata portals, and some others share metadata in the DCAT standard.

`CKAN / DKAN portals`

:	This application uses a custom metadata schema for their API.

`HTML Parsing`

: 	If a data portal or website does not have an API, we may be able to parse the HTML pages to obtain the metadata needed to create GeoBlacklight schema records. 

`OAI-PMH`

:	The Open Archives Initiative Protocol for Metadata Harvesting (OAI-PMH) is a framework that can be used to harvest metadata records from enabled repositories. The records are usually available as a simple Dublin Core XML format. If the protocol is not set up to include extra fields, such as the map image's download link or bounding box, this method may not be sufficient on its own.

### Individual Metadata files

Geospatial metadata standards are expressed in the XML or JSON format, which can be parsed to extract metadata needed to create GeoBlacklight schema records. Common standards for geospatial resources include:

* ISO 19139
* FGDC
* ArcGIS 1.0
* MARC
* MODS

!!! tip

	The best way to transfer MARC records is to send a single file containing multiple records in the .MRC or MARC XML format. The Metadata Coordinator will use MarcEdit or XML parsing to transform the records.


## 3. Contact the BTAA-GIN Product Manager

Send an email, Slack message to the Product Manager / Metadata Coordinator.

Minimum information to include:

- Title and Description of the collection
- a link to the website
- (If known) information about how to harvest the metadata or construct access links. 

The submission will be added to our collections processing queue.

!!! info

	Metadata processing tasks are tracked on our public [GitHub project dashboard](https://github.com/orgs/geobtaa/projects/4).
	
	

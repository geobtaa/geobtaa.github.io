---

title: GeoBTAA Metadata Application Profile
description: ""
sidebar:
  order: 2

---


The GeoBTAA Metadata Application Profile consists of the following components:

## 1. OpenGeoMetadata Elements

- The BTAA Geoportal uses the OpenGeoMetadata Aardvark Schema for each resource. The official schema is documented on the [OpenGeoMetadata website](https://opengeometadata.org/ogm-aardvark).
- For some field values, the GeoBTAA profile has specific guidelines that extend or differ from what is documented in the OpenGeoMetadata schema. See the [The GeoBTAA Metadata Template](/metadata/editingtemplate)) for full instructions.

## 2. Custom Elements

- The GeoBTAA profile includes custom fields for lifecycle tracking and administration
- They all start with the namespace `b1g`
- **See the [Custom Fields page](/metadata/b1g/) for documentation**

## 3. Supplemental information

All other forms of metadata, such as ISO 19139, FGDC Content Standard for Digital Geospatial Metadata, attribute table definitions, or custom schemas are treated as **Supplemental Metadata**.

- Supplemental Metadata is not usually edited directly for inclusion in the project.
- If this metadata is available as XML or HTML, it can be added as a hosted link for the Metadata preview tool in GeoBlacklight.
- XML or HTML files can be parsed to extract metadata that forms the basis for the item’s GeoBlacklight schema record.
- The file formats that can be viewed within the geoportal application include:
    - ISO 19139 XML
    - FGDC XML
    - MODS XML
    - HTML (any standard)

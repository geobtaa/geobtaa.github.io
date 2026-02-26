---
title: How to update the list of ArcGIS Hub websites.
description: " "
sidebar:
  order: 4
---

## Background

The BTAA Geoportal provides a central access point to find and browse public geospatial data. A large portion of these records come from ArcGIS Hubs that are maintained by states, counties, cities, and regional entities. These entities continually update the data and the website platforms. In turn, we need to continually update our links to these resources.

The [ArcGIS Harvesting Recipe](/harvest/py_arcgis_hub/) walks through how we programmatically query ArcGIS Hubs to obtain the current list of datasets. This page describes how to keep our list of ArcGIS Hub websites updated.

## How to create or troubleshoot an ArcGIS Hub website record in GBL Admin

!!! info

	The ==highlighted== fields listed below are required for the ArcGIS harvesting script. If the script fails, check that these fields have been added.
	The {++underlined++} fields are used to query GBL Admin and produce the list of Hubs that we regularly harvest.

Each Hub has its own entry in GBL Admin. Manually create or update each record with the following parameters:

* ==Title==: The name of the site as shown on its homepage. **This value will be transferred into the Provider field of each dataset.**
* Description: Usually "Website for finding and accessing open data provided by " followed by the name of the administrative place or organization publishing the site. Additional descriptions are helpful.
* Language: 3-letter code as shown on the [OpenGeoMetadata](https://opengeometadata.org/ogm-aardvark/#language-values) website.
* ==Publisher==: The administrative place or organization publishing the site. **This value will be concatenated into the title of each dataset.** For place names, use the FAST format (i.e. `Minnesota--Clay County`.
* {++Resource Class++}: `Websites` **This value is used for filtering & finding the Hubs in GBL Admin**
* Temporal Coverage: `Continually updated resource`
* Spatial Coverage: Add place names using the FAST format as described for the [B1G Profile.](https://geobtaa.github.io/metadata/input-guidelines/#spatial-coverage)
* Bounding Box: If the Hub covers a specific area, include a bounding box for it using the [manual method](/metadata/add-bbox/) described in the Add Bounding Boxes guide.
* Member Of: one of the following values: 
     * `ba5cc745-21c5-4ae9-954b-72dd8db6815a`  (Government Open Geospatial Data)
     * `b0153110-e455-4ced-9114-9b13250a7093` (Research Institutes Geospatial Data Collection)
* {++Format++}: `ArcGIS Hub` **This value is used for filtering & finding the Hubs in GBL Admin**
* Links - Reference - "Full layer description" : link to the homepage for the Hub
* ==ID== and Code: Both of the values will be the same. Create a new code by following the description on the [Code Naming Schema page](/metadata/codenamingschema/). Use the Advanced Search in GBL Admin to query which codes have already been used. If it is not clear what code to create, ask the Product Manager or use the [UUID Generator website](https://www.uuidgenerator.net) to create a random one. **The ID value will be transferred into the Code field of each dataset.**
* ==Identifier==: If the record will be part of the monthly harvests, add this to the end of the baseUrl (usually the homepage): `/api/feed/dcat-us/1.1.json`. **The Identifier will be used to query the metadata for the website.**

    !!! warning
    
        Always check the Identifier link! It should show a JSON API in your browser that displays all of the metadata for each dataset hosted by the website. The baseUrl may be slightly different than the landing page for the organization. For example, some entities may add the string "data-" to the beginning of their site URL. The best way to make sure you have the right URL is to look for a box labeled "Search all data". This will result in a link like "`baseUrl`/search". Then, replace the "/search" with `/api/feed/dcat-us/1.1.json`

* ==Access Rights==: `Public` for all ArcGIS Hubs.
* ==Accrual Method==: `DCAT US 1.1`. **This value is used for filtering & finding the Hubs in GBL Admin**
* Status: If the site is part of the ArcGIS Harvest, use the value `Indexed`. If the site is not part of the harvest, use `Not indexed`. Other explanatory text can be included here, such as indicating if the site is broken.
* Publication State: When a new record is created it will automatically be assigned `Draft`. Change the state to `published` when the metadata record is ready. If the site breaks or is deprecated, change this value to `unpublished`.

## How to remove broken or deprecated ArcGIS Hubs

If a Hub site stalls the Harvesting script, it needs to be updated in GBL Admin.

### If the site is missing:

Try to find a replacement site. When a Hub is updated to a new version, sometimes the baseURL will change. If a new site is found, update:

* **Links - Reference - "Full layer description"** : new landing page 
* **Identifier** : the new API (with the suffix `/api/feed/dcat-us/1.1.json`)

### If the site is present, but the API is returning an error:

In this case, we freeze the website and the dataset records, but stop new harvests. Make these changes:


#### Website Record

* ==Accrual Method==: remove `DCAT US 1.1` and leave blank
* Status: Change the value "Indexed" to "Not indexed". Leave a short explanation if the API is broken.

#### Dataset Records

* Export all of the records using the `Code` field
* ==Accrual Method==: change from "ArcGIS Hub" to "ArcGISHub-paused"

!!! info "Broken APIs"

	These steps will remove the records from our preset query to select active ArcGIS Hubs in GBL Admin. The effect will be to freeze them until the API starts working again. Once the API becomes accessible again, reverse the Accrual Method values.













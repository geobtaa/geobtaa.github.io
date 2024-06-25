# Software Requirements Specification (SRS) for the BTAA Geoportal


## 1. Purpose and Scope

###Purpose

This document describes the BTAA Geoportal as it has been developed since 2015 and how it will be enhanced in the near future to incorporate the new BTAA-GIN Geodata Collection.
	
### Scope

The BTAA Geoportal is a search application for a federated registry of geospatial resources. Users can use a combination of search strategies to discover items held at multiple external hosts, including government data portals, research institutions, academic libraries, and more.  
	
The BTAA Geoportal is solely for search and discovery. It does not include mapping capabilities, such as combining layers, styling layers, analyzing data, or creating web maps. For these activities, users will need to open the datasets in a different application, such as desktop GIS software or SAAS web mapping applications.
	
The BTAA Geoportal also includes a backend management tool, GBL Admin, for metadata creation, batch ingest, editing, publishing, and analysis.
	
	
## 2. General Description

### 1. Metadata Management

Data curators need tools to:

1. Transform and normalize metadata into the GeoBTAA Metadata Profile
2. Upload and export metadata records in CSV formats
3. Create, edit, and retire metadata records
4. Publish and export metadata records as OGM Aardvark JSONs

### 2. BTAA Geoportal 

Users need to:

1. Discover resources with a combination of text, faceted, and spatial searches
2. Evaluate resources with item viewers and metadata
3. Download resources from item pages
4. Share direct links to search queries and item pages

### 3. Digital Asset Management (new initiative)

Data curators need asset management tools to:

1. upload assets to cloud storage
2. attach assets to metadata records in GBL Admin

Types of digital assets include:

* zipped datasets for user download
* hosted files for "serverless" user preview, including tiled datasets and images
* supplemental documentation files for user preview and download
* thumbnails for item preview

### Product Perspective

The BTAA Geoportal is an index of tens of thousands of geospatial resources from hundreds of sources. The Geoportal enables users to search by map, keyword, and category, providing access to scanned maps, digital GIS data, aerial imagery, and interactive mapping applications. Most of the cataloged data originates from local governments, including states, counties, and cities, with a significant contribution of scanned maps from Big Ten University libraries.

Designed to streamline the research process, the Geoportal alleviates the time-consuming task of locating geospatial resources. Unlike general search engines, which often obscure local datasets, the Geoportal allows users to search by What, Where, and When—without needing to know which agency manages the data. For example, a user researching urban development can easily access comprehensive data on city infrastructure across multiple jurisdictions through a single interface.

The metadata catalog for the BTAA Geoportal needs to be updated frequently, at least weekly. Each time, there may be 10s of thousands of records that need to be updated, are new, or need to be retired based on the source portal dataset lifecycle. These management activities are supported by GBL Admin, a backend management tool that provides an interface for for metadata creation, batch ingest, editing, publishing, and analysis.
	
The BTAA Geoportal’s metadata catalog requires frequent updates, at least weekly, to accommodate changes in the data lifecycle of source portals. This involves updating tens of thousands of records—some may be new, others may need updates, and some may need to be retired. GBL Admin is a custom backend management tool that provides an interface for metadata creation, batch ingest, editing, publishing, and analysis, ensuring that the Geoportal remains accurate and up-to-date. This system streamlines the management of large volumes of geospatial metadata.  

In the near future, the BTAA Geoportal is poised to address a critical gap by providing access to historical datasets, which are often unavailable or hidden in original repositories. 
	
Beginning in 2025, users will also be able to discover unique data, collected and distributed by the BTAA-GIN. This data will largely be historical resources that have not been archived elsewhere. For this collection, users will be able to preview and download all of the items.

### Product Functions

The BTAA Geoportal is built with [GeoBlacklight](https://geoblacklight.org) software and enables most of its default functionality, along with a few custom features.

#### Search

Users can discover resources in the BTAA Geoportal using a variety of search methods:

- **Text Search**: Allows users to enter keywords related to their research interests.
- **Faceted Filters**: Users can refine search results using multiple facets, including:
  - **Place**: Filters resources by cataloguer-assigned place names.
  - **Resource Class and Type**: Allows filtering by resource categories and types, such as Datasets, Maps, or Imagery.
  - **Year and Time Period**: Users can specify date ranges or select pre-defined historical periods.
  - **Language and Creator**: Filters by the language of the resource and the creator or responsible organization.
  - **Provider and Access**: Distinguishes between public and restricted access resources, filtering further by subscribing institutions.
  - **Georeferenced Resources**: Indicates if a resource has a georeferenced version available, including those processed through the AllMaps plugin.

Each facet is designed to optimize user experience by making data discovery as intuitive and efficient as possible.

#### Item Pages

**Metadata**

The BTAA Geoportal uses the [GeoBTAA Metadata Application Profile](https://gin.btaa.org/metadata/geobtaa-metadata-application-profile/), an extension of the [OpenGeoMetadata (OGM) Aardvark metadata profile](https://opengeometadata.org/ogm-aardvark/). The OGM Aardvark profile enhances discoverability, while the GeoBTAA extension introduces specific administrative tracking features, such as 'Date Accessioned' and 'Accrual Method'.

The GBL Admin tool is designed specifically for this metadata application profile.

Supplemental metadata formats, including ISO 19139, FGDC, and unstructured text files, are also supported. Users can access these additional metadata forms via a simple interface option that allows viewing or downloading directly from the item pages.



**Resource Viewers**

Resource visualization is facilitated through viewers tailored to the content type:

- **Web Services**: Geospatial data published as web services can be previewed using a dedicated viewer that incorporates a query function for extracting attribute values of selected features.
- **Scanned Maps**: For items such as scanned maps hosted on IIIF servers, an image viewer is used. This viewer supports both single and multipart items. A secondary viewer integrates with the AllMaps plugin for optional georeferencing.


**Resource Access**

When available, users can preview and download items from within the interface. When these features are not available, users are directed to the source websites to obtain the data externally. 

- **Download Access**: Direct downloading of resources is available via a 'Download' button, facilitating immediate access to data when available. For resources not hosted directly, users are redirected to original source websites for external data retrieval.


- **Endpoint Integration**: Users interested in integrating geospatial data into third-party applications can easily copy web service endpoints, supporting use in desktop GIS and web mapping platforms.

**Item Relationships**

To enhance the navigability and understanding of data connections, the Geoportal displays various item relationships through intuitive widgets:

- **Hierarchical Relationships**: Displays parent-child linkages, useful for navigating collections and related datasets.
- **Associative Relationships**: Identifies and links similar items or different versions within a dataset series, aiding in comprehensive data exploration.


### User Characteristics

See the [User Personas document.](../../library/user-personas/)

The BTAA Geoportal does not enable user authentication for public logins. The collection does feature some databases that are only accessible by affiliates at specific BTAA institutions. For these resources, users are directed to the library catalogs of their home institution, where they can authenticate locally.

### Constraints


	
## System Features and Requirements

### Functional Requirements: BTAA Geoportal
	•	A description of the function.
	•	The input required.
	•	The output expected.
	•	The processes involved.
	
### Functional Requirements: GBL Admin

	•	A description of the function.
	•	The input required.
	•	The output expected.
	•	The processes involved.


## Data Requirements

	•	Data Modelling: Describe the data structure that the Geoportal will manage. Include details about data types, how data is input to the system, how it is stored, and how it should be manipulated.
	•	Metadata Standards: Given your specialty, include any specific metadata standards that need to be adhered to within the portal.
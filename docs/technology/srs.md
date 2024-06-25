# Software Requirements Specification (SRS) for the BTAA Geoportal


## 1. Purpose and Scope

###Purpose

This document describes the BTAA Geoportal as it has been developed since 2015 and how it will be enhanced in the near future to incorporate the new BTAA-GIN Geodata Collection.
	
### Scope

The BTAA Geoportal is a search application for a federated registry of geospatial resources. Users can use a combination of search strategies to discover items held at multiple external hosts, including government data portals, research institutions, academic libraries, and more.  
	
The technical stack also includes a backend management tool, GBL Admin, for metadata creation, batch ingest, editing, publishing, and analysis.
	
	
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

The metadata catalog for the BTAA Geoportal needs to be updated frequently, at least weekly. Each time, there may be tens of thousands of records that need to be updated, are new, or need to be retired based on the source portal dataset lifecycle. These management activities are supported by GBL Admin, a backend management tool that provides an interface for for metadata creation, batch ingest, editing, publishing, and analysis.
	
Beginning in 2025, users will also be able to discover locally held data, collected and distributed by the BTAA-GIN. This data will largely be historical resources that have not been archived elsewhere. For this collection, users will be able to preview and download all of the items.

### Product Functions

The BTAA Geoportal is built with [GeoBlacklight](https://geoblacklight.org) software, which enables most of its default functionality, along with a few custom features.

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

- **Downloads**: Direct downloading of resources is available via a 'Download' button, facilitating immediate access to data when available. For resources not hosted directly, users are redirected to original source websites for external data retrieval.


- **Endpoint Integration**: Users interested in integrating geospatial data into third-party applications can easily copy web service endpoints, supporting use in desktop GIS and web mapping platforms.

**Item Relationships**

The Geoportal displays various item relationships using widgets on the item browse pages:

- **Hierarchical Relationships**
	- displays parent-child linkages, useful for navigating collections and related datasets
	- Examples: `Member Of`, `Is Part Of`, `Source`
- **Associative Relationships**
	- identifies and links similar items or different versions within a dataset series
	- Examples: `Relation`, `Is Version Of`

### User Characteristics

See the [User Personas document.](../../library/user-personas/)

The BTAA Geoportal does not enable user authentication for public logins. The collection does feature some databases that are only accessible by affiliates at specific BTAA institutions. For these resources, users are directed to the library catalogs of their home institution, where they can authenticate locally.

	
## System Features and Requirements

### Functional Requirements: GBL Admin

#### 1. User Login
- **Requirement ID**: admin-01
- **Description**: GBL Admin shall allow curators to securely log in to manage records.
- **Acceptance Criteria**:
  - Curators can log in using their institutional email.
  - Authentication must be handled via the *central Authentication Service.*
  - The system should log all login attempts.
- **Dependencies**: Relies on the *Authentication Service* for credential verification.

#### 2. Dashboard View
- **Requirement ID**: admin-02
- **Description**: A dashboard that provides an overview of records and quick access to administrative tools.
- **Acceptance Criteria**:
  - Dashboard loads within 5 seconds upon login.
  - Displays a list of recent records and links to administrative tools.

#### 3. Text Search
- **Requirement ID**: admin-03
- **Description**: Enable curators to perform a free text search across all metadata fields.
- **Acceptance Criteria**:
  - Returns relevant search results within 5 seconds.
  - Supports partial text input and common search operators.

#### 4. Faceted Search
- **Requirement ID**: admin-04
- **Description**: Provide curators with faceted search capabilities to filter records efficiently.
- **Acceptance Criteria**:
  - Facets accurately reflect the counts of underlying data.
  - Users can apply multiple facets simultaneously.
- **Facets Include**:
  - Date Created, Publication State, Date Accessioned, Resource Class, Provider, Accrual Method, Public/Restricted, Member Of, Resource Type, Georeferenced.

#### 5. Advanced Search
- **Requirement ID**: admin-05
- **Description**: An advanced search form that allows curators to perform complex queries.
- **Acceptance Criteria**:
  - Users can construct queries using multiple fields
  - The form supports dropdowns for field selection.
- **Fields Include**:
  - Resource Class, Provider, Date Accessioned, Code, Is Part Of, Member Of, Resource Type, Format, Suppressed, Child Record, Georeferenced.

#### 6. Batch Record Import
- **Requirement ID**: admin-06
- **Description**: Curators can import records in bulk using a templated CSV format.
- **Acceptance Criteria**:
  - The system validates the format and content of the CSV file before import.
  - Provides a report on the success/failure of record imports.

#### 7. Batch Record Export
- **Requirement ID**: admin-07
- **Description**: Enable curators to export records in a templated CSV format.
- **Acceptance Criteria**:
  - Exported CSV files must match the specified template format.
  - Curators can select which records to export based on search results or filters.




	
### Functional Requirements: BTAA Geoportal
	•	A description of the function.
	•	The input required.
	•	The output expected.
	•	The processes involved.


## Data Requirements

	•	Data Modelling: Describe the data structure that the Geoportal will manage. Include details about data types, how data is input to the system, how it is stored, and how it should be manipulated.
	•	Metadata Standards: Given your specialty, include any specific metadata standards that need to be adhered to within the portal.
---
title: Best Practices for ArcGIS Hub Open Data Portals
description: This guide presents publishing workflows that improve the stability of data identifiers and maximize benefits from metadata of resources on ArcGIS Hub / Open Data Portals.
year: 2018

authors: 
   - name: ArcGIS Portals Working Group
tags:
- best practices
- reports
---

Last revised June 2018

## Executive Summary

Open data is important for facilitating government transparency, accountability, and public participation.  In recent years, ArcGIS Hub / Open Data Portals have emerged as the most popular publishing application for geospatial data providers. While this platform excels with user experience and data accessibility, it enables problematic publishing practices that contribute to link rot.  Additionally, when migrating a dataset between the ArcGIS suite of products, it is very easy for the metadata to get lost.

This guide presents publishing workflows that improve the stability of data identifiers and maximize benefits from metadata of resources on ArcGIS Hub / Open Data Portals.

Stable data identifiers prevent URL links from breaking for those who are using your data dynamically in web maps or for sites that aggregate resources.  They also reduce time required to maintain and update links within your own organizational website, protecting investment of time and labor in the resources you have created.

Strong metadata workflows ensure that the context needed to trust and understand data stays associated with the resource.  When information about data collection steps are not written down or become separated from the data, data users are likely to be frustrated and more likely to use data incorrectly.  Losing track of metadata creates more work down the road for staff trying to answer questions from the public or others in the office about unfamiliar data. Metadata is also critical for making resources more discoverable within the open data environment.  Providing descriptive text about your data will make these resources much more likely to show up in searches within ArcGIS Online and Google.

At the time of writing this guide, the best option for keeping metadata associated with data in ArcHub is to create metadata using ArcCatalog and then to upload individual shapefiles to ArcGIS Online through the Content Pane.  With this workflow, information specific to each data layer can be displayed on item pages and metadata is included with shapefile downloads.

If your organization must publish data from a desktop platform (i.e. ArcMap or ArcGIS Pro), it is only possible to provide item description metadata for the entire service, not for individual layers.  Metadata cannot be automatically included with data downloaded from ArcGIS Hub.  A workaround is to “enable metadata for your organization” and then use the online metadata editor to make a separate metadata file available from the download dropdown in ArcGIS Hub.  This workaround also can be used in conjunction with other publishing workflows to provide additional metadata in alternative formats, such as a PDF or spreadsheet with attribute field definitions. 

If you do “enable metadata for your organization,” it will affect how metadata is displayed to users online when they “View Metadata.”  It will also affect the format of metadata in cases where it is available with shapefile downloads. Metadata created or changed online (on the item page or in the online metadata editor) will not be included in data downloaded from ArcGIS Hub.

Examining every combination of settings was beyond the scope of this guide and best practice changes frequently with updates to ArcGIS products and tools.  We recommend checking that your organization’s specific publishing workflow: 

* preserves data identifiers
* provides layer specific metadata on your open data site 
* makes documentation available for download, optimally in a format bundled with the data itself 

------------------------------------------

## Checklist

To improve the stability and usefulness of resources on ArcGIS Hub:

- [x] Enable persistent layer ordering. Existing links will not break if the layers in a map service are reordered or if new data is added or removed from the service.
- [x] When possible and appropriate, **overwrite existing services** to update layers. Item IDs will remain the same, preserving links and other layer properties (e.g. item page information, symbology, and pop-up configurations)
- [x] Edit metadata on the desktop** (i.e. ArcCatalog), rather than using the online metadata editor or making changes on item pages. Metadata generated offline can be bundled with shapefile downloads. Revisions made to metadata online will not be reflected in these downloaded files.
- [x] Publish zipped shapefiles or single feature layer geodatabases by uploading directly into ArcGIS Online through the Content Pane. This is the only method for publishing data that supports layer level metadata in your open data portal and allows metadata to be automatically included with shapefile downloads. 
- [x] If you have to publish services from a desktop platform, consider **enabling metadata for your organization**. While metadata will not be automatically included with shapefile download, this setting makes it possible to manually add service-level metadata for download as a spreadsheet, PDF or other format.
- [x] Double check that your organization’s specific publishing workflow preserves data identifiers and makes sufficient metadata available for download. It is beyond the scope of this guide to discuss every possible publishing workflow and the software frequently changes.  

## Section 1: Publishing practices for stable identifiers

Every item (unit of content) published to ArcGIS Online is assigned a unique identifier.   Depending on your publishing workflow, however, you may unintentionally generate new identifiers for data even though the content has not changed substantially. 

Things that may cause this behavior include:

* stopping and restarting a server
* deleting and republishing a dataset to update it

### 1.1  Overwriting existing files

Overwriting existing files is one way to avoid frequent changes to identifiers and broken links for your data users.  

When should you overwrite/update:

* if you are making a small revision to a dataset or correcting an error
* if the data is frequently updated or programmed to sync with local servers at regular intervals

When should you republish:

* if it is a “new” dataset - something that has been changed substantially so that it no longer matches the description provided in the metadata

**Workflows for overwriting resources:**

**ArcMap 10.4.1:**

File →  Share As → Service → Overwrite Existing Service

**ArcGIS Online:**

On the right side of a hosted feature layer item page: 

Click on Update Data, then chose “Update Entire Laye**r**”

Note that all field names and layers in the file you upload must be the same as the original file


### 1.2  Enable persistent layer ordering

([from ESRI help documentation on server configuration details](https://doc.arcgis.com/en/hub/data/server-configuration-details.htm))

When adding a layer to ArcGIS Online to be used in Hub, a URL to the service will have a number on it so the request goes to the right layer. It can be problematic in older versions of ArcGIS Server when changes are made to the services that affect the order of these numbers. In ArcGIS Server 10.3, on the map service's MXD data frame properties, you can enable persistent layer IDs. This means that if the layers are reordered or new data is added or removed from the service, the existing links will not break.

![alt_text](@images/open-data_image1.png "image_tooltip")

--------------------------------------
## Section 2: Providing quality metadata

Metadata (the documentation and context necessary to make sense of data) is especially important in the open data environment. 

* **Metadata improves the discoverability of your data resources.** Providing descriptive text about your data will make these resources much more likely to show up in searches within ArcGIS Online and Google.  ArcGIS Online uses the title, tags, description, terms of use / use constraints, and summary in its search algorithms.
* **Metadata makes data more usable and trustworthy.** Without contextual information about who created the data, what processes were used to collect and prepare data, and what cryptic attribute field names mean - data may be rendered useless.  

Despite its importance, it is very easy for metadata to be separated from data as it is published to and downloaded from ArcGIS Hub/Open Data Portals.  Transfer of information between desktop and online products is problematic, as is transformation between different metadata styles.  Publishing services from desktop platforms limits the granularity of metadata and organization-level settings have some unintuitive impacts on how metadata displays and downloads.

What steps can you take to protect the time and effort you have invested into describing your data? To reduce having to manually add metadata in multiple places?  To have the documentation stay connected to the data resource as it moves within the digital environment?

Section 2.1 of this guide discusses how different methods for publishing data and organizational settings affect metadata display and download in Hub /Open Data Portals.  Section 2.2 recommends what to include when writing quality metadata.    


### 2.1 Publishing metadata

There are a large number of settings that impact how metadata is displayed and available from Hub / Open Data Portals. This includes:

* the method used to publish data (e.g. adding item to ArcGIS Online from the content pane, publishing services from ArcMap or ArcGIS Pro, or using a programmatic tool such as ArcGIS API for Python)
* what tool is used to create metadata and whether it is generated before or after being published (ArcCatalog, ArcGIS Online metadata editor, editing the item details page)
* whether ArcGIS Online organizational account has “metadata enabled”
* what style metadata was set for the organizational account when data is uploaded and what style is currently selected
* the version of server and desktop software

Metadata may be available in multiple locations and formats within an open data portal - most notably as text on the item page, by clicking the “view metadata” link, and as an .xml file accompanying shapefile downloads.


![alt_text](@images/open-data_image2.jpg "image_tooltip")


The section below offers some general advice about how publishing workflows and other settings affect metadata for your resources.  

[Please see the Metadata Workflow Options for Open Data Portals chart for a more comprehensive look](#metadata-workflow-options-for-open-data-portals) 

Examining every combination of settings was beyond the scope of this report and best practice changes frequently with updates to ArcGIS products and tools.  Overarching goals for making useful metadata should be to:

* Provide layer specific, human-readable metadata on your site 
* Make documentation available for download, optimally in a format bundled with the data itself 


#### 2.1.1 Enabling metadata for your organization

Site administrators have the option to “enable metadata for your organization” within the item settings for their enterprise account.  This terminology is confusing since the setting doesn’t affect what types of metadata can be uploaded, just how it will be formatted in online display and downloads.  Currently, organizations can only choose one metadata style (e.g. FGDC, ISO 19139) of formatting which will be applied to all of their records. 


![alt_text](@images/open-data_image3.png "image_tooltip")


Turning on this setting:

* **formats the “view metadata” page based on the metadata style selected for your organization** -  All items uploaded to your organization will have this formatting regardless of whether you have provided metadata in this style.  If you turn off this setting later, the “view metadata” page will continue to be formatted in the style that was last enabled. 
* **formats the metadata file downloaded with shapefiles based on the metadata style selected for your organization**  -  The metadata setting you have in place when you upload data will determine what format it will take when downloaded with shapefiles.  For example, if you have metadata enabled for your organization with FGDC style selected, upload layers, and then turn off the setting, the downloaded shapefiles for these layers will still have FGDC formatting.  The .xml files cannot be edited in ArcCatalog without transforming back into the ArcGIS 1.0 metadata standard.  
* **provides access to an online metadata editor** - Changes that are made using the editor will only modify online descriptions of your data and will not be incorporated into metadata downloads from your open data portal. Because of this, we recommend editing metadata with desktop software. If you do edit metadata using this tool (or on the item page while metadata is enabled), you can “Save Local Copy**”** to get an XML file with revisions made online. Use this file to update the offline copy of the data and then overwrite the layer in your open data portal.

Enabling metadata could be a good option if:   

* You have to publish data using a desktop platform and need to use the online editor to provide some metadata for download (such as a PDF or spreadsheet with attribute field definitions)


#### 2.1.2 Publishing Workflows

** RECOMMENDED WORKFLOW: Uploading directly to ArcGIS Online via the Content Pane **

Uploading directly to ArcGIS Online via the content pane offers the opportunity to provide individual-layer level metadata.  (Note that, unlike files loaded into web maps, these [hosted feature layers do not have feature limits](https://support.esri.com/en/technical-article/000012039).)

When shapefiles or single feature layer geodatabases are uploaded to the content pane, the item page will automatically be populated from existing metadata.  

The “view metadata” link on the open data site also draws on this content.  If metadata is enabled, the page will be loosely based around the organization’s selected metadata standard (e.g. FGDC, ISO 19139, etc).  If metadata is not enabled and no metadata created for the layer prior to upload, the “view metadata” button will link back to the ArcGIS Online page for the resource - even if metadata has been filled in later.

Perhaps the greatest advantage to uploading resources directly to the content pane is that it is possible to have metadata accompany shapefile downloads.  The data must have a metadata file when it is originally uploaded to ArcGIS Online or it won’t have one when the file is downloaded - even if you fill out information on the item page or add information to the online metadata editor. Also revisions that you make to metadata online will not be reflected in metadata downloaded from the open data portal.

If metadata is enabled (see section 2.1.1), the shapefile download will include an .xml file in the metadata standard specified by your organization at the time of upload.  It will not be possible to open these files in ArcCatalog without transforming them back into ArcGIS 1.0 metadata.  If metadata is not enabled at the time the data is uploaded, the shapefile download will include an .xml file in ArcGIS 1.0 metadata.  ArcCatalog will see this file as being separate from the rest of the shapefile, but it is possible to open and edit without transformation.

**Publishing services from a desktop platform:**

Metadata for services can be created through the “Map Document Properties” (before publishing your service) or the Item Description tab of the Service Editor (during the publishing process).

 
![alt_text](@images/open-data_image4.png "image_tooltip")
                   
![alt_text](@images/open-data_image5.png "image_tooltip")


When shared to an open data portal, each layer that is published as part of a service will have its own page.  The metadata for these pages, however, will all be the same, matching the information available for the overarching service. It is not possible to customize the metadata (description, tags, and use constraints) for individual layers.  Metadata that has been created for individual layers within ArcCatalog will not appear anywhere online.

Metadata files are also not automatically included with any of the download format options.

When to publish from the desktop:

* if layers are closely related such that it makes sense to describe them as a set rather than individually.
* If you plan to use the online metadata editor to manually add additional metadata distribution options (see below). 

**ALTERNATE WORKFLOW / WORKAROUND: Adding metadata files to the download dropdown**


![alt_text](@images/open-data_image6.png "image_tooltip")


You can include additional download file formats or related documents by adding links in the Distribution section of ArcGIS 1.0 Format Metadata. These files will then show up in the download dropdown in ArcGIS Hub.  While preference should be given to workflows that include metadata directly with the data download (so that users have the information even if they don’t realize that they will need it later), this could be an option if you need to publish services from a desktop platform or want to provide an alternative metadata format, such as a PDF or spreadsheet with attribute field definitions

(Steps modified [from ESRI help documentation on preparing your data](http://doc.arcgis.com/en/hub/data/prepare-your-data.htm) )

ArcGIS Online 

You must “enable metadata for your organization” (see section 2.1.1)

1. From the item page, click Metadata. 
2. Within the metadata form, choose Distribution. 
3. In the Online Resource page that appears, click the + sign.
4. Enter a URL to your download file, or external related link. This could be a non-hosted file that you have uploaded to ArcGIS Online through the Content Pane or a link to an organizational website / ftp server.
5. Enter a name for the file. This name will appear on ArcGIS Hub.
6. Change the Function to Download.

 ArcCatalog: 

1. Click on an item in the directory.  Select the “description” tab and click to “Edit” the metadata. 
2. Select “Distribution” under the Resource section.
3. Click on the + sign by “New Digital Transfer Options”
4. Click on the  + sign. By “New Online Resource”
5. Follow steps 4 through 6 above. 


### 2.2 Tips for creating quality metadata for ArcGIS Online

ArcGIS Online has limited capability handling standards-based metadata at this time.  Providing quality item description metadata should therefore be a priority for resources hosted on ArcGIS open data portals.  In particular, choosing a meaningful title and writing a thorough description will help users understand the value and limitations of your data. 

In ArcGIS Hub/ Open Data Portals the only metadata elements visible on the main page are: title, description, tags, and access/use constraints.

**Title:**  Theme, Where, When  (e.g. City Zoning, Minneapolis, 2015)

**Tags / Keywords:**  Tags are used to make data more discoverable. Think about what words someone might use when searching for your layers. Avoid being too broad (e.g. “GIS”, “open data”), too narrow (e.g. project acronyms), and typos. If you are not sure what to choose, picking terms from a “dictionary” of disciplinary subjects can be a good place to start (e.g. [ISO 19115 Topic Categories](https://www2.usgs.gov/science/about/thesaurus-full.php?thcode=15))

**Description:** 

* Description of content of the layer or the list of layers included in the service (could also include most important or unique attributes)
* Purpose (why has this data been collected or the reason it is being made available)
* Lineage (where the data came from and any changes that were made)
* Temporal extent of data collection / time period that data represents
* Special data characteristics or use limitations (e.g. excluded geographies, scale digitized)

**Access and Use Constraints (when publishing a Map Document service)) / Use Limitation (ArcCatalog) / Terms of Use (on item page)**: Adding a license for your data helps data users know how they can work with the data and when to give credit.  You can add custom text specific to your organization or a standardized open data license..   

“If you add a Creative Commons license (CC0, CC BY, CC BY-SA) by either the name or URL, the dataset page will display the Creative Commons license icon and will link to the appropriate license details web page. If you add an Open Data Commons license (PDDL, ODbL, ODC-By) the dataset page will display the license name and link to the appropriate license details web page.” ([from ESRI help documentation on preparing your data](http://doc.arcgis.com/en/hub/data/prepare-your-data.htm) ) 

**Elements that are part of the item description, but are not visible on ArcGIS Open Data Portal item pages:**

**Summary:** Very brief description (1 sentence) about what the data is and (if applicable) how it relates to other maps or applications from the organization.  Despite the fact that “Summary” is included in dialog boxes whenever saving changes to a resource in ArcGIS Online, this text does not appear on open data portals.

**Credits:** If the data you are publishing were created by a specific individual or derived from an outside source, cite this source.  This metadata element is hidden on the open data portals, so you may want to also provide this information as part of the description.


## Resources for working with metadata in ArcGIS Online:

[Manage data (with frequently asked questions about metadata)](https://doc.arcgis.com/en/arcgis-online/manage-data/metadata.htm)

[Publish hosted feature layers ](http://doc.arcgis.com/en/arcgis-online/manage-data/publish-features.htm)(Content Pane, Arc Pro, ArcMap)

## Metadata Workflow Options for Open Data Portals

<p>
<strong>Publishing a service (from ArcMap 10.4.1)</strong>
</p>

<table>
  <tr>
   <td>
   </td>
   <td>ArcGIS Hub item page
   </td>
   <td>View Metadata
   </td>
   <td>Shapefile downloads
   </td>
  </tr>
  <tr>
   <td>Shapefiles or file geodatabases
   </td>
   <td> Information from the “Map Document Properties” (before publishing your service) or the Item Description tab of the Service Editor (during the publishing process)
   </td>
   <td>Opens item details page for service
<p>
If metadata is enabled….If you open the metadata editor for the service and save, it will open an html with item description metadata
   </td>
   <td>No
   </td>
  </tr>
</table>


<p>
<strong>Direct upload of layer to ArcGIS Content Pane</strong>
</p>
<p>
<strong>File Geodatabases</strong>
</p>
<p>
Metadata Enabled: Direct upload of layer to ArcGIS Content Pane
</p>

<table>
  <tr>
   <td> 
   </td>
   <td colspan="4" >ArcGIS Online
   </td>
   <td colspan="3" >ArcGIS Hub
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td colspan="2" >Hosted Feature Layer
   </td>
   <td colspan="2" >
   </td>
   <td colspan="3" >
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>On item page
   </td>
   <td>“View metadata”
   </td>
   <td>Included with 
<p>
shapefile
<p>
download 
   </td>
   <td>Included with file geodatabase download
   </td>
   <td>On item page
   </td>
   <td>“View metadata” 
   </td>
   <td>Included with shapefile download 
   </td>
  </tr>
  <tr>
   <td>Multiple files:
<p>
Standards-based metadata added in ArcCatalog before upload
   </td>
   <td>No - but “Metadata” button next to each layer opens html formatted standard
   </td>
   <td>If you open the metadata editor for the service and save, it will open a html with the changes made
   </td>
   <td>No
   </td>
   <td>Yes - but any revisions made online won’t be included
   </td>
   <td>No
<p>
If you open the metadata editor for the service, make changes and save - it will show description for the gdb service item 
   </td>
   <td>Opens item details page for service
<p>
If you open the metadata editor for the service, make changes and save - it will show description for the gdb service item
   </td>
   <td>No
   </td>
  </tr>
  <tr>
   <td>One layer: item description or standards added in ArcCatalog before upload
   </td>
   <td>Yes - missing credits and license
   </td>
   <td>Yes - item description formatted with the standard style
   </td>
   <td>Yes - the text of the originally uploaded metadata  as an.xml that can be opened in ArcCatalog
   </td>
   <td>Yes - the text of the originally uploaded metadata as an.xml that can be opened in ArcCatalog
   </td>
   <td>Yes - the data resource title will be of the service, not the layer
   </td>
   <td>Yes - item description formatted with the standard style
   </td>
   <td>Yes - the text of the originally uploaded metadata as an .xml in the format selected by the organization - cannot be opened in ArcCatalog
   </td>
  </tr>
</table>


<p>
<strong>Shapefiles</strong>
</p>
<p>
Metadata Enabled at the time of upload: Direct upload of layer to ArcGIS Content Pane
</p>

<table>
  <tr>
   <td> 
   </td>
   <td colspan="3" >ArcGIS Online
   </td>
   <td colspan="3" >ArcGIS Hub
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td colspan="3" >Hosted Feature Layer
   </td>
   <td colspan="3" >
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>On item page
   </td>
   <td>“View metadata”
   </td>
   <td>Included with 
<p>
shapefile
<p>
download 
   </td>
   <td>On item page
   </td>
   <td>“View metadata” 
   </td>
   <td>Included with shapefile download 
   </td>
  </tr>
  <tr>
   <td>Item description added in ArcCatalog before upload
   </td>
   <td>Yes - if you open the online metadata editor and “save and close”
   </td>
   <td>Yes - html version of the standard
   </td>
   <td>Yes - but any revisions made online won’t be included
   </td>
   <td>Yes - summary and credits not included
   </td>
   <td>Yes - html version of the standard
   </td>
   <td>Yes - the text of the originally uploaded metadata as an .xml in the format selected by the organization - cannot be opened in ArcCatalog
   </td>
  </tr>
  <tr>
   <td>Item description added on the item page after upload 
   </td>
   <td>Yes
   </td>
   <td>
   </td>
   <td>No
   </td>
   <td>Yes -  summary and credits not included
   </td>
   <td>Yes - html version of the standard
   </td>
   <td>No
   </td>
  </tr>
  <tr>
   <td>Standards-based metadata added in ArcCatalog before upload
   </td>
   <td>Yes - missing some elements (license, credits)
   </td>
   <td>Display quality may vary depending on the standard
<p>
some of it in view metadata,  limited elements in the online metadata editor 
   </td>
   <td>Yes - but any revisions made online won’t be included
   </td>
   <td>Yes - missing license
   </td>
   <td>Display quality may vary depending on the standard,
<p>
some of it in view metadata
   </td>
   <td>Yes - only some item description elements
<p>
as an .xml in the format selected by the organization - cannot be opened in ArcCatalog
   </td>
  </tr>
  <tr>
   <td>Standards-based metadata imported into online metadata editor
   </td>
   <td> Quality of translation varies  
   </td>
   <td> Quality of translation varies 
   </td>
   <td>No
   </td>
   <td>Yes
   </td>
   <td>Yes - html version of the standard
   </td>
   <td>No
   </td>
  </tr>
</table>


<p>
Metadata: Not enabled at the time of upload: Direct upload of layer to ArcGIS Content Pane
</p>

<table>
  <tr>
   <td> 
   </td>
   <td colspan="3" >ArcGIS Online
   </td>
   <td colspan="3" >ArcGIS Hub
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td colspan="3" >Hosted Feature Layer
   </td>
   <td>
   </td>
   <td>
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>On item page
   </td>
   <td>“View metadata”
   </td>
   <td>Included with 
<p>
shapefile
<p>
download 
   </td>
   <td>On item page
   </td>
   <td>“View metadata” 
   </td>
   <td>Included with shapefile download 
   </td>
  </tr>
  <tr>
   <td>Item description added in ArcCatalog before upload
   </td>
   <td>Yes
   </td>
   <td>Yes - html
   </td>
   <td>Yes - but any revisions made online won’t be included
   </td>
   <td>Yes - summary and credits not included
   </td>
   <td>Yes - html
   </td>
   <td>Yes - the text of the originally uploaded metadata  as a separate .xml that can be opened in ArcCatalog
   </td>
  </tr>
  <tr>
   <td>Item description added on the item page after upload 
   </td>
   <td>Yes
   </td>
   <td>N/A
   </td>
   <td>No
   </td>
   <td>Yes - summary and credits not included
   </td>
   <td>Opens Items Page in ArcGIS Online
   </td>
   <td>No
   </td>
  </tr>
  <tr>
   <td>Standards-based metadata added in ArcCatalog before upload
   </td>
   <td>Yes - missing some elements (license, credits)
   </td>
   <td>Display quality may vary depending on the standard
   </td>
   <td>Yes - but any revisions made online won’t be included
   </td>
   <td>Yes - but not all elements show (licence, credits not included)
   </td>
   <td>Yes - html 
   </td>
   <td>Yes - the text of the originally uploaded metadata as a separate .xml that can be opened in ArcCatalog
   </td>
  </tr>
  <tr>
   <td colspan="7" >Not Applicable: Standards-based metadata imported into online metadata editor
   </td>
  </tr>
</table>

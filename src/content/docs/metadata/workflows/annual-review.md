---
title: How to Perform Annual Reviews of Catalog Websites
description: " "
sidebar:
  order: 6
---

# How to Perform Annual Reviews of Catalog Websites

## Background and Purpose

We annually review websites with many GIS resources that can't easily be updated by an existing script or recipe, usually due to issues with the site's API or structure. 

These sites can be found by searching GeoBlacklight Admin for the tag "staticSites" and then filtering by the Resource Class "Website". Their child resources are tagged "staticSitesPart." Generally speaking, the resources on these sites do not have direct file download links in the GeoPortal, and in some cases the individual resources may not be indexed. 

The purpose of an annual review is not to fix or update all records associated with a website, but rather to 1. assess and triage major changes to the website's main page, 2. make a snapshot of the site's current state for future comparison, and 3. in some cases, compare the current state of the resources available on the site to past snapshots and/or records in GBL.

This may lead to recommendations for further harvesting or editing steps. These could include re-classifying the site to be harvested with a recipe (for example, if it has been converted to an ArcGIS Hub), removing some records, reharvesting some or all of the site manually, etc. If the site structure has changed significantly, if many resources have been added or removed from the website, or if many of our associated records in GBL have broken links, the site may need to be partially or completely re-harvested. Complete as many steps as possible at the time of the review, as long as they are brief enough that they don't delay other reviews. 

## How to Complete an Annual Review
Use the GitHub issue to track progress and record results. This process is best done with a wide screen or multiple monitors so you can view two windows next to each other. 

### Triage the Main Website Record Page

> This step is required.

1. Visit the Geoportal resource page for the parent website that you're reviewing. You can typically find the link associated with the GitHub issue, or you can search the Geoportal directly, usually under the **Websites** Resource Class. 

2. Check the **Title**, **Description**, and **Format** sections of the main website record page in the Geoportal. Is this information still accurate? If there are any links in the **Description** field, do they still work? *Note* changes or no change in the GitHub issue.

3. Use the blue **Visit Source** link in the right sidebar to open the source site in a new tab or window. It should bring you to a static web page with a list of links to GIS resources. 

4. If the **Visit Source** link is broken or brings you to a web page that *doesn't* have links to GIS resources, try to locate a working or better URL for this website. Use search engines and/or look for mentions of GIS or maps on the site(s) of the agency or entity providing the records. In most cases, the list of resources in GBL should roughly match those on the source site. 

> If the **Visit Source** link needs to be updated, do so right away using the following instructions.

> If you find that the website has been replaced by an ArcGIS Hub, follow the instructions to [add a new ArcGIS Hub website](/harvest/update-hub-list/).


#### If Needed: Update "Visit Source" Link  
1. Search GeoBlacklight Admin for the ID of the website. Select all records with the incorrect source website link, including the indexed child records. 

2. Export the Distributions CSV for these records. Edit this to create a list of only the links that need to be replaced. These will generally be "documentatation - external" type links, so you can do this by removing all rows *except* that type. 

3. Go to **Distributions** under the **Admin Tools** menu. Click **Delete CSV** in the upper right corner. Click **Choose File** and select the CSV you downloaded in the previous step. Use this to delete the incorrect source URLs before uploading the corrected ones. This is necessary because there can be multiple entries for each type of distribution link, which means that uploading a new table does not overwrite existing data.

4. In the Distributions CSV edited in step 2, replace all instances of the broken or outdated link with the new correct link. 

5. Import this corrected Distributions table in GeoBlacklight Admin. 

6. Spot check the results on the GBL record pages of affected records. 

### Create a Snapshot for Comparison

> This step is required only for large indexed websites with many child records. 

1. Make a snapshot of the resources currently on the source website by copying and pasting all text on the page(s) or saving the whole page as an HTML file. 

2. Make a snapshot of the records currently in GeoBlacklight by exporting both Primary and Distributions CSVs of all indexed records associated with the website. 

3. Attach these snapshotes to the GitHub ticket for the annual review. This ticket can be referenced for comparison the following year.


### Compare the Current Website to the Previous Snapshot

> This step applies only to indexed websites with many child records and only if a snapshot was previously created. 

1. Check past GitHub tickets for snapshots of the source website or past GeoBlacklight records.

2. If CSV exports of past GBL records exist, compare these to the current snapshot CSVs made in the previous step. This can be done manually or with a script if many records are involved. 

3. If only a snapshot of the website exists, compare it with the current snapshot of the website. Use this to evaluate the magnitude of changes. Note in the GitHub ticket roughly how many resources appear to have been added, removed, or otherwise altered. 

4. If a great number of records have been changed, evaluate whether the website can be reharvested with any automated means, needs to be reharvested manually, or may no longer need to be indexed at all. Make a recommendation for next steps. 

---
title: ArcGIS Hubs Harvest Recipe
description: " "
sidebar:
  order: 5
---

# ArcGIS Hubs Harvest Recipe

## Overview

This article contains instructions for harvesting and ingesting metadata records from ArcGIS Hub websites. It also includes troubleshooting recommendations and information about field values.

The metadata is retrieved from DCAT 1.1 API feeds using a python script, returned as a CSV using the GeoBTAA Metadata Schema, and uploaded to the BTAA Geoportal through the GeoBlacklight Admin interface.   

Records can be uploaded in two ways: 
- A *full upload*, in which all records that were found by the harvest script are published and absent records must be manually unpublished
- A *difference upload*, in which the CSV returned by the harvest script is filtered to include only records that have changed since the previous harvest. When this *difference CSV* is uploaded, records that are newly absent in the current harvest are automatically unpublished and only newly present records are published. 

This workflow uses VSCode (or another code editor) and a fastAPI browser interface to run Python scripts. This method was introduced in 2025 and replaces our Jupyter Notebook harvest recipes. 

Like all of our current harvest workflows, the ArcGIS Hubs harvest script produces two output tables: a **Primary** table and a **Distributions**  table containing links. For more information, see documentation on **Distributions** (in progress). 

## Workflow
> **Important:** The following instructions assume you've already completed the **Harvest Tools Setup Guide** (in progress).  

Updated January 2026.

### Step 1: Launch the fastAPI ArcGIS Metadata Harvester
1. In VSCode (or the code editor of your choice), open a bash terminal.
2. Activate your fastAPI harvester conda environment and change directories to the **harvester-api** repository.
3. Enter the command: **uvicorn main:app --reload**
4. In a web browser, visit **localhost:8000**.
5. Click the **ArcGIS Harvester** link. 
### Step 2: Retrieve and Prepare the Hubs List
> The list of currently active ArcGIS Hubs may change in between harvests, so it's best practice to download a new list every time. 
1. Click the link labeled **Filter ArcGIS Hubs in GBL Admin** to open a list of all currently active ArcGIS Hubs in GeoBlacklight Admin in a new tab. 
2. Select all results that match this search, then export and download their Primary CSV.
3. On the fastAPI ArcGIS Harvester page, click the **Choose File** button under **Step 1: Upload CSV of ArcGIS Hubs**, navigate to and select the CSV downloaded in the previous step, and click **Upload**.
>This interface will automatically move the CSV into the **inputs** folder in the **harvester-api** repository and rename it **arcHubs.csv**.  
>Alternatively, any of the above steps can be done manually: 
1. In GeoBlacklight Admin, apply the following filters: Publication State = **published**, Resource Class = **Websites**, Harvest Workflow = **py_arcgis_hub**. For added validation, you may also filter for Accrual Periodicity = **Weekly** and/or Source Platform = **ArcGIS Hub**. 
2. Select all results that match this search, then export and download their Primary CSV.
3. Rename the resulting CSV "**arcHubs.csv**" and move it into the **inputs** folder within the **harvester-api** respository.

### Step 3: Run the Harvester
1. Click the **Run Harvester** button. A line for each hub site will be displayed as it is harvested. A full harvest often takes about 10-15 minutes. 
2. When the harvester has finished, confirm that both **Primary** and **Distributions** CSVs for the present date exist within the **outputs** folder in the repository. These are the *full upload* CSVs.

### Step 4: Prepare and Upload the Harvest CSVs
> **Important:** There are two ways to complete this step.
> - A *difference upload* should done for most weekly harvests. This updates only child records that have been added or removed since the last harvest. 
> - A *full upload* should be done once per quarter or if you don't have CSVs from a previous harvest. This updates all child records. 

#### Weekly: Difference Upload

How it works:
- Compares the current full list of harvested records to the CSVs from the previous harvest saved on your computer. 
- Returns a CSV that will unpublish newly absent records and publish newly present records. 
- Does not update the "date accessioned" field. 

Steps: 
1. In VSCode, change directories to the **scripts** folder within the **harvester-api** repository.
2. Run the **build_uploads.py** script ("uv run build_uploads.py"). When it's finished, there should be new Primary and Distributions CSVs in the **outputs** folder named with the present date and the suffix "**_upload**." These are *difference* CSVs, and they include only records that have changed since the previous full harvest CSVs in your Outputs folder.
3. In the VSCode terminal, the script should also report how many records were added and retired. Record these numbers in the harvest ticket. 
4. In GeoBlacklight Admin, navigate to the **Admin Tools** menu and select **Import Primary**. Name the import "**[Ticket #]-ArcHubs Harvest-YYYY-MM-DD**". Select **BTAA CSV** under **Type**. 
5. Click the **Choose file** button and select the current **primary_upload** difference CSV from the **outputs** folder. Click through to start the import.
6. Next, navigate to the **Admin Tools** menu and select **Import Distributions**. Name the import "**[Ticket #]-ArcHubs Harvest-YYYY-MM-DD-Distributions**". *Note*: you must import the Primary CSV before the Distributions CSV. 

#### Quarterly: Full Upload

How it works:
- All records that were found by the harvest script are published.
- Records that were previously published but are now absent must be manually unpublished.
- A previous harvest's CSV is not required, and there is no need to run the build_uploads script. 
- Full uploads will take much longer to import in GBL admin than difference uploads.   

Steps:  

1. In GeoBlacklight Admin, navigate to the **Admin Tools** menu and select **Import Primary**. Name the import **[Ticket #]-ArcHubs Harvest-YYYY-MM-DD**. Select **BTAA CSV** under **Type**. 
2. Click the **Choose file** button and select the current date's **primary** CSV from the **outputs** folder. (No need to run the build_uploads script - just use the harvest script's output directly!) Click through to start the import.
3. Next, navigate to the **Admin Tools** menu and select **Import Distributions**. Name the import "**[Ticket #]-ArcHubs Harvest-YYYY-MM-DD-Distributions**". *Note*: you must import the Primary CSV before the Distributions CSV.
4. Click the **Choose file** button and select the current date's **distributions** CSV from the **outputs** folder (again, NOT distributions-uploads, just [date]-distributions). Click through to start the import. 
5. Unlike a difference upload, a full upload does not unpublish records that have been removed from their parent hubs. This must be done manually. After completing the upload, view the list of all published ArcGIS Hub records, and unpublish any whose date accessioned field is older than several weeks. 


## Troubleshooting

If an individual hub produces an error message during a harvest, it's often worth simply ignoring it once and trying again the following week. If it continues to return an error, check if its endpoint URL still loads a valid JSON. If not, unpublish the site. Create a GitHub issue, put it on hold, and attach the "monitor" label to it.  

If the Hubs list needs additions or changes, visit the article **Adding and Updating ArcGIS Hubs** (in progress). 

## Explanation of Fields and Parameters

Most of the following fields apply to *the child records harvested from the Hub sites*, not the Hub sites themselves. For a detailed explanation of Hub website metadata, visit **Adding and Updating ArcGIS Hubs**(in progress). 

Unless otherwise specified, all values in the fields below are automatically populated by the harvest script using a combination of the parent Hub's metadata and the metadata retrieved from the API feed. 

### Provenance Fields

- Accrual Method: Automated retrieval
- Accrual Periodicity: Weekly
- Date Accessioned: The most recent date on which a record's *parent hub* was harvested, *not necessarily* the most recent time the child record was confirmed to still exist during a harvest.
- Date Retired: The most recent date on which a record was unpublished. 
- Endpoint Description: DCAT API
- Endpoint URL: The DCAT 1.1 API feed URL of the parent Hub, which can be found by clicking the "Explore Feeds" link at the bottom of a Hub's homepage. Typically, this is the hub's main URL followed by "api/feed/dcat-us/1.1.json"
- Harvest Workflow: py_arcgis_hubs
- Source Platform: ArcGIS Hub

> Notes about the Date Accessioned field: Because records are only included in the difference CSV (described in Step 3) if they are being added or removed, the Date Accessioned won't reflect the last time a resource was found during a difference harvest - that date will be reflected by the Hub site's Date Accessioned. In other words, records that are still published were validated by the last harvest process, although they weren't changed. *When a full harvest upload is completed, the Date Accessioned field on all child records will be updated.*

### Other Fields
- Resource Class: Web Services
- Format: The type of web service. 

### Other Parameters
- Download links are no longer included in the harvest. 
- Distributions URLs correspond to the web services only. These are typically REST service URL. 

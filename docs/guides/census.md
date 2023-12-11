# Locating and Using U.S. Census Data

## What is census data?
The U.S. Census products are the premier source for detailed population and housing information about our nation. It is comprised of two parts: 

1. 	The U.S. **decennial census** is a count of each resident of the country, where they lived on April 1 in every year ending in zero. 
2. 	The **American Community Survey (ACS)** is an ongoing monthly survey which started in 2005. The ACS contains much more varied and timely data than the decennial census. 
	
Together these datasets drive government policy and help researchers, local officials, community leaders, and businesses understand the changes taking place in their communities.

When you have a question about the demographics of the United States population, your question may seem straightforward. Because there is so much data available, it can be challenging to find the right resource to answer your question.

## Where to get census data

Census data is available from a variety of places. The following table shows recommended public and licensed sources.

| Resource | Access | Date availability | Data formats | Margins of Error |
| --- | --- | --- | --- | --- |
| IPUMS NHGIS | Public (with an account) | 1790-present | CSV, boundaries | yes |
| Census Bureau data.census.gov | Public | 2010-present | CSV, boundaries separate | yes |
| Social Explorer | Public/Licensed | 1790-present | CSV, boundaries separate | yes |
| PolicyMap | Licensed | 2000-present | CSV, boundaries separate | |
| SimplyAnalytics | Licensed | 1980-present | CSV, Shapefiles | |
| Living Atlas | Licensed | 2010-present | web services | yes |

!!! tip

	See our help page on [Licensed Data](https://geo.btaa.org/catalog/8888-001) for information on what licensed data is and how to access it.*


## Authoritative Sources

NHGIS and the Census Bureau are the authoritative sources for historic and current census data. 

### Census Bureau

* Data tables: [https://data.census.gov/cedsci/](https://data.census.gov/cedsci/)
* Boundaries: [https://www.census.gov/programs-surveys/geography/guidance/tiger-data-products-guide.html](https://www.census.gov/programs-surveys/geography/guidance/tiger-data-products-guide.html)
* Documentation: [https://www.census.gov/programs-surveys/acs/methodology/questionnaire-archive.html](https://www.census.gov/programs-surveys/acs/methodology/questionnaire-archive.html)

The official source for current decennial census and American Community Survey data is the U.S. Census Bureau website. This is the best place to look for the most comprehensive set of variables and the most detailed documentation about how the data was collected and processed, including the text of the survey forms. The website only provides access to the most recent surveys, however, and the interface can be difficult to navigate.

!!! note ""

	**Census Bureau use cases**

	- When you only need current data, and have no access to licensed data through an institution
	- Finding quick demographic statistics on cities, states, etc.
	- Finding official documentation on tables, survey forms
	- Finding boundary files that other resources don’t have (fact check)
	- Finding cartographic boundary files - better for making maps if you don’t have to do analysis, especially for areas with coastline
	- Making thematic maps on [data.census.gov](https://data.census.gov/) if you do not have access to Social Explorer

### [IPUMS NHGIS](https://geo.btaa.org/catalog/05d-10)
The National Historic Geographic Information System (NHGIS) provides access to census data from 1790 to the present along with GIS-compatible boundary files. This is the best place to look if you need raw data tables for historical censuses. NHGIS has excellent documentation about how the data was processed and which survey tables are represented in the data. The interface can be difficult to navigate.

There are no mapping capabilities in this tool, but datasets are designed to be smoothly integrated into GIS software.

!!! note ""

	**IPUMS NHGIS Use cases**
	
	- Getting a large number of variables for use in a statistics program, including margins of error
	- Getting data for the whole country, at any geographic level
	- Using the data in a GIS program, where you want shapefiles and data to join beautifully
	- When you are comfortable subsetting geographies yourself in GIS
	- (rare: efficiently download multiple years of data)

## Mapping tools

If you would like to make maps using census data, there are several programs specifically designed for this.


### [Social Explorer](https://geo.btaa.org/catalog/999-0001)

Social Explorer is a useful mapping interface for exploring current and historical census data. It has a point-and-click interface which is easy to use for focused data needs. It is useful if you are only looking at census variables and don’t need to map with data layers from other sources. The interface is the easiest to use of all the Census data options here.

!!! note ""

	**Social Explorer use cases**
	
	- Making a map quickly on the website to see what variables look like
	- To make beautiful maps (static images, PowerPoint slides), and can’t use GIS, in Social Explorer
	- Easy to find the demographics you want, including searching keywords in tables and variables, and when you need really great metadata
	- Download reports that adjust for inflation

### [SimplyAnalytics](https://geo.btaa.org/catalog/999-0004)

SimplyAnalytics has a business and marketing focus - with resources that contain many government and private datasets beyond the U.S. Census. Use this resource if you would like to combine census data with business or economic data. This interface will pro-rate indicators into smaller geographies than how the data were gathered, which is problematic in a rigorous statistical analysis.

!!! note ""

	**SimplyAnalytics use case**
	
	Download a ready-to-go shapefile with variables already joined, especially if including non-Census derived variables

### [PolicyMap](https://geo.btaa.org/catalog/999-0003)

PolicyMap is a community-focused resource which contains many public and private datasets beyond the U.S. Census. Because census datasets are available elsewhere, use PolicyMap when you are interested in the additional social science data. It also has a location identifier functionality which will identify the census tract number wherever you click on the map.

!!! note ""

**PolicyMap use cases:**

	- Easily make a Multi Layer Map, where you pick several data layers and find the places where they overlap, e.g. areas with a certain level of poverty, with food deserts, and low access to vehicles
	- Narrow down a study area or use interactive tool to compare areas
	- Combining census data with other unique social science data (e.g. supermarket access, quality of life indicators)
	- Mapping tool, not a data export tool

### [Living Atlas](https://geo.btaa.org/catalog/99-1200-001)

If you are making maps using a subscription version of ArcGIS and only need recent census variables, the Living Atlas provides easy access to census data. The census layers feature multiple geographies that become visible as you zoom and well-formatted pop-ups.

!!! note ""

	**Living Atlas use cases:**
	
	- Easily integrate with other layers in ArcGIS Online or ArcGIS Pro, but only has states, counties, and tracts
	- Good pop-up information if you are building a web map or StoryMap
	- If you’re working in ArcGIS Online or ArcGIS Pro, easy to check if these layers are sufficient for your project

## Other sources of census data

Sometimes data from the census or American Community Survey will be available from regional or local entities. This data has usually been clipped to a limited geographic area and may contain variables combined from multiple census data tables. This data may be useful if it matches your study area. Since these layers have been repackaged, make sure you know how the variables relate back to the original survey.

!!! info "More Information about census data"

	Kernik, M. and D. Bonsal (2017). Data. In S. M. Manson (ed) Mapping, Society, and Technology. Minneapolis, Minnesota: University of Minnesota Libraries Publishing. Available from: [https://open.lib.umn.edu/mapping/chapter/2-data/#chapter-397-section-4](https://open.lib.umn.edu/mapping/chapter/2-data/#chapter-397-section-4)
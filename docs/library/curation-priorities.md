---
tags:
  - program guidelines
  - '2021'
---

# Curation Priorities

:fontawesome-solid-user: Authors: BTAA Collection Development & Education Outreach Committee; Product Manager

There are three distinct but related aspects of prioritizing the addition of new collections: content/theme, administration, and technology. 

These priorities will affect how quickly the items are processed or where they fall in line within our processing queue.


## Content/Theme

When it comes to scanned maps, prioritization based on content or theme is primarily a local effort. However, there are opportunities for internal collaborations, including with Special Collections librarians or other local digital collections initiatives. These collaborations can allow for unique and distinctive maps to be harvested into the geoportal across our universities.

For geospatial data, datasets created in association with research projects at our institutions may be a high priority based on content or theme. Additionally, resources that provide access to foundational datasets, such as administrative boundaries, parcels, road networks, address points, and land use, should also be considered.

Regardless of the content type, special consideration should be given to highly relevant content, especially to current events. For example, in April 2020, a call went out to all task force members to identify and submit content related to COVID-19 for harvesting into the geoportal. Content that aligns with other ongoing BTAA-GIN program efforts, such as the Diverse Collections Working Group, will also be a higher priority as these efforts are further developed.


## Administration

Collections may be prioritized based on the organization responsible for creating and maintaining content, which impacts the types of maps or datasets available to be harvested, spatial and temporal coverage, and stability. Based on these considerations, current priorities in terms of administration are:

1. University libraries and archives
	* Links to these resources are likely to be stable
	* Resources will likely be documented with a metadata standard
	* Represent our core audience

2. States and counties
	* Produce most foundational geospatial datasets (e.g., roads and parcels) and are currently our largest source of geospatial data
	* Technology and open data policies vary widely resulting in patchwork coverage

3. Regional organizations and research institutes
	* Often special organizations with funding to create geospatial data across political boundaries
	* Higher risk of harvesting duplicate datasets, as these organizations sometimes aggregate records from cities, counties, or state agencies

4. Cities
	* less likely to produce and share data in geospatial formats and more likely to share tabular data
	* prioritized cities: major metropolitan areas and the locations of our university campuses

## Technology

The source's hosting platform influences the ease of harvesting, the quality of the metadata, and the stability of the access links. Based on these considerations, current priorities in terms of technology are:

1. Published via known portal or digital library platforms, including:
	* Blacklight/GeoBlacklight
	* Islandora
	* Preservica
	* ArcGIS Hubs
	* Socrata
	* CKAN
	* Sites with OAI-PMH enabled APIs

2. Custom portals
	* each portal requires a customized script for HTML web parsing
	* writing and maintaining custom scripts takes extra time

3. Static webpages with download links
	* at a minimum, a title is required for each item
	* static sites with nested links take a long time to process and may require an extensive amount of manual work

4. Database websites
	* require the user to perform interactive queries to extract data
	* not realistic to make Geoportal records for individual datasets
	* usually results in a single "website" record in the Geoportal to represent the database
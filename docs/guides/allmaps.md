# Georeferencing with the Allmaps Plugin

This document describes the Geoportal's Allmaps Plugin and gives instructions for using this tool to create a georeferenced map overlay in the browser.

## Background

Georeferencing is the process of using ground control points to match a digital image to the geography of the real world. [Allmaps](https://allmaps.org/) is an online tool for georeferencing and overlaying any map that follows [IIIF standards](https://iiif.io/). This allows historical maps and other scanned resources to be displayed and understood in their geographic context. 

The BTAA-GIN Geoportal has an integrated Allmaps plugin that enables users to easily georeference compatible maps and view them as overlays on a basemap without leaving the browser. To view images that have been or could be georeferenced with this tool, expand the **Georeferenced via Allmaps Plugin** filter in the left sidebar of a [Geoportal search](https://geo.btaa.org/?search_field=all_fields&q=).

Important: Resources that include a downloadable georeferenced GeoTIFF file are distinct from images that are georeferenced within the Allmaps online viewer. Currently, resources with downloadable georeferenced files can be found under the filter simply named **Georeferenced**. Downloadable georeferenced TIFFs are not currently available through Allmaps.  

## Georeference a Map with Allmaps

Anyone can contribute to our collection of georeferenced map overlays.

1. Visit the [BTAA Geoportal](https://geo.btaa.org/), leave the search bar blank or enter keywords of your choice, and click the **Search** button.
2. Scroll down and expand the **Georeferenced via Allmaps Plugin** filter. Click on **False** to view all maps that are compatible with Allmaps but have not yet been georeferenced. 
3. Choose a map from the results and visit its resource page. Note that you will need to be able to identify at least some geographic features in the image in order to create a useful overlay. 
4. Click **Georeference this item** under **Georeferencing** in the right sidebar. The Allmaps Editor will open in a new browser tab.
5. Click **Georeference** in the menu near the top of the page. A basemap will open to the right of your chosen image. 
6. Select matching ground control points (GCPs) by clicking on corresponding locations in the image and the basemap. 
> - Zoom in as close as possible to the identified location in order to place the point with greater accuracy. 
> - Each pair of GCPs will be labelled with a matching number.
> - Move GCPs that have already been placed by clicked on them, holding, and dragging.
> - View and delete pairs of GCPs by clicking the list icon in the lower right corner.  
> - Place at least 3-5 pairs of GCPs. More is better. 
> - Try to distribute GCPs somewhat evenly throughout the image.
7. After a sufficient number of points have been placed, click **Results**, then click **View current image.** Check to make sure the overlay looks reasonably accurate. If needed, use the back button and click **Georeference** to return to the editor and make changes.


## Improve a Georeferenced Map




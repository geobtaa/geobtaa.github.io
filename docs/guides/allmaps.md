# Georeferencing with the Allmaps Plugin

This document describes the Geoportal's Allmaps Plugin and gives instructions for using this tool to create a georeferenced map overlay in the browser.

## Background

Georeferencing is the process of using ground control points to match a digital image to the geography of the real world. [Allmaps](https://allmaps.org/) is an online tool for georeferencing and overlaying any map that follows [IIIF standards](https://iiif.io/). This allows historical maps and other scanned resources to be displayed and understood in their geographic context. 

The BTAA-GIN Geoportal has an integrated Allmaps plugin that enables users to easily georeference compatible maps and view them as overlays on a basemap without leaving the browser. To view images that have or could have a georeferenced map overlay, expand the **Map Overlay** filter in the left sidebar of a [Geoportal search](https://geo.btaa.org/?search_field=all_fields&q=).

Important: Georeferenced browser overlays created with Allmaps are currently not available for download as GeoTIFF files, although this functionality may be available at some point in the future. Resources that include downloadable georeferenced GeoTIFFs can be found under the **Downloadable GeoTIFF** filter. Although both GeoTIFFs and Allmaps overlays use ground control points to georeference a map, the Allmaps overlays are primarily suitable for display, while GeoTIFFs are more suitable for GIS analysis.

## Georeference a Map with Allmaps

Anyone can contribute to our collection of georeferenced map overlays.

1. Visit the [BTAA Geoportal](https://geo.btaa.org/), leave the search bar blank or enter keywords of your choice, and click the **Search** button.
2. Scroll down and expand the **Map Overlay** filter. Click on **False** to view all maps that are compatible with Allmaps (have a IIIF manifest) but have not yet been georeferenced. 
3. Choose a map from the results and visit its resource page. Note that you will need to be able to identify at least some geographic features in the image in order to create a useful overlay. 
4. Click **Georeference this item** under **Map Overlay** in the right sidebar. The Allmaps Editor will open in a new browser tab.
5. Click **Georeference** in the menu near the top of the page. A basemap will open to the right of your chosen image. 
6. Select matching ground control points (GCPs) by clicking on corresponding locations in the image and the basemap. 
> - Zoom in as close as possible to the identified location in order to place the point with greater accuracy. 
> - Each pair of GCPs will be labelled with a matching number.
> - Move GCPs that have already been placed by clicked on them, holding, and dragging.
> - View and delete pairs of GCPs by clicking the list icon in the lower right corner.  
> - Place at least 3-5 pairs of GCPs. More is better. 
> - Try to distribute GCPs somewhat evenly throughout the image.
7. After a sufficient number of points have been placed, click **Results**. Check to make sure the overlay looks reasonably accurate. You can also check the overlay in more detail by using the opacity sliders in the ****Allmaps Viewer** tool. To access this, click the up arrow icon in the lower right corner and click **View in Allmaps Viewer**. If needed, return to the **Georeference** to make further changes. If the results aren't satisfactory, *delete all GCPs* so the scanned map is no longer georeferenced.

## View a Georeferenced Map

- To view a map overlay without leaving the resource page of a georeferenced scanned map, click the **Map Overlay** tab next to the **Item Viewer** tab beneath the title of the page. 
- To open the Allmaps Viewer in a new tab, click **View this georeferenced item** beneath the **Georeferencing** heading in the right sidebar of the resource page. 
- To view all recently georeferenced maps, visit [latest.allmaps.org](https://latest.allmaps.org/).
- To view a map that you just georeferenced, click the up arrow icon in the lower right corner of the Allmaps Editor interface and click **View in Allmaps Viewer**. 

## Edit a Previously Georeferenced Map

1. Open the resource page of a georeferenced scanned map. 
2. Under the **Item Viewer** tab, click three lines (hamburger) icon to expand the sidebar to the left of the map display. 
3. Scroll to the bottom of this sidebar and copy the URL labeled **IIIF manifest**.
4. Open the Allmaps Editor at [editor.allmaps.org](https://editor.allmaps.org/#/) and paste the IIIF manifest URL into the input box, then click **Load**. Click the **Georeference** tab.

## Other Resources

[Leventhal Map Library's Allmaps Georeferencing Instructions]((https://www.leventhalmap.org/projects/digital-projects/georeferencing/))


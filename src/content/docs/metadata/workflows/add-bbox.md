---
title: How to Add Bounding Boxes
description: " "
sidebar:
  order: 13
---


This page describes processes for obtaining bounding box coordinates for our scanned maps. The coordinates will be used for indexing the records in the Big Ten Academic Alliance Geoportal.

:::note[About bounding box coordinates for the BTAA Geoportal]

* Bounding boxes enable users to search for items with a map interface. 
* The format is 4 coordinates in decimal degrees 
* Provide the coordinates in this order: West, South, East, North. 
* The bounding boxes do not need to be exact, particularly with old maps that may not be very precise anyways.

:::



## Manual method

### Part A: Setup

1. Open and inspect the image file.
2. Try to identify a single / combined region that the map or atlas represents
3. You can also check to see if the map has the bounding coordinates printed in the text anywhere or you are able to find the bounds by inspecting the edges.  
4. Open another window with the [Klokan Bounding Box](https://boundingbox.klokantech.com) tool.
5. Set the Copy & Paste section to CSV.

### Part B: Find the coordinates

#### Option 1: Search for a place name

1. Use the search boxes on the Klokan Bounding Box tool to zoom to the region.  (For example, search for “Illinois”.
2. Manually adjust the grey overlay box in the Klokan site to line up the edges to the edges of the map. 
3. Try to line it up reasonably closely


#### Option 2: Draw a shape

1. Switch to the Polygon tool by clicking on the pentagon icon
2. Click as many points on the screen as needed to approximate the map extent.
3. Click on the first point to close the polygon
4. The interface will display a dotted line showing the bounding box rectangle.

### Part C: Copy back to GeoBTAA metadata

1. Click the “Copy to Clipboard” icon on the Klokan site.
2. Paste the coordinates into the Bounding Box field in the GeoBTAA metadata template or in the GBL Admin metadata editor.

## Programmatic method

The OpenStreetMap offers and API that allows users to query with place names and return a bounding box. This tutorial, [Use OpenStreetMap to generate bounding boxes](https://github.com/geobtaa/harvesting-guide/tree/main/tutorials/T-08_bboxes-from-osm), employs this method.




---
title: Digitizing
summary: This tutorial introduces how to use ArcGIS Pro to convert data in raster format, such as scanned maps or aerial imagery, into vector data, like points, lines, and polygons. 
authors:
    - Nicole Kong
date: 2021-08-16

---
!!! Info

	:material-arrow-right-box: Purpose: how to use ArcGIS Pro to convert data in raster format.
	
	:timer: Estimated time to complete: 40-50 minutes

	:fontawesome-solid-user: Prepared by: Nicole Kong, Associate Professor, GIS Specialist, Purdue University (kongn@purdue.edu). 

	:material-creative-commons: License: Except where otherwise noted, content in this tutorial is licensed under a [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

------------------------------

??? Note "Note for Instructors"

	* This tutorial uses ArcGIS Pro as the software.
	* This tutorial comes with an exercise worksheet.	

## Introduction

In this tutorial, digitizing means the process of converting features on a paper/scanned map, aerial photos, or raster images into digital vector features. 

* Purpose: Through digitizing process, users can convert unique features from maps, aerials and other raster layers to GIS vector data.
* Input data: to digitize, you need a reference map which includes the spatial features you are interested to digitize. If your reference map is only available in hardcopy format, you will need to scan the  map, and georeference it before digitizing.

### Evaluating the reference map

* Spatial reference: the reference map should come with a coordinate system (projection). Ideally, this coordinate system is the same as your new feature class.
* Scale: Your reference map should have a map scale that is appropriate for digitizing the features.
* Resolution: for digital raster images, the resolution must be good enough to determine the shape of the features you plan to digitize.

## 1. Create a new feature class

* All the geospatial features need a place to be saved. So we start the digitizing process by creating a new vector file, a new feature class within a geodatabase, or a new shapefile.
* If you want to add new features to an existing feature class, you can simply open the feature class and skip this step.
* To create a new feature class in ArcGIS Pro: Open the Catalog Pane, right-click on a Geodatabase, click on New -> feature class...
    <figure markdown>
     ![Download image](images/feature-class.png){ width="500" }
     <figcaption>Create a feature class from the Catalog Pane</figcaption>
    </figure>
 * In the Geoprocessing tool, enter the name for the new feature class, and then select the Geometry Type to be created. You can also select the coordinate system for your new feature class.
    <figure markdown>
     ![Name your feature class](images/create-feature-class.png){ width="500" }
     <figcaption>Name your feature class</figcaption>
    </figure>


## 2. Create new features

Before creating any new features, you should choose a scale at which you will digitize features. This scale should clearly represent the features you want to trace. Try to remain at the same scale as you digitize.

* Data editing scenarios:
	* Digitize new features
	* Modify existing features
	* Delete features
* ArcGIS allows you to edit data using edit tools
    <figure markdown>
     ![Edit tools](images/edit-data.png){ width="500" }
     <figcaption>Edit tools</figcaption>
    </figure>
* Features are created in ArcGIS Pro using templates.
* Feature template defines the default template type for your feature class.
* Every editable feature layer has a feature template, created automatically when the layer is added to the map.
* You can edit the existing template, or create new feature template.
* Generally, the template name corresponds to the layer name or a unique symbol value on which the features are created, but you can change it. 

### Snapping

* You can use snapping tools to avoid editing errors. 
* Snapping is the process of moving a feature to coincide with another point’s or feature’s coordinates when your pointer is within a specified distance (tolerance distance). 
    <figure markdown>
     ![Snapping tools](images/snapping.png){ width="500" }
     <figcaption>Snapping tools</figcaption>
    </figure>
    
    <figure markdown>
     ![Snapping types](images/snapping-types.png){ width="500" }
     <figcaption>Snapping types</figcaption>
    </figure>
    
* Choose the feature template
* Choose construction tool: lines, curves, trace, and so on to create geometry
* Trace the feature: then finish the sketch.

## 3. Edit geometry and attributes

### Geometry editing

In case you need to modify any geometry you have digitized, ArcGIS Pro provides a whole list of tools allow you to reshape, move, or split the geometry of your features.
    <figure markdown>
     ![Geometry editing](images/geometry-editing.png){ width="300" }
     <figcaption>Geometry editing</figcaption>
    </figure>


### Add feature attribute

After you have creed geometry for a feature, you can add the attributes for it. You can add attributes in the attribute table or Attributes pane. Add new fields if you need more columns in the attribute table.
    <figure markdown>
     ![Feature attribute](images/feature-attribute.png){ width="500" }
     <figcaption>Feature attribute tools</figcaption>
    </figure>
    <figure markdown>
     ![Feature attribute table](images/feature-attribute-table.png){ width="500" }
     <figcaption>Feature attribute table</figcaption>
    </figure>

## 4. Save!

* If you are done with your edits, **SAVE** your edits!
* Saving the project can’t guarantee to save your edits.
* After you save your edits, you can’t undo the editing.
    <figure markdown>
     ![SAve](images/save.png){ width="300" }
     <figcaption>Save edits</figcaption>
    </figure>











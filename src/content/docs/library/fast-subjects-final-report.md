---
title: FAST for Subject Terms Workgroup Final Report
description: Final report of Geodata Pilot Collection Working Group
year: 2025
date: 2025-03-31
authors:
   - name: FAST for Subject Terms Workgroup
tags:
- reports
---

:::note[Summary]
FAST (Faceted Application of Subject Terminology) is derived from the Library of Congress Subject Headings (LCSH). It retains the rich vocabulary of LCSH and at the same time is easier to understand, control, apply, and use. The proposed working group will come up with guidance for applying FAST terms to records in the BTAA Geoportal on an ongoing basis as well as retrospectively, while keeping in mind potential workflow considerations.
:::

## What problem was addressed by this group?

1. Discoverability \- Currently, the metadata ingested into the subject and keyword fields is inconsistent across member institutions and inhibits our ability to enhance the discoverability of items through weighted or faceted searches based on subject headings.

2. Sustainability \- The way metadata has been ingested into the subject and keyword fields currently limits how much automated clean-up can be performed, particularly on the keyword field. To support automated clean-up moving forward, better crosswalks and guidelines are needed.

## What we did

### Analysis

* Created [MARC to GeoBTAA Metadata Profile](https://docs.google.com/spreadsheets/d/11VoZrqKlLWa6KaQwm09fB2m-sCTXKgxN3zeuPbsGEHo/edit?usp=sharing).  
* Performed initial review of headings in subject field and generated list of nearest [FAST equivalent headings](https://docs.google.com/document/d/1KMVplNnNWovI7RQD0AHupsRVpUYXPfos/edit?usp=sharing&ouid=106182567550693215185&rtpof=true&sd=true).  
* [Performed fuller review of both subject headings and keywords assigned by BTAA-GIN participants.](/library/fast-subject-keyword-assessment)
* Created list of FAST headings currently assigned by BTAA-GIN participants to aid in extraction of authorized headings from the keyword field.

### Local Profile Updates

* Augmented the BTAA Geoportal metadata application profile to include new fields for [cartographic scale](https://gin.btaa.org/metadata/b1g-custom-elements/#spatial-resolution-as-text) and [administrative tags](https://gin.btaa.org/metadata/b1g-custom-elements/#admin-tags).  
* Updated [input guidelines](https://gin.btaa.org/metadata/input-guidelines/) for Subject field to specify the FAST format.


### Cleanup

* Identified LCSH subjects stored in the Keyword field, migrated them to the existing Subject field.  
* Converted any subject terms in the LCSH format to the FAST format  
* Identified BTAA-GIN custom tags in the Keyword field and migrated them to the new Admin Tags field.  
* Identified scale values stored in the Description field and migrated them to the newly created scale field. Examples: [Indiana University](https://geo.btaa.org/catalog/VAC3073-M-00754), [University of Minnesota](https://geo.btaa.org/catalog/p16022coll245:857).   
* Shared Aardvark/MARC crosswalk with the GeoBlacklight/OpenGeoMetadata community for feedback.  
  * Not much feedback as of 3/31/2025, but a colleague from Cornell has started work on Python scripts to generate Aardvark records for scanned maps that have existing MARC records.

## Recommendations for institutions submitting to the Geoportal

1. For institutions creating item-level MARC records for scanned maps, encourage the submission of MARC records in addition to the metadata stored by the institutions’ local online repositories.  
2. Provide clear separations between thematic subjects, geographic terms, and local keywords.

## Changes to the BTAA Geoportal workflow

* Retain scale values in dedicated field instead of concatenating them into the Description  
* Utilize the Subject field with only FAST terms.  
* Store custom administrative tags in a dedicated field instead of the Keyword field

## Potential Next Steps

* Explore the possibility of metadata sprints to continue subject heading clean-up  
* Continue review of Aardvark/MARC crosswalk  
* Perform a more extensive review of the metadata from selected institutions (University of Minnesota and Indiana University)  
* Develop additional metadata guidelines for BTAA Geoportal members
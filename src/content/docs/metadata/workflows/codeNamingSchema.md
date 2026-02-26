---

title: Code Naming Schema
description: ""
sidebar:
  order: 9

---

# Code Naming Schema

Each website / collection in the BTAA Geoportal has an alphanumeric code. This code is also added to each metadata record to facilitate administrative tasks and for grouping items by their source. Some of the Codes are randomly generated strings, but most are constructed with an administrative schema described below:

| First part of string | Contributing institution |
| --- | ----------- |
| 01 | Indiana University |
| 02 | University of Illinois Urbana-Campaign |
| 03 | University of Iowa | 
| 04 | University of Maryland |
| 05 | University of Minnesota |
| 06 | Michigan State University |
| 07 | University of Michigan |
| 08 | Pennsylvania State University |
| 09 | Purdue University |
| 10 | University of Wisconsin-Madison | 
| 11 | The Ohio State University |
| 12 | University of Chicago |
| 13 | University of Nebraska-Lincoln |
| 14 | Rutgers University |
| 15 | Northwestern University |
| 16 | University of Washington |
| 17 | University of Oregon |

| Second part of string | Type of organization hosting the datasests |
| --- | ----------- |
| a | State |
| b | County |
| c | Municipality | 
| d | University |
| f | Other (ex. NGOs, Regional Groups, Collaborations)|
| g | Federal |

| Third part of string | The sequence number added in order of accession or a county FIPs code|
| --- | ----------- |
| -01  | First collection added from same institution and type of organization |
| -02 | Second collection added from same institution and type of organization |
| -55079 | County FIPS code for Milwaukee County, Wisconsin |

!!! example 
 	code for a collection sourced from Milwaukee County: '10b-55079'

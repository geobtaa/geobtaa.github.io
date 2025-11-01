---
title: Proposal for a Geospatial Data Discovery Project Across the CIC
description: Original proposal for the first year of the program
year: 2015
tags:
  - proposals
---

**February 2015**

## Authors

|     |     |     |
| --- | --- | --- |
| Mara Blake | Spatial & Numeric Data Librarian, Clark Library | University of Michigan  |
| Len Kne | Associate Director, U-Spatial | University of Minnesota  |
| Ryan Mattke | Head, John R. Borchert Map Library | University of Minnesota |
| Kathleen Weessies | Head, Map Library | Michigan State University |



## Proposal

_With the University of Minnesota as lead institution, we propose a collaborative pilot project to provide discoverability, facilitate access, and connect scholars across the CIC to geospatial data resources._ 

We request an initial two-year investment of \$135,000 per year total from participating CIC institutions to jointly fund (equally split) the launching and populating of an Open Geoportal (OGP) instance for CIC institutions with the requisite metadata and technology project staffing and infrastructure to host the services. [^1] The initial two years would serve as a pilot ‒ upon a successful evaluation of the effort, the project would seek additional support at a comparable level for an additional year for custom programming, metadata coordination, contribution to the OGP code base, and to facilitate the inclusion of any remaining CIC institutions (see Project Timeline in appendix). If the pilot and subsequent year proves successful, we would seek additional funding after three years to continue the services.


[^1]:	Open Geoportal is an open source project with no cost to purchase/license the software. 


We further propose the creation of a CIC Geospatial Data Task Force responsible for advising the development of the pilot, determining the target minimum number of metadata records to be contributed by each participating institution, serving as liaisons with their home institutions, and coordinating the creation of metadata. The University of Minnesota is poised to take the lead on this project. The U-Spatial program, a campus-wide initiative with the Libraries as a partner, is a logical host for this project, with the Libraries’ Spatial Data Analyst/Curator acting as the project manager during the pilot phase. [^2] A Metadata Coordinator would be hired at the beginning of the pilot phase.

[^2]:	[http://uspatial.umn.edu/summary](http://uspatial.umn.edu/summary) (scroll down to see partner list)

Much like the Digital Public Library of America model, OGP is a federated metadata aggregation service, with the added component of a well-designed geographic search interface (see Open Geoportal Overview in appendix). Collective investment in this project will allow the Libraries of the CIC to offer our academic communities a broader array and aggregation of spatial resources metadata, more robust geospatial data services, and the economies of leveraging common infrastructure across institutions. 


## Deliverables

The pilot will create a production-level OGP interface that will act as the primary access point for CIC geospatial data resources, including GIS data, imagery, and scanned historical maps. Pilot evaluation would include an assessment of satisfaction with pilot participants, including an evaluation of workflows and of the interface itself. Upon successful evaluation of the pilot, OGP operations moving into the third year (production-level services) would continue to be managed and coordinated by the Metadata Coordinator and the project manager, with guidance from the CIC Geospatial Data Task Force.


## Benefits

Benefits of the project include sharing the cost of providing specialized programming, IT infrastructure and support, enabling each institution to showcase their unique resources, allowing discovery of geospatial data resources across the CIC, leveraging the expertise of geospatial and GIS specialists across CIC institutions, and facilitating shared metadata creation, allowing for the future transformation and repurposing of created metadata.


## Budget and Contributions

The pilot funding would be used to fund a 0.25 FTE Spatial Data Analyst/Curator to coordinate the project, as well as to fund a full-time Metadata Coordinator (to manage the process of metadata creation, metadata template creation, and metadata ingest) and host a face-to-face kick-off and planning meeting with CIC Task Force members at which we would set priorities and requirements. The remaining funds would go to technical infrastructure (see Budget in appendix). Aside from funding, each institution would also be responsible for  the creation of metadata for their local datasets and would remain responsible for object/asset storage and access, as OGP only stores the metadata for discovery. 


## Technical Capacity

Several CIC institutions already have active members on the OGP Developers Group or the OGP Metadata Working Group. As such, they will be able to provide technical and operational guidance for this process. The pilot project manager is housed at U-Spatial, which provides technical support and server administration for campus-wide geospatial initiatives. Open Geoportal is an open source, federated discoverability platform that utilizes Apache Solr to store and index metadata records for searching. For the pilot, the application would be hosted on Amazon EC2 servers with metadata XML routinely backed-up to UMN-hosted servers (as per current U-Spatial model). As part of the pilot, we will evaluate University of Minnesota virtual server and storage environment (Cloudnexa) for ongoing infrastructure support. The application itself and the metadata ingest process would be mediated by the pilot project manager. Metadata contributions would conform to one of two main metadata standards for spatial data (FGDC and ISO 19115); either of which can be transformed into the OGP metadata schema. 


## CIC Context and Collaboration

Scholars across academia increasingly demand access to geospatial data to facilitate their research. The 2012 CIC CLI conference ([Finding Our Way: Collaborative Strategies for Developing Geospatial Services](https://web.archive.org/web/20151229001324/http://www.cic.net/calendar/conferences/library/2012/program)) focused on this demand. A group of CIC geospatial librarians has been working on how to best provide our users access to geospatial data. 

Currently, most CIC libraries employ GIS specialists or librarians.[^3] Including the University of Minnesota, nine CIC institutions have expressed interest in OGP. By collaborating, we can more effectively combine our efforts and expertise for the benefit of the consortium. Based on expressed interest and responses to a readiness survey, proposed participant institutions include: University of Illinois, University of Iowa, University of Maryland, University of Michigan, Michigan State University, University of Minnesota, Pennsylvania State University, Purdue University, and University of Wisconsin-Madison.

[^3]:	[CIC Geospatial Activities Grid](https://docs.google.com/spreadsheets/d/1qDvI91SoO8ZJvHuyH6VBxbspZRRJP4_RZ5NrtkurQE4/edit?usp=sharing)

Overall, the collaboration will benefit from the investments Minnesota has already made. The University of Minnesota has recently launched a beta version of their Open Geoportal instance, as well as a short video showing the functionality of University of Minnesota’s OGP site.[^4]

[^4]:	[http://z.umn.edu/libogp](http://z.umn.edu/libogp) & [http://z.umn.edu/umnogpvideo](http://z.umn.edu/umnogpvideo) (note: no sound)

**_Cost Model_**

If each participating institution were to individually implement OGP, likely costs would include a manager, developer time, and other infrastructure support (approximately $360,000/year for nine institutions). By coalescing resources, considerable savings can be achieved over the course of the project.

**_Funding Model:_**

* Each of the nine CIC participant institutions would contribute $15,000/year. 
* Institutions would commit to the 2-year pilot, with potential for 3<sup>rd</sup> year extension.
* If the pilot and subsequent year proves successful, we would seek additional funding after three years to continue the services. The cost to provide OGP services is expected to remain fairly consistent over time.

**_Governance Model:_**

* A CIC OGP Task Force, comprised of representatives from each participating institution, would be formed to oversee the project and guide policy and governance decisions.
* The Task Force will advise on project management and software development, coordinate training and best practice standards for participants, and stay apprised of national OGP activities
* OGP is an open source project using the GNU GPL v3 license. It is the intent that any development work would be contributed to the OGP project along with all rights.


## Joining a National Movement

OGP has been adopted by a number of prominent institutions. The strength and popularity of the OGP community is well documented and includes 30 partner institutions. [^5] As of January 2015, there are six public instances of OGP. OGP projects have also been the recipient of grants from the Alfred P. Sloan Foundation, for technology development and a governance summit, and a National Leadership Grant from IMLS, for the University of New Hampshire PLACE project.

[^5]: [http://opengeoportal.org/events/](http://opengeoportal.org/events/) (scroll down to see partner list)

A node of universities on the east coast has emerged as a multi-institution prototype and several institutions in California are OGP partners. _The CIC is perfectly placed to take leadership in forming a midwest node._ The project manager would serve as an active member in the national OGP community by contributing to the further enhancement of this open source collaboration.


## Appendix


### Project Timeline

Year 1 ‒ Beginning July 2015

Month 1-3:

* Hire Metadata Coordinator
* Establish CIC Geospatial Task Force
* Metadata standard review - examine OGP Metadata Working Group documentation
* Two-day kick-off conference to determine wants/needs/priorities & metadata bootcamp
* Metadata template creation

Month 4-9

* Metadata standardization and/or creation at individual institutions
* Regular check-in meetings with metadata creators
* OGP interface customization

Month 10-12

* Configure server infrastructure
* Roll out OGP instance

Year 2 ‒ Beginning July 2016

Month 1-3

* Continue to ingest metadata for additional CIC data sets
*Identify if there are custom programming needs and prioritize

Month 4-12

* Work with contract programmers to facilitate changes
* Continue to ingest metadata for additional CIC data sets
* Identify unique CIC resources for possible inclusion in specialized OGP instance(s): Great Lakes data, Agricultural data, Land Use data, etc.

Year 3 ‒ Beginning July 2017 (_prospective_)

Month 1-6

* Two-day update conference to evaluate progress and facilitate any needed training
* Coordinate metadata for additional CIC institutions
* Customize OGP instance for additional CIC institutions
* Customize and launch any specialized OGP instances
* Identify any additional custom programming needs


Month 7-12

* Roll out OGP instances for additional CIC institutions
* Evaluate successes, failures, and lessons learned
* Create a strategic plan for the future of the project

## Project Budget 

($135,000/year)

Year 1 Total: $135,000 

Personnel: $95,000

* UMN Spatial Data Analyst/Curator (¼ time)
* Metadata Coordinator (full-time)
* Graduate assistant (1 GA, ¼ time in fall) 

Technical Infrastructure:$20,000

* Computer hardware (desktops/laptops)
* Secure Amazon Web Hosting (Cloudnexa)

Collaboration costs (meetings, communications): $20,000

* Kick-off conference (travel, lodging & meals - 16 x $1000/person)
* GIS & Metadata person from each institution
* Two day kick-off conference logistical costs
* Virtual meetings

 


Year 2 Total: $135,000 :

Personnel: $95,000

* UMN Spatial Data Analyst/Curator (¼ time)
* Metadata Coordinator (full-time)
* Graduate assistant (1 GA, ½ time in summer)

Specialized Programming (contract out): $25,000 

Technical Infrastructure: $15,000

* Computer hardware maintenance (desktops/laptops)
* Secure Amazon Web Hosting (Cloudnexa)

Year 3 Total: $135,000  (_prospective_):

Personnel: $100,000

* UMN Spatial Data Analyst/Curator (¼ time)
* Metadata Coordinator (full-time)
* Graduate assistant (1 GA, ¼ time in fall) 

Technical Infrastructure: $15,000

* Computer hardware maintenance (desktops/laptops)
* Secure Amazon Web Hosting (Cloudnexa)

Collaboration costs (meetings, communications): $20,000

* Update conference (travel, lodging & meals - 16 x $1000/person)
* GIS & Metadata person from each institution
* Two day conference logistical costs


## Open Geoportal Overview

Technology diagram

![alt_text](@images/ogp-diagram.png "image_tooltip")

User interface showing previewable data (roads in red) and extent (blue box) of data for item highlighted in the menu at left

![alt_text](@images/ogp-search.png "image_tooltip")

---

*Attachment: Letter of support from Patrick Florance, Director, The Open Geoportal Project.*


<!-- Footnotes themselves at the bottom. -->
## Notes

     



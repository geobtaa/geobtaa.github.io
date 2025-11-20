---
title: Technology Strategic Plan 2025-2026
description: 'Details the rationale and vision for a Technology Stack upgrade'
year: 2025
authors:
   - name: Karen Majewicz
   - name: Eric Larson
tags:
- proposals
---
## Introduction

As our program grows, so do our technological needs. The Big Ten itself has expanded, welcoming four new institutional partners in the past year. As we incorporate new geospatial resources from Washington, Oregon, and California into the BTAA Geoportal, our collection (already over 100,000 records) will continue to increase. At the same time, the BTAA-GIN Geodata Collection has introduced new demands for asset storage and metadata management. 

To keep pace, we have taken a step back to assess what is working, what needs improvement, and how we can continue to build and maintain a resilient, future-compatible technology framework. To guide this process, we articulated a set of [**Technical Values**](/about/guiding-principles/#technical-values) that embrace resilience, growth, community, and interoperability. 

With these principles in mind, we turned to identifying our core technology requirements, approaching the task as if we were starting from the ground up. At the top of our list is stable storage for both metadata and datasets that remains reliable regardless of changes to platforms or applications. In addition, we identified two essential tools: an administrative workflow system and a public-facing discovery interface. Our current technology stack meets these needs.

What we lack, however, is a dedicated **metadata service** that operates independently of any single application. Our current technology stack functions as a silo, requiring all access and use to flow through the Geoportal. We envision a shared registry of geospatial metadata records that welcomes contributions from multiple stakeholders and supports broad reuse. Transitioning from a traditional catalog to a metadata service will allow us to repurpose and redistribute our records across a wider range of systems and uses. By making the metadata available through an **API** as easily parsable web services, any BTAA institutional service will be able to access, display, and build upon our shared collection.

With this model in mind, we then evaluated our chosen **discovery platform**, GeoBlacklight. It has long been the cornerstone of our technology stack, but the version we use is aging, and the next major release introduces major changes that would require a time-consuming rebuild. Until now, few alternatives have offered comparable features. However, a new metadata API opens the door to a simpler, more adaptable Geoportal built on top of this service.  Given our evolving needs, especially around metadata lifecycle management and file storage, we asked ourselves: should we reinvest in GeoBlacklight, or is there a better path forward?

Drawing on our Technical Values, core requirements, and current technology assessment, we created a **Vision** that emphasizes modularity, interoperability, and prioritizing data over specific software solutions. Many existing tools, including our metadata editor and Amazon S3 storage, will stay in place. New components, including a metadata API and a lightweight front-end application, will strengthen our ability to manage and serve geospatial information.

This transition creates exciting **opportunities**. A modular architecture allows us to update or refine individual components without disrupting the entire system. Adopting modern, widely supported frameworks lowers barriers and encourages a broader range of contributors to participate. An API-driven approach makes metadata more accessible, supporting not just our Geoportal but other repositories and services across the BTAA and beyond. However, we also recognize potential **risks**. Departing from the established GeoBlacklight code base may reduce synergy with a community that has developed specialized geospatial features, and we will need to recreate or adapt these functionalities in our new framework. 

Ultimately, we believe this shift will provide **increased stability**, because it addresses two of our biggest, interrelated, vulnerabilities: our reliance on a single developer’s specialized skill set and tying all of our resources to a single piece of open-source software. By adopting a modular, widely-used technology stack, we broaden our pool of potential collaborators and decouple our data from the inherent ephemerality of software. Moreover, this approach makes building lightweight discovery systems more accessible for any institution. As we evolve, we remain committed to promoting collaboration beyond GeoBlacklight by fostering a more inclusive, technology-agnostic “Geo-Libraries” **community**.

This Strategic Technology Plan outlines our next steps, focusing on four priority projects that balance ongoing work with needed upgrades. Our roadmap centers on the 2025-26 fiscal year, setting the stage for a gradual evolution of our infrastructure. Testing and proof-of-concept development will begin in **Q3 2025**, with full production rollout expected by **mid-2026**.

## Technology Assessment

This section provides an overview of our current technology stack (as of February 2025), our architecture framework, a critical assessment of GeoBlacklight, and recommendations for future tools.

### Current Technology Stack Overview

#### 1. Software Applications

* **BTAA Geoportal**: A custom web application built on GeoBlacklight, an open-source GIS discovery and indexing framework that utilizes Blacklight (a discovery framework using Ruby on Rails and Solr for indexing).  
* **GBL Admin Toolkit:** A custom-built metadata management tool, developed with Kithe and Ruby on Rails.

#### 2. Infrastructure & Hosting

* Applications are hosted on AWS.  
* Assets such as data, derivatives, and metadata are stored in Amazon S3.  
* All development work is maintained in public GitHub repositories.

#### 3. Data Management & Storage

* The BTAA Geoportal primarily functions as an index of materials hosted at member libraries and has not historically stored any resources.  
* A Geodata Collection pilot was recently completed to begin collecting assets, now stored in S3.

#### 4. Analytics & Performance Monitoring

* Matomo tracks user statistics and behavior.  
* Tableau dashboard displays Matomo analytics.  
* Google Search Console provides insights into search terms directing users to the site.  
* AppSignal monitors site performance and alerts on slowdowns or heavy traffic.

#### 5. Support tools

* Jupyter Notebooks for batch metadata harvesting and data processing  
* GitHub Pages for documentation  
* GitHub Projects for project management

### Current Architecture Framework

Our current technology architecture is designed as a closed system. Our management tool (GBL Admin) pushes to Amazon S3 for data storage, a PostGRES database for metadata, and Solr for indexing. GBL Admin and the BTAA Geoportal share the same Solr instance. The architecture reflects the requirements of our chosen frontend application, GeoBlacklight, which requires a flat metadata schema served via Solr.

![Current tech stack as of 2024](@images/current-tech-stack.png)

*Current architecture framework for the BTAA Geoportal*


### Critical Assessment of GeoBlacklight

#### Why did we choose GeoBlacklight in 2015?

* GeoBlacklight was the best option available for academic/library applications.

* Ruby on Rails was the dominant framework for library web development teams.

* GeoBlacklight was part of the Blacklight ecosystem, promising stability.

* It had a small but engaged developer community, supported through Geo4LibCamp.

* The GeoBlacklight schema provided an easy-to-adopt geospatial metadata profile.

#### What has changed since 2015?

* Our project requirements have evolved: we now need workflow tools, file storage, geodata collection management, metadata enrichment, and gazetteer-based concordances for linked data. GeoBlacklight’s limited scope (discovery-side only) does not provide these essential features.

* Many institutions have adopted GeoBlacklight over the years. There are over a dozen listed on the GeoBlacklight website. However, many institutions also struggled with the platform and were never able to implement it. Several of those who succeeded ended up abandoning it, as they could not keep up with security patches and new developments.

* Several key GeoBlacklight developers have moved on, and community contributions have slowed significantly.

* Ruby on Rails framework adoption is declining, raising longer-term staffing and maintainability concerns.

* New frameworks provide better options for faster development cycles, higher uptime/availability, and easier scalability.

* The OpenGeoMetadata Aardvark metadata profile has proven to be more accessible, community engaging, and enduring than the GeoBlacklight software stack.


#### GeoBlacklight’s strengths

* It offers stronger **geo-focused discovery features** than many general-purpose digital library platforms, including several filters, location-based searching, and uniform place names.

* It includes **previews** for many specialized geospatial and image web services.

* It uses a **standardized metadata** application profile, enabling interoperability across institutions.

* A dedicated **community** has grown over the past decade to guide progress and provide support.

* Users praise its clean and simple interface **design** and find it easy to use.

#### GeoBlacklight’s weaknesses

* Few maintainers:  with only a few active contributors, new development has slowed to largely maintenance releases. 

* Less common code framework:  most members of the GIS community are more comfortable working with Python/Javascript than with Ruby on Rails

* Poor developer ergonomics:  the development and maintenance of Rails Engines, like GeoBlacklight, is inherently slow. Most changes to the codebase require deleting and regenerating a local copy of the full application stack, which can be extremely time intensive.

* No built-in metadata workflow tools:  makes GeoBlacklight adoption and setup harder.

* Monolith architecture:  the software’s design is not modular, which makes custom changes difficult. Relying entirely on flattened metadata structure in Apache Solr for data storage makes relational-database enrichment challenging.

* Flat metadata schema:  GeoBlacklight uses the non-relational Apache Solr search engine for indexing and storing data, which prohibits object enrichment via associated SQL joins in a relational-database environment.

* Performance concerns:  with increased AI bot traffic, it has become challenging to meet production response time expectations. This is not solely an issue for (Geo)Blacklight-based apps, but the GBL stack was never inherently performant from the outset.

* Upstream Blacklight technology decisions create significant challenges for GeoBlacklight applications downstream:  with limited insight and zero optionality, technology decisions cascade into GeoBlacklight from above. Examples:

  * Despite many Blacklight v7 dependent GeoBlacklight applications in production, there will be no Blacklight v7 release with Rails v8 support.

  * Adopting ViewComponents introduced a paradigm that makes upgrading and migrating local customizations from GBLv4 to GBLv5 significantly harder.

  * The Blacklight development team changed their preferred Rails front-end technology stack to ImportMaps and broke GeoBlacklight’s continuous integration tests for several weeks.

##### Frameworks that will need upgrades soon

Software that reaches "end of life" no longer gets official updates or security patches. This leaves older systems open to security threats and missing new features.

GeoBlacklight 4.4.2 (our current version) relies on several frameworks that are nearing end of life :

* Blacklight v7: no official support for Ruby on Rails 8

* Ruby on Rails 7.2: security support on ends on August 2026

* Older ES5 JavaScript, which works in current browsers but is out-of-date

* jQuery, which most modern frameworks do not require

* Bootstrap 4, which ended support in 2023

##### Future Changes

The GeoBlacklight Community recently introduced GeoBlacklight v5.0 that does use modern frameworks. However, upgrading the BTAA Geoportal to GeoBlacklight 5.0 would require extensive time and skill. We anticipate that this would take, at minimum, 8 weeks of work spread out over 4 months. We do not currently have a strategy in place to upgrade.

### Recommendations for the future technology stack

#### Plan for long-term stability

  Without significant upgrades, the current GeoBlacklight platform risks falling short of our long-term performance and reliability needs.

#### Modernize our approach

Instead of spending months upgrading to GeoBlacklight version 5, we should use that time to implement a new decoupled application architecture that allows the BTAA Geoportal to prosper outside the constraints of GeoBlacklight. The new system will handle traffic better, keep security up to date, and adapt well to future needs. A simpler, more flexible platform will help the Geoportal stay fast, cost-effective, and ready for growth. The tools we choose should be well-documented, widely used, and supported by large, active open-source communities.

#### Proposed transition

1. Shift to GIS community-familiar technologies like Python-based tooling and PostgreSQL/PostGIS. 

2. Transition to industry-standard web frameworks like FastAPI and React. 

3. Separate the backend API from the frontend discovery interface to modularize development and deployment. 
 

## Vision

### Statement

We envision a technology approach that supports long-term geospatial information collection and sharing. Because we value durability, we will store metadata in a relational database while hosting datasets in secure cloud storage. We will adopt a modular technology stack that fosters resilience and growth, so each component can be updated or replaced as usage grows and needs evolve. We will share metadata through an open API to ensure it remains accessible even if the underlying management and discovery tools change. Finally, to encourage adoption and contributions from the geospatial community, we will choose widely used tools that are likely to align with their existing skills.

### Core Technology Needs

| Component | Technology | Purpose | Changes to current stack |
| :---- | :---- | :---- | :---- |
| Asset storage | Amazon S3 | Store datasets | \- |
| Metadata database | PostgreSQL | Store metadata | \- |
| Management tool | GBL Admin | Administrative workflow tool | \- |
| Metadata API | FastAPI (Python) | Serve metadata to discovery application(s) | NEW: We will expose our metadata as APIs, which multiple schemas and filters available |
| Discovery application | React (Javascript) | Frontend user interface | CHANGED: The API will allow us to adopt a more lightweight and modern platform. |


### New Technology Stack Diagram

![Proposed Tech Stack](@images/strategic-tech-plan.png)



## Priority Projects for Technology 2025-2026

### P1. Develop a Metadata API

Design and implement a metadata API using the FastAPI framework. The API will serve as a central access point for sharing metadata records. It will support integration with a variety of frontend applications and provide filtered metadata outputs for reuse. We will document its schema and endpoints to facilitate community adoption.

### P2. Build a new frontend for the BTAA Geoportal

Create a lightweight discovery interface using the React framework. This new frontend will consume metadata from the API and decouple the interface from the current GeoBlacklight system. We will reuse existing GeoBlacklight JavaScript components where feasible, while simplifying the architecture to improve performance and maintenance needs.

### P3. Address the evolving needs of the BTAA-GIN Geodata Collection

As we transition into **Phase 3: Foundation** of the **Geodata Collection Strategic Plan**, we remain dedicated to addressing the evolving needs of the collection. This involves iteratively developing based on workgroup recommendations, conducting user testing, and adapting to emerging priorities.

### P4. Foster the Geo-Libraries Community

For over five years, we have served as de facto leaders of the GeoBlacklight community, guiding its development and supporting adopters. However, as the community grapples with the evolving direction of the Blacklight framework, we recognize the need for a broader approach. Our commitment to open-source collaboration remains strong, with a new focus on fostering the Geo-Libraries Community, a space for geospatial professionals in libraries to engage with metadata standards, GIS tools, and discovery frameworks beyond a single software platform.

## Roadmap

![Roadmap chart](@images/tech-roadmap-2025.png)
#The BTAA-GIN Geodata Collection Implementation Plan (2024-2026)


This document provides technical details, roadmap and staffing needs for implementing the BTAA-GIN Geodata Collection.


!!! info "Prepared by"

	Big Ten Academic Alliance Geospatial Information Network
	Karen Majewicz, Product Manager, April 2024


## 1. DESCRIPTION OF COLLECTION SCOPE EXPANSION

### 1.1 Current Operations: Metadata Curation with a Discovery Portal

#### 1.1.1 Collection Policy

Our current collection policy covers metadata records for geodata (open data and licensed databases) and historical scanned maps.

<div class="grid cards" markdown>

-	{==**Collection A: DATA REGISTRY**==} 
	
	**1. Open Data Registry**
	
	Regularly updated registry of public geodata available from hundreds of public sites, including state and local governments, research institutes, and libraries. 
	
	Curation goals:      
                                                                                                                        
     -   metadata normalization and enhancement                                                                        
     -   transformations into a schema specifically designed for       
         geospatial resources                                                                                                             
     -   searchable by text string, dates, place names, and with a map 
         interface                                                                                                                    
     -   federated search of hundreds of sites at once.                
                                                                       
 	**2.  Licensed Data Registry**

 	Index of all layers within complex licensed databases that various BTAA Universities subscribe to. 
     
     Curation goals:                                                 
                                                                       
     -   an index of all layers within the databases                                                                                 
     -   provide normalized federated search of hundreds of sites and  
         databases at once.                                          

-	{==**Collection B: LIBRARY REPOSITORIES**==}                               
                                                                       
 	Scanned maps and geodata held at BTAA university digital libraries.   
 	
 	Curation goals:                                                       
                                                                       
 	-   metadata improvements from regular cleanup sprints to fix         
     bounding box errors, creator normalization, date normalization, 
     and application of linked data URIs.                                                                        
 	-   provide normalized federated search of all geospatial resources held at BTAA libraries in one site
 	-   augment search capabilities beyond typical library catalogs, including spatial and temporal searches                       

</div>

#### 1.1.2 Technology Workflow (Current operations)

We rely on two open-source tools for our workflows: the BTAA Geoportal
and GeoBlacklight Admin, a custom administrative toolkit. Both tools
run on Amazon Web Services (AWS). Under our current scope, we are only
able to provide access as external links to the most recent versions
of any dataset. When authors overwrite a public dataset, we must
re-harvest the metadata and discard the previous version with its
broken access links.

### 1.2 Expanded Operations: Add Data Curation with Cloud Storage

#### 1.1.1 Collection Policy

Our planned collection policy would continue to cover metadata records
for open data, licensed data, and scanned maps. It would expand to
include a curated collection of public data, selectively chosen with
the BTAA researchers in mind. To develop this new aspect of the
collection policy, we will develop these four areas:

-   STAFFING: Shift the focus of our Product Manager to include the role
    of Geospatial Data Curator and hire a Program and Outreach
    Coordinator to manage the increased complexity of the BTAA-GIN.

-   CURATION: Collaboratively develop a curation plan that identifies
    datasets based on criteria such as theme, geography, temporal
    range, data quality, and administrative source.

-   QUALITY CONTROL: Determine our data and metadata quality standards,
    such as the principles of FAIR (Findability, Accessibility,
    Interoperability, and Reuseability).

-   COMMUNICATION: Create a data provider communication plan for
    obtaining historical datasets and current datasets at regular or
    as-needed intervals.

<div class="grid cards" markdown>

-	{==**New Collection C: BTAA-GIN Geodata**==}

	Free and open geodata curated and stored by the BTAA-GIN. Curation goals:                                                                
                                                                       
 	-   capture snapshots of recently published at-risk resources that    
     will be overwritten                                                                                                                
	 -   fill in the gaps of hidden or unpublished datasets from the early 
     digital era
     -   save a historical record of the changing geospatial landscape
     -   provide a consistent user experience that minimizes broken links  

</div>

#### 1.1.2 Technology Workflow (Expanded operations)

To incorporate data curation, we will expand the functionality of GBL
Admin to include data ingest and management. This will involve setting
up cloud object storage with Amazon S3 to store and provide access to
the curated resources. Under our expanded scope, users will still be
able to access current versions from the original data provider, but
will also be able to download historical versions.

## 2. STRATEGIC ROADMAP

!!! info

	This roadmap is a preliminary outline. To follow actual progress, see the [Geodata Collection page.](../../technology/geodata-collection/)

### 2.1 Foundations & Pilot Storage (2024 Q1-Q2)

#### 2.1.1 Initiate Working Group and Planning

-   Establish and run the Geodata Collection Pilot Working Group.

-   Research existing geodata archiving practices across the BTAA
    region

-   Establish a framework of best practices: Develop guidelines for data
    collection, management, and storage that the pilot will adhere to.

-   Create a set of sample datasets: Select or create datasets that
    represent the variety and scope of data to be managed.

#### 2.1.2 Recruitment and Staffing

-   Assess current team capabilities and identify gaps in skill or
    resources.

-   Draft job description Program and Outreach Coordinator

-   Advertise the position

-   Conduct the interview and selection process.

#### 2.1.3 Technical Setup and Testing

-   Establish Amazon cloud storage (S3) accounts: Set up and configure
    Amazon S3 buckets for data storage.

-   Implement asset management tools in our Admin Toolkit: Integrate or
    develop tools within the Admin Toolkit for ingesting and managing
    datasets.

-   Test adding sample datasets to Amazon S3: Conduct tests to ensure
    data can be stored, accessed, and managed effectively in the cloud
    environment.

#### 2.1.4 Documentation and Process Definition

-   Obtain official approval of the BTAA-GIN Geodata Collection
    Strategic Plan.

-   Document the setup and configuration processes: Create detailed
    documentation on the setup of S3 accounts and asset management
    tools.

-   Define and document pilot testing procedures: Establish how the
    testing of sample datasets will be conducted, including success
    criteria and evaluation metrics.


### 2.2 Develop Curation Plan and Explore Technology Enhancements (2024 Q3-Q4)

#### 2.2.1 Recruitment and Training

-   Hire Program and Outreach Coordinator: Finalize the hiring process
    and onboard the new hire.

-   Conduct orientation and training: Provide training on project
    objectives, tools, and responsibilities.

#### 2.2.2 Curation Plan Development

-   Assess data types and sources: Identify and the types of geospatial
    data to be included in the collection.

-   Define curation criteria and processes: Establish standards for data
    selection, acquisition, and quality control.

-   Document the curation plan: Create detailed documentation outlining
    the curation strategy, procedures, and responsibilities.

#### 2.2.3 Communication Plan Development

-   Identify key stakeholders and communication needs: Map out
    stakeholders and determine their information requirements.

-   Develop communication strategies: Create a plan detailing the
    frequency, channels, and content of communications.

-   Prepare communication templates and materials: Develop templates for
    newsletters, reports, and presentations to streamline ongoing
    communications.

### 2.2.4 Pilot Expansion and Testing

-   Select a broader range of sample data: Identify and prepare
    additional datasets that cover a wider range of subjects and
    formats for testing.

-   Integrate new sample data into the pilot: Test the expanded
    collection in the Amazon S3 environment to assess scalability and
    performance.

#### 2.2.5 Technology Enhancement and Integration

-   Redesign Geoportal Dev branch interface: Enhance the user interface
    to better feature and access the Geodata Collection.

-   Enhance Admin Toolkit for batch processing: Develop or integrate
    batch asset management capabilities to improve efficiency.

-   Adjust Amazon services based on pilot feedback: Optimize cloud
    storage configurations and services to meet the project's evolving
    needs.

#### 2.2.6 Review and Refinement

-   Conduct a pilot review meeting: Assess the expanded pilot's
    performance, focusing on data management, storage efficiency, and
    user experience.

-   Update the framework of best practices: Refine data curation and
    management practices based on the insights gained from the
    expanded pilot testing.

### 2.3 Begin Active Curation and Implement Enhancements (2025 Q1-Q2)

#### 2.3.1 Active Curation Process

-   Establish curation cycles.

-   Implement data quality checks and validation processes.

#### 2.3.2 Technology Deployment and Enhancement

-   Publish Geoportal design enhancements to the production site:
    Transition the updated Geoportal interface from the development
    branch to the live environment, ensuring all new features are
    fully operational.

-   Conduct final testing of the enhanced Admin Toolkit: Ensure that the
    new batch asset management functionalities are working as intended
    and integrate feedback from the pilot phase.

#### 2.3.3 Monitoring and Evaluation

-   Set up monitoring tools for the new systems: Implement tools to
    continuously monitor the performance and usage of the Geoportal
    and data repository, ensuring they meet user needs and technical
    requirements.

-   Review initial active curation outcomes: Evaluate the effectiveness
    of the curation process, identifying areas for improvement or
    adjustment.

### 2.4 Documentation & Outreach (2025 Q3-Q4)

#### 2.4.1 Outreach and Communication

-   Develop and execute an outreach plan: Create a detailed plan for
    engaging with the community, including conferences, webinars, and
    workshops to showcase the project.

-   Prepare and publish outreach materials: Design and distribute
    materials to highlight the project's features and benefits.

#### 2.4.2 Assessment and Feedback

-   Conduct program evaluation: Assess the project's impact on users and
    stakeholders, evaluating how well the curation plan and new
    systems are meeting the established goals.

-   Gather and analyze user feedback: Use surveys, interviews, and usage
    data to understand user experiences, satisfaction, and areas for
    improvement.

#### 2.4.3 Continuous Improvement

-   Establish mechanisms for regularly updating the project based on
    stakeholder feedback and evolving requirements.

-   Plan for next phases of project expansion.

## 3. TECHNOLOGY STACK AND WORKFLOW

### 3.1 Cloud-Based Storage Infrastructure

Amazon Cloud Object Storage will serve as the primary storage solution,
selected for its efficiency, scalability, and cost-effectiveness. It
provides a flat storage structure that simplifies management.

### 3.2 Technology Components

-   BTAA Geoportal: The main discovery portal for users.

-   Solr: To index metadata, facilitating efficient searching.

-   GBL Admin Toolkit: For managing metadata and datasets.

-   AWS S3: The central cloud storage repository.

-   AWS Serverless Applications: Enables data previews.

-   AWS Glacier (Planned for future): For long-term storage needs.

### 3.3 Ingest Workflow

#### 3.3.1 Manual Process

-   Metadata Creation:

    -   A curator manually creates a metadata record using the GBL Admin
        Toolkit's user interface, adhering to the OpenGeometadata
        Aardvark schema.

-   Data Upload and Storage:

    -   The curator uploads the zipped geospatial dataset, bundled with
        a standards-compliant metadata file, through the GBL Admin
        interface.

    -   GBL Admin then pushes this dataset to an Amazon S3 bucket for
        public access and to AWS Glacier for dark storage (future
        implementation).

-   Data Preview and Metadata Access:

    -   The S3 bucket integrates with serverless applications to offer
        data previews to users.

    -   The curator uploads a separate standards-based XML metadata file
        via the GBL Admin UI, which is also stored in S3. This allows
        users to preview the metadata independently before downloading
        the dataset.

#### 3.3.2 Batch Processing

-   Metadata Batch Processing

    -   Curators will prepare a spreadsheet containing metadata in the
        OpenGeoMetadata Aardvark schema.

    -   They will then upload this spreadsheet to the GBL Admin Toolkit
        to create multiple metadata records simultaneously.

-   Data Batch Upload

    -   The method for batch uploading of datasets and associated XML
        metadata files is yet to be defined. The future system will
        likely allow curators to upload multiple datasets and their
        metadata files to the GBL Admin Toolkit, which will then
        automate the process of storing these in AWS S3 and handling
        their integration with serverless applications for previews.

**AWS Architecture diagram**

![](images/aws-architecture.png)

### 3.4 Storage and Cost Estimates

#### 3.4.1 Storage Needs

-   Projected to be around 1200 GB for the initial two years, based on
    an analysis of existing data volumes.

-   State-Level Geospatial Clearinghouses: Approximately 100 GB per
    state (for 11 states)

-   County- and Municipal-level ArcGIS Hub Sites: Approximately 80 GB in
    total

-   Miscellaneous Sites: An estimated 40 GB

#### 3.4.2 Cost Analysis

Estimated monthly storage cost of \$27.60 based on current AWS
pricing, with additional download costs depending on usage.

### 3.5 Future Considerations

#### 3.5.1 Format Enhancements

-   Cloud Optimized Formats: Plan to adopt Cloud Optimized GeoTIFFs
    (COGs) and PM Tiles for efficient cloud storage and access.

-   Serverless Data Previews: Investigate serverless solutions for data
    preview, such as Northwestern's Serverless IIIF, to enhance user
    experience.

#### 3.5.2 Exit Strategy

-   Plan Development: Establish an exit strategy to ensure the safe and
    efficient transfer of digital assets if needed.

-   Potential Repository Technologies:

    -   DSpace: Known for its stability and broad user base, using a
        modified Dublin Core metadata schema.

    -   Samvera: Offers greater customization and integration with
        GeoBlacklight, using a MODS metadata schema.

## 4. DATA CURATION

### 4.1 Acquisition and Assessment

#### 4.1.1 Acquisition and Harvesting

-   Determine compliance with data provider agreements

-   Download data from identified sources, in batches or individually

#### 4.1.2 Quality Assessment

-   Assess the quality and relevance of the downloaded data using
    automated scripts

-   Use QGIS to open and visually inspect the datasets

### 4.2 Metadata and Data Preparation

#### 4.2.1 Transformation and Standardization

-   If needed, convert data into open formats

-   Assess the suitability of the coordinate reference system or
    projection

#### 4.2.2 Metadata Creation and Enhancement

-   Automatically extract and generate metadata from the datasets

-   Manually edit or enhance metadata, ensuring it meets the GeoBTAA
    Metadata Profile and provides sufficient data description


### 4.3 Packaging and Publishing

#### 4.3.1 Package and Ingest Preparation

-   Package datasets with their corresponding metadata into zip files

-   Conduct tests on these data bundles to ensure they are ready for
    ingest

#### 4.3.2 Upload to GBL Admin Toolkit and AWS S3

-   Import discovery metadata into GBL Admin Toolkit.

-   Ingest the prepared data bundles into the GBL Admin Toolkit and
    subsequently into AWS S3 for storage and access.

### 4.4 Logging and Maintenance

#### 4.4.1 Documentation

-   Follow and update the Curation Plan

-   Log the date of harvest and actions taken

#### 4.4.2 Monitoring and Quality Control

-   Regularly check the data quality and integrity in the repository

-   Establish a cycle for updating the datasets and metadata in the
    repository to reflect the most current and accurate information

## 5. STAFFING PLAN

### 5.1 Program Director

#### Role Overview

Higher-level oversight, focusing on budget management and liaising
with administrators and stakeholders.

#### Current Responsibilities

-   Set the overarching vision and strategic direction for the program.

-   Maintain budget oversight.

-   Liaise with administrators and stakeholders.

#### New Responsibilities

-   Delegate day-to-day project management tasks and operational
    decisions to the team.

-   Onboard and integrate the Program and Outreach Coordinator into the
    program's activities.

### 5.2 Associate Director: Technology and Data Curation (formerly Geospatial Product Manager)

#### Role Overview

Oversee technical development and data curation, incorporating aspects
of project management, especially in technical and data realms.

#### Current Responsibilities

-   Act as the primary contact and strategic lead for BTAA-GIN software
    products and websites.

-   Oversee metadata analysis, workflows, and documentation for BTAA-GIN
    metadata resources.

#### New Responsibilities

-   Collaborate with the BTAA-GIN Program Team to develop a curation
    plan and processing workflows.

-   Evaluate and assess resources for inclusion in the geodata
    collection.

-   Manage the collection, processing, and maintenance of resources
    within the geodata collection.


### 5.3 Associate Director: Program & Outreach Coordination (New Role)

#### Role Overview

Manage the day-to-day operations of the program, ensuring that
timelines and goals are met, and spearhead outreach and engagement
strategies.

#### Responsibilities

-   Serve as the primary point of contact for both internal and external
    stakeholders.

-   Develop and maintain a communication plan with data providers.

-   Manage the program and team.

-   Lead outreach and engagement efforts.

### 5.4 Lead Developer

#### Role Overview

Focus on Ruby on Rails development, covering both backend and frontend
aspects.

#### Current Responsibilities

-   Maintain and customize the Geoportal software.

-   Engage with the GeoBlacklight open source community for
    collaborative feature development.

#### New Responsibilities

-   Lead the technical expansion of the Geoportal into geospatial data
    curation.

-   Develop workflow and management tools for the Geodata Collection
    Pilot.

-   Coordinate with the BTAA team in development sprint meetings and
    committee consultations.

### 5.5 Application Development Manager

#### Role Overview

Provide advisory support for cloud-based architecture development,
particularly with Amazon Cloud services.

#### Current Responsibilities

-   Optimize AWS services to align with project requirements.

-   Troubleshoot server issues and recommend system improvements.

#### New Responsibilities

-   Establish Amazon S3 buckets and implement security and permissions
    settings.

-   Assist in connecting and configuring AWS services to facilitate
    resource previews through Amazon Serverless Applications.

### 5.6 Graduate Student Research Assistant

#### Role Overview

Process resources for inclusion in the Geoportal. Supervised by
Associate Director: Technology and Data Curation.

#### Current Responsibilities

-   Harvest and process metadata as assigned

-   Troubleshoot broken links and sources

#### New Responsibilities

-   Harvest data and assist with preparation of resources.

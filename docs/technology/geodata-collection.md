# BTAA-GIN Geodata Collection Strategic Roadmap

The BTAA-GIN Program launched a new initiative in 2024 to collect, store, and distribute open geodata. 

!!! info "Plan documents"

	*  [Geodata Collection Strategic Plan](../../library/geodata-collection-strategic-plan/)
	*  [Geodata Collection Implementation Plan](../../library/implementation-plan/)

*Follow our progress*

- [x] Done
- [ ] {++In progress++}
- [ ] Not started

## Year 1 (2024): Pilot Phase

During Year 1, we focus on exploring the potential for a Geodata Collection. This phase involves experimenting with a variety of datasets to test workflows, metadata, tools, and data curation strategies. The goal is to establish Proof of Concepts and refine our methods before scaling up. This work will inform the development of key protocols and processes that will serve as the foundation for the project moving forward.

### 1. Set up storage & pilot workgroup (2024 Q1-Q2)

#### Pilot Workgroup

- [x] Establish the Geodata Collection Pilot Working Group.
- [x] Research existing geodata archiving practices across the BTAA region.
- [x] Create an initial set of sample datasets in a GitHub repository to serve as test objects

#### Technology

- [x] Establish Amazon cloud storage (S3) accounts for data storage.
- [x] Develop techniques within GBL Admin for basic ingest of datasets.
- [x] Test adding sample datasets to Amazon S3.

#### Recruitment and staffing

- [x] Assess current team capabilities and identify gaps in skill or resources.
- [x] Draft job description Program and Outreach Coordinator.
- [x] Advertise the position.

#### Documentation

- [x] Obtain official approval of the BTAA-GIN Geodata Collection Strategic Plan.
- [x] Create and publish a Geodata Collection Implementation Plan that expands on the Strategic Plan.


### 2. Develop Curation Plan and explore technology enhancements (2024 Q3-Q4)

#### Pilot Workgroup

- [x] Ingest sample data to GBL Admin.
- [x] Determine staging environment for sharing datasets
- [x] Select a broader range of pilot datasets.
- [x] Download pilot datasets to staging area
- [x] Test new GBL Admin features for data management.
- [x] Determine minimum metadata requirements.
- [x] Augment the GeoBTAA Metadata Application Profile as needed.
- [ ] {++Add pilot datasets to GBL Admin.++}
- [ ] {++Determine Download package contents.++} 
- [ ] Sunset the pilot workgroup.


#### Technology

- [x] Set up staging area (Box).
- [x] :octicons-milestone-16: [Separate references into Distribution table](https://github.com/geobtaa/geoblacklight_admin/milestone/2)  Modify GBL Admin to store assets and external links in a separate table.
- [x] :octicons-milestone-16: [ncorporate data dictionaries](https://github.com/geobtaa/geoblacklight_admin/milestone/4) Users need the documentation found in data dictionaries and codebooks. Instead of storing these as static documents, we can store them as related tables in our database.


#### Recruitment and staffing

- [x] Continue process for interviewing for new position
- [x] Finalize the hiring process and onboard new hire



#### Documentation

- [ ] {++Document the setup and configuration processes for S3 accounts and asset management tools.++}
- [ ] {++Document pilot testing procedures and decisions.++}



## Year 2 (2025): Trial Phase

Year 2 marks the transition to a Trial phase, where we begin collaborating with select data providers to curate datasets. This phase emphasizes building relationships, refining curation techniques, and enhancing the overall structure of our Geodata Collection.

### 3. Begin Data Curation Pilot and establish communication (2025 Q1-Q2)

#### Curation Plan development

- [ ] {++Identify the themes of geospatial data to be included in the collection.++}
- [ ] Propose a dataset exchange workflow between data providers and the BTAA-GIN.
- [ ] Define curation criteria, including data selection, acquisition, and quality control.
- [ ] Document the curation plan

#### Data Curation Trial

- [ ] Establish partnership with two data providers
- [ ] Determine data provider agreements
- [ ] Ingest datasets submitted by partners

#### Technology

- [ ] :octicons-milestone-16: [Redesign the item view page](https://github.com/geobtaa/geoportal/milestone/24)  Incorporate tabs for metadata, data dictionaries, and download options into item page view.
- [ ] :octicons-milestone-16: [Create a Download Package](https://github.com/geobtaa/geoblacklight_admin/milestone/3) 
- [ ] Transition the updated Geoportal interface from the development branch to the live environment.
- [ ] Implement batch ingest functionality in GBL Admin.

#### Communication

- [ ] Identify key stakeholders.
- [ ] Develop communication strategies (frequency, channels, and content).
- [ ] Prepare communication templates and materials.




### 4. Outreach and Active Data Curation (2025 Q3-Q4)

#### Outreach

- [ ] Create an outreach schedule for engaging with the community, including presentations at conferences.
- [ ] Conduct educational sessions on data curation as webinars or workshops.
- [ ] Design and distribute outreach materials to highlight the project's features and benefits.

#### Active curation process

- [ ] Establish curation cycles.
- [ ] Ingest and publish assets as identified in Communication and Curation Plans.

## Year 3 (2026): Evaluation and Outreach Phase

In Year 3, we will focus on evaluating the effectiveness of our curation efforts and reviewing the overall structure and processes established in the previous phases. This phase will include gathering feedback from stakeholders, refining workflows, and assessing the long-term sustainability of the collection. Additionally, we will increase our outreach efforts, promoting the collection to a broader audience and building partnerships to ensure its growth and visibility in the geospatial and library communities.

#### Assessment and Feedback

- [ ] Assess the project's impact on users and stakeholders.
- [ ] Evaluate how well the curation plan functions.

#### Monitoring and Evaluation

- [ ] Set up monitoring tools for the new systems.
- [ ] Evaluate the effectiveness of the curation process, identifying areas for improvement or adjustment.
- [ ] Establish mechanisms for regularly updating the project based on stakeholder feedback and evolving requirements.
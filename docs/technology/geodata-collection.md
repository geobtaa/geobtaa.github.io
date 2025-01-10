# BTAA-GIN Geodata Collection Strategic Roadmap

The BTAA-GIN Program has launched a new initiative to collect, store, and distribute open geodata. 

!!! info "Plan documents"

	*  [Geodata Collection Strategic Plan](../../library/geodata-collection-strategic-plan/)
	*  [Geodata Collection Implementation Plan](../../library/implementation-plan/)

*This page tracks our progress. It is updated frequently as our work evolves.*

## Roadmap Key

- [x] Done
- [ ] {++In progress++}
- [ ] Not started

## :simple-blueprint: Phase 0: Blueprints

The Blueprints Phase represents the culmination a lengthy period of time (beginning in 2015) that we put into researching geodata archiving. The research resulted in multiple scholarly articles[^1], reports[^2], and nascent proposals[^3].  Finally, in 2023, we submitted the [BTAA-GIN Geodata Collection Strategic Plan](../../library/geodata-collection-strategic-plan/), which was approved by the BTAA-GIN Executive Committee.

[^1]: See Dyke, K. R., Mattke, R., Kne, L., & Rounds, S. (2016). Placing Data in the Land of 10,000 Lakes: Navigating the History and Future of Geospatial Data Production, Stewardship, and Archiving in Minnesota. Journal of Map & Geography Libraries, 12(1), 52–72. https://doi.org/10.1080/15420353.2015.1073655; Majewicz, K., J. Martindale, M. Kernik, and R. Mattke. 2024. Ephemeral geodata: An impending digital dark age. Journal of Map & Geography Libraries 20 (2):88–113. https://doi:10.1080/15420353.2024.2398542.
[^2]: See the reports of the Minnesota Geospatial Advisory Committee's [Archiving Workgroup](https://www.mngeo.state.mn.us/workgroup/archiving/index.html)
[^3]: See the partially realized proposal from 2019, [A Spatial Data Infrastructure (SDI) for the BTAA](../../library/btaa-sdi-2019/)


## :material-bulldozer: Phase 1: Groundwork

During the Groundwork Phase, we focus on exploring the potential for a Geodata Collection and conducting a pilot. This phase involves experimenting with a variety of datasets to test workflows, metadata, tools, and data curation strategies. The goal is to establish a **Proof of Concept** and refine our methods before scaling up.

### 1A. Setup (Q1-Q2 2024)

Set up storage, basic ingest, and a pilot workgroup.

#### Working Group Activities

- [x] Establish the Geodata Collection Pilot Working Group.
- [x] Compile an environmental scan of existing geodata archiving practices across the BTAA region.

#### Recruitment and staffing

- [x] Assess current team capabilities and identify gaps in skill or resources.
- [x] Draft job description Program and Outreach Coordinator.
- [x] Advertise the position.

#### Technology

- [x] Establish Amazon cloud storage (S3) accounts for data storage.
- [x] Develop techniques within GBL Admin for basic ingest of datasets.

#### Curation Tests

- [x] Create a few sample datasets in a GitHub repository to serve as test objects.
- [x] Add the test datasets to Amazon S3.
- [x] Ingest sample data to GBL Admin.

#### Documentation

- [x] Create and publish a Geodata Collection Implementation Plan that expands on the Strategic Plan.


### 1B. Pilot (Q3 2024-Q1 2025)

Build the pilot collection, explore technology enhancements, and document results.

#### Working Group Activities

- [x] Determine staging environment for sharing datasets.
- [x] Select a broader range of pilot datasets.
- [x] Test new GBL Admin features for data management.
- [x] Determine minimum metadata requirements.
- [x] Augment the GeoBTAA Metadata Application Profile as needed.
- [x] Determine Download package contents. 


#### Curation Tests
- [x] Download pilot datasets to staging area
- [x] Add pilot datasets to GBL Admin.


#### Technology

- [x] Set up a staging area (Box).
- [x] :octicons-milestone-16: [Separate references into Distribution table](https://github.com/geobtaa/geoblacklight_admin/milestone/2)  Modify GBL Admin to store assets and external links in a separate table.
- [ ] {++:octicons-milestone-16: [Incorporate data dictionaries](https://github.com/geobtaa/geoblacklight_admin/milestone/4) Users need the documentation found in data dictionaries and codebooks. Instead of storing these as static documents, we can store them as related tables in our database.++}


#### Recruitment and staffing

- [x] Continue process for interviewing for new position
- [x] Finalize the hiring process and onboard new hire


#### Documentation

- [ ] {++Document the setup and configuration processes for S3 accounts and asset management tools.++}
- [ ] {++Document pilot testing procedures and decisions.++}



## :material-dock-bottom: Phase 2: Foundation

During the Foundation Phase, we begin collaborating with select data providers to curate datasets. This phase emphasizes building relationships, refining curation techniques, and establishing the first official collections. This work informs the development of key protocols and processes that will serve as the foundation for the project moving forward.

### 2A. Partner (Q1-Q3 2025)

Communicate our newly developed capabilities and seek out data provider partnerships for our first collections.

#### Working Group Activities

- [ ] Sunset the pilot workgroup.
- [ ] Convene a data provider pilot working group. (name TBD)
- [ ] Propose a dataset exchange workflow between data providers and the BTAA-GIN.
- [ ] Determine data provider agreements
- [ ] Outline a Curation Plan that includes initial scope, workflows, and criteria.

#### Coordination and Outreach

- [ ] Present results of Groundwork Phase to key stakeholders
- [ ] Establish partnership with at least two data providers

#### Technology

- [ ] :octicons-milestone-16: [Redesign the item view page](https://github.com/geobtaa/geoportal/milestone/24)  Incorporate tabs for metadata, data dictionaries, and download options into item page view.
- [ ] :octicons-milestone-16: [Create a Download Package](https://github.com/geobtaa/geoblacklight_admin/milestone/3) 
- [ ] Transition the updated Geoportal interface from the development branch to the live environment.
- [ ] Implement batch ingest functionality in GBL Admin.


### 2A. Trial (Q3 2025-Q1 2026)

Work iteratively with our data providers to collect, document, and publish prior versions of their datasets.

#### Working Group Activities

- [ ] Evaluate the data provider communications.
- [ ] Review the initial collections

#### Curation Tests

- [ ] Ingest datasets submitted by partners
- [ ] Work with partners to refine the metadata and datasets for their original content as displayed in the Geoportal

#### Technology

- [ ] Implement batch ingest functionality in GBL Admin.

#### Curation Plan

- [ ] Publish a Curation Plan, Version 1 to document scope, metadata, and workflows.

## :window: Phase 3: Framework

In the Framework Phase, we will build up our collections with more data providers. This will require broader communication and more outreach. We will also be relying on more streamlined workflows by this phase. This phase will include gathering feedback from stakeholders, refining workflows, and assessing the long-term sustainability of the collection. Additionally, we will increase our outreach efforts, promoting the collection to a broader audience and building partnerships to ensure its growth and visibility in the geospatial and library communities.

### 3A. Outreach (Q1-Q4 2026)

#### Outreach & communication

- [ ] Develop communication strategies (frequency, channels, and content).
- [ ] Prepare communication templates and materials.
- [ ] Create an outreach schedule for engaging with the community, including presentations at conferences.
- [ ] Conduct educational sessions on data curation as webinars or workshops.
- [ ] Design and distribute outreach materials to highlight the project's features and benefits.

### 3B. Curate (Q1-Q4 2026)

#### Active curation process

- [ ] Identify additional data providers.
- [ ] Establish regular curation cycles.
- [ ] Ingest additional collections from multiple data providers.
- [ ] Publish a Curation Plan, Version 2 that includes batch functionality and broadened scope.


## Phase 4: Evaluate & Refine (2027)

- [ ] Gather feedback from a wide variety of stakeholders.
- [ ] Assess the project's impact on users and stakeholders.
- [ ] Evaluate how well the first version of the curation plan functions.



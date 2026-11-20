# CMS editor development decisions

These documents explain the custom CMS design and the constraints to preserve when maintaining it. They describe the checked-in implementation; live hosting settings and release readiness must be verified separately.

- [Design decisions](decisions.md): drafts, publication, recovery, content safety, and performance.
- [Hosting and deployment](deployment.md): project separation, build configuration, OAuth, and rollout checks.
- [Validation and operational limits](validation.md): required checks, measurement methods, limits, and retained recovery state.

For editorial instructions, use the [CMS user guide](../CMS_USER_GUIDE.md). For local development, see the [application README](../../editor-prototype/README.md) and [local setup](../LOCAL_SETUP.md).

## Documentation policy

Update these documents when a decision changes. Record the chosen behavior and its reason rather than adding another milestone report. Keep test output and profiling results with the release or investigation that produced them; do not treat old test counts, branch names, or local measurements as current deployment evidence.

This consolidation replaces the CMS save/publish milestones, prototype and transfer audits, staged release checklists, redirect incident report, and performance/Free qualification reports formerly at the top of `docs/`. Their useful decisions are incorporated here. Superseded automatic-merge and deployment-polling plans, file inventories, temporary diagnostic patches, raw JSON traces, and historical Wrangler configuration were removed. Their original contents remain in Git history.

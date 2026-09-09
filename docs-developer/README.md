# MoFaCTS Developer Docs

This directory is for developer-facing planning, architecture work, audits, decomposition notes, and implementation plans that are useful to maintainers but not part of the public user/operator documentation set.

Use `docs-developer/` for:

- Active implementation plans.
- Architecture exploration and decomposition plans.
- Audit notes and cleanup plans.
- Internal developer operating notes.
- Modularity and extension-boundary planning.

Keep `docs/` focused on software consortium, repository, user, author, operator, release, and compliance docs.

## Migrated Developer Docs

- `modularity-extension-boundary-plan.md`: extension-boundary starter plan for AutoTutor/H5P-style component drop-ins.
- `modularity-readiness-audit.md`: current checkpoint of what is ready, intentionally deferred, and evidenced for modular component packages.
- `modularity-start-plan.md`: short next-step plan for turning the current extension boundaries into practical component packages.
- `open-core-baseline-inventory.md`: current self-hosted deployment inventory for open-core planning.
- `open-core-architecture-vetting.md`: target open-core deployment shape, gap analysis, and Redis assessment.
- `open-core-decision-answers.md`: worksheet for implementation decisions that are not already answered by code or docs.
- `open-core-implementation-plan.md`: full task plan for finishing Self-Hosted MoFaCTS before enterprise-layer work.
- `h5p-assessment-session-playback-audit.md`: H5P assessment playback flow audit.
- `h5p-assessment-session-race-condition-cleanup-plan.md`: H5P assessment race-condition cleanup plan.
- `h5p-no-scroll-container-policy.md`: H5P iframe sizing policy and implementation plan.
- `h5p-stimuli-architecture-plan.md`: H5P stimuli architecture plan.
- `interface-internationalization-plan.md`: interface localization, multilingual input/display, and locale-aware TTS implementation handoff plan.
- `interface-internationalization-status.md`: implementation status, locale review matrix, and language ownership map for interface internationalization.
- `interface-i18n-translation-review-checklist.md`: reviewer checklist and signoff template for moving AI-draft locale strings toward reviewed/enabled status.
- `mofacts_administration_interface_polish_audit.md`: static code-quality audit of user, teacher, and administrator management interfaces.
- `administration-interface-behavioral-primitives-plan.md`: phased implementation plan for shared route, async-state, command, confirmation, disclosure, form, and table behavior across management interfaces.
- `autotutor-dialogue-planner-plan.md`: AutoTutor dialogue planner decomposition plan.
- `autotutor-concern-matrix.md`: AutoTutor concern matrix and implementation audit notes.
- `autotutor-implementation-questions.md`: AutoTutor implementation decision log.
- `autotutor-unit-plan.md`: AutoTutor unit type implementation plan.
- `learner-tdf-configuration-plan.md`: learner-facing per-lesson configuration plan.
- `learning-session-progress-panel-plan.md`: learning-session progress panel plan.
- `sparc-generalized-model-progress-plan.md`: SPARC/shared adaptive logistic model progress provider and placement plan.
- `lesson-launch-resume-cleanup-plan.md`: lesson launch/resume runtime cleanup plan.
- `study-display-subsets-plan.md`: study/drill display subset configuration plan.
- `mofacts-directory-restructure-plan.md`: target repository layout and contributor-orientation plan.
- `mofacts-unit-engine-split-plan.md`: unit-engine decomposition plan for `learning-components/`.
- `ai-legibility-followup-architecture-plan.md`: AI legibility follow-up architecture plan.
- `card-runtime-decomposition-plan.md`: card runtime decomposition plan.
- `delivery-settings-consolidation-plan.md`: delivery settings consolidation plan.
- `delivery-settings-final-cutover-plan.md`: delivery settings final cutover plan.
- `feedback-pipeline-cleanup-plan.md`: feedback pipeline cleanup plan.
- `playwright-mcp-operations.md`: Playwright MCP operations guide.
- `production-smoke-load-test.md`: production smoke load-test notes.
- `security-audit-durable-redesign-plan.md`: durable control-catalog, authorization-evidence, runtime-surface, verification, and cutover plan for the security-audit system.
- `security-audit-durable-redesign-status.md`: implementation stages, verified workstation release workflow, compatibility decisions, and separate source/local/CI/non-production/production evidence.
- `security-audit-phase0-contracts.md`: implemented draft proof contracts, test-only defect witnesses, selected compatibility guards, and remaining runtime/ownership gates.
- `tdf-schema-source-of-truth-plan.md`: TDF and stimulus schema source-of-truth plan.
- `video-session-state-machine-audit-plan.md`: video session state-machine audit and fix plan.
- `tutorscript.schema.json`: TutorScript canonical JSON schema for SPARC plans.
- `sparc-semantic-pages-with-adaptive-rules-and-cognition.md`: SPARC: Semantic Pages with Adaptive Rules and Cognition plan.
- `hybrid-model-traced-reactive-instructional-document-system-plan.md`: hybrid model-traced reactive instructional document system plan.

## Initial Migration Map

All root-level developer planning candidates identified during this pass have been migrated from `docs/` to `docs-developer/`.

Migration should happen in small batches with link updates. Do not move deployment operator docs, release/license docs, or user-facing authoring docs into this directory.

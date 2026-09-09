# Security audit code and tests

The active scanner and receiver still use `SecurityAuditReportV1`. Production setup is documented in [the operator guide](../../../docs/deployment/security-audit.md). Target architecture and progress are in [the plan](../../../docs-developer/security-audit-durable-redesign-plan.md) and [status record](../../../docs-developer/security-audit-durable-redesign-status.md).

The opt-in build-source prototype is documented in [the capture guide](../../../deploy/security-audit/source-capture.md). Its isolated tests run with `npm run security:test:capture`; they use synthetic tar streams and injected Docker responses, not actual builds. It emits unqualified acquisition/build outcomes only and is not automatically called by any scanner or deployment workflow.

## Local-only Phase 0 tests

From `mofacts/`, using pinned Node 24.15.0:

```powershell
npm run security:test:phase0
```

This runs synthetic characterization and draft proof-contract tests. It does not run a production scan, Docker build, Meteor server, browser, SSH command, uploader or deployment. The assembler tests create bounded temporary synthetic files and remove their own temporary directories. No production fixtures or private settings are read. This separate entry point is not automatically added to the active scheduled scanner.

- `tests/phase0CurrentScanner.test.mjs`: V1 membership, canonical fixture digest, and known-defect witnesses. **A passing WITNESS test confirms the defect still exists.** Replace it with the opposite regression assertion in its owning fix phase.
- `tests/phase0RuntimeSemantics.test.mjs`: selected current policy/callback behavior using synthetic dependencies, including Brand Profile guard ordering, its public publication and progressive-launch early denials, plus the reviewed manifest entries; not a substitute for Meteor or HTTP-stack integration.
- `tests/phase0ReleaseIdentity.test.mjs`: strict proof parsing, clean/dirty identity, image-coordinate separation and failed/missing command observations.
- `tests/helpers/sourceWitnesses.mjs`: extracts exactly one first-party expression/callback for characterization. Source changes fail the selection visibly; there is no alternate source lookup or arbitrary private-script evaluation.
- `tests/fixtures/v1-membership.json`: frozen current IDs only, never imported by runtime producers or treated as a second canonical catalog.

## Surface classification maintenance

The V1 surface manifest now includes the previously omitted Brand Profile and progressive-launch entries. Its `public` label denotes intentional anonymous access without a throttling claim; `public-rate-limited` additionally claims throttling and must not be used merely because a surface is public. The checker accepts these labels but does not enforce or prove their policies. Existing classifications outside this bounded correction have not been recertified. Discovery remains syntactic, with known omissions documented by the witness tests.

## Draft shared proof ownership

`common/securityAudit/buildIdentity.ts` and `releaseQualification.ts` own the new pure draft proof contract. They are not imported by current startup, authorization, scanner orchestration or deployment commands. The optional qualification extends the existing workstation release record; it does not replace it. `evaluateReleaseIdentity` proves only consistency of supplied observations, not their authenticity or complete release/security assurance.

`common/securityAudit/releaseQualification.test.ts` supplies parity cases for the existing Meteor test discovery. Writing those cases or running full app typecheck does not mean Meteor CI passed. Every `npm run test:ci` needs fresh explicit authorization; Docker and remote actions also require separate permission.

See the [Phase 0 contract notes](../../../docs-developer/security-audit-phase0-contracts.md) before connecting these modules to acquisition or release tooling. No new dependency, public status, startup gate or access restriction is introduced.

# Opt-in build-source capture

Status: implemented source prototype; 50 synthetic capture/builder tests pass. **The authorized 2026-09-07 real source capture, Windows-to-Linux round trip, endpoint-bound no-cache Compose build and structural image smoke passed. Do not replace the operator's production build command: full application smoke, source-proof binding and remaining qualification gates are still open.** See the [executed checkpoint](../../docs-developer/security-audit-durable-redesign-status.md), including the repaired Compose/Buildx context conflict and default-path comparison. This tool does not issue a security qualification.

The 2026-09-07 ordinary comparison build failed fetching Meteor's pinned `uWebSockets.js` dependency (`ssh: not found`). The separately authorized 2026-09-08 build-stage HTTPS transport repair preserves that repository/ref; the ordinary no-cache build and structural image smoke subsequently passed. The historical failed comparison is not relabeled successful, and these different-source image runs are not bit-for-bit equivalence or full release qualification. See the status checkpoint and [build transport note](../README.md#build-context).

The ordinary `deploy and build.txt` procedure remains unchanged. The root Dockerfile now shares its four copied source roots through `source_inputs`. The separate `source_capture` target adds only the recipe and root ignore file; normal compilation still ends at the existing `runtime` stage. No tests, archive export, capture bounds or new proof requirements run on the default build path.

## Ownership

| Owner | Responsibility |
| --- | --- |
| Root `Dockerfile` | Single source-copy stage; capture target; unchanged application compilation/runtime instructions |
| `deploy/capture-build-source.ps1` | Optional PowerShell entry point with explicit native exit propagation |
| `mofacts/scripts/security-audit/qualification/captureBuildSource.mjs` | Acquisition, workspace lifecycle, recipe/input ownership checks, source round-trip comparison and build-only Compose integration |
| `mofacts/scripts/security-audit/qualification/sourceSnapshot.mjs` | Bounded streaming tar extraction, path/type checks, canonical source digest and local tamper observations |
| `mofacts/scripts/security-audit/qualification/localDockerBuilder.mjs` | Explicit local context/engine binding shared by capture and Compose; rejects unavailable, remote or non-context-backed builders |
| `mofacts/common/securityAudit/buildIdentity.ts` | Existing shared source identity contract; not a second release record |

`capture.json` is private temporary acquisition state, not a production release receipt. Its Docker-observed source digest uses exact file bytes, native archive modes and directory entries. Its separate local-tree digest detects local changes; Windows filesystem modes are not substituted for Linux/Docker modes. Verification requires a fresh Docker re-export to match the original source digest.

## Explicit actions

Use pinned Node 24.15.0 and an explicitly selected, authorized local Buildx builder. The helper does not create a builder or change the selected builder. Source export and Compose build must use the supplied builder. Docker CLI support is documented for [tar export to stdout](https://docs.docker.com/reference/cli/docker/buildx/build/) and [Compose builder selection](https://docs.docker.com/reference/cli/docker/compose/build/); the installed versions still require runtime verification.

The CLI currently supports a running, single-node, context-backed `docker` driver on a local Linux engine (local named pipe or Unix socket). Before export/config/build it resolves the supplied context, validates the builder, and compares engine ID, OS and architecture through the named context and explicit endpoint. Every subsequent Docker invocation binds that endpoint with `--host`; the built-in builder is explicitly named `default` **on that endpoint**, not whichever engine happens to be selected globally. This is the same engine-backed builder, not an alternate-builder retry. Remote, container-backed, stopped or mismatched builders fail explicitly; extending that support requires its own contract and tests.

This binding avoids the verified Compose 5.4.0 / Docker CLI 29.7.2 name conflict: [Compose passes both context and host to standalone Buildx](https://github.com/docker/compose/blob/v5.4.0/pkg/compose/shellout.go), while [the CLI resolves an explicit host as the default context](https://github.com/docker/cli/blob/v29.7.2/cli/command/cli.go). Passing a different context-backed builder name then fails Buildx validation. No Docker installation, global context or production command-sheet change is needed. Missing source/image proof remains unqualified as before.

These examples are instructions for a later authorized run, **not evidence that they ran**. `prepare` and `verify` execute source-target Docker export operations; `build` additionally compiles an app image. None pushes or deploys. Do not execute the complete private command sheet.

```powershell
# Use the base commit and dirty flag already captured by the operator procedure.
# Builder name is supplied explicitly by the operator; do not guess it.
$captureResult = & C:\dev\MoFaCTS\deploy\capture-build-source.ps1 `
    -Action prepare -Builder $ApprovedLocalBuilder `
    -BaseCommit $ProdReleaseCommit -Dirty ($ProdWorkingTreeDirty.ToString().ToLowerInvariant()) |
    ConvertFrom-Json

& C:\dev\MoFaCTS\deploy\capture-build-source.ps1 `
    -Action verify -Builder $ApprovedLocalBuilder -Workspace $captureResult.workspace

# Only after separate build authorization and the prototype acceptance checks:
& C:\dev\MoFaCTS\deploy\capture-build-source.ps1 `
    -Action build -Builder $ApprovedLocalBuilder -Workspace $captureResult.workspace `
    -EnvFile $ProdEnvPath

# Removes only this helper-owned temporary capture; no Docker deletion occurs.
& C:\dev\MoFaCTS\deploy\capture-build-source.ps1 `
    -Action cleanup -Workspace $captureResult.workspace
```

Actions require exactly their documented arguments. A missing builder/identity/workspace/env-file argument is an error; no inferred alternate source, builder or ordinary-build retry is used. The base-revision argument in the resolved Compose build must match the captured identity. The helper uses argument arrays without a shell, keeps resolved private Compose configuration in memory, drains native stderr without retaining it, and emits bounded JSON outcomes rather than raw logs or source inventories.

`prepare` creates a new task-owned temporary directory outside the checkout, exports Docker-filtered inputs, checks recipe/ignore bytes and declared roots, and writes acquisition state plus a JSON Compose override. A failed preparation removes its own incomplete directory. `verify` checks local integrity and performs a new bounded re-export from the candidate, then deletes its own round-trip derivative. `build` first verifies, compares resolved base/override Compose configurations, permits only the absolute build-context adjustment, and invokes base Compose with that override, the supplied builder, `--no-cache` and service `mofacts`. Post-build local integrity is checked. An unsuccessful build never yields a successful result or retries against the live checkout.

Output states are intentionally `captured-unqualified`, `capture-verified-unqualified`, and `built-unqualified`. Exit zero for these actions means that action completed, **not that source tests, image smoke, published identity, host identity or a security audit passed**. There is no `PASS` release proof, embedded source bundle or automatic deployment-record write. Existing push/runtime overlay/remote commands are not invoked or rewritten.

## Safety and supported bounds

- The temporary root is created under the OS temporary directory with a unique helper-owned name and marker. Linux permissions are restricted; Windows inherits the user's temporary-directory ACL. Windows ACL isolation remains part of runtime qualification, not a claim that Node `chmod` implements an ACL.
- The candidate is immutable by helper ownership: test code never writes to it and the helper rechecks it. This is **not** an OS-enforced immutable snapshot or defense against a malicious process with the same user permissions. Do not edit candidate files. Full in-image source observation and stronger sealing remain acceptance work.
- Extraction checks bounds before writing each entry: 100,000 entries, 2 GiB total, 256 MiB per file, depth 64, and 1,024 UTF-8 bytes per path. Additional archive overhead is bounded. Files are streamed serially, limiting open files and memory; no parallel reread of the whole archive is needed.
- Regular files/directories and bounded per-file PAX path/time/owner metadata are supported. Links, sparse files, devices, global/GNU extensions, special mode bits, traversal, duplicate/case-colliding paths and ambiguous Windows names are rejected, never silently omitted or dereferenced. Native mode/encoding/empty-directory round trips still need real Docker fixtures.
- Only the root `.dockerignore` form is supported initially. An existing `Dockerfile.dockerignore` causes an explicit acquisition error, not use of the wrong policy. Nested ignore files are not reinterpreted. Unsupported `ADD`, mount inputs or direct context copies outside the shared input owner also fail acquisition.
- The helper exports only the declared copied roots and recipe metadata, not the config repo or a broad `COPY .`. Docker filtering is not secret detection: verify that included source roots contain no private runtime material before authorizing capture. This prototype must not be used to export production data/settings.
- Cleanup validates the exact owned temporary root and rejects links before recursive removal. It does not remove the live checkout, arbitrary directories, images, builders, volumes or containers. Successful captures persist until explicit cleanup. A stopped native client does not prove remote BuildKit work was cancelled; interrupted Docker cleanup belongs to the authorized runtime check.

## Verification and remaining work

Local synthetic verification, from `mofacts/`:

```powershell
npm run security:test:capture
npm run security:test:phase0
npm run security:test:source
npm run typecheck
npm run lint
npm run security:surfaces
```

The capture suite uses bounded synthetic archives and injected Docker responses. It does not start Docker, Meteor, a browser, MongoDB or any host connection. PowerShell syntax can be parsed without invoking the wrapper.

Remaining gates: real source-export/default-image equivalence; supported builder/Compose and Windows/Linux metadata round trips; measured source capacity/privacy review; supplemental test-input closure and isolated Linux runner; embedded source-proof and final in-image source binding; exact-image smoke/config identity; and protected release/host proof. The current helper's pre-build re-export is **not** claimed to be the planned final in-image recomputation. No production command-sheet hook is installed before these gates. See the [Phase 0 contract](../../docs-developer/security-audit-phase0-contracts.md) and [status](../../docs-developer/security-audit-durable-redesign-status.md).

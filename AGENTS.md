# MoFaCTS Agent Guide

This repository contains MoFaCTS, the Mobile Fact and Concept Training System. MoFaCTS is a web-based adaptive learning system. The executable application source tree lives under `mofacts/`.

This file is intentionally root-level and self-contained for critical behavior. Longer operational procedures may live in the public documentation linked here; do not rely on nested agent files for critical rules unless the user explicitly asks to introduce them.

## Decision Priority

When instructions compete, use this order:

1. The user's explicit scope, intent, and permissions.
2. Data integrity, security, privacy, and repository invariants.
3. Verified runtime behavior and clear architectural ownership.
4. The narrowest coherent change that does not leave broken wiring.
5. Required verification and honest reporting of its result.
6. Documentation, cleanup, and maintainability improvements within scope.

## Critical Invariants

- For runtime behavior, UI rendering, themes, transitions, Svelte components, state machines, or application logic, work in this repository and prefer `mofacts/`.
- For TDF/config content or sync scripts, use `C:\dev\mofacts_config`; inspect this repository only for compatibility checks.
- For product and developer documentation too long for public repo docs, use `C:\dev\MoFaCTS.wiki`.
- `MOFACTS_CONFIG_REPO`, when present, must resolve to `C:\dev\mofacts_config`. If it points elsewhere, stop and report the mismatch. If it is missing, verify `C:\dev\mofacts_config` exists, use that path, and do not report missingness as a problem.
- `MOFACTS_WIKI_REPO`, when present, must resolve to `C:\dev\MoFaCTS.wiki`. If it points elsewhere, stop and report the mismatch. If it is missing, verify `C:\dev\MoFaCTS.wiki` exists, use that path, and do not report missingness as a problem.
- Treat the config/content repo and wiki repo as critical MoFaCTS project components. Do not clone, create, copy, or substitute replacements unless explicitly instructed.
- If user-facing behavior changes in `mofacts/`, check whether the wiki needs an update.
- If code changes alter required TDF fields, config names, structures, schemas, payloads, interfaces, or field names, verify compatibility with dependent repositories.
- Do not silently substitute data, identity, repositories, configuration, runtime paths, or behavior when a required invariant fails. Fail clearly at the owning boundary.
- Explicit, observable recovery behavior is allowed only when it has a named owner and contract and does not mask a broken invariant.
- Do not add compatibility fallback paths unless explicitly requested.
- Do not run Docker build, push, deploy, or production-affecting commands unless explicitly requested.
- Do not use local Meteor CLI workflows as release-confidence substitutes for the supported Docker Compose workflow.

## User Intent And Permissions

- When the user asks a conceptual question whose answer is already available from the prompt, answer it directly without workspace inspection.
- A repository diagnosis, review, audit, or status question authorizes bounded read-only inspection of the named workspace, including source searches, diffs, status checks, and non-mutating diagnostics. It does not authorize edits, service startup, tests with side effects, external actions, commits, or pushes.
- When a diagnosis depends on a runtime value that is not visible in the supplied evidence, such as the selected model, reasoning level, credential source, provider route, environment, or persisted setting, ask the user for that value before hypothesizing or patching. Do not substitute assumptions or external research for information the user can provide directly.
- Do not add user-visible fields, controls, workflow stages, output types, or behavior outside the user-approved specification. If an apparently necessary product-surface addition is not already approved, stop and ask the user before implementing it.
- If a change seems needed after a question, recommend it separately and wait for explicit approval.
- When the user asks for a change, implement it end to end when feasible, then report what changed and what was verified.
- Stay on the current branch unless the user explicitly asks to create or switch branches.
- Do not create `codex/*` or other work branches automatically.
- This repository normally expects agent commits to be made on `main` when the checkout is on `main`.
- Never revert user or unrelated working-tree changes unless the user explicitly requests it.
- Do not commit or push unless the user explicitly asks.
- When committing, include only intentional files and mention verification performed.
- For a direct commit-and-push request, use plain Git with the repository's existing remote credentials. Do not require the GitHub CLI or open a pull request unless the user explicitly requests a PR or another operation that requires `gh`.

## Common Commands

- App directory: `cd mofacts`
- Typecheck from `mofacts/`: `npm run typecheck`
- Lint from `mofacts/`: `npm run lint`
- Generate schemas from `mofacts/`: `npm run generate:schemas`

## Repo Map

- `mofacts/`: application source.
- `learning-components/`: pedagogical extension logic such as unit engines, trial behavior, adaptive model logic, TDF/stimulus interpretation, response normalization, and external learning adapters.
- `deploy/`: canonical Docker Compose build and deploy workflow, plus local hotfix scripts.
- `docs/`: concise public repository documentation.
- `.github/`: GitHub workflow, issue, and pull request metadata.
- Root `app/`, `tests/`, and `packages/` are architectural scaffolds unless local README and build/test wiring prove the relevant runner is active.

## Architecture Boundaries

- Put Meteor routing, collections, publications, server methods, app shell UI, persistence, logging, and migrations in `mofacts/`.
- Put unit engines and pedagogical extension behavior in `learning-components/`.
- New unit types should go through the unit-engine registry and expose explicit lifecycle methods.
- Do not duplicate legacy behavior in `mofacts/client/views/experiment/unitEngine.ts`; keep that path as an app dependency facade.
- Learning components should depend on explicit runtime context/dependency interfaces.
- Avoid reaching from `learning-components/` into deep Meteor client/server paths unless a temporary facade is already documented and behavior-preserving.
- If an alternate runtime path is intentional, name it by the domain behavior it provides. Do not call a deliberate path a fallback.
- Do not add recovery behavior that masks a broken invariant.

## Legacy And Alternative Paths

- MoFaCTS does not yet have a large user base that requires preserving every historical behavior. Prefer maintainable, coherent code over keeping obsolete paths alive by default.
- "Legacy" means code, configuration, data paths, or behavior kept only to support past approaches that are not intended for the final system.
- Do not call something legacy merely because it is older, unfamiliar, or different from another path. If it is an intentional current alternative path, name the domain behavior it provides.
- When the requested work would build on, change, delete, or add a compatibility layer around apparently unnecessary legacy code, pause and ask whether it is still needed. Describe what depends on it and recommend whether to remove, replace, or preserve it. Incidental legacy code that does not affect the task may be reported at handoff without interrupting the work.
- Usually delete or collapse confirmed legacy paths instead of adding compatibility layers around them.
- If preserving a legacy path is explicitly chosen, document the invariant, owner, expected lifetime, and verification needed to keep it from becoming hidden maintenance debt.

## Change Discipline

- Do not make patch fixes that leave broken wiring in place. When a subsystem boundary or flow is wrong, analyze the whole flow, name the invariants, and make the integration coherent.
- Before editing, inspect the surrounding implementation and existing patterns; do not assume architecture from filenames alone.
- Prefer existing local helpers, conventions, and abstractions over introducing new ones.
- Keep edits scoped to the requested behavior and the owning module boundary.
- If a task seems to require a broad refactor, explain why before expanding scope.
- Before adding a new variable, field, id, schema property, fact slot, config key, or similarly named concept, search the relevant and adjacent modules for existing concepts to reuse, rename, or collapse.
- For TDF fields, config keys, schema properties, and unit identifiers, search both `mofacts/` and `C:\dev\mofacts_config` before introducing or renaming concepts.
- Redundancy is a top design risk. Do not create parallel names or representations for the same concept unless the distinction is explicit, necessary, and documented at the boundary.
- If pre-existing redundancy appears while working, stop before building on it and inform the user. Describe the duplicate concepts, locations, and whether the current task depends on resolving them.
- Preserve current intentional working paths, especially explicitly identified reference paths, unless the user asks to redesign them. Do not preserve obsolete legacy paths by default.
- When a plan and its invariants make sense, make the smallest coherent move, verify whether it improved the system, and continue.
- Do not add new npm, Meteor, Docker, or system dependencies without explicit approval.
- Before adding a dependency, search for existing packages or helpers that already solve the problem.
- If a dependency is necessary, explain why the existing stack is insufficient.
- Prefer source files over generated, bundled, cached, or compiled files. If unsure whether a file is generated, check before editing.

## Verification Matrix

Use the verification path that matches the change. Say clearly when a check could not be run locally.

| Change type | Required verification |
| --- | --- |
| TypeScript-bearing app changes | Run `npm run typecheck` from `mofacts/`. |
| Lintable TypeScript, JavaScript, or Svelte changes | Run `npm run lint` from `mofacts/`. |
| TDF field registry or schema changes | Run `npm run generate:schemas` from `mofacts/` and inspect generated schema diffs. |
| Meteor integration or client contract coverage | Use CI or another supported Meteor test environment. Do not run `npm run test:ci` routinely on local Windows. |
| Docker build, push, deploy, or release confidence | Run only when explicitly requested. |

Every invocation of `npm run test:ci` requires fresh, explicit user authorization. Authorization is single-use and does not carry forward to a later invocation, even within the same conversation or task.

The CI runner owns cleanup of test-generated `meteortesting:*` resolutions in `.meteor/versions`. Treat those entries as transient test artifacts; lint and pre-commit verification must reject their persistence in the application dependency manifest.

For TypeScript-bearing app changes, the full app check is:

```bash
npm run typecheck
```

Run it from `mofacts/`. Do not substitute per-file checks or targeted `tsc` invocations for full-app TypeScript verification.

- When a required check fails, report the failing command, the relevant error summary, and whether the failure appears related to the change.
- When a required check cannot run locally, report the reason and the next-best supported verification path.
- Required verification failures block staging, commit, and push. Proceed only if the user explicitly accepts the identified failure after being told its relevance and risk.

## Persistence And Migration Safety

- Treat learner histories, model state, course assignments, TDF content, and resume identity as durable data contracts.
- Do not run destructive or irreversible data migrations without explicit approval.
- Migration code must be restartable or idempotent, bounded for production-scale data, and observable through progress and failure logging.
- Before implementing a migration, define the forward transformation, validation, failure recovery or rollback approach, and the readers and writers affected.
- Do not reinterpret an existing stored field until all active writers, readers, indexes, publications, methods, analytics, and dependent repositories have been traced.
- Verify migration logic against representative existing records as well as newly created data. Never treat a clean-install-only test as sufficient migration evidence.

## Security And Privacy

- Never expose credentials, tokens, connection strings, local settings, learner data, or raw database records in logs, screenshots, generated artifacts, commits, or handoff text.
- Treat learner history and exported usage data as sensitive. Minimize fields and record counts during diagnosis and redact identifiers from retained artifacts.
- Enforce authentication and authorization at Meteor method, publication, route, and server boundaries. Client-side visibility controls are not authorization.
- Do not copy production data locally or broaden database access without explicit approval. Prefer representative synthetic or minimized records when possible.
- Keep secrets in approved ignored settings or environment mechanisms; never add them to source-controlled defaults or examples.

## UI, Logging, And Client Behavior

- Never add raw client `console.*` for routine logging; use `mofacts/client/lib/clientLogger.ts`.
- Preserve admin-controlled client verbosity behavior.
- Use inline UI patterns instead of modal popups unless explicitly requested.
- Preserve keyboard operation, visible focus, semantic labels, screen-reader announcements, readable contrast, and reduced-motion behavior where applicable.
- Keep interface locale, authored content language, learner response language, speech-recognition language, and text-to-speech language as distinct contracts. Do not infer one silently from another.

## Local Hotfix Watch Loop

The local hotfix loop under `deploy/` is the fast source-watching application workflow. Helper ownership is documented in `deploy/hotfix/README.md`.

- There is exactly one localhost application server: the native Meteor/Rspack watcher at `http://localhost:3200`, owned by `deploy/hotfix-local.ps1`.
- Docker Compose owns MongoDB and its replica-set initialization for this workflow; it does not own a second localhost application container.
- Source edits must rebuild and reload automatically. Do not replace the watcher with a manual generated-bundle loop or monkey-patch compiled output.
- `deploy/hotfix-local.ps1` validates Compose and the pinned Meteor tool before starting, then manages start, restart, stop, status, and logs for the watcher.
- This fast loop is local verification, not release confidence, and must not replace the canonical Docker Compose image build.

## Server Method Design

- Keep the server minimized; the client should do as much processor work as safely possible.
- The normal lint workflow enforces that production server modules cannot directly or transitively import learner-executable code under `learning-components/models/` or `learning-components/units/`; type-only server-interface imports are ignored.
- Add server methods only for database access, authentication or authorization enforcement, encryption, secrets, or external API calls that cannot safely run on the client.
- Do not add pure-compute methods to `mofacts/server/methods.ts`.
- Minimize database round-trips. Prefer batched queries or aggregation pipelines over N+1 loops.
- Do not return full collection scans to the client.
- Avoid server-side reshaping that the client can do from data it already has.
- Rate-limit public and unauthenticated methods.
- Extract large helpers out of `methods.ts` into `server/lib/` or `common/`.

## Scalability-Sensitive Surfaces

- Do not publish broad full TDF documents reactively.
- Keep listing publications field-limited and reserve full TDF content for exact-ID runtime, launch, or edit publications.
- Avoid full collection scans, unbounded `find({})` publications, and full-document payloads on dashboard, admin, or learner startup paths.
- Cache rebuilds, admin refreshes, and migration-style jobs must use supporting indexes, bounded concurrency, and progress logging when they can touch many users or history rows.
- Prefer child-to-root or explicit reference indexes over scanning every TDF/root document to reconstruct lesson families.
- When a broad or expensive path is intentionally retained for compatibility, document the invariant, expected lifetime, limit returned fields, and verify the relevant index or bound in the same change.

## Generated Files And Public Repo Hygiene

- Do not commit root `outputs/`, root `tmp/`, one-off inventory JSON, working-copy notes, generated slide decks, screenshots, local analysis dumps, or ad hoc artifacts.
- Curated examples must live under an intentional public path such as `examples/`, `docs/`, or a documented asset folder, with enough provenance for license and source review.
- If an artifact is only useful locally, keep it ignored rather than tracked. Update `.gitignore` when a repeatable tool produces new local output.
- If public setup, local run, admin bootstrap, test, deployment, TDF schema, or unit-extension behavior changes, update concise public docs in the same change.
- Do not update public docs for purely internal refactors unless behavior, setup, schema, workflow, or contributor expectations change.
- If user-facing behavior changes but docs do not need updates, say why.
- Do not leave private/local knowledge as the only working path.
- Do not point contributors at scaffold packages as implementation entry points when an active source root exists.
- For unit behavior, point to `learning-components/` unless the scaffold package has become the real contract.
- Do not generate, edit, or keep side-by-side emitted `.js` files next to `.ts` source files in `mofacts/client/`, `mofacts/server/`, or `mofacts/common/`.
- Treat untracked `.js` twins beside `.ts` files in `mofacts/` as build spill unless proven otherwise.

## Maintenance Rule

- Treat this file as part of the codebase. When build, test, dev, deployment, documentation, architecture, or verification workflows change, update `AGENTS.md` or the appropriate public documentation in the same change.
- Keep this file lean enough that critical instructions remain visible. Prefer root-level concise guidance over nested agent files when the rule is essential.
- When a rule becomes long, procedural, or rare, move the detail to public docs and keep only the decision rule here.

## Required Handoff

At the end of repository work, report concisely:

- What changed or what was concluded.
- The evidence supporting the result.
- Verification performed and its outcome.
- Required verification not performed and why.
- Any unrelated working-tree changes that were preserved.
- Compatibility, migration, security, privacy, accessibility, localization, or documentation impact when relevant.
- Remaining risks or decisions that require the user.

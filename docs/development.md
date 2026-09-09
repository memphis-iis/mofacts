# Development Guide

This guide covers the public contributor baseline for MoFaCTS.

## Requirements

- Node.js `24.15.0`
- npm `11.12.1`
- Meteor `3.5`
- Docker Desktop for local Compose-backed workflows
- Git

## Setup

```bash
git clone https://github.com/memphis-iis/mofacts.git
cd mofacts/mofacts
npm ci
# Create private local settings before running the app.
```

Adjust local settings for your environment. Do not commit local settings or secrets.

Docker Desktop must be running for MongoDB. The canonical localhost workflow
runs one native Meteor/Rspack watcher and uses Docker only for supporting
services. The pinned Meteor tool matching `mofacts/.meteor/release` must be
installed locally.

## First Local Run

The only supported contributor server is the source-watching hotfix server at
`http://localhost:3200`, managed by `deploy/hotfix-local.ps1`.

Startup requires four consecutive checks of MongoDB's configured writable
replica-set primary and both authenticated users. A startup-only MongoDB pool
loss is cleaned up, archived, and retried once; there is no recurring restart
loop that can conceal a persistent database or host failure.

1. Install dependencies and run the baseline check:

   ```powershell
   cd mofacts
   npm ci
   npm run typecheck
   ```

2. Prepare local deployment inputs:

   ```powershell
   cd ..\deploy
   Copy-Item .env.local.example .env.local
   Copy-Item settings.local.example.json settings.local.json
   ```

   Replace placeholder values in `.env.local` and its
   `METEOR_SETTINGS_HOST_PATH` target. `MONGO_URL` is the Docker-network URI;
   `MOFACTS_NATIVE_MONGO_URL` is the equivalent authenticated replica-set URI
   through `127.0.0.1`. The settings JSON must define `owner` for local admin
   bootstrap. Keep these files private.

3. Confirm the local runtime prerequisites:

   ```powershell
   node --version
   npm --version
   docker version
   docker compose version
   ```

4. Start the app:

   ```powershell
   .\hotfix-local.ps1
   .\hotfix-local.ps1 logs
   ```

   The command returns after the supervised Meteor/Rspack process tree is ready.
   Source edits then rebuild and reload automatically. `status` distinguishes
   process ownership from app, bundle, HMR, and Change Stream readiness, while
   previous run logs remain under ignored `deploy/local-hotfix/runs/`. Open:

   ```text
   http://localhost:3200
   ```

   The canonical hotfix manager creates or verifies a local admin account for the owner
   configured in the settings JSON. Read the ignored local credentials with:

   ```powershell
   Get-Content .\local-hotfix\agent-secrets.env
   ```

   Use `MOFACTS_AGENT_ADMIN_EMAIL` and `MOFACTS_AGENT_ADMIN_PASSWORD` from that file to sign in.

For status, logs, and stop commands, see `../deploy/README.md`. Do not start
another Meteor or Compose application process on port 3200.

## First Admin And Content Pass

After the first local startup:

1. Sign in at `http://localhost:3200` using the local admin credentials from `deploy/local-hotfix/agent-secrets.env`.
2. Open the content upload or content management area from the app navigation.
3. Use a small local TDF/config package for smoke testing. Public TDF authoring concepts are summarized in [authoring.md](authoring.md); canonical project content lives outside this repository in the MoFaCTS configuration/content repository used by maintainers.
4. Launch the uploaded or available lesson from the home/practice dashboard and complete a few trials.
5. Re-run the checks that match your change:

   ```powershell
   cd ..\mofacts
   npm run typecheck
   npm run lint
   ```

The localhost hotfix watcher is not release confidence. Production validation
and deployment remain separate workflows.

## Common Checks

```bash
npm run lint
npm run typecheck
```

The full TypeScript check is the required TypeScript verification path for app code changes.

## Tests

The repository defines test scripts in `mofacts/package.json`. Some local Meteor workflows may require additional environment setup. For release preparation, record any test limitations explicitly rather than treating a narrowed check as full release confidence.

CI owns `npm run test:ci`. The workflow supplies an explicit checked-in test
settings file and launches Chromium through the configured Meteor browser
driver, so both server and client tests execute. The test runner owns the fixed
test-process contract: database name `meteor`,
`METEOR_REACTIVITY_ORDER=changeStreams`, `DDP_TRANSPORT=sockjs`,
Playwright/Chromium, and non-self-hosted/no-Redis mode. `MONGO_URL` remains
owned by Meteor's local test database or CI's replica-set container. A local
invocation requires fresh maintainer authorization.
The source-owned browser-test package makes that Playwright contract portable
across the supported Linux CI job and an explicitly authorized Windows run.
Meteor resolves the dynamically selected test driver into `.meteor/versions`
during a test run. The repository runner removes only those test-driver entries
when it exits, while lint and the pre-commit hook reject any such entries left
in the application dependency manifest. Do not commit these `meteortesting:*`
resolutions as application dependencies.
Never overwrite a private `settings.json` or describe a narrower local check as
equivalent coverage.

## Modify Or Add A Unit Type

Production unit behavior lives in `learning-components/`, not in the scaffold package under `packages/unit-engine-api`.

Start here:

- `../learning-components/README.md`: current component package checklist.
- `architecture.md`: application boundaries.
- `learning-component-contracts.md`: manifest and capability rules.
- `../learning-components/units/createUnitEngine.ts`: unit-engine creation facade.
- `../learning-components/units/*/manifest.ts`: existing unit manifests.
- `../learning-components/defaultLearningComponentCatalog.ts`: default in-repo component catalog.

For a small change to an existing unit, edit the relevant folder under `../learning-components/units/`, update its tests, and keep Meteor routing, publications, collections, authorization, and app shell UI in `mofacts/`.

For a new production unit type:

1. Create `../learning-components/units/<unit-name>/`.
2. Add a manifest that declares the unit type and required runtime capabilities.
3. Add the unit engine/runtime code behind explicit dependencies.
4. Register the manifest in `../learning-components/defaultLearningComponentCatalog.ts` only when it should ship by default.
5. Add focused tests for manifest registration, missing-capability failure, and runtime behavior.
6. Run:

   ```powershell
   cd mofacts
   npm run typecheck
   npm run lint
   ```

If the change alters TDF fields, generated schemas, or authoring expectations, update the authoring docs and run the schema generation workflow described by the changed code path.

## Docker Build and Deployment

The canonical build and deployment workflow lives in `deploy/`. Do not substitute a local Meteor build for release-confidence deployment validation.

Do not run Docker build, push, or deploy commands unless a maintainer explicitly asks for that task.

## Android Web-App Support

MoFaCTS supports installation from an Android browser as a web app. This uses
the ordinary browser build and does not require Meteor's Cordova `android`
platform, an APK/AAB artifact, an Android SDK, or release signing.

## Documentation Updates

Update documentation when a change affects:

- setup or runtime requirements,
- TDF structure or authoring expectations,
- user-facing behavior,
- deployment or configuration,
- release process,
- public terminology.

Use "adaptive learning system" for public project descriptions.

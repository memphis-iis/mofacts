# MoFaCTS Deployment Workflow

This folder contains executable deployment examples and scripts for MoFaCTS. Human-facing self-hosted operator docs start at `../docs/deployment/self-hosted-guide.md`.

## Contents

- `docker-compose.yml`: canonical Self-Hosted MoFaCTS app, authenticated MongoDB, and Redis runtime.
- `docker-compose.local.yml`: local supporting-service overrides, including the
  MongoDB host port used by the source watcher.
- `docker-compose.change-streams-qualification.yml`: test-only stable-3.5.0
  Change Streams recovery qualification override; it is not part of the
  production path.
- `.env.self-hosted.example`: shareable self-hosted environment template. Copy it to ignored `.env.self-hosted`.
- `settings.self-hosted.example.json`: shareable self-hosted settings template. Copy it to ignored private settings before use.
- `.env.local.example`: shareable local environment template. Copy it to ignored `.env.local` for machine-specific values.
- `settings.local.example.json`: shareable local settings template. Copy it to
  ignored `settings.local.json`, or point `.env.local` at another private path.
- The canonical localhost watcher reads the private settings path from `.env.local`; self-hosted containers mount their private settings at runtime.
- `docker/`: scripts copied into the app image.
- `hotfix-local.ps1`: the sole localhost source-watcher start, restart, status,
  logs, and stop command.
- `hotfix/`: scripts used by the local Meteor/Rspack watcher.
- `SERVER_IMAGE_DEPLOY_RUNBOOK.md`: server deployment runbook.
- `../docs/deployment/mongodb-replica-set-conversion.md`: maintenance, recovery, and future-expansion runbook for the in-place replica-set conversion.
- `server-deploy-validate.sh`: remote rollout validation helper.
- `security-audit/`: root-owned, read-only forced-command host audit and protected configuration example. See `../docs/deployment/security-audit.md`.
- `start-lan-https.ps1`, `stop-lan-https.ps1`, `Caddyfile.local`: local LAN HTTPS helpers.
- `build-timed.ps1`: optional timing wrapper around Docker Compose builds.

## Build Context

Run Docker Compose from this folder.

`docker-compose.yml` sets the build context to `../`, which resolves to the repository root that contains the application Dockerfile.

Private settings files under `deploy/` are ignored by Docker build context. Production and self-hosted settings must be copied to the server separately and mounted into the app container at `/run/mofacts/settings.json`.

The Meteor build stage configures Git to fetch the existing public `unetworking/uWebSockets.js` repository through HTTPS, including when npm supplies its SSH-form URL. The repository and dependency ref are unchanged. This build-stage-only setting is not copied into the runtime image and does not alter workstation Git configuration. No SSH package, key, alternate repository or additional retry loop is required; HTTPS failures still fail the build. The transport regression is covered by `npm run security:test:source`.

## Self-Hosted Operator Path

Start with the docs, then use these tracked examples:

```bash
cd deploy
cp .env.self-hosted.example .env.self-hosted
cp settings.self-hosted.example.json settings.self-hosted.json
```

Replace every placeholder before startup. Create the private MongoDB replica-set
keyfile named by `MONGO_REPLICA_SET_KEYFILE_HOST_PATH`; for example, on a Linux
host:

```bash
sudo install -d -m 700 /etc/mofacts
openssl rand -base64 756 | tr -d '\n' | sudo tee /etc/mofacts/mongodb-keyfile >/dev/null
sudo chmod 600 /etc/mofacts/mongodb-keyfile
```

The keyfile is a cluster secret. Keep the same value when adding future members
and never commit or print it. The application `MONGO_URL` must use the configured
replica-set name, for example by including `replicaSet=mofacts-rs` along with the
existing app-user credentials and `authSource`.

The canonical Compose path starts MongoDB with replica-set member
authentication and runs an idempotent initializer. On a fresh volume it creates
the app users and then initializes the set. On an existing standalone volume it
preserves the data and users, starts that volume as the first member, and
initializes the set. That existing-volume conversion is a maintenance action:
stop writers and verify a restorable backup before running it on a live server.
The initial one-member set enables replica-set features but does not provide
host failover. Its explicit set/member configuration supports adding members or
migrating to a parallel replica-set target later.

The app validates settings, MongoDB authentication, the exact replica-set
identity, authenticated Redis configuration, and storage paths and fails clearly
when required values are missing. `MOFACTS_REDIS_PASSWORD` is the single
operator-owned Redis credential: Compose uses it for Redis `requirepass`, its
authenticated healthcheck, and the private application `REDIS_URL`. Generate a
URL-safe random value of at least 32 characters and never commit it.

## Local Settings

Keep private settings and secrets out of commits. Use local environment files and local settings files for deployment-specific values.

Production security-audit report ingestion requires `MOFACTS_SECURITY_AUDIT_INGEST_SECRET` in the private app environment. It must exactly match the protected GitHub environment secret `AUDIT_REPORT_INGEST_SECRET`; never place either value in a tracked file.

For local Docker Compose validation, start from the tracked template:

```bash
cp .env.local.example .env.local
```

Create the ignored local keyfile once from PowerShell:

```powershell
.\New-MongoReplicaSetKeyfile.ps1
```

Replace the MongoDB URL placeholder in `.env.local`. The sole application runs
inside Docker, so its opaque URL uses `mongodb:27017` and
`replicaSet=mofacts-rs` (or the same custom name configured by
`MOFACTS_MONGO_REPLICA_SET_NAME`). There is no native application URI.

Create the ignored private settings file named by `METEOR_SETTINGS_HOST_PATH`:

```powershell
Copy-Item settings.local.example.json settings.local.json
```

Start from `settings.local.example.json`, then replace placeholders. The launcher fails clearly if the settings path is missing or invalid.

The LAN HTTPS helper also requires an explicit Caddy executable path:

```powershell
$env:MOFACTS_CADDY_EXE = 'C:\Path\To\caddy.exe'
.\start-lan-https.ps1
```

The normal local application URL remains `http://localhost:3200`. The LAN
HTTPS helper intentionally reserves `https://localhost:3000` as the only local
port-3000 exception and proxies it to the application on port 3200.

## Typical Local Validation

Validate the canonical definition without printing resolved secrets:

```bash
cd deploy
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml config --quiet
```

For an explicitly isolated Change Streams qualification, append both the
rehearsal and qualification overlays:

```bash
docker compose -p mofacts-cs-qualification --env-file .env.local \
  -f docker-compose.yml -f docker-compose.rehearsal.yml \
  -f docker-compose.change-streams-qualification.yml config
```

The qualification overlay sets the test-only
`MOFACTS_CHANGE_STREAMS_QUALIFICATION=true` flag with the exact driver order
`changeStreams`. The application rejects polling and all alternate observer
drivers, keeps SockJS and disconnect grace zero, and reports the selected
qualification mode at startup. Ordered or otherwise incompatible reactive
observers are defects: they must be redesigned or made explicitly
non-reactive, never routed to polling. Do not add this overlay to a production
Compose command unless the qualification gate passes and the production change
is separately authorized.

The opt-in client/server regression matrix is exercised by the manually
triggered `Meteor 3.5 Change Streams qualification` GitHub Actions workflow.
That workflow installs stable Meteor 3.5, starts a disposable MongoDB 8
one-member replica set, selects the qualification overlay's exact environment
contract, and runs the existing supported Linux Meteor/Playwright test path.
It is intentionally separate from ordinary CI because its purpose is to
exercise fault/restart qualification. Triggering the
workflow is an explicit test authorization; it does not deploy or modify a
protected database.

Build, push, and deploy commands should be run only by maintainers or release owners with the appropriate environment access.

## SPARC OpenRouter Prefix Caching

“Improve prompt caching” is an on/off checkbox in User Admin alongside the global OpenRouter API key, model, and reasoning controls. It defaults to off for existing and new settings. Enabling it sends OpenRouter's top-level `session_id` for SPARC requests so related calls stay on one provider route; disabling it omits that field. Provider prompt caching may still occur automatically when this option is off, and enabling it does not guarantee lower total cost because output tokens and completed turns also affect cost. Changes apply to subsequent requests without rebuilding or restarting the server. The ID is generated randomly in the dialogue runtime, is stable only for one TDF/attempt/page scope (or one live-evaluation run), and contains no learner, attempt, TDF, or content-derived identity. It is never written to AI-flow logs.

This setting changes only provider cache locality. It does not change prompt messages, message order, structured-output schemas, model selection, reasoning, sampling, response handling, or provider fallback routing. It does not enable whole-response caching, response replay, explicit cache breakpoints, or provider-specific cache policy.

AI-flow telemetry records request counts indirectly through events plus prompt, cached-prompt, cache-write, completion, and total tokens; cache-read ratio; reported cache discount and cost; provider; model; operation; duration; and whether the session ID was applied. The live-evaluation artifact additionally aggregates these usage values for scoring and utterance separately, reports session-ID application counts and normalized cost per request and dialogue turn, and uses `null` when OpenRouter did not report a cache discount. These summaries exclude prompts, learner text, raw responses, credentials, account identifiers, attempt identifiers, TDF identifiers, and the session ID.

To stop sending the sticky-session routing hint, clear the checkbox in User Admin. No data cleanup, prompt change, rebuild, or server restart is required.

`server-deploy-validate.sh` can make an operator-provided readiness probe mandatory after the container reaches running state:

```bash
READINESS_COMMAND='./run-admin-readiness-check.sh' ./server-deploy-validate.sh --require-readiness --image repo/mofacts:tag
```

The readiness command must call the admin-only deployment readiness path for that environment, such as an authenticated browser/DDP check against `/admin/tests`. The script fails the rollout when `--require-readiness` is set and no command is provided, or when the command exits non-zero.

## Canonical Local Hotfix Server

There is exactly one supported local application server: the source-watching
Meteor/Rspack hotfix server at `http://localhost:3200`. It is owned by
`hotfix-local.ps1`. Docker Compose supplies MongoDB and replica-set
initialization; it does not run another localhost application container. Do not
add another port-3200 application path.

Prepare `.env.local` and the private settings file named by its
`METEOR_SETTINGS_HOST_PATH`, then run:

```powershell
cd deploy
.\hotfix-local.ps1
```

That command validates the pinned Meteor tool and Compose configuration before
cleanup, starts the local MongoDB replica set, and launches one supervisor for
the native Meteor/Rspack process tree. MongoDB must first pass four consecutive
writable-primary and authenticated-access checks. A MongoDB pool loss during
Meteor startup gets exactly one clean, archived retry; recurring failures stay
visible. The manager then waits for the app and HMR endpoints
and creates or verifies the local admin. Subsequent source edits rebuild and
reload automatically; rerun the command only to restart the watcher itself.

Its management actions are:

```powershell
.\hotfix-local.ps1 status
.\hotfix-local.ps1 logs
.\hotfix-local.ps1 stop
```

`status` reports the supervisor and Meteor ownership, stale PID or obsolete
helper state, app and bundle readiness, HMR, Change Streams, and a
bounded summary of the last recognized failure. Previous run logs are retained
under ignored `deploy/local-hotfix/runs/`. Local admin credentials are stored only in ignored
`deploy/local-hotfix/agent-secrets.env`. This workflow is local verification,
not release confidence; production remains a separately authorized path.

## Security Notes

- Do not commit private keys, SAML certificates, database credentials, or production settings.
- Keep MongoDB private to the deployment network.
- Use HTTPS for exposed deployments.
- Review `SECURITY.md` before exposing a deployment to learners, instructors, or research participants.

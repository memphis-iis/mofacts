# Self-Hosted Settings Inventory

This inventory classifies the self-hosted configuration surface used by application code, startup validation, deployment scripts, and operator examples. The operator-facing reference remains `settings-reference.md`; this file is the release-readiness audit view.

## Meteor Settings

| Setting | Classification | Required When | Consumers |
| --- | --- | --- | --- |
| `ROOT_URL` | required, private-server, deployment-specific | self-hosted production | startup validation, readiness, SAML URL derivation, password reset links |
| `owner` | required, private-server, deployment-specific | self-hosted production | startup validation, first-admin readiness, server utilities |
| `initRoles.admins` | required, private-server, deployment-specific | self-hosted production | startup validation, first-admin role assignment |
| `initRoles.teachers` | optional, private-server, deployment-specific | when pre-seeding teacher roles | role bootstrap flow |
| `encryptionKey` | required, private-server, secret | always for self-hosted production | API/key encryption helpers |
| `prod` | optional, private-server | production behavior flag | email default behavior and startup mode |
| `enableEmail` | optional, private-server | required to send mail deliberately | startup validation and server email helpers |
| `MAIL_URL` | production-only, private-server, secret | when `enableEmail` or `prod` enables mail | Meteor mail transport |
| `emailFrom` | production-only, private-server, deployment-specific | when `enableEmail` or `prod` enables mail | startup validation, account verification, password reset, system mail |
| `emailReplyTo` | optional, private-server, deployment-specific | when operators want replies to go to an admin mailbox | system mail reply-to |
| `mturkSandbox` | optional integration, private-server | MTurk workflows | auth/support and MTurk workflow methods |
| `auth.allowPublicSignup` | required, private-server/public behavior | self-hosted production | signup method guard |
| `auth.requireEmailVerification` | required, private-server/public behavior | self-hosted production | auth state and verification flow |
| `auth.argon2Enabled` | required, private-server | self-hosted production | password hash runtime |
| `auth.enableBreachedPasswordScreening` | optional, private-server | when screening is enabled | auth settings template; not required by open-core validation |
| `google.clientId`, `google.secret` | optional integration, private-server, secret | when Google OAuth is enabled | OAuth settings validation |
| `microsoft.clientId`, `microsoft.secret` | optional integration, private-server, secret | when Microsoft OAuth is enabled | OAuth settings validation |
| `saml.memphis.*` | optional integration, private-server, secret-capable | when Memphis SAML is enabled | SAML metadata/config helpers |
| `openCore.requireRedis` | required, private-server | completed self-hosted runtime | Redis validation and Redis boundary creation |
| `openCore.redisUrl` | optional, private-server, secret-capable | only if not using `REDIS_URL` | Redis boundary creation |
| `storage.backend` | optional, private-server | defaults to `local`; `s3` enables object storage | storage boundary, readiness, package and media paths |
| `storage.local.dynamicAssetsPath` | required for deployed local storage, private-server | local uploaded-asset storage | FilesCollection, dynamic asset route, storage boundary, readiness, backup and restore |
| `storage.s3.*` | optional integration, private-server, secret-capable | S3-compatible storage backend | storage boundary and readiness |
| `public.systemName` | public-client | required initial identity | one-time Brand Profile initialization; published Brand Profile owns runtime identity afterward |
| `public.forceSSL` | public-client | public HTTPS deployments | client SSL redirect behavior |
| `public.packages.accounts.clientStorage` | required, public-client auth behavior | all supported runtimes | Meteor Accounts credential persistence; must be `session` for per-tab authentication |
| `public.sourceUrl` | public-client | initial source traceability | one-time Brand Profile initialization; published legal destination owns runtime source access afterward |
| `public.socialPreview.*` | public-client | optional preview layout | social-preview type, URL, dimensions, and crawler behavior; published Brand Profile owns title, description, image, and image alt text |
| `debug` | development-only/private-server | local debugging | settings template only |

## Environment Variables

| Variable | Classification | Required When | Consumers |
| --- | --- | --- | --- |
| `METEOR_SETTINGS_FILE` | required, private-server | container startup | pre-start Meteor settings loader, startup validation, readiness |
| `METEOR_SETTINGS_HOST_PATH` | required, deployment file | Compose host mount | Compose and backup script |
| `ROOT_URL` | required, deployment-specific | self-hosted production | Meteor runtime and settings validation |
| `PORT` | required, deployment file | app container | Compose/app runtime |
| `MOFACTS_HTTP_BIND` | optional, deployment file | direct app port binding | Compose port binding |
| `MONGO_URL` | required, private-server, secret | app runtime | Meteor MongoDB connection, readiness, validation |
| `EXPECTED_MONGO_DB_NAME` | required, private-server | self-hosted production | settings validation and readiness |
| `MOFACTS_MONGO_REPLICA_SET_NAME` | required, private-server | self-hosted MongoDB replica set | MongoDB startup, initialization, and exact-topology readiness |
| `MOFACTS_MONGO_REPLICA_SET_MEMBER` | required, deployment file | initial replica-set member | initial `rs.initiate` configuration; later expansion remains explicit |
| `MONGO_REPLICA_SET_KEYFILE_HOST_PATH` | required, deployment secret path | self-hosted MongoDB replica set | read-only source for internal member-authentication key |
| `MOFACTS_SELF_HOSTED` | required, private-server | self-hosted production | settings validation and readiness |
| `METEOR_REACTIVITY_ORDER` | required, runtime behavior | Meteor 3.5 reactivity owner | Must be `changeStreams`; polling and all alternate reactive drivers are prohibited |
| `DDP_TRANSPORT` | required, runtime behavior | Meteor 3.5 contained base | DDP transport selection; must be `sockjs` |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` | required, deployment secret | MongoDB bootstrap | Compose MongoDB init |
| `MOFACTS_MONGO_APP_DATABASE`, `MOFACTS_MONGO_APP_USERNAME`, `MOFACTS_MONGO_APP_PASSWORD` | required, deployment secret | MongoDB app user bootstrap | Mongo init script and Compose |
| `MOFACTS_REDIS_PASSWORD` | required, private-server, secret | self-hosted Redis | Compose Redis `requirepass`, authenticated healthcheck, and application URL construction |
| `REDIS_URL` | generated private-server runtime value | when Redis is required | Redis boundary and readiness; Compose constructs it from `MOFACTS_REDIS_PASSWORD` |
| `MOFACTS_SECURITY_AUDIT_INGEST_SECRET` | required in production, private-server, secret | security audit report ingestion | HMAC authentication for `/internal/security-audits/v1` |
| `MOFACTS_REQUIRE_REDIS` | optional, private-server | env override for Redis requirement | settings validation and Redis boundary |
| `MOFACTS_DEFAULT_THEME_DIR`, `MOFACTS_THEME_DIR` | optional, private-server | theme customization | theme registry |
| `MOFACTS_INSERT_HISTORY_TIMING` | development-only/private-server | server diagnostics | bounded history-write timing, size, schema, field-presence, and event-category metadata; never raw learner-history values |
| `RUN_CONVERT_SCRIPT` | development-only | direct conversion script runs | conversion helper |
| `DOCKER_REGISTRY`, `IMAGE_NAME`, `IMAGE_TAG` | deployment file | image build/pull paths | Compose image naming |
| `READINESS_COMMAND`, `REQUIRE_READINESS` | release/deploy validation | deployment validation helper | `server-deploy-validate.sh` |
| `MOFACTS_PROD_SSH_KEY`, `MOFACTS_PROD_SSH_HOST`, `MOFACTS_PROD_BASE_URL` | private operator values | production sidecar helper | MCP sidecar production script |

## Deployment Files

- `deploy/settings.self-hosted.example.json`: sanitized self-hosted Meteor settings template. Operators copy it to an ignored private file.
- `deploy/.env.self-hosted.example`: sanitized self-hosted Compose environment template. Operators copy it to an ignored private file.
- `deploy/settings.local.example.json` and `deploy/.env.local.example`: local/dev examples only.
- `deploy/docker-compose.yml`: canonical self-hosted Compose runtime with authenticated MongoDB and Redis.
- `deploy/docker-compose.local.yml`, `deploy/docker-compose.hotfix-*`: local developer/hotfix loops, not public production defaults.

## Hygiene Status

- Public templates intentionally contain example domains and replacement markers.
- The release readiness scan checks for common committed secrets, required source artifacts, and private local paths.
- Runtime startup validation rejects missing required settings and placeholder values for self-hosted production.

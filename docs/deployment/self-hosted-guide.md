# Self-Hosted MoFaCTS Guide

Self-Hosted MoFaCTS runs the app, authenticated MongoDB, Redis, and local dynamic assets on one Docker Compose host. Direct HTTP is for local or LAN evaluation. Public deployments should bind the app to localhost and expose HTTPS through a reverse proxy.

## Files

- `deploy/docker-compose.yml`: canonical self-hosted runtime.
- `deploy/.env.self-hosted.example`: environment template.
- `deploy/settings.self-hosted.example.json`: private Meteor settings template.
- `deploy/Caddyfile.self-hosted.example`: HTTPS reverse proxy example.
- `docs/deployment/settings-inventory.md`: release-readiness classification for settings and environment variables.
- `docs/deployment/security-audit.md`: protected periodic confidentiality and account-compromise audit setup.

## Configure

From `deploy/`, copy the examples to private ignored files:

```bash
cp .env.self-hosted.example .env.self-hosted
cp settings.self-hosted.example.json settings.self-hosted.json
```

Edit both files. Replace every placeholder, especially passwords, `ROOT_URL`,
`MAIL_URL`, `owner`, `emailFrom`, `initRoles.admins`, and `encryptionKey`.
`METEOR_SETTINGS_HOST_PATH` must point to the private settings file. Create the
private replica-set keyfile named by `MONGO_REPLICA_SET_KEYFILE_HOST_PATH`, and
make `MONGO_URL` include the same `replicaSet` value as
`MOFACTS_MONGO_REPLICA_SET_NAME`. The app fails startup when required settings
are missing, examples are still present, MongoDB is unauthenticated or connected
to the wrong replica set, or Redis is required, unauthenticated, or unavailable.
Set `MOFACTS_REDIS_PASSWORD` to a URL-safe random value of at least 32 characters;
Compose uses that one value for Redis and the application's private connection URL.

For an existing standalone data volume, follow
`docs/deployment/mongodb-replica-set-conversion.md` rather than treating normal
startup as an unreviewed live conversion.

The SPARC OpenRouter sticky-session optimization is disabled by default. An administrator can enable or disable “Improve prompt caching” alongside the global OpenRouter key, model, and reasoning controls in User Admin. The option improves provider-route consistency; provider caching may still happen automatically when it is off. Changes apply to subsequent requests without rebuilding or restarting the server. Follow the telemetry and privacy guidance in `deploy/README.md`.

The admin backup control plane writes local archives to `/backups` inside the app container. Compose mounts `MOFACTS_BACKUP_HOST_PATH` there, defaulting to `/backups/mofacts` on the host. Create and protect that host directory before production use, then copy completed archives off-server. A backup stored only on the same server does not protect against server loss, disk loss, hosting-account loss, or accidental deletion of the backup directory.

For email verification deliverability, set `emailFrom` to an address on a domain authenticated with your SMTP provider, for example `Learning Lab <no-reply@your-domain.example>`, and use `emailReplyTo` for the admin contact address. Do not send production verification mail from a personal Gmail address through a separate SMTP provider.

`storage.backend` defaults to `local`. To use S3-compatible object storage, set `storage.backend` to `s3` and configure `storage.s3.endpoint`, `bucket`, `region`, `accessKeyId`, and `secretAccessKey`. Optional `storage.s3.prefix` scopes object keys for one MoFaCTS instance, and `storage.s3.forcePathStyle` defaults to `true` for MinIO-style endpoints. Readiness writes and deletes a temporary object, so the configured credentials need object write, read, head, list-prefix, and delete permissions.

## Start

```bash
cd deploy
docker compose --env-file .env.self-hosted -f docker-compose.yml config
docker compose --env-file .env.self-hosted -f docker-compose.yml up -d
```

After startup, sign up with the email configured as `owner` and included in `initRoles.admins`. The existing login/startup role-assignment flow grants that account the admin role. Then open `/admin/tests` and run Deployment Readiness.

Before inviting users or publicizing the URL, open **Theme → Branding and Landing Page** as that administrator. Complete every supported language, identity/icon asset, landing-page option, and legal destination, then publish the Brand Profile. Use its preview and public `/legal` page to confirm that the deployment identity and software license/source access are correct. Brand Profile publication is deployment-wide and independent of users' visual-theme choices.

## State

Back up all of these together:

- MongoDB data volume.
- MongoDB replica-set keyfile and database-scoped users/roles.
- `.env.self-hosted` and private settings JSON.
- The private `MOFACTS_REDIS_PASSWORD` used by Redis and the application.
- A private `MOFACTS_SECURITY_AUDIT_INGEST_SECRET` value when scheduled audit reports will be shown in the admin interface.
- Dynamic assets mounted at `/dynamic-assets`.
- SAML/OAuth certificate or key material when configured.
- Backup archives stored in `MOFACTS_BACKUP_HOST_PATH`; copy these off-server.

When `storage.backend` is `s3`, object storage replaces local dynamic-asset storage for new uploads. Back up the bucket or bucket prefix with MongoDB and configuration. Do not switch an existing local-storage install to S3 until existing DynamicAssets records have S3 metadata or have been re-imported.

Redis is required for the completed open-core runtime, but current Redis dashboard-cache lock state is reconstructable from MongoDB and does not need restore.

## Smoke Test

1. Run readiness checks from `/admin/tests`.
2. Create or sign in as the configured owner/admin.
3. Upload or enable the public world countries system.
4. Launch one learner flow.
5. Confirm dynamic assets load.
6. Run a backup before any upgrade.

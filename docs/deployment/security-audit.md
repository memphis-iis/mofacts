# Periodic Confidentiality and Account-Compromise Audit

MoFaCTS has an observation-only security audit for `https://mofacts.optimallearning.org`. It records evidence about confidentiality, authentication, public and internal exposure, and source security. A red report does not stop services, block traffic, alter a firewall or proxy, deploy code, or change real accounts.

This assessment intentionally excludes backup, restore, uptime, disk health, capacity, and disaster recovery. The scanners remain independent of application deployment, but the application now receives their sanitized reports through one authenticated endpoint so administrators can review them at `/admin/security-audits`.

## Schedule and result semantics

`.github/workflows/production-security-audit.yml` runs:

- Daily at 06:00 UTC: external and host exposure controls.
- Monday at 06:00 UTC: all four sections, adding production authentication and repository/image controls.
- Manually with an `exposure` or `full` scope.

The workflow uses the protected `production-security-audit` GitHub environment, has only `contents:read`, and serializes runs without cancelling an active audit. Every run assembles a bounded, sanitized JSON report, sends it to the application, and encrypts it before uploading it as a 90-day recovery artifact. Plaintext reports and raw scanner output remain ephemeral and are removed from the runner.

An audit with security findings still completes successfully. Missing tools, malformed scanner output, or unavailable fixtures are recorded as execution `ERROR` results; the report is stored and the encrypted artifact is uploaded before the workflow fails. UDP silence is resolved against the host's UDP listener, Docker-publication, and firewall evidence: a completed `open|filtered` probe passes only when those protected host facts confirm that no prohibited UDP service is exposed. Missing or contradictory evidence becomes `ERROR` or `FAIL` rather than a guessed result. Failure to store the report also fails the workflow. Public workflow output contains only generic execution messages and encrypted-artifact metadata.

## Protected GitHub environment

Create a protected environment named `production-security-audit`. Restrict its administrators and add these environment secrets:

| Secret | Purpose |
| --- | --- |
| `AUDIT_SSH_HOST` | Production host's stable Tailscale MagicDNS name. |
| `AUDIT_SSH_USER` | Dedicated account whose key is forced to the audit command. |
| `AUDIT_SSH_PRIVATE_KEY` | Restricted key; it must not be accepted for a shell. |
| `AUDIT_SSH_KNOWN_HOSTS` | Pinned host-key line, created and reviewed out of band. |
| `AUDIT_AUTH_FIXTURES_JSON` | Dedicated synthetic tenant/account IDs and deterministic authorization probes. |
| `AUDIT_IMAPS_PASSWORD` | Password for the dedicated reset-test mailbox only. |
| `AUDIT_REPORT_INGEST_SECRET` | HMAC key shared only with the production application. |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client limited to creating `tag:ci` auth keys. |
| `TS_OAUTH_SECRET` | Secret for the limited Tailscale OAuth client. |

Add `AUDIT_REPORT_ENCRYPTION_PUBLIC_KEY` as a protected environment variable. It is an RSA public key, not a secret. The matching private key must remain solely with authorized operators and must never be placed in GitHub, the production server, the application settings, or source control.

Generate the encryption key pair on an operator-controlled machine:

```powershell
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out mofacts-security-audit-private.pem
openssl pkey -in mofacts-security-audit-private.pem -pubout -out mofacts-security-audit-public.pem
```

Copy the complete public PEM into `AUDIT_REPORT_ENCRYPTION_PUBLIC_KEY`. Protect the private key with the same care as an administrative credential. Report encryption uses RSA-OAEP-SHA256 to wrap a random AES-256-GCM content key; the private key is never available to the runner.

Do not put real administrator, teacher, or learner credentials in the protected environment. The browser runner may use only the audit tenant and synthetic identities. The Sidecar is not invoked by the workflow.

Generate the ingestion key on an operator-controlled machine and place the same value in the protected GitHub environment as `AUDIT_REPORT_INGEST_SECRET` and in the production app environment as `MOFACTS_SECURITY_AUDIT_INGEST_SECRET`:

```powershell
openssl rand -base64 48
```

Do not put the value in source control, workflow logs, application settings JSON, or shell history. The endpoint accepts only `application/json`, limits requests to 2 MiB, requires an HMAC-SHA256 signature over the timestamp, nonce, and body digest, rejects timestamps outside five minutes, and rejects reused nonces, report IDs, and report digests.

`AUDIT_AUTH_FIXTURES_JSON` must describe two learners, two teachers, a synthetic audit administrator, reset, expiry, and lockout identities; an existing incomplete passwordless-study participant; IMAPS host/user/mailbox; method, publication, route, and download authorization probes; canary values; at least 12 unique connection-throttle identifiers; and at least 21 unique IP-throttle identifiers. The reset identity has two audit-only passwords and alternates between them across runs.

Authorization evidence uses stable actor-and-surface probe IDs. Passwordless containment reports each sealed-target boundary as its own control with impact-specific severity and treats anonymous resume-token issuance as required behavior. Enumeration uses symmetric synthetic identifier buckets and records normalized result categories for each attempt; a rate-limited comparison is inconclusive rather than a pass or vulnerability finding. Reset expiration is tested only with a mailbox token demonstrably older than the configured one-hour lifetime; absence of an old-enough token is inconclusive, not a vulnerability. Throttling evidence recognizes the server's `rate-limit` response category and records bounded final categories without identifiers or credentials.

## Restricted host command

Install the tracked script as a root-owned executable and its configuration as root-only data:

```bash
sudo install -d -o root -g root -m 0755 /usr/local/libexec/mofacts-security-audit
sudo install -o root -g root -m 0644 deploy/security-audit/host-listener-policy.awk /usr/local/libexec/mofacts-security-audit/host-listener-policy.awk
sudo install -o root -g root -m 0644 deploy/security-audit/host-firewall-policy.awk /usr/local/libexec/mofacts-security-audit/host-firewall-policy.awk
sudo install -o root -g root -m 0755 deploy/security-audit/host-exposure-audit.sh /usr/local/sbin/mofacts-host-exposure-audit
sudo install -d -o root -g root -m 0700 /etc/mofacts
sudo install -o root -g root -m 0600 deploy/security-audit/security-audit.conf.example /etc/mofacts/security-audit.conf
sudoedit /etc/mofacts/security-audit.conf
```

Replace every example value. Configure the private SSH management interface and tailnet ranges, current container names, the expected MongoDB replica set and database, scoped app/Sidecar MongoDB users, a MongoDB audit credential, the Redis audit password, and the active enabled Apache HTTPS site. Missing settings or tools produce audit errors.

Restrict the dedicated SSH public key to the forced command:

```text
restrict,no-pty,no-agent-forwarding,no-port-forwarding,no-X11-forwarding,command="sudo -n /usr/local/sbin/mofacts-host-exposure-audit" ssh-ed25519 PUBLIC_KEY audit
```

Test that the key cannot open a shell, request a PTY, forward a port, or run another command. The host script reads only whitelisted socket, Docker port/network, active Apache HTTPS virtual-host routing, UFW, MongoDB, Redis, running-image, and connectivity information. The root-owned listener policy recognizes IPv4/IPv6 loopback infrastructure, a concrete-interface UDP 68 listener owned by `systemd-networkd`, and `tailscaled` UDP 41641 plus peer listeners bound to Tailscale's reserved IPv4/IPv6 ranges. Wildcard DHCP, non-Tailscale processes on UDP 41641, Tailscale-named listeners on public addresses, and internal-service listeners on tailnet addresses remain findings. The firewall policy reads UFW's canonical saved commands and requires exactly one SSH rule per configured tailnet range on the configured private interface, exactly one public TCP 80 rule and one public TCP 443 rule, active UFW, and default-deny inbound. Reports identify unexpected listener endpoints and process labels plus stable firewall, MongoDB, and Redis sub-probe outcomes and exit categories. The script does not print container environments or credentials and does not change state. Reinstall the host command and both root-owned policy files after scanner updates before relying on the new host evidence format.

Production operator and audit SSH use Tailscale; the EC2 public address is not the management endpoint. Enroll the production host with a stable MagicDNS name and enroll the scheduled GitHub runner ephemerally as `tag:ci`. Tailnet grants must allow the operator identity and `tag:ci` to reach only production TCP 22. Before enabling UFW, prove an operator login and the forced audit command through the MagicDNS name while retaining an existing public SSH maintenance session. Stage UFW rules in this order: SSH on `tailscale0` from `100.64.0.0/10` and `fd7a:115c:a1e0::/48`, public TCP 80, and public TCP 443; then enable default-deny inbound. Only close the maintenance session after a second private operator login, a private forced-command audit, HTTPS/WSS checks, and an external port scan all pass.

The production Compose overlay sets `HTTP_FORWARDED_COUNT=1` because Apache is the single trusted proxy in front of the loopback-only Meteor listener. This is required for `connection.clientAddress` and the IP throttle bucket to represent the originating client rather than Docker's private proxy address. Do not set it on a deployment that accepts direct client traffic or has a different number of trusted proxies. Production also disables Meteor inline runtime scripts, serves MoFaCTS bootstrap script/style files from the same origin, and enforces the tracked CSP. Inline scripts and inline style blocks remain prohibited; `style-src-attr 'unsafe-inline'` is the narrow compatibility exception for the application's reviewed dynamic style attributes. External instructional-resource origins are limited to the HTTPS image, media, and frame hosts present in the tracked content inventory; adding a new embedded resource host requires an explicit CSP review.

The safe-expression rollout is enforced. Author-provided `calculateProbability` formulas and `adaptiveLogic` rules are validated as bounded data at every write and runtime-load boundary, then executed only by the bounded interpreter. The admin Deployment Readiness `tdf.expressions` check scans live units and unit templates in bounded batches and reports only counts plus bounded TDF IDs/field paths—not formula text or learner data. Require that check to pass before every deployment. Invalid authored formulas fail explicitly: there is no JavaScript execution, legacy execution path, or default-model substitution. The production CSP therefore prohibits dynamic JavaScript evaluation and does not include `unsafe-eval`.

The host must provide `bash`, `jq`, `ss`, Docker, UFW, Apache (`apache2ctl` and its systemd unit), and the active enabled HTTPS site configured by `APACHE_HTTPS_SITE_FILE`. MongoDB and Redis probes execute their clients inside the configured containers. Sidecar ports must be absent or exactly `127.0.0.1:8931` and `127.0.0.1:8932`.

The workflow classifies a failure before valid host JSON is received as one of `tailnet-connection-failed`, `ssh-identity-configuration-failed`, `ssh-transport-failed`, `forced-command-rejected`, or `host-output-invalid`. Each category produces a complete sanitized internal section with `ERROR` controls; SSH diagnostics and raw host output are never copied into the report. If `tailnet-connection-failed` appears, first confirm that both `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` exist in the protected environment and that the OAuth client may create ephemeral `tag:ci` devices.

## Synthetic production fixtures

Create a dedicated audit tenant with no real learner data. Provision two learners, two teachers, one synthetic audit administrator, reset/session, expiry, and lockout users plus one existing incomplete passwordless-study participant. Assign only the minimum courses, histories, dashboard state, settings, routes, and exports needed by the configured probes. Seed recognizable non-secret canaries in these synthetic records so the runner can detect cross-user payload and logging leakage without retaining raw responses.

The authorization probe matrix must cover anonymous, self, other learner, teacher, and admin-only behavior across methods, publications, routes, downloads, courses, histories, dashboards, experiment state, settings, and admin surfaces. Brute-force probes run last and may affect only the lockout canary and unique synthetic throttle identifiers.

The IMAPS mailbox must be dedicated to the reset identity. It retains the previous run's reset message long enough to test token expiry, while the current message proves one-time use and replay rejection. Never reuse a personal or production-support mailbox.

## Source and scanner contracts

`npm run security:surfaces` compares every discovered Meteor method, publication, HTTP handler, export, and management route with `mofacts/security-surface-contract.json`. New or removed server surfaces fail until their access classification is reviewed. `npm run security:test:source` tests canonical hashing, redaction, scanner parsers, encryption integrity, malformed/missing evidence handling, and canary detection.

Surface labels describe intended access; they do not enforce it. `public` means intentional anonymous access without a rate-limit claim; `public-rate-limited` additionally requires verified throttling. A passing surface check proves agreement with the current source-discovery patterns, not complete runtime coverage or correct authorization. See the [code-local maintenance notes](../../mofacts/scripts/security-audit/README.md).

An [opt-in build-source capture prototype](../../deploy/security-audit/source-capture.md) is available for separately authorized qualification work. It is not installed in the production command sheet, does not issue release assurance, and has not yet passed real Docker/Windows-to-Linux qualification. Ordinary builds do not require its metadata or tests.

UDP results combine independent external and host evidence without overstating uncertainty. An exact external `open` response is always a finding. A completed scan containing only `closed` or silent `open|filtered` results passes only when the host simultaneously reports zero unexpected UDP listeners, zero Docker UDP publications, active default-deny inbound filtering, and zero unapproved UDP allow rules. Unsafe host evidence is a finding; missing host facts remain `ERROR`. TCP and UDP evidence names the observed address, protocol, port, and state. TLS cipher review parses only enumerated cipher entries and their grades; a normal `compressors: NULL` line is not a weak cipher. Failed reset-token and throttle subprobes use fixed non-secret IDs. Failed authorization probes use deterministic semantic IDs, retain at most 12 sanitized observations, and record how many additional failures were omitted.

Development-only npm advisories remain visible as bounded maintenance evidence but do not fail production posture merely because they exist outside the `--omit=dev` dependency graph. Runtime dependency and built-image controls remain independent security findings. A development advisory becomes a security failure only after its package and advisory ID are added to the strict `development-dependency-exposure.json` policy with a reviewed build/CI exposure rationale. A missing or malformed policy is an audit error rather than an implicit pass.

The regular Security workflow performs a redacted full-history Gitleaks scan, both npm lockfiles' runtime and development-only dependency graphs, and the source contract tests. Gitleaks evidence includes rule, path, line, and abbreviated commit without the secret value. The Monday audit additionally scans an image built from the audited checkout with pinned Trivy and reports installed and fixed package versions. The running production image digest is recorded as informational evidence when the restricted host command can observe it; it does not alter or gate the production deployment.

Exact Gitleaks fingerprints may be added to `.gitleaksignore` only after a value-independent provenance review proves that the occurrence is synthetic, generated vendor content, a false positive, or retired non-production material. Keep the classification visible in this section and never use a path-wide or rule-wide exception.

The two `generic-api-key` detections at `mofacts/.deploy/settings.local.json:4` in commits `403ea082da296f5d7e476cfa99786bfb99ec3015` and `bbb9400da27cc4c74c3024c4d1597a31173a298c` were reviewed on 2026-08-22. They are the same retired local-development encryption key. Historical Compose wiring mounted that file only through `docker-compose.local.yml`; the value differs from the current production, staging, and ignored local encryption keys. It is not an authentication credential, is not used by the deployed application, and cannot be tested against or accepted by a service. No production rotation or history rewrite is required. The two exact fingerprints are ignored so this reviewed local-only material does not obscure new findings; any different commit, line, path, or rule remains reportable.

The report's `sourceRevision` identifies the audit workflow checkout, not a claim that a clean Git tree was deployed to production.
Production image builds set `MOFACTS_SOURCE_REVISION` to the exact 40-character Git commit and preserve it as the OCI `org.opencontainers.image.revision` label. The production deployment must verify that label against the selected release before recording success. The host audit independently records the running image's immutable SHA-256 identity.

## Review and download reports

Administrators review summaries at `/admin/security-audits`. The page shows the latest exposure and full reports, freshness warnings after 36 hours and eight days respectively, section status, severity counts, target, source revision, production image identity, and the recent 90-day history. The collection is never published; full findings are not sent to the page.

JSON and standalone escaped HTML downloads use five-minute, single-use tokens. Every response uses `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and exact-body SHA-256 headers. The JSON contains the canonical report and its report digest.

The encrypted Actions artifact remains a recovery copy. To inspect that copy, download it from the completed Actions run and decrypt it locally from `mofacts/` into a new file:

```powershell
node scripts/security-audit/decrypt-report.mjs C:\path\report.encrypted.json C:\path\report.json C:\secure\mofacts-security-audit-private.pem
```

The decryptor refuses to overwrite an existing output file, authenticates the AES-GCM ciphertext, and verifies the canonical report SHA-256 before writing the plaintext with restrictive permissions where the operating system supports them. Delete decrypted copies when the review is complete.

## First run and interpretation

Do not start the first manual full run until the restricted SSH command works through the stable Tailscale host name, the private-interface UFW policy is active, the encryption public key is configured, and the dedicated mailbox and complete synthetic fixtures exist.

The first strict report may be red. Passwordless experiment sessions are expected to receive anonymous resume tokens; the control tests that those sessions remain contained to the sealed experiment target and cannot reach ordinary-account, cross-user, or administrative surfaces. Other initial findings may include unauthenticated Redis or missing CSP. These are evidence for separately approved remediation; the audit does not change those behaviors.

Treat an `ERROR` as missing authoritative evidence, never as a passing control. The application report history is the primary administrator view; the encrypted artifact is the independent recovery copy. Codex or an operator may interpret findings, but neither path remediates production automatically.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { hardenMeteorNodeStubs } = require('../hardenBundledDependencies.cjs');
import {
  canonicalJson,
  control,
  finalizeReport,
  isExecutionErrorControl,
  sanitizedMetrics,
  sanitizedText,
  section,
} from './audit-lib.mjs';
import { resolveCompositeUdpExposure } from './composite-exposure.mjs';
import {
  boundedBuildExposureObservations,
  classifyDevelopmentDependencyPosture,
} from './dependency-posture.mjs';
import {
  INTERNAL_CONTROL_DEFINITIONS,
  INTERNAL_EXECUTION_CATEGORIES,
  internalExecutionError,
} from './internal-audit-contract.mjs';
import {
  boundedGitleaksObservations,
  boundedNpmAuditObservations,
  boundedNpmFindings,
  boundedTrivyObservations,
  classifyUdpPortStates,
  developmentOnlyNpmFindings,
  findCanaryLeaks,
  countPotentialSensitiveLogStatements,
  parseNmapOpenPorts,
  parseNmapPortStates,
  parseNmapTlsCipherReport,
  parseNpmAuditVulnerabilityCount,
  npmAuditFindings,
  parseTrivyHighCritical,
} from './scanner-parsers.mjs';
import {
  decryptReportEnvelope,
  encryptReportBuffer,
  verifyCanonicalReportDigest,
} from './report-crypto.mjs';
import {
  assertUniqueSemanticProbeIds,
  classifyAuthenticationTiming,
  classifyEnumeration,
  passwordlessContainmentOutcomes,
  routeProbePassed,
  selectExpiredResetLink,
  semanticAuthorizationProbeId,
  throttleResultCategory,
  throttleWasObserved,
} from './authentication-probes.mjs';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('Meteor builder resolves the public uWebSockets repository over HTTPS without changing its ref', () => {
  const recipe = fs.readFileSync(path.join(repositoryRoot, 'Dockerfile'), 'utf8');
  const stage = recipe.split(' AS meteor_builder')[1].split('\nFROM ')[0];
  const settings = [...stage.matchAll(/git config --global --add (url\.\S+\.insteadOf) (\S+)/g)];
  assert.equal(settings.length, 2);
  assert.ok(stage.indexOf('git config --global') < stage.indexOf('meteor update --npm'));
  const args = settings.flatMap((match) => ['-c', `${match[1]}=${match[2]}`]);
  const url = 'https://github.com/unetworking/uWebSockets.js.git';
  for (const source of [url, 'ssh://git@github.com/unetworking/uWebSockets.js.git', 'git@github.com:unetworking/uWebSockets.js.git']) {
    assert.equal(execFileSync('git', [...args, 'ls-remote', '--get-url', source], { encoding: 'utf8' }).trim(), url);
    assert.equal(execFileSync('git', [...args, 'ls-remote', '--get-url', `${source}#v20.66.0`], { encoding: 'utf8' }).trim(), `${url}#v20.66.0`);
  }
  const unrelated = 'ssh://git@github.com/another/repository.git';
  assert.equal(execFileSync('git', [...args, 'ls-remote', '--get-url', unrelated], { encoding: 'utf8' }).trim(), unrelated);
  // Deny HTTPS before network access: failure must remain failure, not use SSH.
  assert.throws(() => execFileSync('git', [...args, '-c', 'protocol.https.allow=never', 'ls-remote',
    'ssh://git@github.com/unetworking/uWebSockets.js.git'], { stdio: 'pipe' }),
  (error) => error.status !== 0 && error.stderr.toString().includes("transport 'https' not allowed"));
});

function runtimeSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSourceFiles(absolutePath);
    if (!/\.(?:[cm]?js|tsx?|svelte)$/.test(entry.name) || /\.(?:test|spec)\.[^.]+$/.test(entry.name)) return [];
    return [absolutePath];
  });
}

function scriptBodies(filePath, source) {
  if (!filePath.endsWith('.svelte')) return [source];
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1] || '');
}

function dynamicEvaluationSites(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  for (const body of scriptBodies(filePath, source)) {
    const sourceFile = ts.createSourceFile(filePath, body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
        findings.push(`${path.relative(repositoryRoot, filePath)}:new Function`);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
        findings.push(`${path.relative(repositoryRoot, filePath)}:Function`);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval') {
        findings.push(`${path.relative(repositoryRoot, filePath)}:eval`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return findings;
}

test('canonical reports hash deterministically and exclude the digest from its payload', () => {
  const sections = Object.fromEntries(['external', 'authentication', 'internal', 'repository'].map((sectionId) => [
    sectionId, { sectionId, status: 'NOT_APPLICABLE', controls: [] },
  ]));
  const input = {
    schema: 'SecurityAuditReportV1', reportId: 'audit-12345678', reportType: 'full',
    startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z',
    target: 'https://mofacts.optimallearning.org', sourceRevision: 'abcdef0', productionImage: `sha256:${'b'.repeat(64)}`,
    toolVersions: { node: '24.15.0' }, sections, executionErrors: [],
  };
  const report = finalizeReport(input);
  const { digestSha256, ...payload } = report;
  assert.equal(digestSha256, crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex'));
  assert.equal(finalizeReport(input).digestSha256, digestSha256);
});

test('redaction removes emails and credential-shaped evidence', () => {
  const result = sanitizedText('user@example.org password=hunter2 Authorization:Bearer-value');
  assert.doesNotMatch(result, /user@example\.org|hunter2|Bearer-value/);
  assert.deepEqual(sanitizedMetrics({ count: 2, passwordValue: 'no', note: 'user@example.org' }), {
    count: 2,
    note: '[redacted-email]',
  });
});

test('nmap parser handles passing, vulnerable, malformed, and missing output', () => {
  const prefix = '<?xml version="1.0"?><nmaprun><host><address addr="192.0.2.2" addrtype="ipv4"/><ports>';
  assert.deepEqual(parseNmapOpenPorts(`${prefix}</ports></host></nmaprun>`), []);
  assert.deepEqual(parseNmapOpenPorts(`${prefix}<port protocol="tcp" portid="6379"><state state="open"/></port></ports></host></nmaprun>`), ['192.0.2.2/tcp/6379']);
  const udp = parseNmapPortStates(`${prefix}<port protocol="udp" portid="53"><state state="open|filtered" reason="no-response"/></port><port protocol="udp" portid="443"><state state="closed"/></port></ports></host></nmaprun>`);
  assert.deepEqual(udp, [
    { endpoint: '192.0.2.2/udp/53', state: 'open|filtered', reason: 'no-response' },
    { endpoint: '192.0.2.2/udp/443', state: 'closed' },
  ]);
  assert.deepEqual(parseNmapOpenPorts(`${prefix}<port protocol="udp" portid="53"><state state="open|filtered"/></port></ports></host></nmaprun>`), []);
  assert.throws(() => parseNmapOpenPorts('<nmaprun>'));
  assert.throws(() => parseNmapOpenPorts(undefined));
});

test('TLS cipher parser ignores NULL compression but rejects weak cipher entries and malformed output', () => {
  const strong = `| ssl-enum-ciphers:\n|   TLSv1.2:\n|     ciphers:\n|       TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (ecdh_x25519) - A\n|     compressors:\n|       NULL\n|_  least strength: A`;
  assert.deepEqual(parseNmapTlsCipherReport(strong), { cipherCount: 1, weakCipherCount: 0 });
  const weak = `| ssl-enum-ciphers:\n|   TLSv1.2:\n|     ciphers:\n|       TLS_RSA_WITH_NULL_SHA (rsa 2048) - F\n|_  least strength: F`;
  assert.deepEqual(parseNmapTlsCipherReport(weak), { cipherCount: 1, weakCipherCount: 1 });
  assert.throws(() => parseNmapTlsCipherReport('| ssl-enum-ciphers:\n| compressors:\n| NULL'));
  assert.throws(() => parseNmapTlsCipherReport(undefined));
});

test('UDP classification distinguishes closed, open, inconclusive, and incomplete scans', () => {
  const closed = [{ endpoint: '192.0.2.2/udp/53', state: 'closed' }];
  assert.equal(classifyUdpPortStates(closed, 1).status, 'PASS');
  assert.equal(classifyUdpPortStates([{ ...closed[0], state: 'open' }], 1).status, 'FAIL');
  assert.equal(classifyUdpPortStates([{ ...closed[0], state: 'open|filtered' }], 1).status, 'ERROR');
  assert.deepEqual(classifyUdpPortStates([{ ...closed[0], state: 'open|filtered' }], 1).inconclusiveEndpoints,
    ['192.0.2.2/udp/53 state=open|filtered']);
  assert.deepEqual(classifyUdpPortStates([{ ...closed[0], state: 'open|filtered', reason: 'no-response' }], 1).inconclusiveEndpoints,
    ['192.0.2.2/udp/53 state=open|filtered reason=no-response']);
  assert.equal(classifyUdpPortStates([], 1).status, 'ERROR');
  assert.equal(classifyUdpPortStates([closed[0], closed[0]], 2).status, 'ERROR');
  assert.throws(() => classifyUdpPortStates(null, 1));
});

test('composite UDP exposure resolves silence only with complete host evidence', () => {
  const externalUdp = (status, metrics = {}) => section('external', [control(
    'external.public-udp-ports',
    'Selected UDP ports are closed',
    status,
    'HIGH',
    status === 'ERROR' ? 'External UDP probes were inconclusive.' : 'External UDP probe result.',
    { observations: ['inconclusive-endpoint: 192.0.2.2/udp/53 state=open|filtered reason=no-response'], metrics },
  )]);
  const internalUdp = ({ listeners = 0, firewallAllows = 0, publications = 0, active = true, deny = true } = {}) => (
    section('internal', [
      control('internal.listening-sockets', 'listeners', listeners ? 'FAIL' : 'PASS', 'HIGH', 'listener evidence', {
        metrics: { unexpectedUdpListenerCount: listeners },
      }),
      control('internal.firewall', 'firewall', active && deny && !firewallAllows ? 'PASS' : 'FAIL', 'HIGH', 'firewall evidence', {
        metrics: { unexpectedUdpAllowRuleCount: firewallAllows, firewallActive: active, defaultDenyInbound: deny },
      }),
      control('internal.docker-ports', 'docker', publications ? 'FAIL' : 'PASS', 'HIGH', 'Docker evidence', {
        metrics: { unexpectedUdpPublicationCount: publications },
      }),
    ])
  );

  const silent = externalUdp('ERROR', { inconclusive: true, inconclusivePortCount: 7 });
  const resolved = resolveCompositeUdpExposure(silent, internalUdp());
  assert.equal(resolved.status, 'PASS');
  assert.equal(resolved.controls[0].status, 'PASS');
  assert.equal(resolved.controls[0].evidence.metrics.inconclusivePortCount, 7);
  assert.equal(resolved.controls[0].evidence.metrics.internalEvidenceComplete, true);

  assert.equal(resolveCompositeUdpExposure(silent, internalUdp({ listeners: 1 })).controls[0].status, 'FAIL');
  assert.equal(resolveCompositeUdpExposure(silent, internalUdp({ firewallAllows: 1 })).controls[0].status, 'FAIL');
  assert.equal(resolveCompositeUdpExposure(silent, internalUdp({ publications: 1 })).controls[0].status, 'FAIL');
  assert.equal(resolveCompositeUdpExposure(silent, internalUdp({ active: false })).controls[0].status, 'FAIL');

  const externallyClosedButContradicted = resolveCompositeUdpExposure(
    externalUdp('PASS', { closedSelectedUdpPortCount: 7 }),
    internalUdp({ deny: false }),
  );
  assert.equal(externallyClosedButContradicted.controls[0].status, 'FAIL');

  const missingHostEvidence = resolveCompositeUdpExposure(silent, section('internal', []));
  assert.equal(missingHostEvidence.controls[0].status, 'ERROR');
  assert.equal(missingHostEvidence.controls[0].evidence.metrics.internalEvidenceComplete, false);

  const confirmedOpen = externalUdp('FAIL', { openSelectedUdpPortCount: 1 });
  assert.equal(resolveCompositeUdpExposure(confirmedOpen, internalUdp()).controls[0].status, 'FAIL');

  const scannerFailure = externalUdp('ERROR', { inconclusive: false });
  assert.equal(resolveCompositeUdpExposure(scannerFailure, internalUdp()).controls[0].status, 'ERROR');
});

test('authentication timing classification uses paired robust samples and rejects malformed evidence', () => {
  const passing = classifyAuthenticationTiming(
    [900, 910, 920, 930, 940],
    [880, 900, 910, 920, 930],
    [100, 110],
    [105, 115],
  );
  assert.equal(passing.status, 'PASS');
  assert.equal(passing.login.differentialMs, 10);
  const failing = classifyAuthenticationTiming(
    [900, 910, 920, 930, 940],
    [80, 90, 100, 110, 120],
    [100, 110],
    [105, 115],
  );
  assert.equal(failing.status, 'FAIL');
  const inconclusive = classifyAuthenticationTiming(
    [1000, 1000, 1000, 10, 10],
    [0, 0, 0, 900, 900],
    [100, 110],
    [105, 115],
  );
  assert.equal(inconclusive.status, 'ERROR');
  assert.equal(inconclusive.login.dominantDirectionCount, 3);
  assert.equal(inconclusive.login.requiredDirectionCount, 4);
  assert.throws(() => classifyAuthenticationTiming([1], [1], [1], [1]));
});

test('inconclusive controls remain visible without becoming execution failures or severity findings', () => {
  const inconclusive = {
    status: 'ERROR', severity: 'HIGH', evidence: { summary: 'No conclusive response.', metrics: { inconclusive: true } },
  };
  assert.equal(isExecutionErrorControl(inconclusive), false);
  assert.equal(isExecutionErrorControl({ ...inconclusive, evidence: { summary: 'Tool failed.' } }), true);
  const sections = { external: { controls: [inconclusive] } };
  const report = finalizeReport({ sections });
  assert.equal(report.counts.error, 1);
  assert.equal(report.counts.high, 0);
});

test('dependency parsers never turn incomplete evidence into a pass', () => {
  assert.equal(parseNpmAuditVulnerabilityCount({ metadata: { vulnerabilities: { high: 0, critical: 0 } } }), 0);
  assert.equal(parseNpmAuditVulnerabilityCount({ metadata: { vulnerabilities: { high: 2, critical: 1 } } }), 3);
  assert.throws(() => parseNpmAuditVulnerabilityCount({}));
  assert.deepEqual(parseTrivyHighCritical({ Results: [{ Vulnerabilities: [] }] }), []);
  assert.deepEqual(parseTrivyHighCritical({ Results: [{ Target: '/app/package-lock.json', Class: 'lang-pkgs', Vulnerabilities: [{ Severity: 'CRITICAL' }] }] }), [
    { Severity: 'CRITICAL', auditTarget: '/app/package-lock.json', auditClass: 'lang-pkgs' },
  ]);
  assert.throws(() => parseTrivyHighCritical({}));
});

test('repository findings expose bounded identifiers without raw scanner evidence', () => {
  assert.deepEqual(boundedGitleaksObservations([
    { RuleID: 'generic-api-key', File: 'mofacts/server/example.test.ts', Secret: 'must-not-appear' },
  ]), ['gitleaks.generic-api-key: mofacts/server/example.test.ts:unknown commit=unknown']);
  assert.deepEqual(boundedNpmAuditObservations({
    vulnerabilities: {
      transitive: { severity: 'moderate', isDirect: false },
      direct: { severity: 'high', isDirect: true },
    },
  }), [
    'npm.direct: severity=high, direct=yes',
    'npm.transitive: severity=moderate, direct=no',
  ]);
  assert.deepEqual(boundedNpmFindings(npmAuditFindings({
    vulnerabilities: {
      direct: {
        severity: 'high',
        isDirect: true,
        via: [{ source: 1234567, title: 'bounded advisory metadata' }, 'transitive-package'],
      },
    },
  })), ['npm.direct: severity=high, direct=yes']);
  assert.deepEqual(npmAuditFindings({
    vulnerabilities: {
      direct: { severity: 'high', isDirect: true, via: [{ source: 1234567 }, { source: 'GHSA-test' }] },
    },
  })[0].advisoryIds, ['1234567', 'GHSA-test']);
  assert.deepEqual(boundedTrivyObservations([
    { VulnerabilityID: 'CVE-2026-1234', PkgName: 'runtime-lib', InstalledVersion: '1.0.0', Severity: 'HIGH', FixedVersion: '2.0.0', auditTarget: '/app/package-lock.json', auditClass: 'lang-pkgs' },
  ]), ['trivy.CVE-2026-1234: package=runtime-lib, installed=1.0.0, fixed=2.0.0, severity=HIGH, class=lang-pkgs, target=/app/package-lock.json']);
  assert.throws(() => boundedGitleaksObservations([{ RuleID: 'generic-api-key' }]));
  assert.throws(() => boundedNpmAuditObservations({}));
  assert.throws(() => boundedTrivyObservations([{ VulnerabilityID: 'CVE-2026-1234' }]));
});

test('development dependency findings exclude runtime packages without mutating source order', () => {
  const all = [
    { name: 'dev-only', severity: 'high', direct: true, advisoryIds: ['1234567'] },
    { name: 'runtime', severity: 'moderate', direct: false, advisoryIds: ['7654321'] },
  ];
  const runtime = [{ name: 'runtime', severity: 'moderate', direct: false, advisoryIds: ['7654321'] }];
  assert.deepEqual(developmentOnlyNpmFindings(all, runtime), [all[0]]);
  boundedNpmFindings(all);
  assert.deepEqual(all.map((finding) => finding.name), ['dev-only', 'runtime']);
});

test('bundled dependency hardening replaces Meteor qs with the reviewed direct version', (t) => {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mofacts-bundled-hardening-'));
  t.after(() => fs.rmSync(packageRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(packageRoot, 'node_modules', 'qs');
  const meteorNodeStubsDirectory = path.join(packageRoot, 'node_modules', 'meteor-node-stubs');
  const targetDirectory = path.join(
    meteorNodeStubsDirectory,
    'node_modules',
    'qs',
  );
  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.writeFileSync(path.join(sourceDirectory, 'package.json'), JSON.stringify({
    name: 'qs',
    version: '6.16.0',
  }));
  fs.writeFileSync(path.join(sourceDirectory, 'implementation.js'), 'reviewed');
  fs.writeFileSync(path.join(meteorNodeStubsDirectory, 'package.json'), JSON.stringify({
    name: 'meteor-node-stubs',
    version: '1.2.29',
  }));
  fs.writeFileSync(path.join(targetDirectory, 'package.json'), JSON.stringify({
    name: 'qs',
    version: '6.15.2',
  }));
  fs.writeFileSync(path.join(targetDirectory, 'implementation.js'), 'upstream');

  assert.equal(hardenMeteorNodeStubs(packageRoot), true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8')).version,
    '6.16.0',
  );
  assert.equal(fs.readFileSync(path.join(targetDirectory, 'implementation.js'), 'utf8'), 'reviewed');
  assert.equal(hardenMeteorNodeStubs(packageRoot), false);
});

test('development advisories are informational unless a reviewed build exposure matches exactly', () => {
  const findings = [{ name: '@rspack/cli', severity: 'moderate', direct: true, advisoryIds: ['1234567'] }];
  const emptyPolicy = { schema: 'DevelopmentDependencyExposurePolicyV1', confirmedBuildExposures: [] };
  assert.deepEqual(classifyDevelopmentDependencyPosture(findings, emptyPolicy, 'application'), {
    status: 'PASS',
    severity: 'INFO',
    confirmed: [],
    maintenanceAdvisoryPackageCount: 1,
  });

  const reviewedPolicy = {
    schema: 'DevelopmentDependencyExposurePolicyV1',
    confirmedBuildExposures: [{
      lockfile: 'application',
      package: '@rspack/cli',
      advisoryId: '1234567',
      rationaleId: 'ci-untrusted-input-rce',
    }],
  };
  const confirmed = classifyDevelopmentDependencyPosture(findings, reviewedPolicy, 'application');
  assert.equal(confirmed.status, 'FAIL');
  assert.equal(confirmed.severity, 'MEDIUM');
  assert.deepEqual(boundedBuildExposureObservations(confirmed.confirmed), [
    'confirmed-build-exposure.@rspack/cli: advisory=1234567, rationale=ci-untrusted-input-rce',
  ]);
  assert.equal(classifyDevelopmentDependencyPosture(findings, reviewedPolicy, 'sidecar-mongo').status, 'PASS');
  assert.throws(() => classifyDevelopmentDependencyPosture(findings, {}, 'application'));
  assert.throws(() => classifyDevelopmentDependencyPosture(
    findings,
    { schema: 'DevelopmentDependencyExposurePolicyV1', confirmedBuildExposures: [{}] },
    'application',
  ));
  assert.throws(() => classifyDevelopmentDependencyPosture(
    findings,
    {
      ...reviewedPolicy,
      confirmedBuildExposures: [
        reviewedPolicy.confirmedBuildExposures[0],
        reviewedPolicy.confirmedBuildExposures[0],
      ],
    },
    'application',
  ));
});

test('canary scanning detects retained secrets without emitting their values', () => {
  const canary = 'AUDIT-CANARY-123456';
  assert.equal(findCanaryLeaks(['safe', `payload:${canary}`], [canary]).length, 1);
  assert.deepEqual(findCanaryLeaks(['safe'], [canary]), []);
});

test('sensitive log scanning distinguishes safe summaries from personal identifiers', () => {
  assert.equal(countPotentialSensitiveLogStatements("serverConsole('count', resultCount);"), 0);
  assert.equal(countPotentialSensitiveLogStatements("serverConsole('Password reset completed successfully');"), 0);
  assert.equal(countPotentialSensitiveLogStatements("serverConsole('reset', normalizedEmail.canonical);"), 1);
  assert.throws(() => countPotentialSensitiveLogStatements(null));
});

test('production authentication policy uses ambiguous errors and a 30-day session maximum', () => {
  const source = fs.readFileSync(new URL('../../server/startup/serverStartup.ts', import.meta.url), 'utf8');
  const timingDefense = fs.readFileSync(new URL('../../server/lib/passwordTimingDefense.ts', import.meta.url), 'utf8');
  const authMethods = fs.readFileSync(new URL('../../server/methods/authMethods.ts', import.meta.url), 'utf8');
  assert.match(source, /Accounts as any\)\.config\(\{[\s\S]*?loginExpirationInDays:\s*30,/);
  assert.match(source, /Accounts as any\)\.config\(\{[\s\S]*?ambiguousErrorMessages:\s*true,/);
  assert.match(source, /_selectorForFastCaseInsensitiveLookup[\s\S]*?fields: \{ _id: 1 \}[\s\S]*?limit: 2/);
  assert.match(source, /_checkPasswordAsync[\s\S]*?equalizeFailedPasswordAttempt\(attempt\.user, password, loginQuery\)/);
  assert.match(source, /method_handlers[\s\S]*?wrapPasswordLoginMethodWithResponseEnvelope/);
  assert.match(timingDefense, /checkPasswordAsync\(DECOY_BCRYPT_USER, password\)[\s\S]*?checkPasswordAsync\(DECOY_ARGON2_USER, password\)/);
  assert.match(timingDefense, /FAILED_PASSWORD_RESPONSE_MIN_MS = 1100/);
  assert.match(timingDefense, /FAILED_PASSWORD_RESPONSE_MAX_MS = 1300/);
  assert.match(timingDefense, /cryptoRandomInt/);
  assert.match(timingDefense, /setTimeout/);
  assert.match(authMethods, /PASSWORD_RESET_RESPONSE_FLOOR_MS = 1000/);
  assert.match(authMethods, /requestPasswordReset:[\s\S]*?try \{[\s\S]*?finally \{[\s\S]*?waitForPasswordResetResponseFloor/);
});

test('public Caddy example sends a one-year HSTS policy', () => {
  const source = fs.readFileSync(new URL('../../../deploy/Caddyfile.self-hosted.example', import.meta.url), 'utf8');
  assert.match(source, /header Strict-Transport-Security "max-age=31536000"/);
});

test('host exposure audit inspects the active Apache HTTPS site rather than inactive Caddy configuration', () => {
  const source = fs.readFileSync(new URL('../../../deploy/security-audit/host-exposure-audit.sh', import.meta.url), 'utf8');
  const config = fs.readFileSync(new URL('../../../deploy/security-audit/security-audit.conf.example', import.meta.url), 'utf8');
  assert.match(config, /^APACHE_HTTPS_SITE_FILE=\/etc\/apache2\/sites-enabled\/000-default-le-ssl\.conf$/m);
  assert.match(source, /systemctl is-active apache2/);
  assert.match(source, /apache2ctl configtest/);
  assert.match(source, /internal\.reverse-proxy-routes/);
  assert.match(source, /mongodb\.unauthenticated-denied/);
  assert.match(source, /redis\.unauthenticated-denied/);
  assert.match(source, /unauth_redis_output=.*redis-cli --no-auth-warning --raw PING/);
  assert.match(source, /grep -Eq '\^NOAUTH\(\[\[:space:\]\]\|\$\)'/);
  assert.match(source, /unauth_redis=2/);
  assert.match(source, /redis\.application-authenticated-connectivity/);
  assert.match(source, /applicationConnectivityProbeExit/);
  assert.doesNotMatch(source, /redis-cli --no-auth-warning PING >\/dev\/null 2>&1; echo \$\?/);
  assert.match(source, /firewall\.default-deny/);
  assert.match(source, /ufw show added/);
  assert.match(source, /host-firewall-policy\.awk/);
  assert.match(config, /^MOFACTS_SSH_MANAGEMENT_INTERFACE=tailscale0$/m);
  assert.match(source, /unexpected_socket_observations/);
  assert.match(source, /host-listener-policy\.awk/);
  assert.match(source, /127\\\.0\\\.0\\\.1:3000/);
  assert.doesNotMatch(source, /CADDY_CONFIG_FILE|internal\.caddy-routes|caddy adapt/);
});

test('production audit reaches the host through a pinned ephemeral Tailscale identity', () => {
  const workflow = fs.readFileSync(new URL('../../../.github/workflows/production-security-audit.yml', import.meta.url), 'utf8');
  assert.match(workflow, /tailscale\/github-action@306e68a486fd2350f2bfc3b19fcd143891a4a2d8 # v4/);
  assert.match(workflow, /oauth-client-id: \$\{\{ secrets\.TS_OAUTH_CLIENT_ID \}\}/);
  assert.match(workflow, /oauth-secret: \$\{\{ secrets\.TS_OAUTH_SECRET \}\}/);
  assert.match(workflow, /tags: tag:ci/);
  assert.match(workflow, /version: 1\.102\.3/);
  assert.match(workflow, /ping: \$\{\{ secrets\.AUDIT_SSH_HOST \}\}/);
  assert.doesNotMatch(workflow, /log-mode:/);
  assert.match(workflow, /AUDIT_TAILNET_OUTCOME: \$\{\{ steps\.tailnet\.outcome \}\}/);
  assert.match(workflow, /AUDIT_SSH_IDENTITY_OUTCOME: \$\{\{ steps\.ssh_identity\.outcome \}\}/);
  assert.match(workflow, /write-internal-execution-error\.mjs/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test('internal transport failures produce complete sanitized section evidence', () => {
  assert.deepEqual(INTERNAL_EXECUTION_CATEGORIES, [
    'tailnet-connection-failed',
    'ssh-identity-configuration-failed',
    'ssh-transport-failed',
    'forced-command-rejected',
    'host-output-invalid',
  ]);
  for (const category of INTERNAL_EXECUTION_CATEGORIES) {
    const result = internalExecutionError(category);
    assert.equal(result.sectionId, 'internal');
    assert.equal(result.status, 'ERROR');
    assert.equal(result.productionImage, 'unknown');
    assert.equal(result.controls.length, INTERNAL_CONTROL_DEFINITIONS.length);
    assert.deepEqual(
      result.controls.map((control) => control.controlId),
      INTERNAL_CONTROL_DEFINITIONS.map(([controlId]) => controlId),
    );
    assert.ok(result.controls.every((control) => control.status === 'ERROR'));
    assert.ok(result.controls.every((control) => control.evidence.metrics.executionCategory === category));
  }
  assert.throws(() => internalExecutionError('unbounded-raw-ssh-error'));
});

function executablePath(fileUrl) {
  const nativePath = fileURLToPath(fileUrl);
  if (process.platform !== 'win32') return nativePath;
  const match = /^([A-Za-z]):\\(.*)$/.exec(nativePath);
  assert.ok(match, `Cannot map fixture path into WSL: ${nativePath}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

function classifyHostListenerFixture(fixtureName) {
  const policy = executablePath(new URL('../../../deploy/security-audit/host-listener-policy.awk', import.meta.url));
  const fixture = executablePath(new URL(`./fixtures/${fixtureName}`, import.meta.url));
  const executable = process.platform === 'win32' ? 'wsl.exe' : 'awk';
  const args = process.platform === 'win32'
    ? ['--exec', 'awk', '-f', policy, fixture]
    : ['-f', policy, fixture];
  return execFileSync(executable, args, { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
}

function classifyHostFirewallFixture(fixtureName) {
  const policy = executablePath(new URL('../../../deploy/security-audit/host-firewall-policy.awk', import.meta.url));
  const fixture = executablePath(new URL(`./fixtures/${fixtureName}`, import.meta.url));
  const executable = process.platform === 'win32' ? 'wsl.exe' : 'awk';
  const policyArgs = [
    '-v', 'management_interface=tailscale0',
    '-v', 'management_cidrs=100.64.0.0/10,fd7a:115c:a1e0::/48',
    '-f', policy,
    fixture,
  ];
  const args = process.platform === 'win32' ? ['--exec', 'awk', ...policyArgs] : policyArgs;
  return execFileSync(executable, args, { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
}

test('host listener policy accepts reviewed loopback, DHCP, Tailscale, web, and SSH fixtures', () => {
  assert.deepEqual(classifyHostListenerFixture('host-listeners-expected.fixture'), []);

  const dangerous = classifyHostListenerFixture('host-listeners-dangerous.fixture');
  assert.equal(dangerous.length, 8);
  assert.ok(dangerous.some((line) => line.includes('0.0.0.0:68')));
  assert.ok(dangerous.some((line) => line.includes('ens5:68')));
  assert.ok(dangerous.some((line) => line.includes('0.0.0.0:3000')));
  assert.ok(dangerous.some((line) => line.includes('[::]:27017')));
  assert.ok(dangerous.some((line) => line.includes('*:6379')));
  assert.ok(dangerous.some((line) => line.includes('rogue-tunnel')));
  assert.ok(dangerous.some((line) => line.includes('52.89.109.53:39580')));
  assert.ok(dangerous.some((line) => line.includes('100.69.46.68:27017')));
});

test('host firewall policy accepts only private-interface SSH and public web rules', () => {
  assert.deepEqual(classifyHostFirewallFixture('host-firewall-expected.fixture'), []);

  const dangerous = classifyHostFirewallFixture('host-firewall-dangerous.fixture');
  assert.equal(dangerous.length, 5);
  assert.ok(dangerous.some((line) => line.includes('ufw allow 22/tcp')));
  assert.ok(dangerous.some((line) => line.includes('on eth0')));
  assert.ok(dangerous.some((line) => line.includes('ufw allow 3000/tcp')));
  assert.ok(dangerous.some((line) => line.includes('fd7a:115c:a1e0::/48=0')));
  assert.ok(dangerous.some((line) => line.includes('443/tcp=0')));
});

test('first-party runtime code and production CSP prohibit dynamic JavaScript evaluation', () => {
  const runtimeRoots = [
    'learning-components',
    'mofacts/client',
    'mofacts/server',
    'mofacts/common',
  ].map((relativePath) => path.join(repositoryRoot, relativePath));
  const findings = runtimeRoots.flatMap(runtimeSourceFiles).flatMap(dynamicEvaluationSites);
  assert.deepEqual(findings, []);
});

test('production hardening assets preserve reviewed findings and remove unnecessary runtime tooling', () => {
  const ignore = fs.readFileSync(new URL('../../../.gitleaksignore', import.meta.url), 'utf8');
  const ignoredFingerprints = ignore.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  assert.equal(ignoredFingerprints.length, 7);
  assert.deepEqual(ignoredFingerprints.filter((line) => line.includes('mofacts/.deploy/settings.local.json')), [
    '403ea082da296f5d7e476cfa99786bfb99ec3015:mofacts/.deploy/settings.local.json:generic-api-key:4',
    'bbb9400da27cc4c74c3024c4d1597a31173a298c:mofacts/.deploy/settings.local.json:generic-api-key:4',
  ]);
  const dockerfile = fs.readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');
  const runtimeNpmHardening = fs.readFileSync(new URL('../../../deploy/docker/harden-runtime-npm-dependencies.sh', import.meta.url), 'utf8');
  const mongoReadiness = fs.readFileSync(new URL('../../../deploy/docker/connect-to-mongo.sh', import.meta.url), 'utf8');
  assert.match(dockerfile, /apk update && apk upgrade --no-cache && apk add --no-cache/);
  assert.match(dockerfile, /harden-runtime-npm-dependencies\.sh/);
  assert.match(dockerfile, /rm -rf \/docker\/node_modules \/docker\/package\.json \/docker\/package-lock\.json/);
  assert.match(dockerfile, /rm -rf \/usr\/local\/lib\/node_modules\/npm \/usr\/local\/bin\/npm \/usr\/local\/bin\/npx/);
  assert.match(dockerfile, /LABEL org\.opencontainers\.image\.revision=\$MOFACTS_SOURCE_REVISION/);
  assert.match(runtimeNpmHardening, /bcrypt@6\.0\.0 argon2@0\.41\.1 node-gyp-build@4\.8\.4/);
  assert.match(runtimeNpmHardening, /openpgp@5\.11\.3/);
  assert.match(runtimeNpmHardening, /tmp@0\.2\.7 lodash@4\.18\.1 postcss@8\.5\.18 nanoid@3\.3\.18 svgo@2\.8\.3 nodemailer@9\.0\.1/);
  assert.match(runtimeNpmHardening, /browserslist@4\.28\.8 baseline-browser-mapping@2\.11\.20 caniuse-lite@1\.0\.30001810/);
  assert.match(runtimeNpmHardening, /electron-to-chromium@1\.5\.420 node-releases@2\.0\.54 update-browserslist-db@1\.3\.2/);
  assert.match(runtimeNpmHardening, /Patched browserslist failed its runtime load check/);
  assert.match(runtimeNpmHardening, /Patched nodemailer failed its runtime load check/);
  assert.match(runtimeNpmHardening, /assert_package_version/);
  assert.match(mongoReadiness, /meteor\/npm-mongo\/node_modules\/mongodb/);
  assert.doesNotMatch(mongoReadiness, /require\('mongodb'\)/);
  const apache = fs.readFileSync(new URL('../../../deploy/maintenance/apache-mofacts-maintenance.conf', import.meta.url), 'utf8');
  assert.match(apache, /ProxyPass \/websocket ws:\/\/127\.0\.0\.1:3000\/websocket/);
  assert.match(apache, /Header always set Content-Security-Policy "/);
  assert.doesNotMatch(apache, /Content-Security-Policy-Report-Only/);
  assert.match(apache, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  assert.match(apache, /font-src 'self' data: https:\/\/fonts\.gstatic\.com/);
  assert.match(apache, /media-src 'self' blob: data:/);
  assert.match(apache, /script-src 'self'(?:;|$)/);
  assert.doesNotMatch(apache, /unsafe-eval/);
  assert.doesNotMatch(apache, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(apache, /(?:^|;\s*)style-src\s+[^;]*(?:'unsafe-inline'|'unsafe-eval')/m);
  assert.match(apache, /style-src-attr 'unsafe-inline'/);
  const index = fs.readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
  const serverMain = fs.readFileSync(new URL('../../server/main.ts', import.meta.url), 'utf8');
  const cspRuntime = fs.readFileSync(new URL('../../server/runtime/contentSecurityPolicy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(index, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(index, /<style\b/i);
  assert.match(serverMain, /runtime\/contentSecurityPolicy/);
  assert.match(cspRuntime, /setInlineScriptsAllowed\(false\)/);
  assert.doesNotMatch(apache, /ws:\/\/localhost:3000/);
  const auditAdmin = fs.readFileSync(new URL('../../client/views/adminSecurityAudits.ts', import.meta.url), 'utf8');
  assert.match(auditAdmin, /auditText\(key, options\?\.hash\)/);
  const studentPerformance = fs.readFileSync(new URL('../../client/lib/studentPerformanceRuntime.ts', import.meta.url), 'utf8');
  assert.match(studentPerformance, /clientConsole\(2, 'setStudentPerformance:start'\)/);
  assert.doesNotMatch(studentPerformance, /clientConsole\([^\n]*student(?:ID|Username)/);
  const probabilityCalculation = fs.readFileSync(new URL('../../../learning-components/models/adaptive-logistic/probabilityCalculation.ts', import.meta.url), 'utf8');
  assert.match(probabilityCalculation, /calculateCardProbabilities:complete[\s\S]*stimulusCount: count/);
  assert.doesNotMatch(probabilityCalculation, /JSON\.stringify\(ptemp\)/);
  const compose = fs.readFileSync(new URL('../../../deploy/docker-compose.yml', import.meta.url), 'utf8');
  assert.match(compose, /MOFACTS_SOURCE_REVISION: \$\{MOFACTS_SOURCE_REVISION:-unknown\}/);
  assert.match(compose, /REDIS_URL: "redis:\/\/:\$\{MOFACTS_REDIS_PASSWORD:\?[^}]+\}@redis:6379\/0"/);
  assert.match(compose, /redis-server --appendonly yes --requirepass \\"\$\$MOFACTS_REDIS_PASSWORD\\"/);
  assert.match(compose, /REDISCLI_AUTH=\\"\$\$MOFACTS_REDIS_PASSWORD\\" redis-cli --no-auth-warning ping/);
});

test('encrypted report retention round-trips and detects tampering', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  const sections = Object.fromEntries(['external', 'authentication', 'internal', 'repository'].map((sectionId) => [
    sectionId, { sectionId, status: 'NOT_APPLICABLE', controls: [] },
  ]));
  const report = finalizeReport({
    schema: 'SecurityAuditReportV1', reportId: 'audit-encryption-test', reportType: 'exposure',
    startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z',
    target: 'https://mofacts.optimallearning.org', sourceRevision: 'unknown', productionImage: 'unknown',
    toolVersions: { node: 'test' }, sections, executionErrors: [],
  });
  const plaintext = Buffer.from(`${canonicalJson(report)}\n`);
  const encrypted = encryptReportBuffer(plaintext, publicKey.export({ type: 'spki', format: 'pem' }));
  const decrypted = decryptReportEnvelope(encrypted, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  assert.deepEqual(verifyCanonicalReportDigest(decrypted), report);
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -4)}AAAA` };
  assert.throws(() => decryptReportEnvelope(tampered, privateKey.export({ type: 'pkcs8', format: 'pem' })));
});

test('production authentication probes honor session-scoped credentials and fail closed', () => {
  const source = fs.readFileSync(new URL('./production-auth-audit.mjs', import.meta.url), 'utf8');
  assert.match(source, /sessionStorage\.getItem\('Meteor\.loginToken'\)/);
  assert.match(source, /sessionStorage\.setItem\('Meteor\.loginToken', stored\.token\)/);
  assert.doesNotMatch(source, /localStorage\.(?:getItem|setItem)\('Meteor\.(?:loginToken|userId|loginTokenExpires)'/);
  assert.match(source, /if \(!resume\.ok\) \{[\s\S]*?passwordlessContainmentOutcomes\(\{\}\)[\s\S]*?errorControl\(outcome\.id/);
  assert.match(source, /passwordlessContainmentOutcomes\([\s\S]*?issuedToken[\s\S]*?modifiedTargetRejected[\s\S]*?crossUserMethodDenied/);
  assert.match(source, /reset-token\.expired-rejected[\s\S]*?reset-token\.current-single-use[\s\S]*?reset-token\.replay-rejected/);
  assert.match(source, /semanticAuthorizationProbeId\('method'[\s\S]*?semanticAuthorizationProbeId\('route'[\s\S]*?semanticAuthorizationProbeId\('publication'[\s\S]*?semanticAuthorizationProbeId\('download'/);
  assert.doesNotMatch(source, /numberedProbeId/);
  assert.match(source, /observations:\s*authorizationFailures[\s\S]*?omittedFailureCount:/);
  assert.match(source, /const existingSession = await newPage\(\);[\s\S]*?const missingSession = await newPage\(\);/);
  assert.match(source, /login\(existingSession\.page[\s\S]*?login\(missingSession\.page/);
  assert.match(source, /existingSession\.context\.close\(\)[\s\S]*?missingSession\.context\.close\(\)/);
  assert.match(source, /throttle\.connection[\s\S]*?throttle\.identifier[\s\S]*?throttle\.ip/);
  assert.match(source, /index < 11/);
});

test('external UDP probes retain raw uncertainty and assembly resolves it with bounded host facts', () => {
  const source = fs.readFileSync(new URL('./external-audit.mjs', import.meta.url), 'utf8');
  const assembly = fs.readFileSync(new URL('./assemble-report.mjs', import.meta.url), 'utf8');
  const host = fs.readFileSync(new URL('../../../deploy/security-audit/host-exposure-audit.sh', import.meta.url), 'utf8');
  assert.match(source, /'-sU', '--reason', '-p', udpPorts/);
  assert.doesNotMatch(source, /'-sV'|'--max-retries'/);
  assert.match(source, /classification\.status === 'ERROR'/);
  assert.match(source, /inconclusive: true/);
  assert.match(assembly, /resolveCompositeUdpExposure\(external, internal\)/);
  assert.match(host, /unexpectedUdpListenerCount/);
  assert.match(host, /unexpectedUdpPublicationCount/);
  assert.match(host, /unexpectedUdpAllowRuleCount/);
  assert.match(host, /firewallActive/);
  assert.match(host, /defaultDenyInbound/);
});

test('authentication probe helpers produce stable bounded diagnostics', () => {
  const routeProbe = { actor: 'learnerA', path: '/admin/security-audits', expectDenied: true };
  assert.equal(
    semanticAuthorizationProbeId('route', routeProbe),
    semanticAuthorizationProbeId('route', { ...routeProbe }),
  );
  assert.match(semanticAuthorizationProbeId('route', routeProbe), /^authorization\.route\.learnera-admin-security-audits-[a-f0-9]{8}$/);
  assert.match(
    semanticAuthorizationProbeId('download', { actor: 'anonymous', path: `/download/${'a'.repeat(40)}` }),
    /anonymous-download-parameter-/,
  );
  assert.equal(assertUniqueSemanticProbeIds({ route: [routeProbe, { ...routeProbe }] }), false);
  assert.equal(throttleWasObserved({ ok: false, code: 'rate-limit' }), true);
  assert.equal(throttleResultCategory({ ok: false, code: 403 }), 'invalid-credentials');
  assert.deepEqual(
    classifyEnumeration([{ code: '403' }], [{ code: '403' }], true),
    { status: 'PASS', loginCodeMatch: true, resetShapeMatch: true, rateLimitedAttemptCount: 0 },
  );
  assert.equal(classifyEnumeration([{ code: '403' }], [{ code: '404' }], true).status, 'FAIL');
  assert.deepEqual(
    classifyEnumeration([{ code: '403' }], [{ code: 'rate-limit' }], true),
    { status: 'ERROR', loginCodeMatch: false, resetShapeMatch: true, rateLimitedAttemptCount: 1 },
  );
  assert.deepEqual(
    classifyEnumeration([{ code: '403' }], [{ code: '403' }], false, [{ code: 'rate-limit' }]),
    { status: 'ERROR', loginCodeMatch: true, resetShapeMatch: false, rateLimitedAttemptCount: 1 },
  );
  assert.equal(routeProbePassed({
    actor: 'learnerA', requestedPath: '/admin/security-audits', finalPath: '/home', expectDenied: true, authReady: true,
  }), true);
  assert.equal(routeProbePassed({
    actor: 'anonymous', requestedPath: '/profile', finalPath: '/profile', expectDenied: true, authReady: true,
  }), false);
});

test('passwordless containment accepts token issuance and identifies the exact failing boundary', () => {
  const passingState = {
    issuedToken: true,
    tokenLogin: true,
    identityMatches: true,
    experimentFlag: true,
    targetMatches: true,
    modifiedTargetRejected: true,
    adminDenied: true,
    ordinaryAccountDenied: true,
    assignedExperimentAllowed: true,
    crossUserMethodDenied: true,
    crossUserPublicationContained: true,
    tokenNotLeaked: true,
  };
  const passing = passwordlessContainmentOutcomes(passingState);
  assert.equal(passing.length, 12);
  assert.equal(passing.every((outcome) => outcome.passed), true);
  const failing = passwordlessContainmentOutcomes({ ...passingState, modifiedTargetRejected: false });
  assert.deepEqual(failing.filter((outcome) => !outcome.passed).map((outcome) => outcome.id), [
    'authentication.passwordless.modified-target-rejected',
  ]);
});

test('reset expiration probes select only links older than the configured lifetime', () => {
  const now = Date.parse('2026-08-21T12:00:00Z');
  const links = [
    { token: 'recent', issuedAtMs: now - 30 * 60 * 1000 },
    { token: 'expired', issuedAtMs: now - 90 * 60 * 1000 },
    { token: 'invalid-date', issuedAtMs: Number.NaN },
  ];
  assert.equal(selectExpiredResetLink(links, now, 60 * 60 * 1000)?.token, 'expired');
  assert.equal(selectExpiredResetLink(links.slice(0, 1), now, 60 * 60 * 1000), null);
  assert.throws(() => selectExpiredResetLink(null, now, 60 * 60 * 1000));
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import membership from './fixtures/v1-membership.json' with { type: 'json' };
import { finalizeReport, control, section, canonicalJson as scannerCanonicalJson } from '../audit-lib.mjs';
import { canonicalJson, parseSecurityAuditReport } from '../../../common/securityAuditReport.ts';
import { sourceFile, oneNode, initializer, evaluateNode, findNodes, ts } from './helpers/sourceWitnesses.mjs';

const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
const authSource = sourceFile('scripts/security-audit/production-auth-audit.mjs');

test('Phase 0: the V1 membership fixture has a fixed shared/scanner canonical digest', () => {
  assert.equal(canonicalJson(membership), scannerCanonicalJson(membership));
  assert.equal(createHash('sha256').update(canonicalJson(membership)).digest('hex'),
    '37bd0109ed7c4c14755566692d0e32ae71e95b19ef91de091b7d5dc743b0dfeb');
});

function assembler(t, mode, change = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mofacts-audit-phase0-'));
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('mofacts-audit-phase0-'));
    fs.rmSync(directory, { recursive: true });
  });
  const inputs = Object.fromEntries(Object.entries(membership).map(([id, ids]) => [id, section(id,
    ids.map((controlId) => control(controlId, 'Synthetic fixture control', 'PASS', 'INFO', 'Synthetic contract fixture')),
  )]));
  // Satisfy the current composite UDP proof shape without making a network call.
  const metric = (id, metrics) => { inputs.internal.controls.find((entry) => entry.controlId === id).evidence.metrics = metrics; };
  metric('internal.listening-sockets', { unexpectedUdpListenerCount: 0 });
  metric('internal.docker-ports', { unexpectedUdpPublicationCount: 0 });
  metric('internal.firewall', { unexpectedUdpAllowRuleCount: 0, firewallActive: true, defaultDenyInbound: true });
  change(inputs);
  const paths = Object.keys(inputs).map((id) => {
    const target = path.join(directory, `${id}.json`);
    fs.writeFileSync(target, JSON.stringify(inputs[id]), { mode: 0o600 });
    return [id, target];
  });
  const inputPaths = Object.fromEntries(paths);
  const output = path.join(directory, 'report.json');
  // The actual assembler only reads/writes these synthetic files. Deliberately
  // exclude scanner secrets, runtime settings and unrelated ambient variables.
  execFileSync(process.execPath, [
    'scripts/security-audit/assemble-report.mjs', mode,
    inputPaths.external, inputPaths.internal, inputPaths.authentication, inputPaths.repository, output,
  ], { cwd: appRoot, windowsHide: true, timeout: 10000, stdio: 'pipe', env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    AUDIT_STARTED_AT: '2026-01-01T00:00:00.000Z', AUDIT_REPORT_ID: 'audit-phase0-synthetic', GITHUB_SHA: 'a'.repeat(40),
  } });
  return JSON.parse(fs.readFileSync(output, 'utf8'));
}

test('Phase 0 V1 fixture: full membership is exactly 52 controls in current assembler order', (t) => {
  const report = assembler(t, 'full');
  for (const [id, ids] of Object.entries(membership)) {
    assert.deepEqual(report.sections[id].controls.map((entry) => entry.controlId), ids);
  }
  assert.equal(report.counts.pass, 52);
  assert.equal(report.counts.error, 0);
  assert.deepEqual(parseSecurityAuditReport(report), report);
});

test('Phase 0 V1 fixture: exposure preserves the two existing not-applicable placeholders', (t) => {
  const report = assembler(t, 'exposure');
  for (const id of ['external', 'internal']) {
    assert.deepEqual(report.sections[id].controls.map((entry) => entry.controlId), membership[id]);
  }
  for (const id of ['authentication', 'repository']) {
    assert.deepEqual(report.sections[id].controls.map((entry) => entry.controlId), [`${id}.not-applicable`]);
  }
  assert.equal(report.counts.pass, 20);
  assert.equal(report.counts.notApplicable, 2);
});

// A passing WITNESS test confirms a known defect, not a corrected scanner. Each
// owning phase replaces its witness with the opposite desired regression test.
test('P0-3 WITNESS: duplicate results overwrite an earlier failure in the V1 assembler', (t) => {
  const report = assembler(t, 'full', (inputs) => {
    const original = inputs.external.controls[0];
    inputs.external.controls.unshift({ ...original, status: 'FAIL', severity: 'CRITICAL' });
  });
  assert.equal(report.sections.external.controls[0].status, 'PASS');
  assert.equal(report.executionErrors.length, 0);
  assert.notEqual(report.sections.external.status, 'ERROR', 'Phase 1 desired outcome: duplicate producer must be ERROR');
});

test('P0-3 WITNESS: unknown controls disappear without an execution error', (t) => {
  const report = assembler(t, 'full', (inputs) => {
    inputs.external.controls.push(control('external.unexpected', 'Synthetic unexpected', 'FAIL', 'CRITICAL', 'Synthetic fixture'));
  });
  assert.equal(report.sections.external.controls.length, membership.external.length);
  assert.equal(report.counts.fail, 0);
  assert.equal(report.executionErrors.length, 0);
});

test('P0-3 WITNESS: the V1 parser accepts missing and wrong-section membership after valid count/digest assembly', (t) => {
  const report = assembler(t, 'full');
  report.sections.external.controls.pop();
  const moved = report.sections.authentication.controls.pop();
  report.sections.repository.controls.push(moved);
  // finalizeReport expects a digest-free input; preserve real count/digest rules.
  const { digestSha256: _digest, counts: _counts, ...payload } = report;
  const validDigestReport = finalizeReport(payload);
  assert.doesNotThrow(() => parseSecurityAuditReport(validDigestReport));
  assert.notDeepEqual(validDigestReport.sections.external.controls.map((entry) => entry.controlId), membership.external);
});

function currentProbeDecision(group, bindings) {
  const loop = oneNode(authSource, (node) => ts.isForOfStatement(node) && node.expression.getText(authSource) === `config.${group}`);
  return evaluateNode(initializer(loop.statement, 'passed'), authSource, bindings);
}

test('P0-2 WITNESS: an unrelated method domain error is accepted as authorization denial', () => {
  assert.equal(currentProbeDecision('authorizationProbes', {
    probe: { expectDenied: true }, result: { ok: false, code: 'synthetic-domain-error' },
  }), true);
});

test('P0-2 WITNESS: missing publication data and an unrelated error can satisfy the denial expression', () => {
  assert.equal(currentProbeDecision('publicationProbes', {
    probe: { expectError: true }, result: { leakedCanary: false, error: true },
  }), true);
  assert.equal(currentProbeDecision('publicationProbes', {
    probe: { expectError: false }, result: { leakedCanary: false },
  }), true);
});

test('P0-2 WITNESS: a nonexistent download returning 404 is accepted as denial', () => {
  assert.equal(currentProbeDecision('downloadProbes', { probe: { expectDenied: true }, status: 404 }), true);
});

test('P0-2 WITNESS: an already-expired session lifetime is accepted as PASS', () => {
  assert.equal(evaluateNode(initializer(authSource, 'lifetimeStatus'), authSource, {
    expiryLogin: { ok: true }, lifetimeDays: -1,
  }), 'PASS');
});

test('P0-1 WITNESS: the current checker misses handlers-stack routes and collapses default publications', () => {
  const inventory = JSON.parse(execFileSync(process.execPath, [
    'scripts/security-audit/check-security-surfaces.mjs', '--discover',
  ], { cwd: appRoot, windowsHide: true, timeout: 15000, encoding: 'utf8', env: {
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  } }));
  const pwa = sourceFile('server/http/pwa.ts');
  assert.equal(findNodes(pwa, (node) => ts.isCallExpression(node)
    && node.expression.getText(pwa) === 'WebAppAny.handlers.use').length, 1);
  assert.ok(pwa.text.includes("'/site.webmanifest'"));
  assert.equal(inventory.httpRoutes.includes('/site.webmanifest'), false);
  const countDefaults = (relative) => {
    const source = sourceFile(relative);
    return findNodes(source, (node) => ts.isCallExpression(node)
      && node.expression.getText(source) === 'Meteor.publish' && node.arguments[0]?.kind === ts.SyntaxKind.NullKeyword).length;
  };
  assert.ok(countDefaults('server/publications.ts') + countDefaults('server/serverComposition.ts') >= 2);
  assert.equal(inventory.publications.filter((name) => name === '<default>').length, 1);
});

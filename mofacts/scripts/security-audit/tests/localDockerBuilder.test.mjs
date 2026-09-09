import assert from 'node:assert/strict';
import test from 'node:test';
import { localEndpoint, assertContextBuilder, assertSameEngine, localDockerInvoker } from '../qualification/localDockerBuilder.mjs';

const name = 'desktop-linux';
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const context = [{ Name: name, Endpoints: { docker: { Host: endpoint, SkipTLSVerify: false } } }];
const inspection = `Name: ${name}\nDriver: docker\n\nNodes:\nName: ${name}\nEndpoint: ${name}\nStatus: running\n`;
const engine = { ID: 'synthetic-engine', OSType: 'linux', Architecture: 'x86_64' };

test('accepts explicit local pipe and Unix socket context endpoints', () => {
  assert.equal(localEndpoint(context, name), endpoint);
  assert.equal(localEndpoint([{ Name: name, Endpoints: { docker: { Host: 'unix:///var/run/docker.sock' } } }], name), 'unix:///var/run/docker.sock');
});
test('rejects remote, missing, mismatched and TLS endpoint bindings', () => {
  for (const bad of [[], [{ Name: 'other' }], [{ Name: name }], ...['ssh://host', 'tcp://localhost:2375', 'npipe:////remote/pipe/docker'].map((Host) => [{ Name: name, Endpoints: { docker: { Host } } }])]) {
    assert.throws(() => localEndpoint(bad, name), /binding failed/);
  }
  const tls = structuredClone(context); tls[0].Endpoints.docker.SkipTLSVerify = true;
  assert.throws(() => localEndpoint(tls, name), /binding failed/);
});
test('requires the exact single running context-backed docker builder', () => {
  assertContextBuilder(inspection, name);
  for (const bad of [inspection.replace('Driver: docker', 'Driver: docker-container'), inspection.replace('Status: running', 'Status: stopped'), inspection.replace(`Endpoint: ${name}`, 'Endpoint: other'), `${inspection}Name: second\n`]) {
    assert.throws(() => assertContextBuilder(bad, name), /binding failed/);
  }
});
test('requires matching observed Linux engine identity and architecture', () => {
  assertSameEngine(engine, structuredClone(engine));
  for (const bad of [{ ...engine, ID: 'other' }, { ...engine, Architecture: 'arm64' }, null]) {
    assert.throws(() => assertSameEngine(engine, bad), /binding failed/);
  }
  assert.throws(() => assertSameEngine({ ...engine, OSType: 'windows' }, { ...engine, OSType: 'windows' }), /binding failed/);
});
test('binds capture and Compose to the same endpoint without changing selected context', async () => {
  const calls = [];
  const options = { input: Buffer.from('recipe') };
  const invoke = localDockerInvoker(name, async (args, received) => {
    calls.push(args);
    if (args[0] === 'context') return JSON.stringify(context);
    if (args.includes('inspect')) return inspection;
    if (args.includes('info')) return JSON.stringify(engine);
    if (args.includes('source_capture')) assert.equal(received, options);
    return 'completed';
  });
  await invoke(['buildx', 'build', '--builder', name, '--target', 'source_capture'], options);
  await invoke(['compose', 'config', '--format', 'json']);
  await invoke(['compose', 'build', '--builder', name, '--no-cache', 'mofacts']);
  assert.equal(calls.length, 7);
  assert.deepEqual(calls[4], ['--host', endpoint, 'buildx', 'build', '--builder', 'default', '--target', 'source_capture']);
  assert.deepEqual(calls[6], ['--host', endpoint, 'compose', 'build', '--builder', 'default', '--no-cache', 'mofacts']);
  assert.equal(calls.some((args) => args.includes('use') || args.includes('create')), false);
  await assert.rejects(invoke(['buildx', 'build', '--builder', 'other']), /binding failed/);
});
test('failed binding never exports, builds or retries on another endpoint', async () => {
  let calls = 0;
  const invoke = localDockerInvoker(name, async () => { calls++; throw new Error('synthetic unavailable'); });
  await assert.rejects(invoke(['buildx', 'build']), /synthetic unavailable/);
  await assert.rejects(invoke(['compose', 'build']), /synthetic unavailable/);
  assert.equal(calls, 1);
});

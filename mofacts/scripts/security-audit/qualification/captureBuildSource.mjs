import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { localDockerInvoker } from './localDockerBuilder.mjs';
import { parseBuildIdentity } from '../../../common/securityAudit/buildIdentity.ts';
import { extractSnapshot, inspectSnapshotTree, sha256, snapshotPath, invalidSnapshot } from './sourceSnapshot.mjs';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const workspacePrefix = 'mofacts-qualified-build-';
const maxControlBytes = 1024 * 1024;

export async function readControl(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxControlBytes) invalidSnapshot();
  const result = await fs.readFile(file);
  if (result.length > maxControlBytes) invalidSnapshot();
  return result;
}

// Intentionally bounded to the canonical recipe's supported registration shape.
// This reads COPY ownership, not Docker ignore patterns. Unsupported acquisition
// families fail qualification; the ordinary Docker build remains untouched.
export function captureRoots(recipe) {
  const lines = recipe.replace(/\\\r?\n/g, ' ').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const roots = [];
  const stages = new Set();
  let stage;
  let captureMetadata = false;
  for (const line of lines) {
    const from = /^FROM (\S+)(?: AS ([a-z_]+))?$/i.exec(line);
    if (from) {
      stage = from[2];
      if (!stage || stages.has(stage)) invalidSnapshot();
      if (stage === 'source_inputs' && (stages.size || from[1] !== 'scratch')) invalidSnapshot();
      if (stage === 'source_capture' && from[1] !== 'source_inputs') invalidSnapshot();
      stages.add(stage);
      continue;
    }
    if (/^ADD\b/i.test(line) || /--mount[= ]/i.test(line)) invalidSnapshot();
    if (stage === 'source_inputs') {
      const copy = /^COPY \.\/([^\s]+) \/([^\s]+)$/.exec(line);
      if (!copy || copy[1] !== copy[2] || !copy[1].endsWith('/')) invalidSnapshot();
      const root = snapshotPath(copy[1].slice(0, -1));
      if (roots.some((existing) => root === existing || root.startsWith(`${existing}/`) || existing.startsWith(`${root}/`))) invalidSnapshot();
      roots.push(root);
    } else if (stage === 'source_capture') {
      if (line !== 'COPY ./Dockerfile ./.dockerignore /' || captureMetadata) invalidSnapshot();
      captureMetadata = true;
    } else if (/^COPY\b/i.test(line)) {
      const copy = /^COPY --from=([a-z_]+)\s+/.exec(line);
      if (!copy || !stages.has(copy[1]) || copy[1] === stage || copy[1] === 'source_capture') invalidSnapshot();
    }
  }
  if (!roots.length || !captureMetadata || stage !== 'runtime') invalidSnapshot();
  return roots;
}

export function contextOverride(candidate) {
  if (!path.isAbsolute(candidate)) invalidSnapshot();
  return { services: { mofacts: { build: { context: candidate } } } };
}

export function assertContextOnlyChange(before, after, candidate) {
  const expected = structuredClone(before);
  if (!expected.services?.mofacts?.build || expected.services.mofacts.build.dockerfile !== 'Dockerfile') invalidSnapshot();
  const actualContext = after?.services?.mofacts?.build?.context;
  if (typeof actualContext !== 'string' || !path.isAbsolute(actualContext)
    || path.resolve(actualContext) !== path.resolve(candidate)) invalidSnapshot();
  expected.services.mofacts.build.context = actualContext;
  if (!isDeepStrictEqual(expected, after)) invalidSnapshot();
}

export function assertCapturedEntries(entries, roots) {
  for (const [name, type] of entries) {
    if (name === 'Dockerfile' || name === '.dockerignore') {
      if (type !== 'file') invalidSnapshot();
    } else if (!roots.some((root) => name === root || name.startsWith(`${root}/`)
      || (type === 'directory' && root.startsWith(`${name}/`)))) invalidSnapshot();
  }
  for (const root of roots) if (!entries.some(([name, type]) => name === root && type === 'directory')) invalidSnapshot();
}

async function docker(args, { input, consume, timeout = 10 * 60 * 1000 } = {}) {
  const child = spawn('docker', args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let timer;
  let failure = false;
  const exit = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Docker invocation unavailable')));
    child.once('close', (code) => code === 0 && !failure ? resolve(code) : reject(new Error('Docker invocation failed')));
    timer = setTimeout(() => { failure = true; child.kill(); reject(new Error('Docker invocation timed out')); }, timeout);
  });
  // Drain, but never retain/print commands, resolved config, build logs or errors.
  child.stderr.resume();
  child.stdin.on('error', () => { failure = true; });
  child.stdin.end(input);
  const output = (async () => {
    if (consume) return consume(child.stdout);
    const chunks = [];
    let bytes = 0;
    for await (const chunk of child.stdout) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) throw new Error('Docker output exceeded bound');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  })();
  try { return (await Promise.all([output, exit]))[0]; }
  catch {
    child.kill();
    child.stdout.destroy();
    child.stdin.destroy();
    // Do not remove an incomplete workspace while its consumer still writes.
    await Promise.allSettled([output, exit]);
    throw new Error('Docker acquisition or command failed');
  }
  finally { clearTimeout(timer); }
}

async function exportSource(context, recipe, builder, destination, invoke = docker) {
  return invoke(['buildx', 'build', '--builder', builder, '--file', '-', '--target', 'source_capture',
    '--output', 'type=tar,dest=-', context], { input: recipe, consume: (stream) => extractSnapshot(stream, destination) });
}

async function requireWorkspace(workspace) {
  const resolved = path.resolve(workspace);
  const temporary = await fs.realpath(os.tmpdir());
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(await fs.realpath(resolved)) !== temporary
    || !path.basename(resolved).startsWith(workspacePrefix)) invalidSnapshot();
  const marker = JSON.parse(await readControl(path.join(resolved, 'owner.json')));
  if (marker.schema !== 'MoFaCTSCaptureWorkspaceV1' || marker.workspace !== resolved
    || !/^[a-f0-9-]{36}$/.test(marker.id)) invalidSnapshot();
  return resolved;
}

// Only newly created task workspaces may be removed. No caller-supplied broad
// output/deletion path is supported. read-only file modes are restored locally.
async function removeOwnedTree(root) {
  async function writable(directory) {
    await fs.chmod(directory, 0o700);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) invalidSnapshot();
      if (stat.isDirectory()) await writable(target);
      else if (stat.isFile()) await fs.chmod(target, 0o600);
      else invalidSnapshot();
    }
  }
  await writable(root);
  await fs.rm(root, { recursive: true });
}

async function removeWorkspace(workspace) {
  await removeOwnedTree(await requireWorkspace(workspace));
}

// Explicit dependencies permit synthetic orchestration tests without executing
// Docker or evaluating operator configuration. The CLI supplies no overrides.
export async function prepareCapture(builder, baseCommit, dirty, dependencies = {}) {
  const repository = dependencies.repositoryRoot ?? repoRoot;
  const invoke = dependencies.docker ?? docker;
  // Identity validation occurs before allocating a workspace or invoking Docker.
  parseBuildIdentity({ schema: 'BuildIdentityV1', baseCommit, includedUncommittedLocalChanges: dirty,
    sourceSnapshotDigestSha256: '0'.repeat(64) });
  if (await fs.lstat(path.join(repository, 'Dockerfile.dockerignore')).then(() => true, (error) => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error('Dockerfile-specific ignore acquisition is not supported');
  const recipe = await readControl(path.join(repository, 'Dockerfile'));
  const ignore = await readControl(path.join(repository, '.dockerignore'));
  const roots = captureRoots(recipe.toString('utf8'));
  const temporary = await fs.realpath(os.tmpdir());
  const relativeTemporary = path.relative(await fs.realpath(repository), temporary);
  if (!relativeTemporary || (!relativeTemporary.startsWith(`..${path.sep}`)
    && relativeTemporary !== '..' && !path.isAbsolute(relativeTemporary))) invalidSnapshot();
  const workspace = await fs.mkdtemp(path.join(temporary, workspacePrefix));
  await fs.chmod(workspace, 0o700);
  await fs.writeFile(path.join(workspace, 'owner.json'), JSON.stringify({ schema: 'MoFaCTSCaptureWorkspaceV1', workspace, id: randomUUID() }), { flag: 'wx', mode: 0o600 });
  try {
    const candidate = path.join(workspace, 'context');
    await fs.mkdir(candidate, { mode: 0o700 });
    const result = await exportSource(repository, recipe, builder, candidate, invoke);
    assertCapturedEntries(result.entries, roots);
    if (!(await readControl(path.join(candidate, 'Dockerfile'))).equals(recipe)
      || !(await readControl(path.join(candidate, '.dockerignore'))).equals(ignore)) invalidSnapshot();
    const localTree = await inspectSnapshotTree(candidate);
    const receipt = {
      schema: 'MoFaCTSSourceCaptureV1',
      identity: parseBuildIdentity({ schema: 'BuildIdentityV1', baseCommit, includedUncommittedLocalChanges: dirty,
        sourceSnapshotDigestSha256: result.sourceSnapshotDigestSha256 }),
      localTreeDigestSha256: localTree.digestSha256,
      composeDigestSha256: sha256(await readControl(path.join(repository, 'deploy/docker-compose.yml'))),
      recipeDigestSha256: sha256(recipe),
      entryCount: result.entries.length,
    };
    await fs.writeFile(path.join(workspace, 'capture.json'), JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
    await fs.writeFile(path.join(workspace, 'compose.capture.json'), JSON.stringify(contextOverride(candidate)), { flag: 'wx', mode: 0o600 });
    return { state: 'captured-unqualified', workspace, identity: receipt.identity, entryCount: receipt.entryCount };
  } catch (error) {
    await removeWorkspace(workspace);
    throw error;
  }
}

export async function verifyCapture(workspace, builder, dependencies = {}) {
  const composePath = path.join(dependencies.repositoryRoot ?? repoRoot, 'deploy/docker-compose.yml');
  const root = await requireWorkspace(workspace);
  const receipt = JSON.parse(await readControl(path.join(root, 'capture.json')));
  const identity = parseBuildIdentity(receipt.identity);
  if (receipt.schema !== 'MoFaCTSSourceCaptureV1' || !/^[a-f0-9]{64}$/.test(receipt.localTreeDigestSha256)
    || receipt.composeDigestSha256 !== sha256(await readControl(composePath))) invalidSnapshot();
  const candidate = path.join(root, 'context');
  if ((await inspectSnapshotTree(candidate)).digestSha256 !== receipt.localTreeDigestSha256) invalidSnapshot();
  const recipe = await readControl(path.join(candidate, 'Dockerfile'));
  if (sha256(recipe) !== receipt.recipeDigestSha256) invalidSnapshot();
  const roots = captureRoots(recipe.toString('utf8'));
  // Every verification owns a new export; a prior successful export is not reused.
  const roundTrip = await fs.mkdtemp(path.join(root, 'round-trip-'));
  try {
    const observed = await exportSource(candidate, recipe, builder, roundTrip, dependencies.docker ?? docker);
    assertCapturedEntries(observed.entries, roots);
    if (observed.sourceSnapshotDigestSha256 !== identity.sourceSnapshotDigestSha256
      || (await inspectSnapshotTree(candidate)).digestSha256 !== receipt.localTreeDigestSha256) invalidSnapshot();
  } finally {
    // This exact child was allocated above, never taken from receipt metadata.
    await requireWorkspace(root);
    if (path.dirname(roundTrip) !== root || !(await fs.lstat(roundTrip)).isDirectory()
      || (await fs.lstat(roundTrip)).isSymbolicLink()) invalidSnapshot();
    await removeOwnedTree(roundTrip);
  }
  const override = contextOverride(candidate);
  if (!isDeepStrictEqual(JSON.parse(await readControl(path.join(root, 'compose.capture.json'))), override)) invalidSnapshot();
  return { root, candidate, receipt, identity };
}

export async function buildCapturedSource(workspace, builder, envFile, dependencies = {}) {
  const invoke = dependencies.docker ?? docker;
  const checked = await verifyCapture(workspace, builder, dependencies);
  const composePath = path.join(dependencies.repositoryRoot ?? repoRoot, 'deploy/docker-compose.yml');
  const compose = ['compose', '--env-file', path.resolve(envFile), '-f', composePath];
  const qualified = [...compose, '-f', path.join(checked.root, 'compose.capture.json')];
  const baseline = JSON.parse(await invoke([...compose, 'config', '--format', 'json']));
  const effective = JSON.parse(await invoke([...qualified, 'config', '--format', 'json']));
  assertContextOnlyChange(baseline, effective, checked.candidate);
  if (baseline.services.mofacts.build.args?.MOFACTS_SOURCE_REVISION !== checked.identity.baseCommit) invalidSnapshot();
  // Source compilation remains Compose-owned. No push, test:ci, SSH or deployment.
  await invoke([...qualified, 'build', '--builder', builder, '--no-cache', 'mofacts'], {
    timeout: 60 * 60 * 1000, consume: async (stream) => { for await (const chunk of stream) void chunk; },
  });
  if ((await inspectSnapshotTree(checked.candidate)).digestSha256 !== checked.receipt.localTreeDigestSha256) invalidSnapshot();
  return { state: 'built-unqualified', identity: checked.identity,
    reason: 'Source-test bundle, exact-image smoke and published/running proof are not yet integrated' };
}

export async function main(argv) {
  const [action, ...rest] = argv;
  const args = new Map();
  for (let i = 0; i < rest.length; i += 2) {
    if (!/^--[a-z-]+$/.test(rest[i]) || !rest[i + 1] || args.has(rest[i])) invalidSnapshot();
    args.set(rest[i], rest[i + 1]);
  }
  const allowed = { prepare: ['--builder', '--base-commit', '--dirty'], verify: ['--builder', '--workspace'],
    build: ['--builder', '--workspace', '--env-file'], cleanup: ['--workspace'] }[action];
  if (!allowed || allowed.length !== args.size || allowed.some((key) => !args.has(key))) invalidSnapshot();
  const builder = args.get('--builder');
  if (builder !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(builder)) invalidSnapshot();
  const dependencies = { docker: localDockerInvoker(builder, docker) };
  if (action === 'prepare') {
    if (!['true', 'false'].includes(args.get('--dirty'))) invalidSnapshot();
    return prepareCapture(builder, args.get('--base-commit'), args.get('--dirty') === 'true', dependencies);
  }
  if (action === 'verify') {
    const { identity } = await verifyCapture(args.get('--workspace'), builder, dependencies);
    return { state: 'capture-verified-unqualified', identity };
  }
  if (action === 'build') return buildCapturedSource(args.get('--workspace'), builder, args.get('--env-file'), dependencies);
  await removeWorkspace(args.get('--workspace'));
  return { state: 'temporary-capture-removed' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`), () => {
    process.stderr.write('Build-source operation failed; no qualification was issued.\n');
    process.exitCode = 1;
  });
}

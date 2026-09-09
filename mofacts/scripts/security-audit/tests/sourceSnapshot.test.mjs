import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { SNAPSHOT_LIMITS, extractSnapshot, inspectSnapshotTree, snapshotPath, snapshotDigest, sha256 } from '../qualification/sourceSnapshot.mjs';
import { captureRoots, contextOverride, assertContextOnlyChange, assertCapturedEntries, main,
  prepareCapture, verifyCapture, buildCapturedSource } from '../qualification/captureBuildSource.mjs';

function header(name, size = 0, type = '0', mode = 0o644) {
  const result = Buffer.alloc(512);
  result.write(name, 0, 100);
  result.write(`${mode.toString(8).padStart(7, '0')}\0`, 100);
  result.write('0000000\0', 108);
  result.write('0000000\0', 116);
  result.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  result.write('00000000000\0', 136);
  result.fill(32, 148, 156);
  result.write(type, 156);
  result.write('ustar\0', 257);
  result.write('00', 263);
  result.write(`${result.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0')}\0 `, 148);
  return result;
}
function archive(items) {
  return Buffer.concat([...items.flatMap(({ name, content = '', type = '0', mode = 0o644 }) => {
    const bytes = Buffer.from(content);
    return [header(name, bytes.length, type, mode), bytes, Buffer.alloc((512 - bytes.length % 512) % 512)];
  }), Buffer.alloc(1024)]);
}
function chunks(buffer) {
  return Readable.from((function* () { for (let i = 0; i < buffer.length; i += 37) yield buffer.subarray(i, i + 37); })());
}
async function directory(t) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'mofacts-snapshot-test-'));
  t.after(async () => {
    assert.equal(path.dirname(root), await fs.realpath(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('mofacts-snapshot-test-'));
    async function writable(dir) {
      await fs.chmod(dir, 0o700);
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) await writable(file);
        else if (!entry.isSymbolicLink()) await fs.chmod(file, 0o600);
      }
    }
    await writable(root);
    await fs.rm(root, { recursive: true });
  });
  return root;
}

test('capture streams exact bytes and records native tar modes and empty directories', async (t) => {
  const root = await directory(t);
  const result = await extractSnapshot(chunks(archive([
    { name: 'mofacts/', type: '5', mode: 0o755 },
    { name: 'mofacts/empty/', type: '5', mode: 0o755 },
    { name: 'mofacts/source.ts', content: 'dirty\r\nsource\n', mode: 0o644 },
  ])), root);
  assert.equal(await fs.readFile(path.join(root, 'mofacts/source.ts'), 'utf8'), 'dirty\r\nsource\n');
  assert.deepEqual(result.entries, [
    ['mofacts', 'directory', 0o755, null], ['mofacts/empty', 'directory', 0o755, null],
    ['mofacts/source.ts', 'file', 0o644, sha256('dirty\r\nsource\n')],
  ]);
  assert.equal(result.sourceSnapshotDigestSha256, snapshotDigest(result.entries));
  const before = await inspectSnapshotTree(root);
  await fs.writeFile(path.join(root, 'mofacts/source.ts'), 'different');
  assert.notEqual((await inspectSnapshotTree(root)).digestSha256, before.digestSha256);
});

test('snapshot digest binds path, type, mode, line endings and empty directories, not iteration order', () => {
  const entries = [['b', 'file', 0o644, sha256('line\r\n')], ['a', 'directory', 0o755, null]];
  const digest = snapshotDigest(entries);
  assert.equal(snapshotDigest([...entries].reverse()), digest);
  for (const changed of [
    [['c', ...entries[0].slice(1)], entries[1]],
    [['b', 'file', 0o755, entries[0][3]], entries[1]],
    [['b', 'file', 0o644, sha256('line\n')], entries[1]], [entries[0]],
  ]) assert.notEqual(snapshotDigest(changed), digest);
});

for (const name of ['../escape', '/absolute', 'a/../escape', 'C:/drive', 'a\\b', 'a//b', 'a:stream', 'CON.txt', 'a.', 'a ', 'e\u0301.txt', 'a\nfile']) {
  test(`capture rejects unsafe path ${JSON.stringify(name)}`, () => assert.throws(() => snapshotPath(name), /validation failed/));
}

for (const type of ['1', '2', '3', '4', '6', '7', 'L', 'K', 'g', 'S']) {
  test(`capture rejects unsupported archive type ${type} before writing`, async (t) => {
    const root = await directory(t);
    await assert.rejects(extractSnapshot(chunks(archive([{ name: 'unsafe', type }])), root), /validation failed/);
    assert.deepEqual(await fs.readdir(root), []);
  });
}

for (const items of [
  [{ name: 'same' }, { name: 'same' }],
  [{ name: 'Name' }, { name: 'name' }],
  [{ name: 'file' }, { name: 'file/child' }],
  [{ name: 'missing/child' }],
  [{ name: 'dir/', type: '5', content: 'invalid' }],
  [{ name: 'special', mode: 0o4755 }],
]) test('capture rejects duplicate/colliding paths, missing parents and invalid metadata', async (t) => {
  await assert.rejects(extractSnapshot(chunks(archive(items)), await directory(t)), /validation failed/);
});

test('capture validates checksums, truncation, end markers and trailing data', async (t) => {
  const valid = archive([{ name: 'file', content: 'abc' }]);
  const corrupt = Buffer.from(valid); corrupt[0] = 120;
  for (const bytes of [corrupt, valid.subarray(0, 515), valid.subarray(0, valid.length - 512), Buffer.concat([valid, Buffer.alloc(512, 1)])]) {
    const parent = await directory(t);
    await assert.rejects(extractSnapshot(chunks(bytes), parent), /validation failed/);
  }
});

test('capture applies entry, byte, file, depth and path limits before writing the violating entry', async (t) => {
  for (const [override, items] of [
    [{ entries: 1 }, [{ name: 'a' }, { name: 'b' }]],
    [{ bytes: 2 }, [{ name: 'a', content: '123' }]],
    [{ fileBytes: 2 }, [{ name: 'a', content: '123' }]],
    [{ depth: 1 }, [{ name: 'a/', type: '5' }, { name: 'a/b' }]],
    [{ pathBytes: 1 }, [{ name: 'long' }]],
  ]) await assert.rejects(extractSnapshot(chunks(archive(items)), await directory(t), { ...SNAPSHOT_LIMITS, ...override }), /validation failed/);
});

function paxRecord(key, value) {
  let record = ` ${key}=${value}\n`;
  let size = Buffer.byteLength(record) + 1;
  while (String(size).length + Buffer.byteLength(record) !== size) size = String(size).length + Buffer.byteLength(record);
  return `${size}${record}`;
}
test('capture supports bounded PAX UTF-8 paths without accepting link or size overrides', async (t) => {
  const result = await extractSnapshot(chunks(archive([
    { name: 'PaxHeader', type: 'x', content: paxRecord('path', '学習.txt') }, { name: 'placeholder', content: 'source' },
  ])), await directory(t));
  assert.equal(result.entries[0][0], '学習.txt');
  for (const key of ['linkpath', 'size', 'GNU.sparse.map', '__proto__']) {
    await assert.rejects(extractSnapshot(chunks(archive([
      { name: 'PaxHeader', type: 'x', content: paxRecord(key, 'value') }, { name: 'file' },
    ])), await directory(t)), /validation failed/);
  }
});

test('capture requires an empty destination and local inspection rejects hard links', async (t) => {
  const root = await directory(t);
  await fs.writeFile(path.join(root, 'existing'), 'keep');
  await assert.rejects(extractSnapshot(chunks(archive([])), root), /validation failed/);
  await fs.link(path.join(root, 'existing'), path.join(root, 'linked'));
  await assert.rejects(inspectSnapshotTree(root), /validation failed/);
});

const recipe = await fs.readFile(new URL('../../../../Dockerfile', import.meta.url), 'utf8');
test('canonical Dockerfile shares four copy roots and leaves runtime as the default stage', () => {
  assert.deepEqual(captureRoots(recipe), ['deploy/docker', 'mofacts', 'learning-components', 'packages']);
  assert.ok(recipe.includes("RUN sed -i 's/\\r$//' $SCRIPTS_FOLDER/*.sh"));
  assert.ok(recipe.includes('COPY --from=source_inputs /mofacts/ $APP_SOURCE_FOLDER/'));
  assert.ok(recipe.includes('ENTRYPOINT ["/docker/entrypoint.sh"]'));
});
test('capture rejects undeclared input families and executable capture instructions', () => {
  for (const changed of [
    recipe.replace('COPY ./mofacts/ /mofacts/', 'COPY ./mofacts/ /wrong/'),
    recipe.replace('FROM source_inputs AS source_capture', 'FROM scratch AS source_capture'),
    recipe.replace('COPY ./Dockerfile ./.dockerignore /', 'RUN echo unsafe'),
    `${recipe}\nCOPY ./other /other`, `${recipe}\nADD https://example.test/source /source`,
    `${recipe}\nRUN --mount=type=bind,target=/source true`,
  ]) assert.throws(() => captureRoots(changed), /validation failed/);
});
test('capture inventory cannot include undeclared context files', () => {
  const roots = ['mofacts'];
  const entries = [['mofacts', 'directory'], ['mofacts/source.ts', 'file'], ['Dockerfile', 'file'], ['.dockerignore', 'file']];
  assert.doesNotThrow(() => assertCapturedEntries(entries, roots));
  assert.throws(() => assertCapturedEntries([...entries, ['private-settings.json', 'file']], roots), /validation failed/);
});
test('Compose integration changes only the absolute build context, not image, args or runtime settings', () => {
  const candidate = path.resolve(os.tmpdir(), 'synthetic-context');
  const base = { services: { mofacts: { image: 'synthetic:tag', build: { context: '/original', dockerfile: 'Dockerfile', args: { MOFACTS_SOURCE_REVISION: 'a'.repeat(40) } }, environment: { synthetic: 'keep' } } } };
  const next = structuredClone(base); next.services.mofacts.build.context = candidate;
  assert.deepEqual(contextOverride(candidate), { services: { mofacts: { build: { context: candidate } } } });
  assert.doesNotThrow(() => assertContextOnlyChange(base, next, candidate));
  next.services.mofacts.image = 'other:tag';
  assert.throws(() => assertContextOnlyChange(base, next, candidate), /validation failed/);
  assert.throws(() => contextOverride('relative'), /validation failed/);
});
test('CLI rejects incomplete/unknown options and broad cleanup targets without Docker', async () => {
  for (const args of [[], ['prepare'], ['prepare', '--builder', 'x', '--builder', 'y'], ['deploy'], ['cleanup', '--workspace', os.tmpdir()]]) {
    await assert.rejects(main(args));
  }
});

async function syntheticCapture(t, change = () => {}) {
  const repositoryRoot = await directory(t);
  await fs.mkdir(path.join(repositoryRoot, 'deploy'));
  await fs.writeFile(path.join(repositoryRoot, 'Dockerfile'), recipe);
  await fs.writeFile(path.join(repositoryRoot, '.dockerignore'), 'synthetic-ignored\n');
  await fs.writeFile(path.join(repositoryRoot, 'deploy/docker-compose.yml'), 'synthetic-compose');
  const items = [
    { name: 'deploy/', type: '5', mode: 0o755 },
    { name: 'deploy/docker/', type: '5', mode: 0o755 },
    { name: 'mofacts/', type: '5', mode: 0o755 },
    { name: 'mofacts/source.ts', content: 'synthetic dirty source\r\n' },
    { name: 'learning-components/', type: '5', mode: 0o755 },
    { name: 'packages/', type: '5', mode: 0o755 },
    { name: 'Dockerfile', content: recipe },
    { name: '.dockerignore', content: 'synthetic-ignored\n' },
  ];
  const calls = [];
  const dependencies = { repositoryRoot, docker: async (args, options = {}) => {
    calls.push(args);
    const phase = args[0] === 'buildx' ? 'export' : args.includes('config') ? 'config' : 'build';
    const state = { phase, items: structuredClone(items), args };
    change(state, calls);
    if (phase === 'export') return options.consume(chunks(archive(state.items)));
    if (phase === 'config') {
      const config = { services: { mofacts: { image: 'synthetic:tag', build: {
        context: repositoryRoot, dockerfile: 'Dockerfile', args: { MOFACTS_SOURCE_REVISION: 'a'.repeat(40) },
      } } } };
      const override = args.find((arg) => arg.endsWith('compose.capture.json'));
      if (override) config.services.mofacts.build.context = JSON.parse(await fs.readFile(override)).services.mofacts.build.context;
      return JSON.stringify(config);
    }
    return options.consume(Readable.from([]));
  } };
  const captured = await prepareCapture('synthetic-builder', 'a'.repeat(40), true, dependencies);
  t.after(async () => { await main(['cleanup', '--workspace', captured.workspace]); });
  return { captured, calls, dependencies, repositoryRoot };
}

test('synthetic prepare/verify/build uses captured source and preserves Compose build-only ownership', async (t) => {
  const { captured, calls, dependencies, repositoryRoot } = await syntheticCapture(t);
  assert.equal(captured.state, 'captured-unqualified');
  assert.equal(captured.identity.includedUncommittedLocalChanges, true);
  // Subsequent reads use the captured recipe, never this edited checkout recipe.
  await fs.writeFile(path.join(repositoryRoot, 'Dockerfile'), 'edited after capture');
  const result = await buildCapturedSource(captured.workspace, 'synthetic-builder', path.join(repositoryRoot, 'synthetic.env'), dependencies);
  assert.equal(result.state, 'built-unqualified');
  assert.deepEqual(result.identity, captured.identity);
  assert.equal(calls.filter((args) => args[0] === 'buildx').length, 2);
  assert.ok(calls[1].includes(path.join(captured.workspace, 'context')));
  const build = calls.at(-1);
  assert.deepEqual(build.slice(-5), ['build', '--builder', 'synthetic-builder', '--no-cache', 'mofacts']);
  assert.equal(calls.some((args) => args.includes('push') || args.includes('up') || args.includes('test:ci')), false);
  assert.equal((await fs.readdir(captured.workspace)).some((name) => name.startsWith('round-trip-')), false);
});

test('synthetic capture rejects local tampering before attempting Docker verification', async (t) => {
  const { captured, calls, dependencies } = await syntheticCapture(t);
  await fs.writeFile(path.join(captured.workspace, 'context/mofacts/source.ts'), 'tampered');
  await assert.rejects(verifyCapture(captured.workspace, 'synthetic-builder', dependencies), /validation failed/);
  assert.equal(calls.length, 1);
});

test('synthetic capture rejects changed Docker round-trip metadata and removes the failed export', async (t) => {
  const { captured, calls, dependencies } = await syntheticCapture(t, (state, invocations) => {
    if (state.phase === 'export' && invocations.length > 1) state.items[3].mode = 0o755;
  });
  await assert.rejects(buildCapturedSource(captured.workspace, 'synthetic-builder', 'synthetic.env', dependencies), /validation failed/);
  assert.equal(calls.some((args) => args[0] === 'compose'), false);
  assert.equal((await fs.readdir(captured.workspace)).some((name) => name.startsWith('round-trip-')), false);
});

test('synthetic failed build is propagated without a successful result or a live-context retry', async (t) => {
  const { captured, calls, dependencies } = await syntheticCapture(t, (state) => {
    if (state.phase === 'build') throw new Error('Synthetic build failed');
  });
  await assert.rejects(buildCapturedSource(captured.workspace, 'synthetic-builder', 'synthetic.env', dependencies), /Synthetic build failed/);
  assert.equal(calls.filter((args) => args[0] === 'compose' && args.includes('build')).length, 1);
});

test('synthetic failed initial export removes its incomplete workspace', async (t) => {
  const { dependencies } = await syntheticCapture(t);
  let destination;
  dependencies.docker = async (args, options) => {
    // The consume closure writes only to the newly owned export directory.
    const before = new Set(await fs.readdir(os.tmpdir()));
    assert.ok(args.includes('source_capture'));
    await assert.rejects(options.consume(chunks(Buffer.alloc(12))), /validation failed/);
    destination = [...before].filter((name) => name.startsWith('mofacts-qualified-build-'));
    throw new Error('Synthetic export failed');
  };
  const before = new Set(await fs.readdir(os.tmpdir()));
  await assert.rejects(prepareCapture('synthetic-builder', 'a'.repeat(40), false, dependencies), /Synthetic export failed/);
  const after = new Set(await fs.readdir(os.tmpdir()));
  assert.ok(destination.length >= 1);
  assert.deepEqual([...after].filter((name) => name.startsWith('mofacts-qualified-build-') && !before.has(name)), []);
});

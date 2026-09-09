const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  clientPassingCount,
  validateMeteorTestModules,
} = require('./meteorCiHarness.cjs');
const {
  CLIENT_LIBRARY_NAME,
  rspackClientOutputContract,
} = require('./rspackClientOutputContract.cjs');
const {
  findMeteorTestVersionArtifacts,
  removeMeteorTestVersionArtifacts,
} = require('./meteorTestVersionArtifacts.cjs');

const completePackage = {
  meteor: {
    testModule: {
      client: 'client-test-entry.js',
      server: 'server-test-entry.js',
    },
  },
};

test('accepts explicit existing client and server test modules', () => {
  assert.doesNotThrow(() => validateMeteorTestModules(completePackage, '/app', () => true));
});

test('rejects a missing configured test module', () => {
  assert.throws(
    () => validateMeteorTestModules(completePackage, '/app', (file) => !file.endsWith('client-test-entry.js')),
    /meteor\.testModule\.client does not identify an existing file/,
  );
});

test('rejects an absent client reporter section', () => {
  assert.equal(clientPassingCount('564 passing\nAll tests finished!'), null);
});

test('recognizes an ANSI-formatted zero-test client result', () => {
  const output = '----- RUNNING CLIENT TESTS -----\n\u001b[92m \u001b[0m\u001b[32m 0 passing\u001b[0m';
  assert.equal(clientPassingCount(output), 0);
});

test('returns a nonzero client passing count', () => {
  const output = '----- RUNNING CLIENT TESTS -----\n127 passing\nAll tests finished!';
  assert.equal(clientPassingCount(output), 127);
});

test('removes only Meteor test-driver resolutions from the application version manifest', () => {
  const versions = [
    'meteor@2.3.1',
    'meteortesting:browser-tests@1.8.0_1',
    'meteortesting:mocha@3.4.0',
    'meteortesting:mocha-core@8.2.0',
    'minimongo@2.2.0',
    '',
  ].join('\n');

  assert.deepEqual(findMeteorTestVersionArtifacts(versions), [
    'meteortesting:browser-tests@1.8.0_1',
    'meteortesting:mocha@3.4.0',
    'meteortesting:mocha-core@8.2.0',
  ]);
  assert.equal(
    removeMeteorTestVersionArtifacts(versions),
    ['meteor@2.3.1', 'minimongo@2.2.0', ''].join('\n'),
  );
});

test('preserves unrelated Meteor version changes while cleaning test artifacts', () => {
  const versions = [
    'custom:test-support@1.0.0\r\n',
    'meteortesting:mocha@3.4.0\r\n',
    'new-runtime-package@2.0.0\r\n',
  ].join('');

  assert.equal(
    removeMeteorTestVersionArtifacts(versions),
    'custom:test-support@1.0.0\r\nnew-runtime-package@2.0.0\r\n',
  );
});

test('pins the source-owned Rspack client-test bridge correction', () => {
  const appRoot = path.resolve(__dirname, '..');
  const directPackages = fs.readFileSync(path.join(appRoot, '.meteor/packages'), 'utf8');
  const resolvedVersions = fs.readFileSync(path.join(appRoot, '.meteor/versions'), 'utf8');
  const packageManifest = fs.readFileSync(path.join(appRoot, 'packages/rspack/package.js'), 'utf8');
  const moduleImports = fs.readFileSync(path.join(appRoot, 'packages/rspack/lib/module-imports.js'), 'utf8');
  const serverBridge = fs.readFileSync(path.join(appRoot, 'packages/rspack/rspack_server.js'), 'utf8');
  const provenance = fs.readFileSync(path.join(appRoot, 'packages/rspack/MOFACTS-OVERRIDE.md'), 'utf8');

  assert.match(directPackages, /^rspack@1\.1\.1$/m);
  assert.match(resolvedVersions, /^rspack@1\.1\.1$/m);
  assert.match(packageManifest, /version: '1\.1\.1'/);
  assert.match(moduleImports, /served as a static resource and injected as a <script>/);
  assert.doesNotMatch(moduleImports, /isMeteorBlazeProject/);
  assert.match(serverBridge, /RSPACK_BUNDLE_REGEX/);
  assert.match(provenance, /fa20c29abb4ae30fe78facab2819ce4f5c99e588/);
});

test('pins the source-owned Meteor DDP session-removal correction', () => {
  const appRoot = path.resolve(__dirname, '..');
  const directPackages = fs.readFileSync(path.join(appRoot, '.meteor/packages'), 'utf8');
  const resolvedVersions = fs.readFileSync(path.join(appRoot, '.meteor/versions'), 'utf8');
  const packageManifest = fs.readFileSync(path.join(appRoot, 'packages/ddp-server/package.js'), 'utf8');
  const serverSource = fs.readFileSync(path.join(appRoot, 'packages/ddp-server/livedata_server.js'), 'utf8');
  const serverTests = fs.readFileSync(path.join(appRoot, 'packages/ddp-server/livedata_server_tests.js'), 'utf8');
  const provenance = fs.readFileSync(path.join(appRoot, 'packages/ddp-server/MOFACTS-OVERRIDE.md'), 'utf8');

  assert.match(directPackages, /^ddp-server@3\.3\.0$/m);
  assert.match(resolvedVersions, /^ddp-server@3\.3\.0$/m);
  assert.match(packageManifest, /version: '3\.3\.0'/);
  assert.match(serverSource, /session\.messageQueue = null/);
  assert.match(serverSource, /!existingSession\._expectingDisconnect/);
  assert.doesNotMatch(serverSource, /Meteor\.defer\(\(\) => \{\s*messageQueue\.forEach/);
  assert.match(serverTests, /send after session removal is a no-op/);
  assert.match(provenance, /3f23e5e402cf9091a4515cb94130b6a0a9ced11e/);
  assert.match(provenance, /14528/);
});

test('pins the source-owned cross-platform Playwright worker', () => {
  const appRoot = path.resolve(__dirname, '..');
  const packageRoot = path.join(appRoot, 'packages/browser-tests');
  const packageManifest = fs.readFileSync(path.join(packageRoot, 'package.js'), 'utf8');
  const server = fs.readFileSync(path.join(packageRoot, 'server.js'), 'utf8');
  const worker = fs.readFileSync(
    path.join(packageRoot, 'browser/playwright_worker.mjs'),
    'utf8',
  );
  const runner = fs.readFileSync(path.join(appRoot, 'scripts/runMeteorCiTest.cjs'), 'utf8');
  const provenance = fs.readFileSync(path.join(packageRoot, 'MOFACTS-OVERRIDE.md'), 'utf8');

  assert.match(packageManifest, /name: 'meteortesting:browser-tests'/);
  assert.match(packageManifest, /version: '1\.8\.0_1'/);
  assert.match(server, /driver !== 'playwright'/);
  assert.match(worker, /pathToFileURL/);
  assert.match(worker, /node_modules', 'playwright', 'index\.mjs'/);
  assert.doesNotMatch(worker, /`\$\{process\.cwd\(\)\}\/node_modules/);
  assert.doesNotMatch(runner, /Refusing to run the Meteor Playwright client suite on Windows/);
  assert.match(runner, /meteorTestEnv\.EXPECTED_MONGO_DB_NAME = 'meteor'/);
  assert.match(runner, /meteorTestEnv\.METEOR_REACTIVITY_ORDER = 'changeStreams'/);
  assert.match(runner, /meteorTestEnv\.DDP_TRANSPORT = 'sockjs'/);
  assert.match(runner, /meteorTestEnv\.MOFACTS_SELF_HOSTED = 'false'/);
  assert.match(runner, /meteorTestEnv\.MOFACTS_REQUIRE_REDIS = 'false'/);
  assert.match(runner, /meteorTestEnv\.TEST_BROWSER_DRIVER = 'playwright'/);
  assert.match(runner, /meteorTestEnv\.PLAYWRIGHT_BROWSER = 'chromium'/);
  assert.match(provenance, /b88bfb72822ce3d67aa2726c7c14f27a8f37fcb4/);
});

test('emits injected client bundles with a browser-owned library target', () => {
  const expectedOutput = {
    externalsType: 'commonjs2',
    output: {
      library: CLIENT_LIBRARY_NAME,
      libraryTarget: 'window',
    },
  };

  assert.deepEqual(
    rspackClientOutputContract({ isClient: true, isTest: true }),
    expectedOutput,
  );
  assert.deepEqual(
    rspackClientOutputContract({ isClient: true, isProduction: true }),
    expectedOutput,
  );
  assert.deepEqual(
    rspackClientOutputContract({ isClient: true, isDevelopment: true }),
    expectedOutput,
  );
});

test('does not change server or native client output ownership', () => {
  assert.deepEqual(
    rspackClientOutputContract({ isServer: true, isTest: true }),
    {},
  );
  assert.deepEqual(
    rspackClientOutputContract({ isClient: true, isNative: true }),
    {},
  );
});

test('keeps explicitly imported standalone test files in the Docker context', () => {
  const dockerignore = fs.readFileSync(path.resolve(__dirname, '../../.dockerignore'), 'utf8');
  const entries = new Set(
    dockerignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  assert.equal(entries.has('mofacts/tests/*'), true);
  assert.equal(entries.has('!mofacts/tests/changeStreamsQualificationContract.ts'), true);
  assert.equal(entries.has('!mofacts/tests/logComparison.test.js'), true);
});

test('requires explicit acknowledgments for both coordinated recovery actions', () => {
  const appRoot = path.resolve(__dirname, '..');
  const clientFixture = fs.readFileSync(
    path.join(appRoot, 'client/lib/changeStreamsQualification.test.ts'),
    'utf8',
  );
  const serverFixture = fs.readFileSync(
    path.join(appRoot, 'server/lib/changeStreamsQualificationFixture.test.ts'),
    'utf8',
  );
  const workflow = fs.readFileSync(
    path.resolve(appRoot, '../.github/workflows/meteor-35-change-streams-qualification.yml'),
    'utf8',
  );

  assert.doesNotMatch(clientFixture, /setTimeout\(resolve, 3_000\)/);
  assert.match(serverFixture, /await access\(markerPath\)/);
  assert.match(serverFixture, /qualification-action-timeout/);
  assert.match(workflow, /rm -f "\$history_marker"/);
  assert.match(workflow, /rm -f "\$restart_marker"/);
  assert.match(workflow, /idleCursors:true/);
  assert.match(workflow, /operation\.cursor\?\.originatingCommand/);
  assert.doesNotMatch(workflow, /MOFACTS_CHANGE_STREAMS_ENABLED/);
  assert.doesNotMatch(serverFixture, /MOFACTS_CHANGE_STREAMS_ENABLED/);
  assert.match(workflow, /METEOR_REACTIVITY_ORDER: changeStreams/);
});

test('qualifies production-shaped projections and the real non-reactive paged publication', () => {
  const appRoot = path.resolve(__dirname, '..');
  const contract = fs.readFileSync(
    path.join(appRoot, 'tests/changeStreamsQualificationContract.ts'),
    'utf8',
  );
  const clientFixture = fs.readFileSync(
    path.join(appRoot, 'client/lib/changeStreamsQualification.test.ts'),
    'utf8',
  );
  const serverFixture = fs.readFileSync(
    path.join(appRoot, 'server/lib/changeStreamsQualificationFixture.test.ts'),
    'utf8',
  );
  const publications = fs.readFileSync(
    path.join(appRoot, 'server/publications.ts'),
    'utf8',
  );

  assert.match(serverFixture, /fields: \{ 'nested\.visible': 1 \}/);
  assert.doesNotMatch(serverFixture, /nested: \{ visible: 1 \}/);
  assert.doesNotMatch(contract, /orderedPage|nestedObjectProjection/);
  assert.doesNotMatch(clientFixture, /ordered limited page|orderedPage/);
  assert.match(serverFixture, /publish_handlers\.filteredUsers/);
  assert.match(serverFixture, /non-reactive snapshot/);
  assert.match(serverFixture, /createRoleAsync\('admin', \{ unlessExists: true \}\)/);
  assert.match(publications, /await \(Meteor\.users\.find\(query/);
  assert.doesNotMatch(publications, /pagedUsersCursor\.observeChanges/);
});

test('enforces one canonical hotfix server on localhost', () => {
  const appRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(appRoot, '..');
  const deployRoot = path.join(repoRoot, 'deploy');
  const baseCompose = fs.readFileSync(
    path.join(deployRoot, 'docker-compose.yml'),
    'utf8',
  );
  const localCompose = fs.readFileSync(
    path.join(deployRoot, 'docker-compose.local.yml'),
    'utf8',
  );
  const hotfixManager = fs.readFileSync(
    path.join(deployRoot, 'hotfix-local.ps1'),
    'utf8',
  );
  const rspackBuildContext = fs.readFileSync(
    path.join(appRoot, 'packages/rspack/lib/build-context.js'),
    'utf8',
  );
  const rspackConfig = fs.readFileSync(
    path.join(appRoot, 'rspack.config.js'),
    'utf8',
  );
  const qualificationCompose = fs.readFileSync(
    path.join(deployRoot, 'docker-compose.change-streams-qualification.yml'),
    'utf8',
  );
  const agentGuide = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  const composeFilesPublishingLocalhost = fs
    .readdirSync(deployRoot)
    .filter((fileName) => /^docker-compose.*\.ya?ml$/.test(fileName))
    .filter((fileName) =>
      /["']3200:3000["']/.test(fs.readFileSync(path.join(deployRoot, fileName), 'utf8')),
    );

  assert.match(baseCompose, /MOFACTS_CHANGE_STREAMS_QUALIFICATION: 'false'/);
  assert.match(rspackConfig, /const acornRuntimePath = require\.resolve\("acorn"\)/);
  assert.match(rspackConfig, /"acorn\$": acornRuntimePath/);
  assert.match(baseCompose, /METEOR_REACTIVITY_ORDER: changeStreams/);
  assert.doesNotMatch(localCompose, /^\s{2}mofacts:/m);
  assert.deepEqual(composeFilesPublishingLocalhost, []);
  assert.match(hotfixManager, /-f", "docker-compose\.yml"/);
  assert.match(hotfixManager, /-f", "docker-compose\.local\.yml"/);
  assert.match(hotfixManager, /config", "--quiet"/);
  assert.match(hotfixManager, /@\("stop", "mofacts"\)/);
  assert.match(hotfixManager, /@\("rm", "-f", "mofacts"\)/);
  assert.match(hotfixManager, /Remove-Item Env:MOFACTS_CHANGE_STREAMS_ENABLED/);
  assert.match(hotfixManager, /\$env:METEOR_REACTIVITY_ORDER = "changeStreams"/);
  assert.match(hotfixManager, /-FilePath \$meteorTool\.NodeExe/);
  assert.match(hotfixManager, /"--require=\$\(\$meteorTool\.WarningModule\)"/);
  assert.match(hotfixManager, /\$meteorTool\.ToolEntry/);
  assert.match(hotfixManager, /\$env:NODE_PATH = \$meteorTool\.NodePath/);
  assert.match(hotfixManager, /\$env:BABEL_CACHE_DIR = \$meteorTool\.BabelCacheDir/);
  assert.match(hotfixManager, /-Action", "__supervise"/);
  assert.match(hotfixManager, /New-HotfixProcessJob/);
  assert.match(hotfixManager, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(hotfixManager, /AssignProcessToJobObject/);
  assert.match(hotfixManager, /Test-TrackedProcess/);
  assert.match(hotfixManager, /Stop-ObsoleteCommonJsGuardProcesses/);
  assert.match(hotfixManager, /Archive-HotfixRunLogs/);
  assert.match(hotfixManager, /Get-HotfixFailureSummary/);
  assert.match(hotfixManager, /Ensure-CommonJsBoundary/);
  assert.match(hotfixManager, /Reset-RspackDevContext/);
  assert.match(hotfixManager, /Remove-Item -LiteralPath \$mainDevDir -Recurse -Force/);
  assert.match(hotfixManager, /Refusing to reset Rspack development context outside \$buildRoot/);
  assert.doesNotMatch(hotfixManager, /Get-CimInstance|LastWriteTime\s*=|Ensure-CommonJsBuildMarker|Remove-RspackDevBuild/);
  assert.match(hotfixManager, /\$RequiredStableChecks = 4/);
  assert.match(hotfixManager, /\$stableChecks \+= 1\s*if \(\$stableChecks -ge \$RequiredStableChecks\)/);
  assert.match(hotfixManager, /\$startupError = \$_/);
  assert.match(hotfixManager, /Set-HotfixRunStateStatus -Status "startup-failed"/);
  assert.match(hotfixManager, /\$RecoveryAttempt -eq 0 -and \$failureSummary -eq "Meteor lost its MongoDB connection pool\."/);
  assert.match(hotfixManager, /Start-HotfixDev -RecoveryAttempt 1/);
  assert.match(hotfixManager, /throw \$startupError/);
  assert.match(hotfixManager, /Get-HotfixDevClientBundleState/);
  assert.match(hotfixManager, /__mofactsRspackClient/);
  assert.match(hotfixManager, /module\\\.exports\\s\*=\\s\*__webpack_exports__/);
  assert.match(hotfixManager, /assert-change-streams\.sh/);
  assert.equal(fs.existsSync(path.join(deployRoot, 'hotfix/ensure-commonjs-build.ps1')), false);
  assert.match(rspackBuildContext, /function writeFileAtomically/);
  assert.match(rspackBuildContext, /shouldPreserveMainDevelopmentContext/);
  assert.match(rspackBuildContext, /!shouldPreserveMainDevelopmentContext \? \[mainClientPath, mainServerPath\] : \[\]/);
  assert.match(rspackConfig, /Meteor\.isDevelopment && !Meteor\.isTest && !Meteor\.isNative && Meteor\.setCache\("memory"\)/);
  assert.equal(fs.existsSync(path.join(deployRoot, 'mongodb/assert-change-streams.js')), true);
  assert.equal(fs.existsSync(path.join(deployRoot, 'mongodb/assert-change-streams.sh')), true);
  assert.match(agentGuide, /There is exactly one localhost application server/);
  for (const removedPath of [
    'docker-compose.hotfix-local.yml',
    'docker-compose.hotfix-native.yml',
    'hotfix-dev.ps1',
    'hotfix-dev',
  ]) {
    assert.equal(fs.existsSync(path.join(deployRoot, removedPath)), false, removedPath);
  }
  assert.doesNotMatch(qualificationCompose, /MOFACTS_CHANGE_STREAMS_ENABLED/);
  assert.match(qualificationCompose, /MOFACTS_CHANGE_STREAMS_QUALIFICATION: 'true'/);
  assert.match(qualificationCompose, /METEOR_REACTIVITY_ORDER: changeStreams/);
});

const { spawn } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const {
  clientPassingCount,
  validateMeteorTestModules,
} = require('./meteorCiHarness.cjs');
const {
  findMeteorTestVersionArtifacts,
  removeMeteorTestVersionArtifacts,
} = require('./meteorTestVersionArtifacts.cjs');

const appRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(appRoot, 'package.json'));
const meteorVersionsPath = path.join(appRoot, '.meteor/versions');

try {
  validateMeteorTestModules(packageJson, appRoot);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (!process.env.CI) {
  console.error(
    [
      'Refusing to run Meteor CI tests outside CI.',
      'This repository does not treat the local Meteor Mocha harness as supported local verification.',
      'Use npm run typecheck and npm run lint locally, and use CI for Meteor integration and client contract coverage.',
    ].join('\n'),
  );
  process.exit(1);
}

const testSettingsFile = String(process.env.TEST_SETTINGS_FILE || '').trim();
if (!testSettingsFile) {
  console.error('TEST_SETTINGS_FILE is required and must identify the Meteor test settings file.');
  process.exit(1);
}
if (!existsSync(testSettingsFile)) {
  console.error('TEST_SETTINGS_FILE does not identify an existing file.');
  process.exit(1);
}

const initialMeteorVersionArtifacts = findMeteorTestVersionArtifacts(
  readFileSync(meteorVersionsPath, 'utf8'),
);
if (initialMeteorVersionArtifacts.length > 0) {
  console.error(
    '.meteor/versions already contains Meteor test-driver resolutions. Remove them before starting CI.',
  );
  process.exit(1);
}

const meteorTestEnv = { ...process.env };
delete meteorTestEnv.FORCE_COLOR;
delete meteorTestEnv.NO_COLOR;
// Own the fixed Meteor test runtime contract here so every CI or explicitly
// authorized invocation receives the same application and browser settings.
// MONGO_URL remains owned by Meteor's test MongoDB or the CI replica-set job.
meteorTestEnv.EXPECTED_MONGO_DB_NAME = 'meteor';
meteorTestEnv.METEOR_REACTIVITY_ORDER = 'changeStreams';
meteorTestEnv.DDP_TRANSPORT = 'sockjs';
meteorTestEnv.MOFACTS_SELF_HOSTED = 'false';
meteorTestEnv.MOFACTS_REQUIRE_REDIS = 'false';
meteorTestEnv.TEST_BROWSER_DRIVER = 'playwright';
meteorTestEnv.PLAYWRIGHT_BROWSER = 'chromium';
// meteortesting:browser-tests uses PWD as the Playwright worker cwd. Windows
// does not define PWD, so provide the exact project directory explicitly.
meteorTestEnv.PWD = process.cwd();

const rawTimeoutMs = String(process.env.TEST_RUN_TIMEOUT_MS || '1200000').trim();
if (!/^\d+$/.test(rawTimeoutMs)) {
  console.error('TEST_RUN_TIMEOUT_MS must be an integer number of milliseconds.');
  process.exit(1);
}

const testRunTimeoutMs = Number(rawTimeoutMs);
if (!Number.isSafeInteger(testRunTimeoutMs) || testRunTimeoutMs < 60000) {
  console.error('TEST_RUN_TIMEOUT_MS must be a safe integer of at least 60000.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';

const child = spawn(
  'meteor',
  [
    'test',
    '--once',
    '--driver-package=meteortesting:mocha',
    '--port',
    '3010',
    '--settings',
    testSettingsFile,
  ],
  {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
    detached: !isWindows,
    env: meteorTestEnv,
  },
);

const maxCapturedStdoutBytes = 2 * 1024 * 1024;
let testStdoutTail = '';
child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  testStdoutTail = `${testStdoutTail}${chunk.toString()}`.slice(-maxCapturedStdoutBytes);
});
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

let finished = false;
let timedOut = false;
let timeoutHandle;
let forceKillHandle;
let hardExitHandle;
let meteorVersionsCleaned = false;

function cleanMeteorTestVersionArtifacts() {
  if (meteorVersionsCleaned) return true;
  try {
    const currentVersions = readFileSync(meteorVersionsPath, 'utf8');
    const cleanedVersions = removeMeteorTestVersionArtifacts(currentVersions);
    if (cleanedVersions !== currentVersions) {
      writeFileSync(meteorVersionsPath, cleanedVersions, 'utf8');
      console.log('Removed Meteor test-driver resolutions from .meteor/versions.');
    }
    meteorVersionsCleaned = true;
    return true;
  } catch (error) {
    console.error(`Unable to clean Meteor test-driver resolutions: ${error.message}`);
    return false;
  }
}

// Normal completion calls this through finish(). The exit hook also covers an
// interrupted wrapper; the pre-commit invariant remains the final protection
// if the entire process tree is forcibly terminated before cleanup can run.
process.once('exit', cleanMeteorTestVersionArtifacts);

function finish(exitStatus) {
  if (finished) return;
  finished = true;
  clearTimeout(timeoutHandle);
  clearTimeout(forceKillHandle);
  clearTimeout(hardExitHandle);
  process.exit(cleanMeteorTestVersionArtifacts() ? exitStatus : 1);
}

function terminateTestTree() {
  if (!child.pid) return;

  if (isWindows) {
    const killer = spawn(
      'taskkill',
      ['/pid', String(child.pid), '/t', '/f'],
      { stdio: 'inherit', windowsHide: true },
    );
    killer.once('error', (error) => {
      console.error(`Unable to terminate timed-out Meteor test tree: ${error.message}`);
    });
    killer.once('exit', (status) => {
      if (status !== 0 && child.exitCode === null) {
        console.error(`taskkill exited with status ${status} while terminating the Meteor test tree.`);
      }
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`Unable to terminate timed-out Meteor test group: ${error.message}`);
    }
  }

  forceKillHandle = setTimeout(() => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        console.error(`Unable to force-stop timed-out Meteor test group: ${error.message}`);
      }
    }
  }, 5000);
}

timeoutHandle = setTimeout(() => {
  timedOut = true;
  console.error(`Meteor CI tests exceeded ${testRunTimeoutMs} ms; terminating the test process tree.`);
  terminateTestTree();
  hardExitHandle = setTimeout(() => {
    console.error('Meteor test process tree did not report exit after termination; forcing wrapper exit.');
    finish(1);
  }, 15000);
}, testRunTimeoutMs);

child.once('error', (error) => {
  console.error(error.message);
  finish(1);
});

child.once('exit', (exitStatus, signal) => {
  if (timedOut) {
    finish(1);
    return;
  }

  if (signal) {
    console.error(`Meteor test process exited via signal ${signal}`);
    finish(1);
    return;
  }

  if (exitStatus === 0) {
    const passingCount = clientPassingCount(testStdoutTail);
    if (!passingCount) {
      console.error('Meteor CI client tests did not report a nonzero passing count.');
      finish(1);
      return;
    }
  }

  finish(exitStatus ?? 1);
});

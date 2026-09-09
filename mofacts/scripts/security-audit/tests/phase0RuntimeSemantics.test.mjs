import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { sourceFile, oneNode, evaluateNode, namedFunction, ts } from './helpers/sourceWitnesses.mjs';
import { canAccessContentUploadTdf, canDownloadOwnedTdfData, canViewDashboardTdf } from '../../../server/lib/contentAccessPolicy.ts';

function registration(source, expression) {
  return oneNode(source, (node) => ts.isCallExpression(node) && node.expression.getText(source) === expression);
}

test('Phase 0 manifest: reviewed brand and progressive surfaces retain explicit classifications', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../../security-surface-contract.json', import.meta.url), 'utf8'));
  for (const name of ['exportDeploymentBrandProfile', 'getDeploymentBrandProfileDraft',
    'importDeploymentBrandProfileDraft', 'publishDeploymentBrandProfile', 'saveDeploymentBrandProfileDraft']) {
    assert.deepEqual(manifest.methods.filter((entry) => entry.name === name), [{ name, access: 'admin-only' }]);
  }
  for (const [kind, name, access] of [
    ['methods', 'getProgressiveAssignmentLaunch', 'authenticated-self'],
    ['publications', 'deploymentBrandProfile', 'public'],
    ['exports', 'method:exportDeploymentBrandProfile', 'admin-only'],
  ]) assert.deepEqual(manifest[kind].filter((entry) => entry.name === name), [{ name, access }]);
});

test('Phase 0 compatibility: all brand methods authorize before reading, parsing or writing drafts', async () => {
  const source = sourceFile('server/methods/deploymentBrandProfileMethods.ts');
  const calls = [];
  const denied = new Error('Synthetic admin denial');
  const factory = namedFunction(source, 'createDeploymentBrandProfileMethods', {
    Meteor: { Error },
    readDeploymentBrandProfileDraft: async () => { calls.push('read'); return { updatedAt: 'synthetic', updatedBy: 'synthetic' }; },
    saveDeploymentBrandProfileDraft: async (value, userId) => { calls.push(['save', value, userId]); return value; },
    publishDeploymentBrandProfile: async (userId) => { calls.push(['publish', userId]); return 'published'; },
  });
  const methods = factory({ requireAdminUser: async (id) => {
    calls.push(['authorize', id]);
    if (id !== 'synthetic-admin') throw denied;
  } });
  for (const method of Object.values(methods)) {
    for (const userId of [null, 'synthetic-learner']) {
      calls.length = 0;
      await assert.rejects(method.call({ userId }, '{invalid-json'), (error) => error === denied);
      assert.deepEqual(calls, [['authorize', userId]]);
    }
  }
  const context = { userId: 'synthetic-admin' };
  for (const name of ['getDeploymentBrandProfileDraft', 'exportDeploymentBrandProfile']) {
    calls.length = 0;
    const result = await methods[name].call(context);
    assert.deepEqual(calls, [['authorize', context.userId], 'read']);
    if (name === 'exportDeploymentBrandProfile') assert.deepEqual(JSON.parse(result), { updatedAt: '', updatedBy: '' });
  }
  for (const name of ['saveDeploymentBrandProfileDraft', 'importDeploymentBrandProfileDraft']) {
    calls.length = 0;
    await methods[name].call(context, { synthetic: true });
    assert.deepEqual(calls, [['authorize', context.userId], ['save', { synthetic: true }, context.userId]]);
  }
  calls.length = 0;
  assert.equal(await methods.publishDeploymentBrandProfile.call(context), 'published');
  assert.deepEqual(calls, [['authorize', context.userId], ['publish', context.userId]]);
});

test('Phase 0 compatibility: anonymous brand publication selects the published key, not the draft', async () => {
  const source = sourceFile('server/publications.ts');
  const call = oneNode(source, (node) => ts.isCallExpression(node)
    && node.expression.getText(source) === 'Meteor.publish' && node.arguments[0]?.text === 'deploymentBrandProfile');
  const events = [];
  const callback = evaluateNode(call.arguments[1], source, {
    ensurePublishedDeploymentBrandProfile: async () => { events.push('ensure'); },
    DEPLOYMENT_BRAND_PROFILE_KEY: 'synthetic-published-key',
    DynamicSettings: { find: (query) => { events.push(JSON.parse(JSON.stringify(query))); return 'synthetic-cursor'; } },
  });
  assert.equal(await callback.call({ userId: null }), 'synthetic-cursor');
  assert.deepEqual(events, ['ensure', { key: 'synthetic-published-key' }]);
});

test('Phase 0 compatibility: progressive launch uses caller snapshot and denies unavailable assignments before database access', async () => {
  const source = sourceFile('server/methods/courseMethods.ts');
  class SyntheticMeteorError extends Error {
    constructor(code, reason) { super(reason); this.error = code; }
  }
  let snapshot = { assignedCourses: [], publicCourses: [] };
  const callers = [];
  const launch = namedFunction(source, 'getProgressiveAssignmentLaunch', {
    Meteor: { Error: SyntheticMeteorError },
    requireAuthenticatedUser: (id) => { if (!id) throw new SyntheticMeteorError(401, 'Synthetic authentication denial'); return id; },
    deps: { normalizeCanonicalId: (id) => id, Assignments: { findOneAsync: () => assert.fail('Denied launch must not query assignments') } },
    getCourseSnapshotCache: () => ({ ensureLearnerCoursesSnapshot: async (id) => { callers.push(id); return snapshot; } }),
  });
  await assert.rejects(launch.call({ userId: null }, 'assignment', 'endpoint'), (error) => error.error === 401);
  assert.deepEqual(callers, []);
  await assert.rejects(launch.call({ userId: 'synthetic-learner' }, 'assignment', 'endpoint'), (error) => error.error === 403);
  snapshot = { assignedCourses: [{ assignments: [{ assignmentId: 'assignment', assignmentType: 'progressive', availability: 'scheduled' }] }], publicCourses: [] };
  await assert.rejects(launch.call({ userId: 'synthetic-learner' }, 'assignment', 'endpoint'), (error) => error.error === 403);
  assert.deepEqual(callers, ['synthetic-learner', 'synthetic-learner']);
});

test('Phase 0 compatibility: publication denial remains ready(), not a new exception', () => {
  const source = sourceFile('server/publications.ts');
  const call = oneNode(source, (node) => ts.isCallExpression(node)
    && node.expression.getText(source) === 'Meteor.publish' && node.arguments[0]?.kind === ts.SyntaxKind.NullKeyword);
  let readyCalls = 0;
  let query;
  const callback = evaluateNode(call.arguments[1], source, {
    getRoleAssignment: () => ({ find: (value) => { query = value; return 'synthetic-cursor'; } }),
  });
  assert.equal(callback.call({ userId: null, ready() { readyCalls++; return 'synthetic-ready'; } }), 'synthetic-ready');
  assert.equal(readyCalls, 1);
  assert.equal(query, undefined);
  assert.equal(callback.call({ userId: 'synthetic-owner' }), 'synthetic-cursor');
  assert.equal(query['user._id'], 'synthetic-owner');
});

test('Phase 0 compatibility: backup authorization, validation, unblock and actor context keep their order', async () => {
  const source = sourceFile('server/methods/backupMethods.ts');
  const calls = [];
  class SyntheticMeteorError extends Error {
    constructor(code, reason) { super(reason); this.error = code; }
  }
  const factory = namedFunction(source, 'createBackupMethods', {
    Meteor: { Error: SyntheticMeteorError },
    requireAdmin: namedFunction(source, 'requireAdmin'),
    actorFromContext: namedFunction(source, 'actorFromContext'),
    runExclusiveBackupOperation: (work) => work(),
    verifyBackupJob: async (_deps, actor, id) => { calls.push(['verify', actor.userId, actor.connection.clientAddress, id]); return 'synthetic-result'; },
  });
  const deps = { requireAdminUser: async (id) => {
    calls.push(['authorize', id]);
    if (id !== 'synthetic-admin') throw new SyntheticMeteorError('not-authorized', 'Synthetic denial');
  } };
  const method = factory(deps)['admin.backups.verify'];
  const context = { userId: 'synthetic-admin', connection: { clientAddress: '192.0.2.1' }, unblock() { calls.push(['unblock']); } };
  assert.equal(await method.call(context, ' synthetic-job '), 'synthetic-result');
  assert.deepEqual(calls, [['authorize', 'synthetic-admin'], ['unblock'], ['verify', 'synthetic-admin', '192.0.2.1', 'synthetic-job']]);
  calls.length = 0;
  await assert.rejects(method.call(context, ''), (error) => error.error === 'invalid-backup-job');
  assert.deepEqual(calls, [['authorize', 'synthetic-admin']]);
  calls.length = 0;
  await assert.rejects(method.call({ ...context, userId: null }, ''), (error) => error.error === 'not-authorized');
  assert.deepEqual(calls, [['authorize', null]]);
});

test('Phase 0 compatibility: current synchronous collection mutation rules stay synchronous', () => {
  const source = sourceFile('common/Collections.ts');
  const rule = (name, bindings = {}) => {
    const call = registration(source, `${name}.allow`);
    const property = oneNode(call.arguments[0], (node) => ts.isPropertyAssignment(node) && node.name.getText(source) === 'update');
    return evaluateNode(property.initializer, source, bindings);
  };
  const owned = rule('GlobalExperimentStates');
  assert.equal(owned('synthetic-owner', { userId: 'synthetic-owner' }, [], {}), true);
  assert.equal(owned('synthetic-other', { userId: 'synthetic-owner' }, [], {}), false);
  const admin = rule('DynamicSettings', { Meteor: { roleAssignment: { findOne: (query) =>
    query['user._id'] === 'synthetic-admin' && query['role._id'] === 'admin' ? {} : undefined } } });
  assert.equal(admin('synthetic-admin'), true);
  assert.equal(admin('synthetic-other'), false);
  assert.equal(rule('DynamicSettings', { Meteor: {} })('synthetic-admin'), false);
});

test('Phase 0 compatibility: public/shared/owned content routes retain different intentional permissions', () => {
  const shared = { ownerId: 'synthetic-owner', accessors: [{ userId: 'synthetic-reader' }] };
  const publicTdf = { ...shared, content: { tdfs: { tutor: { setspec: { userselect: 'true' } } } } };
  assert.equal(canViewDashboardTdf(null, publicTdf), true);
  assert.equal(canAccessContentUploadTdf(null, publicTdf), false);
  assert.equal(canAccessContentUploadTdf('synthetic-reader', shared), true);
  assert.equal(canDownloadOwnedTdfData('synthetic-reader', shared), false);
  assert.equal(canDownloadOwnedTdfData('synthetic-owner', shared), true);
});

test('Phase 0 compatibility: health GET/HEAD stay public and other methods fall through', () => {
  const source = sourceFile('server/http/health.ts');
  const call = registration(source, 'WebApp.connectHandlers.use');
  const callback = evaluateNode(call.arguments[1], source, { buildHealthPayload: () => ({ status: 'ok' }) });
  for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
    const events = [];
    callback({ method }, { writeHead: (status) => events.push(status), end: () => events.push('end') }, () => events.push('next'));
    assert.deepEqual(events, ['GET', 'HEAD'].includes(method) ? [200, 'end'] : ['next']);
  }
});

test('Phase 0 compatibility: PWA middleware falls through without touching theme storage for other paths/methods', async () => {
  const source = sourceFile('server/http/pwa.ts');
  const callback = evaluateNode(registration(source, 'WebAppAny.handlers.use').arguments[0], source, {
    URL, APPLE_TOUCH_ICON_ROUTE: '/apple-touch-icon.png', APPLE_TOUCH_ICON_PRECOMPOSED_ROUTE: '/apple-touch-icon-precomposed.png',
    PWA_ICON_ROUTE_PREFIX: '/theme-install-icon/', DEPLOYMENT_BRAND_SOCIAL_IMAGE_ROUTE: '/synthetic-social-image',
  });
  for (const req of [{ method: 'POST', url: '/site.webmanifest' }, { method: 'GET', url: '/unrelated' }]) {
    let next = 0;
    await callback(req, {}, () => { next++; });
    assert.equal(next, 1);
  }
});

test('Phase 0 compatibility: both asset stacks consume the already-stripped mounted URL', async () => {
  const source = sourceFile('server/runtime/dynamicAssetsRoute.ts');
  const observed = [];
  for (const stack of ['rawConnectHandlers', 'connectHandlers']) {
    const call = registration(source, `WebApp.${stack}.use`);
    const callback = evaluateNode(call.arguments[1], source, {
      deps: {}, getFirstPathSegment: namedFunction(source, 'getFirstPathSegment'),
      serveDynamicAssetById: async (_deps, _res, id) => { observed.push([stack, id]); },
    });
    await callback({ url: '/synthetic-asset/display.png?version=2' }, {}, () => assert.fail('Asset route does not fall through'));
  }
  assert.deepEqual(observed, [['rawConnectHandlers', 'synthetic-asset'], ['connectHandlers', 'synthetic-asset']]);
});

test('Phase 0 compatibility: SAML wrong-method 405 and unmatched-path fallthrough remain distinct', () => {
  const source = sourceFile('server/lib/memphisSaml.ts');
  const events = [];
  const callback = evaluateNode(registration(source, 'WebAppCompat.connectHandlers.use').arguments[0], source, {
    getPathname: (req) => req.url,
    MEMPHIS_SAML_LOGIN_PATH: '/synthetic-login', MEMPHIS_SAML_ACS_PATH: '/synthetic-acs', MEMPHIS_SAML_METADATA_PATH: '/synthetic-metadata',
    writeTextResponse: (_res, status) => events.push(status),
    handleMemphisSamlLogin: () => events.push('login'), handleMemphisSamlAcs: () => events.push('acs'), handleMemphisSamlMetadata: () => events.push('metadata'),
  });
  callback({ url: '/synthetic-acs', method: 'GET' }, {}, () => events.push('next'));
  callback({ url: '/unrelated', method: 'GET' }, {}, () => events.push('next'));
  callback({ url: '/synthetic-acs', method: 'POST' }, {}, () => events.push('next'));
  assert.deepEqual(events, [405, 'next', 'acs']);
});

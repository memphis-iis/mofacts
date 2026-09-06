import { expect } from 'chai';
import { progressiveRevisionId } from '../lib/progressiveAssignmentRevision';
import { createAnalyticsMethods } from './analyticsMethods';

function createMeteorErrorClass() {
  return class MeteorError extends Error {
    error: string | number;

    constructor(error: string | number, reason?: string) {
      super(reason || String(error));
      this.error = error;
    }
  };
}

function createHistoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    historySchemaVersion: 1,
    userId: 'learner-1',
    TDFId: 'tdf-1',
    sessionID: 'session-1',
    levelUnit: 0,
    levelUnitType: 'model',
    time: 1710000000000,
    problemStartTime: 1710000000000,
    selection: '',
    action: '',
    outcome: 'correct',
    typeOfResponse: 'text',
    responseValue: 'answer',
    input: 'answer',
    displayedStimulus: {},
    eventType: '',
    stimuliSetId: 'stim-set-1',
    stimulusKC: '101',
    clusterKC: '5',
    KCId: '101',
    KCDefault: '101',
    KCCluster: '5',
    ...overrides,
  };
}

function createAnalyticsDeps(overrides: Record<string, unknown> = {}) {
  let nextEventId = 100;
  const insertedHistory: Record<string, unknown>[] = [];
  const logEntries: unknown[][] = [];
  const deps = {
    serverConsole: (...args: unknown[]) => {
      logEntries.push(args);
    },
    Histories: {
      find: () => ({ fetchAsync: async () => [], countAsync: async () => 0 }),
      findOneAsync: async () => null,
      insertAsync: async (document: Record<string, unknown>) => {
        insertedHistory.push(document);
        return 'history-id';
      },
      rawCollection: () => ({ aggregate: () => ({ toArray: async () => [] }) }),
    },
    StimulusCrowdStats: {
      upsertAsync: async () => true,
      find: () => ({ fetchAsync: async () => [] }),
    },
    GlobalExperimentStates: {
      find: () => ({ fetchAsync: async () => [] }),
      findOneAsync: async () => null,
      updateAsync: async () => true,
      insertAsync: async () => 'state-id',
    },
    Tdfs: {
      find: () => ({ fetchAsync: async () => [] }),
      findOneAsync: async (selector: Record<string, unknown>) => ({
        _id: selector._id || 'tdf-1',
        content: {
          fileName: selector._id === 'child-tdf' ? 'child.json' : 'root.json',
          tdfs: {
            tutor: {
              setspec: {
                userselect: 'true',
              },
            },
          },
        },
        ownerId: 'teacher-1',
        accessors: [],
      }),
      updateAsync: async () => true,
    },
    Assignments: {
      find: () => ({ fetchAsync: async () => [] }),
      findOneAsync: async () => null,
    },
    Courses: {
      find: () => ({ fetchAsync: async () => [] }),
    },
    Sections: {
      find: () => ({ fetchAsync: async () => [] }),
    },
    SectionUserMap: {
      find: () => ({ fetchAsync: async () => [] }),
    },
    usersCollection: {
      find: () => ({ fetchAsync: async () => [] }),
      findOneAsync: async () => ({ _id: 'learner-1', profile: {}, loginParams: {} }),
    },
    getMethodAuthorizationDeps: () => ({
      Meteor: { Error: createMeteorErrorClass() },
      Roles: { userIsInRoleAsync: async () => false },
    }),
    normalizeCanonicalId: (value: unknown) => {
      if (value === null || value === undefined) return null;
      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    normalizeOptionalString: (value: unknown) => {
      if (value === null || value === undefined) return null;
      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    canViewDashboardTdf: async () => false,
    resolveAssignedRootTdfIdsForUser: async () => [],
    allocateNextEventId: () => {
      nextEventId += 1;
      return nextEventId;
    },
    syncUsernameCaches: () => {},
    createExperimentExport: async () => '',
    createExperimentExportByTdfIds: async () => '',
    createExperimentExportFromHistories: async () => '',
    getTdfIdsByOwnerId: async () => [],
    assertUserOwnsTdfs: async () => true,
    canDownloadOwnedTdfData: () => false,
    getClassPerformanceByTdfWorkflow: async () => ({}),
    getStimuliSetById: async () => [],
    hasMeaningfulProgressSignal: () => false,
    ...overrides,
  };

  return {
    deps,
    insertedHistory,
    logEntries,
  };
}

describe('analyticsMethods', function() {
  function createAssignedRootDeps(overrides: Record<string, unknown> = {}) {
    return createAnalyticsDeps({
      resolveAssignedRootTdfIdsForUser: async () => ['root-tdf'],
      Tdfs: {
        find: (selector: Record<string, any>) => ({
          fetchAsync: async () => {
            const refs = [
              ...(selector._id?.$in || []),
              ...(selector.$or
              ?.flatMap((term: Record<string, any>) => [
                ...(term._id?.$in || []),
                ...(term['content.fileName']?.$in || []),
              ]) || []),
            ];
            return refs.includes('child.json') || refs.includes('child-tdf')
              ? [{ _id: 'child-tdf', content: { fileName: 'child.json' } }]
              : [];
          },
        }),
        findOneAsync: async (selector: Record<string, unknown>) => {
          if (selector._id === 'root-tdf') {
            return {
              _id: 'root-tdf',
              stimuliSetId: 'stim-set-1',
              content: {
                fileName: 'root.json',
                tdfs: {
                  tutor: {
                    setspec: {
                      condition: ['child.json'],
                      conditionTdfIds: ['child-tdf'],
                    },
                  },
                },
              },
            };
          }
          if (selector._id === 'child-tdf') {
            return {
              _id: 'child-tdf',
              stimuliSetId: 'stim-set-1',
              content: { fileName: 'child.json' },
            };
          }
          return null;
        },
        updateAsync: async () => true,
      },
      ...overrides,
    });
  }

  it('replaces stale condition-scoped control state for an explicit fresh condition launch', async function() {
    let updateModifier: Record<string, any> | null = null;
    const { deps } = createAssignedRootDeps({
      GlobalExperimentStates: {
        find: () => ({ fetchAsync: async () => [] }),
        findOneAsync: async () => ({
          _id: 'state-1',
          userId: 'learner-1',
          TDFId: 'root-tdf',
          experimentState: {
            currentRootTdfId: 'root-tdf',
            currentTdfId: 'old-child-tdf',
            conditionTdfId: 'old-child-tdf',
            clusterMapping: [0, 1],
            mappingSignature: 'old-signature',
            schedule: { q: [0, 1] },
            scheduleUnitNumber: 0,
          },
        }),
        updateAsync: async (_selector: Record<string, unknown>, modifier: Record<string, any>) => {
          updateModifier = modifier;
          return true;
        },
        insertAsync: async () => 'state-id',
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    const result = await methods.createExperimentState.call(
      { userId: 'learner-1' },
      {
        currentRootTdfId: 'root-tdf',
        currentTdfId: 'child-tdf',
        conditionTdfId: 'child-tdf',
      },
      { replaceExistingState: true },
    );

    const persistedExperimentState = (updateModifier as Record<string, any> | null)?.$set?.experimentState;
    expect(persistedExperimentState).to.deep.equal({
      currentRootTdfId: 'root-tdf',
      currentTdfId: 'child-tdf',
      conditionTdfId: 'child-tdf',
    });
    expect(result).to.include({
      id: 'state-1',
      currentTdfId: 'child-tdf',
      conditionTdfId: 'child-tdf',
    });
  });

  it('insertHistory invokes the dashboard summary hook after durable history insert', async function() {
    const hookRecords: Record<string, unknown>[] = [];
    const { deps, insertedHistory } = createAnalyticsDeps({
      onHistoryInserted: async (_context: unknown, historyRecord: Record<string, unknown>) => {
        hookRecords.push(historyRecord);
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord());

    expect(insertedHistory).to.have.length(1);
    expect(hookRecords).to.have.length(1);
    const persistedHookRecord = hookRecords[0]!;
    expect(persistedHookRecord).to.equal(insertedHistory[0]);
    expect(persistedHookRecord).to.include({
      userId: 'learner-1',
      TDFId: 'tdf-1',
      eventId: 101,
    });
    expect(persistedHookRecord.recordedServerTime).to.be.a('number');
  });

  it('insertHistory keeps the durable history write when the dashboard hook fails', async function() {
    const { deps, insertedHistory, logEntries } = createAnalyticsDeps({
      onHistoryInserted: async () => {
        throw new Error('sensitive cache failure learner-1 answer');
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord());

    expect(insertedHistory).to.have.length(1);
    const failureLog = logEntries.find((entry) => String(entry[0]).includes('Dashboard cache update failed'));
    expect(failureLog).to.not.equal(undefined);
    expect(failureLog?.[1]).to.deep.include({
      eventCategory: 'model',
      historySchemaVersion: 1,
      errorType: 'Error',
    });
    const serializedLog = JSON.stringify(failureLog);
    expect(serializedLog).to.not.include('learner-1');
    expect(serializedLog).to.not.include('tdf-1');
    expect(serializedLog).to.not.include('sensitive cache failure');
    expect(serializedLog).to.not.include('"answer"');
  });

  it('downloadOwnHistoryAcrossTdfs returns a streaming download URL without building the TSV payload', async function() {
    let exportBuilderCalled = false;
    const { deps } = createAnalyticsDeps({
      Histories: {
        find: () => ({ fetchAsync: async () => [], countAsync: async () => 0 }),
        findOneAsync: async () => ({ _id: 'history-1' }),
        insertAsync: async () => 'history-id',
        rawCollection: () => ({ aggregate: () => ({ toArray: async () => [] }) }),
      },
      usersCollection: {
        find: () => ({ fetchAsync: async () => [] }),
        findOneAsync: async () => ({ _id: 'learner-1', username: 'learner@example.edu' }),
      },
      createExperimentExportFromHistories: async () => {
        exportBuilderCalled = true;
        return 'unexpected payload';
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    const result = await methods.downloadOwnHistoryAcrossTdfs.call({ userId: 'learner-1' });

    expect(exportBuilderCalled).to.equal(false);
    expect(result).to.include({
      fileName: 'mofacts_learner@example.edu_own_history_all_tdfs.tsv',
      contentType: 'text/tab-separated-values',
    });
    expect(result.downloadUrl).to.match(/^\/data-download\/own-history\/[^/]+\/mofacts_learner%40example.edu_own_history_all_tdfs.tsv$/);
    expect(result.content).to.equal(undefined);
  });

  it('insertHistory rejects assigned-root history without course context', async function() {
    const { deps, insertedHistory } = createAssignedRootDeps();
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    try {
      await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({
        TDFId: 'root-tdf',
      }));
      expect.fail('Expected assigned-root history without course context to fail');
    } catch (error: any) {
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Course-assigned history requires courseAssignment context');
    }
    expect(insertedHistory).to.have.length(0);
  });

  it('insertHistory rejects assigned child history without course context', async function() {
    const { deps, insertedHistory } = createAssignedRootDeps();
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    try {
      await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({
        TDFId: 'child-tdf',
      }));
      expect.fail('Expected assigned child history without course context to fail');
    } catch (error: any) {
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Course-assigned history requires courseAssignment context');
    }
    expect(insertedHistory).to.have.length(0);
  });

  it('getLearningHistoryForUnit rejects assigned TDF reads without course context', async function() {
    const { deps } = createAssignedRootDeps();
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    try {
      await methods.getLearningHistoryForUnit.call({ userId: 'learner-1' }, 'learner-1', 'root-tdf', 1);
      expect.fail('Expected assigned learning history read without course context to fail');
    } catch (error: any) {
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Course-assigned learning history requires courseAssignment context');
    }
  });

  it('allows direct history writes and reads for a released progressive member while keeping TDF scope', async function() {
    let capturedSelector: Record<string, unknown> | null = null;
    const { deps, insertedHistory } = createAssignedRootDeps({
      Assignments: {
        find: () => ({ fetchAsync: async () => [{ courseId: 'course-1' }] }),
        findOneAsync: async () => null,
      },
      Courses: {
        find: () => ({ fetchAsync: async () => [{ _id: 'course-1', visibility: 'public' }] }),
      },
      Histories: {
        find: (selector: Record<string, unknown>) => {
          capturedSelector = selector;
          return { fetchAsync: async () => [], countAsync: async () => 0 };
        },
        findOneAsync: async () => null,
        insertAsync: async (document: Record<string, unknown>) => {
          insertedHistory.push(document);
          return 'history-id';
        },
        rawCollection: () => ({ aggregate: () => ({ toArray: async () => [] }) }),
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({ TDFId: 'root-tdf' }));
    await methods.getLearningHistoryForUnit.call(
      { userId: 'learner-1' },
      'learner-1',
      'root-tdf',
      1,
    );

    expect(insertedHistory).to.have.length(1);
    expect(capturedSelector).to.deep.equal({
      userId: 'learner-1',
      TDFId: 'root-tdf',
      levelUnitType: 'model',
      levelUnit: { $lte: 1 },
    });
  });

  it('getLearningHistoryForUnit always includes exact source-TDF history for an individual course launch', async function() {
    const courseRows = [
      createHistoryRecord({
        _id: 'history-1',
        TDFId: 'sparc-tdf',
        clusterKC: 'fractions.lcd',
      }),
      createHistoryRecord({
        _id: 'history-2',
        TDFId: 'definitions-tdf',
        clusterKC: 'fractions.add-numerators',
      }),
    ];
    let capturedSelector: Record<string, unknown> | null = null;
    let capturedFindOptions: Record<string, unknown> | null = null;
    const { deps } = createAssignedRootDeps({
      Histories: {
        find: (selector: Record<string, unknown>, options?: Record<string, unknown>) => {
          capturedSelector = selector;
          capturedFindOptions = options || null;
          return {
            fetchAsync: async () => courseRows,
            countAsync: async () => courseRows.length,
          };
        },
        findOneAsync: async () => null,
        insertAsync: async () => 'history-id',
        rawCollection: () => ({ aggregate: () => ({ toArray: async () => [] }) }),
      },
      Assignments: {
        findOneAsync: async (selector: Record<string, unknown>) => (
          selector._id === 'assignment-1' &&
          selector.courseId === 'course-1'
            ? { _id: 'assignment-1', assignmentType: 'lesson', TDFId: 'root-tdf' }
            : null
        ),
      },
      Courses: {
        find: () => ({ fetchAsync: async () => [{ _id: 'course-1', visibility: 'public' }] }),
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    const rows = await methods.getLearningHistoryForUnit.call(
      { userId: 'learner-1' },
      'learner-1',
      'root-tdf',
      1,
      false,
      {
        courseAssignment: {
          assignmentId: 'assignment-1',
          courseId: 'course-1',
          TDFId: 'root-tdf',
          launchSource: 'courses',
          launchMode: 'individual',
        },
      },
    );

    expect(rows).to.deep.equal(courseRows);
    expect(capturedSelector).to.deep.equal({
      userId: 'learner-1',
      levelUnitType: 'model',
      $or: [{ TDFId: { $in: ['root-tdf'] } }],
    });
    expect(capturedFindOptions).to.deep.include({
      sort: { time: 1 },
    });
  });

  it('getSparcHistoryForUnit rejects assigned child reads without course context', async function() {
    const { deps } = createAssignedRootDeps();
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    try {
      await methods.getSparcHistoryForUnit.call({ userId: 'learner-1' }, 'learner-1', 'child-tdf', 1);
      expect.fail('Expected assigned SPARC history read without course context to fail');
    } catch (error: any) {
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Course-assigned SPARC history requires courseAssignment context');
    }
  });

  it('getStimulusCrowdStatsForDeck rejects an ordinary assigned TDF without course context', async function() {
    const { deps } = createAssignedRootDeps({
      canViewDashboardTdf: async () => true,
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    try {
      await methods.getStimulusCrowdStatsForDeck.call(
        { userId: 'learner-1' },
        'root-tdf',
        [{ stimuliSetId: 'stim-set-1', stimulusKC: '101' }],
      );
      expect.fail('Expected ordinary assigned crowd stats read without course context to fail');
    } catch (error: any) {
      expect(error.error).to.equal(403);
      expect(error.reason).to.equal('Course-assigned crowd stats require courseAssignment context');
    }
  });

  it('scopes progressive history to exact prefix TDFs and excludes future same-cluster lessons', async function() {
    let capturedSelector: Record<string, unknown> | null = null;
    const { deps, insertedHistory } = createAnalyticsDeps({
      Histories: {
        find: (selector: Record<string, unknown>) => {
          capturedSelector = selector;
          return { fetchAsync: async () => [], countAsync: async () => 0 };
        },
        findOneAsync: async () => null,
        insertAsync: async () => 'history-id',
        rawCollection: () => ({ aggregate: () => ({ toArray: async () => [] }) }),
      },
      Assignments: {
        find: () => ({ fetchAsync: async () => [] }),
        findOneAsync: async () => ({
          _id: 'progressive-1',
          courseId: 'course-1',
          assignmentType: 'progressive',
          memberTdfIds: ['lesson-1', 'lesson-3', 'lesson-2'],
          progressiveRevisions: {
            [progressiveRevisionId(['lesson-1', 'lesson-2', 'lesson-3'])]: ['lesson-1', 'lesson-2', 'lesson-3'],
          },
          releaseAt: null,
        }),
      },
      Courses: {
        find: () => ({ fetchAsync: async () => [{ _id: 'course-1', visibility: 'public' }] }),
      },
      Tdfs: {
        find: () => ({
          fetchAsync: async () => [
            {
              _id: 'lesson-1',
              content: { tdfs: { tutor: { unit: [{}, { learningsession: { clusterlist: '0' } }] } } },
              rawStimuliFile: { setspec: { clusters: [{ clusterKC: ' Cluster-A ' }] } },
            },
            {
              _id: 'lesson-2',
              content: { tdfs: { tutor: { unit: [{}, { learningsession: { clusterlist: '0' } }] } } },
              rawStimuliFile: { setspec: { clusters: [{ clusterKC: 'cluster-b' }] } },
            },
          ],
        }),
        findOneAsync: async () => null,
        updateAsync: async () => true,
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    await methods.getLearningHistoryForUnit.call(
      { userId: 'learner-1' },
      'learner-1',
      'lesson-2',
      1,
      false,
      {
        courseAssignment: {
          assignmentId: 'progressive-1',
          courseId: 'course-1',
          TDFId: 'lesson-2',
          launchSource: 'courses',
          launchMode: 'progressive',
          progressiveEndpointTdfId: 'lesson-2',
          progressiveRevisionId: progressiveRevisionId(['lesson-1', 'lesson-2', 'lesson-3']),
        },
      },
    );

    expect(capturedSelector).to.deep.equal({
      userId: 'learner-1',
      levelUnitType: 'model',
      $or: [
        { TDFId: { $in: ['lesson-1', 'lesson-2'] } },
      ],
    });
    const context = { assignmentId: 'progressive-1', courseId: 'course-1', TDFId: 'lesson-1',
      launchSource: 'courses', launchMode: 'progressive', progressiveEndpointTdfId: 'lesson-2',
      progressiveRevisionId: progressiveRevisionId(['lesson-1', 'lesson-2', 'lesson-3']) };
    await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({
      TDFId: 'lesson-1', levelUnit: 1, courseAssignment: context,
    }));
    expect(insertedHistory).to.have.length(1);
    expect(insertedHistory[0]).to.include({ TDFId: 'lesson-1', levelUnit: 1 });
    expect(insertedHistory[0]!.courseAssignment).to.deep.equal(context);
    for (const invalidContext of [
      { ...context, TDFId: 'lesson-3' },
      { ...context, progressiveRevisionId: '0'.repeat(64) },
      { ...context, progressiveRevisionId: undefined },
    ]) {
      let rejected = false;
      try {
        await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({
          TDFId: invalidContext.TDFId, levelUnit: 1, courseAssignment: invalidContext,
        }));
      } catch (error: any) {
        expect(error.error).to.equal(400);
        rejected = true;
      }
      expect(rejected).to.equal(true);
    }
    expect(insertedHistory).to.have.length(1);
  });

  it('insertHistory accepts course history for a resolved child of the assigned root TDF', async function() {
    const { deps, insertedHistory } = createAnalyticsDeps({
      Tdfs: {
        find: (selector: Record<string, any>) => ({
          fetchAsync: async () => {
            const refs = [
              ...(selector._id?.$in || []),
              ...(selector.$or
              ?.flatMap((term: Record<string, any>) => [
                ...(term._id?.$in || []),
                ...(term['content.fileName']?.$in || []),
              ]) || []),
            ];
            return refs.includes('child.json') || refs.includes('child-tdf')
              ? [{ _id: 'child-tdf', content: { fileName: 'child.json' } }]
              : [];
          },
        }),
        findOneAsync: async (selector: Record<string, unknown>) => {
          if (selector._id === 'root-tdf') {
            return {
              _id: 'root-tdf',
              content: {
                tdfs: {
                  tutor: {
                    setspec: {
                      condition: ['child.json'],
                      conditionTdfIds: ['child-tdf'],
                    },
                  },
                },
              },
            };
          }
          if (selector._id === 'child-tdf') {
            return { _id: 'child-tdf', content: { fileName: 'child.json' } };
          }
          return null;
        },
        updateAsync: async () => true,
      },
      Assignments: {
        findOneAsync: async (selector: Record<string, unknown>) => (
          selector._id === 'assignment-1' &&
          selector.courseId === 'course-1'
            ? { _id: 'assignment-1', assignmentType: 'lesson', TDFId: 'root-tdf' }
            : null
        ),
      },
      Courses: {
        find: () => ({ fetchAsync: async () => [{ _id: 'course-1', visibility: 'public' }] }),
      },
    });
    const methods = createAnalyticsMethods(deps as any) as Record<string, any>;

    await methods.insertHistory.call({ userId: 'learner-1' }, createHistoryRecord({
      TDFId: 'child-tdf',
      courseAssignment: {
        assignmentId: 'assignment-1',
        courseId: 'course-1',
        TDFId: 'root-tdf',
        launchSource: 'courses',
          launchMode: 'individual',
      },
    }));

    expect(insertedHistory).to.have.length(1);
    expect(insertedHistory[0]?.courseAssignment).to.deep.include({
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'root-tdf',
    });
  });
});

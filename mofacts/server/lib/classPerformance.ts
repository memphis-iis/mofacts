import type { DueDateException } from '../../common/courseAssignments.contracts';

type ClassPerformanceEntry = {
  userId: string;
  count: number;
  username?: string;
  numCorrect?: number;
  numIncorrect?: number;
  percentCorrect?: string;
  totalTime?: number;
  totalTimeMins?: string | number;
  exception?: string | false;
};


type UserDoc = {
  _id?: unknown;
  username?: unknown;
  dueDateExceptions?: DueDateException[];
};

type GetClassPerformanceByTdfDeps = {
  serverConsole: (...args: unknown[]) => void;
  Sections: {
    find: (selector: Record<string, unknown>) => { fetchAsync: () => Promise<Array<{ _id: string }>> };
  };
  SectionUserMap: {
    find: (selector: Record<string, unknown>) => { fetchAsync: () => Promise<Array<{ userId: string }>> };
  };
  Histories: {
    rawCollection: () => {
      aggregate: (pipeline: Record<string, unknown>[]) => { toArray: () => Promise<Array<Record<string, unknown>>> };
    };
  };
  findUsersByIds: (userIds: string[]) => Promise<UserDoc[]>;
};

type UserPerformanceMeta = {
  username: string;
  exception: string | false;
  exceptionRawDate: number | false;
};

function addGroupedStats(target: ClassPerformanceEntry, next: Partial<ClassPerformanceEntry>) {
  target.count += Number(next.count || 0);
  target.numCorrect = (target.numCorrect || 0) + Number(next.numCorrect || 0);
  target.numIncorrect = (target.numIncorrect || 0) + Number(next.numIncorrect || 0);
  target.totalTime = (target.totalTime || 0) + Number(next.totalTime || 0);
}

function subtractGroupedStats(allStats: Partial<ClassPerformanceEntry>, metStats: Partial<ClassPerformanceEntry>) {
  return {
    count: Math.max(0, Number(allStats.count || 0) - Number(metStats.count || 0)),
    numCorrect: Math.max(0, Number(allStats.numCorrect || 0) - Number(metStats.numCorrect || 0)),
    numIncorrect: Math.max(0, Number(allStats.numIncorrect || 0) - Number(metStats.numIncorrect || 0)),
    totalTime: Math.max(0, Number(allStats.totalTime || 0) - Number(metStats.totalTime || 0))
  };
}

function buildUserPerformanceMetaById(
  users: UserDoc[],
  classId: string,
  assignmentId?: string | null
) {
  const metaByUserId = new Map<string, UserPerformanceMeta>();

  for (const user of users) {
    const userId = String(user._id ?? '').trim();
    if (!userId) {
      continue;
    }

    let exception: string | false = false;
    let exceptionRawDate: number | false = false;
    const exceptions = Array.isArray(user.dueDateExceptions) ? user.dueDateExceptions : [];
    const exceptionEntry = assignmentId
      ? exceptions.find((item) => item.assignmentId === assignmentId && item.courseId === classId)
      : null;
    if (exceptionEntry) {
      const rawDate = new Date(exceptionEntry.date).getTime();
      exceptionRawDate = rawDate;
      exception = new Date(exceptionEntry.date).toLocaleDateString();
    }

    metaByUserId.set(userId, {
      username: String(user.username ?? ''),
      exception,
      exceptionRawDate
    });
  }

  return metaByUserId;
}

async function aggregateHistoryStatsByUser(
  baseMatch: Record<string, unknown>,
  deps: GetClassPerformanceByTdfDeps,
  extraMatch?: Record<string, unknown>
) {
  const pipeline: Record<string, unknown>[] = [
    { $match: baseMatch }
  ];

  if (extraMatch) {
    pipeline.push({ $match: extraMatch });
  }

  pipeline.push({
    $group: {
      _id: '$userId',
      count: { $sum: 1 },
      numCorrect: {
        $sum: {
          $cond: [
            { $eq: ['$outcome', 'correct'] },
            1,
            0
          ]
        }
      },
      numIncorrect: {
        $sum: {
          $cond: [
            { $eq: ['$outcome', 'correct'] },
            0,
            1
          ]
        }
      },
      totalTime: {
        $sum: {
          $add: [
            { $ifNull: ['$CFEndLatency', 0] },
            { $ifNull: ['$CFFeedbackLatency', 0] }
          ]
        }
      }
    }
  });

  const rows = await deps.Histories.rawCollection().aggregate(pipeline).toArray();
  const statsByUserId = new Map<string, Partial<ClassPerformanceEntry>>();
  for (const row of rows) {
    const userId = String(row._id ?? '').trim();
    if (!userId) {
      continue;
    }
    statsByUserId.set(userId, {
      count: Number(row.count || 0),
      numCorrect: Number(row.numCorrect || 0),
      numIncorrect: Number(row.numIncorrect || 0),
      totalTime: Number(row.totalTime || 0)
    });
  }
  return statsByUserId;
}

export async function getClassPerformanceByTdfWorkflow(
  classId: string,
  tdfId: string,
  date: number | false,
  deps: GetClassPerformanceByTdfDeps,
  assignmentContext?: { assignmentId?: string | null; dueAt?: Date | number | string | null }
) {
  deps.serverConsole('getClassPerformanceByTDF', classId, tdfId, date);

  const sections = await deps.Sections.find({ courseId: classId }).fetchAsync();
  const sectionIds = sections.map((section) => section._id);
  const userIds = await deps.SectionUserMap.find({ sectionId: { $in: sectionIds } })
    .fetchAsync()
    .then((rows) => rows.map((user) => user.userId));
  const enrolledUserIds = [...new Set(
    userIds
      .map((userId) => String(userId || '').trim())
      .filter((userId) => userId.length > 0)
  )];

  const performanceMet: ClassPerformanceEntry[] = [];
  const performanceNotMet: ClassPerformanceEntry[] = [];
  const assignmentDueDate = assignmentContext?.dueAt ? new Date(assignmentContext.dueAt).getTime() : NaN;
  const cutoffDate = date || (Number.isFinite(assignmentDueDate) ? assignmentDueDate : new Date().getTime());
  if (enrolledUserIds.length === 0) {
    return [performanceMet, performanceNotMet];
  }

  const baseMatch = {
    userId: { $in: enrolledUserIds },
    TDFId: tdfId,
    levelUnitType: { $ne: 'Instruction' }
  };
  const users = await deps.findUsersByIds(enrolledUserIds);
  const userMetaById = buildUserPerformanceMetaById(users, classId, assignmentContext?.assignmentId || null);
  const allStatsByUserId = await aggregateHistoryStatsByUser(baseMatch, deps);
  const baseMetStatsByUserId = await aggregateHistoryStatsByUser(baseMatch, deps, {
    $expr: {
      $lt: [
        { $ifNull: ['$recordedServerTime', 0] },
        cutoffDate
      ]
    }
  });
  const extraExceptionClauses = enrolledUserIds
    .map((userId) => {
      const exceptionRawDate = userMetaById.get(userId)?.exceptionRawDate;
      if (exceptionRawDate === false || !Number.isFinite(Number(exceptionRawDate)) || Number(exceptionRawDate) <= cutoffDate) {
        return null;
      }
      return {
        userId,
        $expr: {
          $and: [
            { $gte: [{ $ifNull: ['$recordedServerTime', 0] }, cutoffDate] },
            { $lt: [{ $ifNull: ['$recordedServerTime', 0] }, Number(exceptionRawDate)] }
          ]
        }
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  const extraMetStatsByUserId = extraExceptionClauses.length > 0
    ? await aggregateHistoryStatsByUser(baseMatch, deps, { $or: extraExceptionClauses })
    : new Map<string, Partial<ClassPerformanceEntry>>();

  const metStatsByUserId = new Map<string, Partial<ClassPerformanceEntry>>();
  for (const [userId, stats] of baseMetStatsByUserId.entries()) {
    metStatsByUserId.set(userId, { ...stats });
  }
  for (const [userId, stats] of extraMetStatsByUserId.entries()) {
    const current = metStatsByUserId.get(userId) || { count: 0, numCorrect: 0, numIncorrect: 0, totalTime: 0 };
    addGroupedStats(current as ClassPerformanceEntry, stats);
    metStatsByUserId.set(userId, current);
  }

  for (const userId of enrolledUserIds) {
    const allStats = allStatsByUserId.get(userId);
    if (!allStats || Number(allStats.count || 0) <= 0) {
      continue;
    }

    const userMeta = userMetaById.get(userId) || {
      username: '',
      exception: false,
      exceptionRawDate: false
    };
    const metStats = metStatsByUserId.get(userId) || { count: 0, numCorrect: 0, numIncorrect: 0, totalTime: 0 };
    const notMetStats = subtractGroupedStats(allStats, metStats);

    if (Number(metStats.count || 0) > 0) {
      const metEntry = {
        userId,
        count: Number(metStats.count || 0),
        username: userMeta.username,
        numCorrect: Number(metStats.numCorrect || 0),
        numIncorrect: Number(metStats.numIncorrect || 0),
        percentCorrect: ((Number(metStats.numCorrect || 0) / Number(metStats.count || 1)) * 100).toFixed(2) + '%',
        totalTime: Number(metStats.totalTime || 0),
        totalTimeMins: (Number(metStats.totalTime || 0) / 60000).toFixed(3),
        exception: userMeta.exception
      };
      performanceMet.push(metEntry);
    }

    if (notMetStats.count > 0) {
      const notMetEntry = {
        userId,
        count: notMetStats.count,
        username: userMeta.username,
        numCorrect: notMetStats.numCorrect,
        numIncorrect: notMetStats.numIncorrect,
        percentCorrect: ((notMetStats.numCorrect / Math.max(1, notMetStats.count)) * 100).toFixed(2) + '%',
        totalTime: notMetStats.totalTime,
        totalTimeMins: (notMetStats.totalTime / 60000).toFixed(3),
        exception: userMeta.exception
      };
      performanceNotMet.push(notMetEntry);
    }
  }

  return [performanceMet, performanceNotMet];
}

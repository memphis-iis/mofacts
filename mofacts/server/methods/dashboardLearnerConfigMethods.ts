import {
  buildLearnerTdfConfig,
  buildLearnerTdfSourceMetadata,
  normalizeLearnerTdfOverrides,
  type LearnerTdfConfig,
  type LearnerTdfOverrides
} from '../../common/lib/learnerTdfConfig';
import {
  DASHBOARD_CACHE_VERSION,
  computeSummaryStats,
  computeUsageSummary,
} from './dashboardCacheShared';

type DashboardLearnerConfigDeps = {
  Meteor: any;
  UserDashboardCache: any;
  getAccessibleTdf: (userId: string, tdfId: string, options: any) => Promise<any>;
};

function hasConfigurablePatchValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasConfigurablePatchValue);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasConfigurablePatchValue);
  }
  return true;
}

function getTdfConfigSource(tdf: any) {
  return {
    ...(tdf?.content || {}),
    updatedAt: tdf?.updatedAt,
    lastUpdated: tdf?.lastUpdated
  };
}

async function getConfigurableTdfForUser(
  deps: DashboardLearnerConfigDeps,
  userId: string,
  tdfId: string,
  options: any
) {
  const normalizedTdfId = typeof tdfId === 'string' ? tdfId.trim() : '';
  if (!normalizedTdfId) {
    throw new deps.Meteor.Error('invalid-args', 'TDF ID is required');
  }

  const tdf = await deps.getAccessibleTdf(userId, normalizedTdfId, options);

  if (!tdf) {
    throw new deps.Meteor.Error('not-found', 'TDF not found');
  }

  return tdf;
}

async function writeLearnerTdfConfig(
  deps: DashboardLearnerConfigDeps,
  userId: string,
  tdfId: string,
  config: LearnerTdfConfig | null
) {
  const cache = await deps.UserDashboardCache.findOneAsync({ userId });
  const learnerTdfConfigs = {
    ...(cache?.learnerTdfConfigs || {})
  };

  if (config && config.overrides && Object.keys(config.overrides).length > 0) {
    learnerTdfConfigs[tdfId] = config;
  } else {
    delete learnerTdfConfigs[tdfId];
  }

  await deps.UserDashboardCache.upsertAsync(
    { userId },
    {
      $set: {
        userId,
        learnerTdfConfigs,
        lastUpdated: new Date(),
        version: DASHBOARD_CACHE_VERSION
      },
      $setOnInsert: {
        createdAt: new Date(),
        tdfStats: {},
        summary: computeSummaryStats({}),
        usageSummary: computeUsageSummary({})
      }
    }
  );
}

export function createDashboardLearnerConfigMethods(deps: DashboardLearnerConfigDeps) {
  return {
    getLearnerTdfConfig: async function(this: any, tdfId: string) {
      if (!this.userId) throw new deps.Meteor.Error('not-authorized', 'Must be logged in');
      if (typeof tdfId !== 'string' || !tdfId.trim()) throw new deps.Meteor.Error('invalid-args', 'TDF ID is required');
      // Only the caller's settings are read; neither histories nor other users'
      // preferences are published. Lesson access is enforced on load/save.
      const cache = await deps.UserDashboardCache.findOneAsync(
        { userId: this.userId }, { fields: { learnerTdfConfigs: 1 } },
      );
      const configs = cache?.learnerTdfConfigs;
      return configs && Object.prototype.hasOwnProperty.call(configs, tdfId.trim()) ? configs[tdfId.trim()] : null;
    },
    saveLearnerTdfConfig: async function(this: any, tdfId: string, configPatch: LearnerTdfOverrides, options: any = {}) {
      if (!this.userId) {
        throw new deps.Meteor.Error('not-authorized', 'Must be logged in');
      }
      if (!hasConfigurablePatchValue(configPatch)) {
        throw new deps.Meteor.Error('invalid-args', 'Select at least one setting to save');
      }

      const tdf = await getConfigurableTdfForUser(deps, this.userId, tdfId, options);
      const tdfSource = getTdfConfigSource(tdf);
      const config = buildLearnerTdfConfig(tdfSource, tdf._id, configPatch);

      await writeLearnerTdfConfig(deps, this.userId, tdf._id, config);

      return {
        success: true,
        config
      };
    },

    resetLearnerTdfConfig: async function(this: any, tdfId: string, scope: string | null = null, options: any = {}) {
      if (!this.userId) {
        throw new deps.Meteor.Error('not-authorized', 'Must be logged in');
      }

      const tdf = await getConfigurableTdfForUser(deps, this.userId, tdfId, options);
      const cache = await deps.UserDashboardCache.findOneAsync({ userId: this.userId });
      const existingConfig = cache?.learnerTdfConfigs?.[tdf._id] as LearnerTdfConfig | undefined;
      if (!existingConfig?.overrides) {
        return { success: true, config: null };
      }

      if (scope !== null && scope !== 'setspec' && scope !== 'unit') {
        throw new deps.Meteor.Error('invalid-args', 'Scope must be setspec or unit');
      }

      const nextOverrides: LearnerTdfOverrides = {
        ...(existingConfig.overrides || {})
      };
      if (scope === 'setspec') {
        delete nextOverrides.setspec;
        delete nextOverrides.deliverySettings;
      } else if (scope === 'unit') {
        delete nextOverrides.unit;
      } else {
        delete nextOverrides.setspec;
        delete nextOverrides.deliverySettings;
        delete nextOverrides.unit;
      }

      const normalizedOverrides = normalizeLearnerTdfOverrides(getTdfConfigSource(tdf), nextOverrides);
      const nextConfig: LearnerTdfConfig | null = Object.keys(normalizedOverrides).length > 0
        ? {
            source: buildLearnerTdfSourceMetadata(getTdfConfigSource(tdf), tdf._id),
            overrides: normalizedOverrides
          }
        : null;

      await writeLearnerTdfConfig(deps, this.userId, tdf._id, nextConfig);

      return {
        success: true,
        config: nextConfig
      };
    }
  };
}

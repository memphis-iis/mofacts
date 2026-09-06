import { Meteor } from 'meteor/meteor';
import {
  publishDeploymentBrandProfile,
  readDeploymentBrandProfileDraft,
  saveDeploymentBrandProfileDraft,
} from '../lib/deploymentBrandProfileRegistry';

type MethodContext = { userId?: string | null };

type BrandProfileMethodDeps = {
  requireAdminUser: (userId: string | null | undefined, message?: string, code?: string) => Promise<void>;
};

export function createDeploymentBrandProfileMethods(deps: BrandProfileMethodDeps) {
  async function requireAdmin(context: MethodContext): Promise<string> {
    await deps.requireAdminUser(context.userId, 'Only admins can manage the Brand Profile', 'unauthorized');
    if (!context.userId) throw new Meteor.Error('not-logged-in', 'Must be logged in');
    return context.userId;
  }

  return {
    getDeploymentBrandProfileDraft: async function(this: MethodContext) {
      await requireAdmin(this);
      return await readDeploymentBrandProfileDraft();
    },

    saveDeploymentBrandProfileDraft: async function(this: MethodContext, value: unknown) {
      const userId = await requireAdmin(this);
      return await saveDeploymentBrandProfileDraft(value, userId);
    },

    publishDeploymentBrandProfile: async function(this: MethodContext) {
      const userId = await requireAdmin(this);
      return await publishDeploymentBrandProfile(userId);
    },

    importDeploymentBrandProfileDraft: async function(this: MethodContext, payload: unknown) {
      const userId = await requireAdmin(this);
      let parsed = payload;
      if (typeof payload === 'string') {
        try {
          parsed = JSON.parse(payload);
        } catch (_error) {
          throw new Meteor.Error('invalid-json', 'Brand Profile file is not valid JSON');
        }
      }
      return await saveDeploymentBrandProfileDraft(parsed, userId);
    },

    exportDeploymentBrandProfile: async function(this: MethodContext) {
      await requireAdmin(this);
      const draft = await readDeploymentBrandProfileDraft() as Record<string, unknown>;
      return JSON.stringify({ ...draft, updatedAt: '', updatedBy: '' }, null, 2);
    },
  };
}

import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';
import { check } from 'meteor/check';
import { sendErrorReportSummariesWorkflow } from './errorReportSummary';
import { ensurePublishedDeploymentBrandProfile } from './deploymentBrandProfileRegistry';

type ServerUtilityDeps = {
  ErrorReports: any;
  findUsersByIds: (userIds: string[]) => Promise<any[]>;
  adminUsers: string[];
  ownerEmail: string;
  emailFrom: string;
  emailReplyTo?: string;
  thisServerUrl: string;
  isProd: boolean;
  serverConsole: (...args: unknown[]) => void;
};

function getDiskUsageInfo(path = "/") {
  try {
    const fs = Npm.require('fs') as typeof import('fs');
    if (typeof fs.statfsSync === 'function') {
      const info = fs.statfsSync(path);
      const blockSize = Number(info.bsize);
      const totalBlocks = Number(info.blocks);
      const freeBlocks = Number(info.bfree);
      const total = totalBlocks * blockSize;
      const free = freeBlocks * blockSize;

      if (Number.isFinite(total) && Number.isFinite(free) && total > 0) {
        return { total, free };
      }
    }
  } catch (_error: unknown) {
    return null;
  }

  return null;
}

function buildDiskUsageStatus(path = "/") {
  const info = getDiskUsageInfo(path);
  if (!info) {
    return {
      diskSpacePercent: 'N/A',
      remainingSpace: 'N/A',
      diskSpace: 'N/A',
      diskSpaceUsed: 'N/A',
      error: 'Disk usage unavailable from fs.statfsSync.'
    };
  }

  const diskSpaceTotal = info.total;
  const diskSpaceUsed = info.total - info.free;
  const remainingSpace = info.free;
  const driveSpaceUsedPercent = (diskSpaceUsed / diskSpaceTotal) * 100;

  return {
    diskSpacePercent: driveSpaceUsedPercent.toFixed(2),
    remainingSpace: (remainingSpace / 1000000000).toFixed(2),
    diskSpace: (diskSpaceTotal / 1000000000).toFixed(2),
    diskSpaceUsed: (diskSpaceUsed / 1000000000).toFixed(2)
  };
}

export function createServerUtilityHelpers(deps: ServerUtilityDeps) {
  function getLoggedDiskUsageInfo(path = "/") {
    const info = getDiskUsageInfo(path);
    if (!info) {
      deps.serverConsole('Error getting disk usage with fs.statfsSync: unavailable');
    }
    return info;
  }

  function sendEmail(to: string, from: string, subject: string, text: string) {
    const deliveryFrom = from === deps.ownerEmail ? deps.emailFrom : from;
    deps.serverConsole('sendEmail', to, deliveryFrom, subject, '[body redacted, length=' + (text?.length || 0) + ']');
    const emailEnabled = Meteor.settings.enableEmail ?? deps.isProd;
    if (emailEnabled) {
      check([to, deliveryFrom, subject, text], [String]);
      Email.send({
        to,
        from: deliveryFrom,
        ...(deps.emailReplyTo ? { replyTo: deps.emailReplyTo } : {}),
        subject,
        text,
      });
    } else {
      deps.serverConsole('sendEmail SKIPPED (enableEmail is false and prod is false)');
    }
  }

  async function sendErrorReportSummaries() {
    const brandProfile = await ensurePublishedDeploymentBrandProfile();
    return sendErrorReportSummariesWorkflow({
      ErrorReports: deps.ErrorReports,
      findUsersByIds: deps.findUsersByIds,
      adminUsers: deps.adminUsers,
      ownerEmail: deps.ownerEmail,
      thisServerUrl: deps.thisServerUrl,
      brandName: brandProfile.identity.name,
      sendEmail,
      serverConsole: deps.serverConsole
    });
  }

  return {
    getDiskUsageInfo: getLoggedDiskUsageInfo,
    buildDiskUsageStatus,
    sendEmail,
    sendErrorReportSummaries,
  };
}

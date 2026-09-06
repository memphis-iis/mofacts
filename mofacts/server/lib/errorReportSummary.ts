type ErrorReportDoc = {
  _id?: unknown;
  user?: unknown;
  page?: unknown;
  time?: unknown;
  description?: unknown;
  userAgent?: unknown;
};

type ErrorReportUserDoc = {
  _id?: unknown;
  username?: unknown;
  emails?: Array<{ address?: unknown }>;
};

type SendErrorReportSummariesDeps = {
  ErrorReports: {
    find: (selector: Record<string, unknown>) => { fetchAsync: () => Promise<ErrorReportDoc[]> };
    updateAsync: (
      selector: Record<string, unknown>,
      modifier: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => Promise<unknown>;
  };
  findUsersByIds: (userIds: string[]) => Promise<ErrorReportUserDoc[]>;
  adminUsers: string[];
  ownerEmail: string;
  thisServerUrl: string;
  brandName: string;
  sendEmail: (to: string, from: string, subject: string, text: string) => void;
  serverConsole: (...args: unknown[]) => void;
};

function stringifyReportField(value: unknown, fallback = 'UNKNOWN') {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function buildIndividualAckText(
  username: string,
  report: ErrorReportDoc,
  thisServerUrl: string,
  brandName: string,
) {
  return 'Hi ' + username + ', \n\n' +
    'Thank you for reporting an error on ' + thisServerUrl + '. ' +
    'We have received your error report and will investigate it. ' +
    'If you have additional information that might be helpful, ' +
    'please reply to this email. \n\n' +
    'Error details: \n' +
    'Page: ' + stringifyReportField(report.page) + '\n' +
    'Time: ' + stringifyReportField(report.time) + '\n' +
    'Description: ' + stringifyReportField(report.description) + '\n' +
    'User Agent: ' + stringifyReportField(report.userAgent) + '\n\n' +
    'Thanks again for your help! \n\n' +
    `The ${brandName} Team`;
}

function buildSummaryLine(username: string, report: ErrorReportDoc) {
  return 'User: ' + username +
    ', page: ' + stringifyReportField(report.page) +
    ', time: ' + stringifyReportField(report.time) +
    ', description: ' + stringifyReportField(report.description) +
    ', userAgent: ' + stringifyReportField(report.userAgent) + ' ';
}

export async function sendErrorReportSummariesWorkflow(deps: SendErrorReportSummariesDeps) {
  deps.serverConsole('sendErrorReportSummaries');

  const unsentErrorReports = await deps.ErrorReports.find({ emailed: false }).fetchAsync();
  if (unsentErrorReports.length === 0) {
    deps.serverConsole('no unsent error reports to send');
    return 0;
  }

  const userIds = [...new Set(
    unsentErrorReports
      .map((report) => String(report.user ?? '').trim())
      .filter((userId) => userId.length > 0)
  )];
  const users = userIds.length > 0 ? await deps.findUsersByIds(userIds) : [];
  const usersById = new Map(
    users.map((user) => [String(user._id ?? '').trim(), user])
  );

  const summaryLines: string[] = [];
  const emailedReportIds: string[] = [];

  for (const report of unsentErrorReports) {
    const reportId = String(report._id ?? '').trim();
    const reportUser = usersById.get(String(report.user ?? '').trim());
    const username = stringifyReportField(reportUser?.username);
    const userEmail = String(reportUser?.emails?.[0]?.address ?? '').trim();

    summaryLines.push(buildSummaryLine(username, report));

    try {
      if (userEmail) {
        deps.sendEmail(
          userEmail,
          deps.ownerEmail,
          `${deps.brandName} Error Report - ${deps.thisServerUrl}`,
          buildIndividualAckText(username, report, deps.thisServerUrl, deps.brandName)
        );
      }
    } catch (error: unknown) {
      deps.serverConsole(error);
    }

    if (reportId) {
      emailedReportIds.push(reportId);
    }
  }

  const summaryText = summaryLines.join('\n');
  for (const admin of deps.adminUsers) {
    try {
      deps.sendEmail(
        admin,
        deps.ownerEmail,
        'Error Reports Summary - ' + deps.thisServerUrl,
        summaryText
      );
    } catch (error: unknown) {
      deps.serverConsole(error);
    }
  }

  if (emailedReportIds.length > 0) {
    await deps.ErrorReports.updateAsync(
      { _id: { $in: emailedReportIds } },
      { $set: { emailed: true } },
      { multi: true }
    );
  }

  deps.serverConsole('Sent ' + emailedReportIds.length + ' error reports summary');
  return emailedReportIds.length;
}

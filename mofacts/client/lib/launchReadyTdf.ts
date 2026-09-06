import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { meteorCallAsync } from './meteorAsync';
import { clientConsole } from './clientLogger';
import { getCourseAssignmentLaunchContext } from './courseAssignmentLaunchContext';
import type { CourseAssignmentHistoryContext } from '../../common/courseAssignments.contracts';
import type { ProgressiveAssignmentLaunchPayload } from '../../common/courseAssignments.contracts';
import { composeProgressiveLesson } from './progressiveLessonComposer';
import {
  hasLaunchReadyTutorUnits,
  isConditionRootWithoutUnitArray,
} from './tdfUtils';

declare const Tdfs: any;

type LoadLaunchReadyTdfOptions = {
  allowConditionRoot?: boolean;
  courseAssignment?: CourseAssignmentHistoryContext | null;
  source?: string;
};

type LaunchReadyTdfResult = {
  tdfDoc: any;
  content: any;
  isConditionRoot: boolean;
};

export function courseAssignmentContextForLaunchReadyTdf(
  options: Pick<LoadLaunchReadyTdfOptions, 'courseAssignment'> = {},
): CourseAssignmentHistoryContext | null {
  return Object.prototype.hasOwnProperty.call(options, 'courseAssignment')
    ? options.courseAssignment ?? null
    : getCourseAssignmentLaunchContext();
}

function waitForSubscriptionReady(handle: { ready: () => boolean }): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;
    Tracker.autorun((computation) => {
      if (handle.ready()) {
        if (resolved) {
          computation.stop();
          return;
        }
        resolved = true;
        computation.stop();
        resolve();
      }
    });
  });
}

function isLaunchReadyContent(content: any, allowConditionRoot: boolean): boolean {
  if (hasLaunchReadyTutorUnits(content)) {
    return true;
  }
  return allowConditionRoot && isConditionRootWithoutUnitArray(content);
}

function hasAutoTutorUnit(content: any): boolean {
  const units = content?.tdfs?.tutor?.unit;
  return Array.isArray(units) && units.some((unit: any) =>
    unit && typeof unit === 'object' && unit.autotutorsession && typeof unit.autotutorsession === 'object'
  );
}

function hasAutoTutorLaunchModel(content: any): boolean {
  if (!hasAutoTutorUnit(content)) {
    return true;
  }
  const setspec = content?.tdfs?.tutor?.setspec;
  const units = content?.tdfs?.tutor?.unit;
  return Array.isArray(units) && units.some((unit: any) => {
    if (!unit || typeof unit !== 'object' || !unit.autotutorsession) {
      return false;
    }
    const sessionModel = unit.autotutorsession.openRouterModel;
    return (
      typeof sessionModel === 'string' && sessionModel.trim().length > 0
    ) || (
      typeof setspec?.openRouterModel === 'string' && setspec.openRouterModel.trim().length > 0
    );
  });
}

function describeLaunchReadyFailure(tdfId: unknown, content: any): string {
  const units = content?.tdfs?.tutor?.unit;
  const unitSummary = Array.isArray(units)
    ? units.map((unit: any) => unit && typeof unit === 'object' ? Object.keys(unit) : typeof unit)
    : typeof units;
  return `TDF ${String(tdfId)} is not launch-ready; tutor.unit is missing, empty, or only partially projected. Unit summary: ${JSON.stringify(unitSummary)}`;
}

export async function loadLaunchReadyTdf(
  tdfId: unknown,
  options: LoadLaunchReadyTdfOptions = {}
): Promise<LaunchReadyTdfResult> {
  const currentTdfId = String(tdfId || '').trim();
  const source = options.source || 'loadLaunchReadyTdf';
  const allowConditionRoot = options.allowConditionRoot === true;
  const courseAssignment = courseAssignmentContextForLaunchReadyTdf(options);

  if (!currentTdfId) {
    throw new Error(`[${source}] Cannot load launch-ready TDF without a TDF id`);
  }

  if (courseAssignment?.launchMode === 'progressive') {
    if (!courseAssignment.progressiveRevisionId) {
      throw new Error(`[${source}] Progressive revision is missing; launch again from Courses`);
    }
    if (courseAssignment.progressiveEndpointTdfId !== currentTdfId) {
      throw new Error(`[${source}] Progressive endpoint must match the route TDF`);
    }
    const payload = await meteorCallAsync<ProgressiveAssignmentLaunchPayload>(
      'getProgressiveAssignmentLaunch',
      courseAssignment.assignmentId,
      currentTdfId,
      courseAssignment.progressiveRevisionId,
    );
    const tdfDoc = composeProgressiveLesson(payload);
    const content = tdfDoc.content;
    if (!isLaunchReadyContent(content, false)) {
      throw new Error(`[${source}] ${describeLaunchReadyFailure(currentTdfId, content)}`);
    }
    return { tdfDoc, content, isConditionRoot: false };
  }

  const subscription = Meteor.subscribe('currentTdf', currentTdfId);
  await waitForSubscriptionReady(subscription);

  let tdfDoc = Tdfs.findOne({ _id: currentTdfId });
  if (!tdfDoc?.content) {
    clientConsole(1, `[${source}] currentTdf subscription did not provide content; fetching full TDF by id`, {
      currentTdfId,
    });
    tdfDoc = await meteorCallAsync('getTdfById', currentTdfId, { courseAssignment });
  }

  let content = tdfDoc?.content;

  if (!isLaunchReadyContent(content, allowConditionRoot) || !hasAutoTutorLaunchModel(content)) {
    clientConsole(1, `[${source}] TDF content is not launch-ready after subscription; fetching full TDF by id`, {
      currentTdfId,
    });
    tdfDoc = await meteorCallAsync('getTdfById', currentTdfId, { courseAssignment });
    content = tdfDoc?.content;
  }

  const isConditionRoot = isConditionRootWithoutUnitArray(content);
  if (!isLaunchReadyContent(content, allowConditionRoot)) {
    throw new Error(`[${source}] ${describeLaunchReadyFailure(currentTdfId, content)}`);
  }

  if (!hasAutoTutorLaunchModel(content)) {
    throw new Error(`[${source}] AutoTutor TDF ${currentTdfId} is missing an effective OpenRouter model after full TDF load`);
  }

  if (isConditionRoot && !allowConditionRoot) {
    throw new Error(`[${source}] Condition root TDF ${currentTdfId} cannot be used as runnable card content`);
  }

  return {
    tdfDoc,
    content,
    isConditionRoot,
  };
}

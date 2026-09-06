import './courses.html';
import './courses.css';
import { Meteor } from 'meteor/meteor';
import { ReactiveVar } from 'meteor/reactive-var';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';
import { meteorCallAsync, clientConsole } from '../..';
import { selectTdf } from '../../lib/lessonLaunchRunner';
import { setCourseAssignmentLaunchContext } from '../../lib/courseAssignmentLaunchContext';
import { resolveSpeechIgnoreOutOfGrammarResponses } from '../../lib/speechRecognitionConfig';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import { DelayedLoadingVisibility } from '../../lib/delayedLoadingVisibility';
import type { AsyncCommandState } from '../../lib/adminUi/asyncCommandState';
import { createScopedAsyncCommandRegistry, type ScopedAsyncCommandRegistry } from '../../lib/adminUi/scopedAsyncCommandRegistry';
import type {
  LearnerCourseSnapshotCourse,
  LearnerCoursesSnapshot,
} from '../../../common/courseAssignments.contracts';
import {
  buildCourseTreeRows,
  normalizeCourseTreeSort,
  type CourseAssignmentDisplayRow,
  type CourseTreeCourseRow,
  type CourseTreeSection,
  type CourseTreeSort,
} from './courseTree';

const EXPANDED_COURSES_SESSION_KEY = 'coursesExpandedCourseIds';
const JOINING_COURSE_SESSION_KEY = 'coursesJoiningCourseId';
const JOIN_SECTION_SELECTIONS_SESSION_KEY = 'coursesJoinSectionSelections';

type CoursesTemplateInstance = Blaze.TemplateInstance & {
  snapshot: ReactiveVar<LearnerCoursesSnapshot | null>;
  loading: ReactiveVar<boolean>;
  showLoadingFeedback: ReactiveVar<boolean>;
  showSlowLoading: ReactiveVar<boolean>;
  loadingVisibility: DelayedLoadingVisibility;
  loadError: ReactiveVar<string | null>;
  commandStates: ReactiveVar<Record<string, AsyncCommandState<{ message: string }>>>;
  commandRegistry: ScopedAsyncCommandRegistry<{ message: string }>;
  search: ReactiveVar<string>;
  sort: ReactiveVar<CourseTreeSort>;
};

function formatDate(value: unknown, timezone?: string | null) {
  if (!value) return '';
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(getActiveUiLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function formatDateOnly(value: unknown, timezone?: string | null) {
  if (!value) return '';
  const date = new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(getActiveUiLocale(), {
    dateStyle: 'medium',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function courseText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function courseTranslationStatusText(status: string): string {
  if (status === 'author-provided') return courseText('manualCreator.translationStatusAuthorProvided');
  if (status === 'not-translated') return courseText('manualCreator.translationStatusNotTranslated');
  if (status === 'draft') return courseText('manualCreator.translationStatusDraft');
  if (status === 'reviewed') return courseText('manualCreator.translationStatusReviewed');
  return status;
}

function targetActionLabel(action: string, target: unknown): string {
  const targetText = String(target || '').trim();
  return targetText ? `${action}: ${targetText}` : action;
}

function buildCourseLanguageMetadataRows(assignment: Pick<CourseAssignmentDisplayRow, 'contentLanguage' | 'recommendedUiLocales' | 'translationStatus'>) {
  const rows: Array<{ label: string; value: string }> = [];
  const contentLanguage = String(assignment?.contentLanguage || '').trim();
  const recommendedUiLocales = Array.isArray(assignment?.recommendedUiLocales)
    ? assignment.recommendedUiLocales.map((locale: unknown) => String(locale || '').trim()).filter(Boolean)
    : [];
  const translationStatus = String(assignment?.translationStatus || '').trim();
  if (contentLanguage) rows.push({ label: courseText('manualCreator.contentLanguage'), value: contentLanguage });
  if (recommendedUiLocales.length > 0) {
    rows.push({ label: courseText('manualCreator.recommendedUiLocales'), value: recommendedUiLocales.join(', ') });
  }
  if (translationStatus) {
    rows.push({ label: courseText('manualCreator.translationStatus'), value: courseTranslationStatusText(translationStatus) });
  }
  return rows;
}

function getExpandedCourseIds() {
  const stored = Session.get(EXPANDED_COURSES_SESSION_KEY);
  return new Set<string>(Array.isArray(stored) ? stored.map(String) : []);
}

function setExpandedCourseIds(expandedIds: Set<string>) {
  Session.set(EXPANDED_COURSES_SESSION_KEY, Array.from(expandedIds));
}

function getJoinSectionSelections(): Record<string, string> {
  const stored = Session.get(JOIN_SECTION_SELECTIONS_SESSION_KEY);
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored as Record<string, string>
    : {};
}

function setJoinSectionSelection(courseId: string, sectionId: string) {
  Session.set(JOIN_SECTION_SELECTIONS_SESSION_KEY, {
    ...getJoinSectionSelections(),
    [courseId]: sectionId,
  });
}

function getCourseRows(snapshot: LearnerCoursesSnapshot | null, section: CourseTreeSection, instance: CoursesTemplateInstance) {
  const rows = buildCourseTreeRows(snapshot, section, {
    query: instance.search.get(),
    sort: instance.sort.get(),
    expandedCourseIds: getExpandedCourseIds(),
  });
  const states = instance.commandStates.get();
  return rows.map((course) => ({
    ...course,
    joinFeedback: courseCommandPresentation(states[`course:join:${course.courseId}`], `course-join-feedback-${course.courseId}`),
    assignments: course.assignments.map((assignment) => ({
      ...assignment,
      launchFeedback: courseCommandPresentation(
        states[`course:launch:${assignment.assignmentId}:${assignment.TDFId}`],
        `course-launch-feedback-${assignment.assignmentId}-${assignment.TDFId}`,
      ),
    })),
  }));
}

function courseCommandPresentation(
  state: AsyncCommandState<{ message: string }> | undefined,
  id: string,
) {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'pending') return { id, text: courseText('common.loading'), variant: 'info', urgent: false };
  if (state.status === 'error') return { id, text: state.message, variant: 'error', urgent: true };
  return state.result.message
    ? { id, text: state.result.message, variant: 'success', urgent: false }
    : null;
}

function setCourseCommandError(instance: CoursesTemplateInstance, scope: string, message: string): void {
  instance.commandStates.set({ ...instance.commandStates.get(), [scope]: { status: 'error', message } });
}

function currentCourseFromAssignment(instance: CoursesTemplateInstance, assignment: { courseId: string }): LearnerCourseSnapshotCourse | null {
  const snapshot = instance.snapshot.get();
  return [...(snapshot?.assignedCourses || []), ...(snapshot?.publicCourses || [])]
    .find((course) => course.courseId === assignment.courseId) || null;
}

async function reloadCoursesSnapshot(instance: CoursesTemplateInstance) {
  const snapshot = await meteorCallAsync('getLearnerCoursesSnapshot') as LearnerCoursesSnapshot;
  instance.snapshot.set(snapshot);
  return snapshot;
}

Template.courses.onCreated(function(this: CoursesTemplateInstance) {
  this.snapshot = new ReactiveVar(null);
  this.loading = new ReactiveVar(true);
  this.showLoadingFeedback = new ReactiveVar(false);
  this.showSlowLoading = new ReactiveVar(false);
  this.loadingVisibility = new DelayedLoadingVisibility({
    onVisibilityChange: (visible) => this.showLoadingFeedback.set(visible),
    onSlowChange: (slow) => this.showSlowLoading.set(slow),
  });
  this.loadingVisibility.setPending(true);
  this.loadError = new ReactiveVar(null);
  this.commandStates = new ReactiveVar({});
  this.commandRegistry = createScopedAsyncCommandRegistry((scope, state) => {
    this.commandStates.set({ ...this.commandStates.get(), [scope]: state });
  });
  this.search = new ReactiveVar('');
  this.sort = new ReactiveVar('course');
  if (!Array.isArray(Session.get(EXPANDED_COURSES_SESSION_KEY))) {
    Session.set(EXPANDED_COURSES_SESSION_KEY, []);
  }
  if (!Session.get(JOIN_SECTION_SELECTIONS_SESSION_KEY)) {
    Session.set(JOIN_SECTION_SELECTIONS_SESSION_KEY, {});
  }
  Session.set(JOINING_COURSE_SESSION_KEY, null);
});

Template.courses.onRendered(async function(this: CoursesTemplateInstance) {
  this.loading.set(true);
  this.loadError.set(null);
  try {
    await reloadCoursesSnapshot(this);
  } catch (error: any) {
    clientConsole(1, '[Courses] Failed to load learner course snapshot:', error);
    this.loadError.set(error?.reason || error?.message || String(error));
  } finally {
    this.loading.set(false);
    this.loadingVisibility.setPending(false);
  }
});

Template.courses.helpers({
  isLoading() {
    return (Template.instance() as CoursesTemplateInstance).loading.get();
  },
  showLoadingFeedback() {
    return (Template.instance() as CoursesTemplateInstance).showLoadingFeedback.get();
  },
  showSlowLoading() {
    return (Template.instance() as CoursesTemplateInstance).showSlowLoading.get();
  },
  loadingShellBusy() {
    const instance = Template.instance() as CoursesTemplateInstance;
    return instance.loading.get() || instance.showLoadingFeedback.get();
  },
  errorMessage() {
    return (Template.instance() as CoursesTemplateInstance).loadError.get();
  },
  loadingRows() {
    return [1, 2, 3, 4];
  },
  assignedCourses() {
    const instance = Template.instance() as CoursesTemplateInstance;
    return getCourseRows(instance.snapshot.get(), 'assignedCourses', instance);
  },
  publicCourses() {
    const instance = Template.instance() as CoursesTemplateInstance;
    return getCourseRows(instance.snapshot.get(), 'publicCourses', instance);
  },
  hasAssignedAssignments() {
    const instance = Template.instance() as CoursesTemplateInstance;
    return getCourseRows(instance.snapshot.get(), 'assignedCourses', instance).length > 0;
  },
  hasPublicAssignments() {
    const instance = Template.instance() as CoursesTemplateInstance;
    return getCourseRows(instance.snapshot.get(), 'publicCourses', instance).length > 0;
  },
});

Template.courses.onDestroyed(function(this: CoursesTemplateInstance) {
  this.loadingVisibility.destroy();
  this.commandRegistry.destroy();
});

const courseAssignmentDisplayHelpers = {
  timezoneLabel(this: CourseAssignmentDisplayRow | CourseTreeCourseRow) {
    return this.timezone;
  },
  isLocked(this: CourseAssignmentDisplayRow) {
    return this.availability !== 'available';
  },
  statusLabel(this: CourseAssignmentDisplayRow) {
    const row = this;
    if (row.availability === 'scheduled') return courseText('courses.locked');
    if (row.availability === 'unavailable') return courseText('courses.notEnrolled');
    return row.required ? courseText('courses.required') : courseText('courses.optional');
  },
  statusClass(this: CourseAssignmentDisplayRow) {
    const row = this;
    if (row.availability === 'scheduled') return 'course-assignment-status--locked';
    if (row.availability === 'unavailable') return 'course-assignment-status--locked';
    return row.required ? 'course-assignment-status--required' : '';
  },
  releaseLabel(this: CourseAssignmentDisplayRow) {
    const row = this;
    const formatted = formatDate(row.releaseAt, row.timezone);
    return formatted ? courseText('courses.opens', { date: formatted }) : '';
  },
  hasReleaseLabel(this: CourseAssignmentDisplayRow) {
    return Boolean(this.releaseAt);
  },
  dueLabel(this: CourseAssignmentDisplayRow) {
    const row = this;
    const dueAt = row.dueAt;
    if (!dueAt) return '-';
    const dueTime = new Date(dueAt).getTime();
    const now = Date.now();
    const formatted = formatDate(dueAt, row.timezone);
    if (dueTime < now) return formatted ? courseText('courses.overdue', { date: formatted }) : '-';
    return formatted || '-';
  },
  dueWithDateLabel(this: CourseAssignmentDisplayRow) {
    const dueLabel = courseAssignmentDisplayHelpers.dueLabel.call(this);
    return dueLabel === '-' ? `${courseText('courses.due')} -` : courseText('courses.dueWithDate', { date: dueLabel });
  },
  trialsValue(this: CourseAssignmentDisplayRow) {
    return this.progress?.attempts || 0;
  },
  accuracyValue(this: CourseAssignmentDisplayRow) {
    const progress = this.progress;
    return progress?.accuracyApplies && progress.accuracy !== null ? `${progress.accuracy}%` : '-';
  },
  showAccuracyBar(this: CourseAssignmentDisplayRow) {
    const progress = this.progress;
    return Boolean(progress?.accuracyApplies && progress.accuracy !== null);
  },
  accuracyBarWidth(this: CourseAssignmentDisplayRow) {
    const progress = this.progress;
    if (!progress?.accuracyApplies || progress.accuracy === null) return '0%';
    return `${Math.max(0, Math.min(100, progress.accuracy))}%`;
  },
  itemsValue(this: CourseAssignmentDisplayRow) {
    const progress = this.progress;
    return progress?.itemsPracticedApplies && progress.itemsPracticed !== null ? progress.itemsPracticed : '-';
  },
  sessionDaysValue(this: CourseAssignmentDisplayRow) {
    return this.progress?.sessionDays || 0;
  },
  timeValue(this: CourseAssignmentDisplayRow) {
    return courseText('courses.minutes', { minutes: this.progress?.totalTimeMinutes || 0 });
  },
  lastPracticeValue(this: CourseAssignmentDisplayRow) {
    const row = this;
    const lastPracticed = row.progress?.lastPracticed;
    return lastPracticed ? formatDateOnly(lastPracticed, row.timezone) : '-';
  },
  languageMetadataRows(this: CourseAssignmentDisplayRow) {
    return buildCourseLanguageMetadataRows(this);
  },
  actionLabel(this: CourseAssignmentDisplayRow) {
    const row = this;
    if (row.availability === 'scheduled') return courseText('courses.locked');
    if (row.availability === 'unavailable') return courseText('courses.unavailable');
    return row.isUsed ? courseText('courses.continue') : courseText('courses.start');
  },
  assignmentActionLabel(this: CourseAssignmentDisplayRow) {
    return targetActionLabel(courseAssignmentDisplayHelpers.actionLabel.call(this), this.title);
  },
  actionButtonClass(this: CourseAssignmentDisplayRow) {
    return this.isUsed ? 'btn-primary' : 'btn-success';
  },
  progressiveGroupLabel(this: CourseAssignmentDisplayRow) {
    return this.progressiveGroupTitle || '';
  },
  hasProgressiveAction(this: CourseAssignmentDisplayRow) {
    return this.assignmentType === 'progressive' && Number(this.progressiveMemberIndex) > 0;
  },
  progressiveActionLabel(this: CourseAssignmentDisplayRow) {
    return `Progressive Practice through ${this.title}`;
  },
};

const courseTreeCourseRowHelpers = {
  ...courseAssignmentDisplayHelpers,
  isJoinableCourse(this: CourseTreeCourseRow) {
    return this.membership === 'public';
  },
  joinableSectionCount(this: CourseTreeCourseRow) {
    return Array.isArray(this.joinableSections) ? this.joinableSections.length : 0;
  },
  hasMultipleJoinableSections(this: CourseTreeCourseRow) {
    return Array.isArray(this.joinableSections) && this.joinableSections.length > 1;
  },
  singleJoinableSectionId(this: CourseTreeCourseRow) {
    if (!Array.isArray(this.joinableSections) || this.joinableSections.length !== 1) return '';
    const [section] = this.joinableSections;
    return section?.sectionId || '';
  },
  selectedJoinSectionId(this: CourseTreeCourseRow) {
    return getJoinSectionSelections()[this.courseId] || '';
  },
  isJoiningCourse(this: CourseTreeCourseRow) {
    return Session.get(JOINING_COURSE_SESSION_KEY) === this.courseId;
  },
  joinLabel(this: CourseTreeCourseRow) {
    return Session.get(JOINING_COURSE_SESSION_KEY) === this.courseId ? courseText('courses.joining') : courseText('courses.join');
  },
  joinActionLabel(this: CourseTreeCourseRow) {
    return targetActionLabel(courseTreeCourseRowHelpers.joinLabel.call(this), this.courseName);
  },
  joinDisabled(this: CourseTreeCourseRow) {
    const isJoining = Session.get(JOINING_COURSE_SESSION_KEY) === this.courseId;
    if (isJoining) return true;
    const sections = Array.isArray(this.joinableSections) ? this.joinableSections : [];
    if (sections.length === 0) return true;
    if (sections.length > 1 && !getJoinSectionSelections()[this.courseId]) return true;
    return false;
  },
  joinFeedback(this: CourseTreeCourseRow & { joinFeedback?: unknown }) {
    return this.joinFeedback;
  },
};

Template.courseTreeCourseRow.helpers({
  ...courseTreeCourseRowHelpers,
});
Template.courseAssignmentTableRow.helpers(courseAssignmentDisplayHelpers);
Template.courseAssignmentCard.helpers(courseAssignmentDisplayHelpers);
Template.courseAssignmentCourseCard.helpers(courseAssignmentDisplayHelpers);

Template.courses.events({
  'input #coursesSearch': function(event: Event, instance: CoursesTemplateInstance) {
    instance.search.set(String((event.currentTarget as HTMLInputElement).value || ''));
  },
  'change #coursesSort': function(event: Event, instance: CoursesTemplateInstance) {
    instance.sort.set(normalizeCourseTreeSort(String((event.currentTarget as HTMLSelectElement).value || 'course')));
  },
  'change .join-course-section': function(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const courseId = select.dataset.courseid;
    if (!courseId) return;
    setJoinSectionSelection(courseId, String(select.value || ''));
  },
  'click .toggle-course-tree': function(event: Event) {
    const target = event.currentTarget as HTMLElement;
    const courseId = target.dataset.courseid;
    if (!courseId) return;
    const expandedIds = getExpandedCourseIds();
    if (expandedIds.has(courseId)) {
      expandedIds.delete(courseId);
    } else {
      expandedIds.add(courseId);
    }
    setExpandedCourseIds(expandedIds);
  },
  'click .launch-course-assignment': async function(event: Event, instance: CoursesTemplateInstance) {
    const assignment = this as CourseAssignmentDisplayRow;
    if (assignment.availability !== 'available') return;
    const course = currentCourseFromAssignment(instance, assignment);
    if (!course) {
      setCourseCommandError(instance, `course:launch:${assignment.assignmentId}:${assignment.TDFId}`, 'Course context was not found for this assignment.');
      return;
    }
    await instance.commandRegistry.run(`course:launch:${assignment.assignmentId}:${assignment.TDFId}`, async () => {
      const launchContext = {
        assignmentId: assignment.assignmentId,
        courseId: assignment.courseId,
        TDFId: assignment.TDFId,
        launchSource: 'courses' as const,
        launchMode: 'individual' as const,
      };
      const tdf: any = await meteorCallAsync('getTdfById', assignment.TDFId, {
        courseAssignment: launchContext,
      });
      const setspec = tdf?.content?.tdfs?.tutor?.setspec || {};
      await selectTdf(
        assignment.TDFId,
        assignment.title,
        assignment.currentStimuliSetId,
        resolveSpeechIgnoreOutOfGrammarResponses(setspec),
        setspec.speechOutOfGrammarFeedback || translatePlatformString(getActiveUiLocale(), 'speech.outOfGrammarFeedback'),
        'Course assignment launch',
        Boolean(tdf?.content?.isMultiTdf),
        setspec,
        false,
        false,
        { courseAssignment: launchContext },
      );
      return { message: '' };
    }, {
      getErrorMessage: (error: any) => error?.reason || error?.message || String(error),
      onFailure: () => setCourseAssignmentLaunchContext(null),
    });
  },
  'click .launch-progressive-assignment': async function(_event: Event, instance: CoursesTemplateInstance) {
    const assignment = this as CourseAssignmentDisplayRow;
    if (assignment.assignmentType !== 'progressive' || Number(assignment.progressiveMemberIndex) < 1) return;
    if (assignment.availability !== 'available') return;
    const scope = `course:launch:${assignment.assignmentId}:${assignment.TDFId}`;
    const course = currentCourseFromAssignment(instance, assignment);
    if (!course) {
      setCourseCommandError(instance, scope, 'Course context was not found for this assignment.');
      return;
    }
    await instance.commandRegistry.run(scope, async () => {
      const launch: any = await meteorCallAsync('getProgressiveAssignmentLaunch', assignment.assignmentId, assignment.TDFId);
      const launchContext = {
        assignmentId: assignment.assignmentId,
        courseId: assignment.courseId,
        TDFId: assignment.TDFId,
        launchSource: 'courses' as const,
        launchMode: 'progressive' as const,
        progressiveEndpointTdfId: assignment.TDFId,
        progressiveRevisionId: launch.progressiveRevisionId,
      };
      const tdf = launch.tdfs[launch.tdfs.length - 1];
      const setspec = tdf?.content?.tdfs?.tutor?.setspec || {};
      await selectTdf(
        assignment.TDFId,
        assignment.progressiveGroupTitle || assignment.title,
        assignment.currentStimuliSetId,
        resolveSpeechIgnoreOutOfGrammarResponses(setspec),
        setspec.speechOutOfGrammarFeedback || translatePlatformString(getActiveUiLocale(), 'speech.outOfGrammarFeedback'),
        'Progressive course assignment launch',
        false,
        setspec,
        false,
        false,
        { courseAssignment: launchContext },
      );
      return { message: '' };
    }, {
      getErrorMessage: (error: any) => error?.reason || error?.message || String(error),
      onFailure: () => setCourseAssignmentLaunchContext(null),
    });
  },
  'click .join-public-course': async function(event: Event, instance: CoursesTemplateInstance) {
    const course = this as CourseTreeCourseRow;
    if (course.membership !== 'public') return;
    const button = event.currentTarget as HTMLElement;
    const scope = `course:join:${course.courseId}`;
    const sectionId = String(button.dataset.sectionid || getJoinSectionSelections()[course.courseId] || '');
    if (!sectionId) {
      setCourseCommandError(instance, scope, courseText('courses.selectSectionToJoin'));
      return;
    }
    const section = (course.joinableSections || []).find((row) => row.sectionId === sectionId);
    if (!section) {
      setCourseCommandError(instance, scope, courseText('courses.selectSectionToJoin'));
      return;
    }
    Session.set(JOINING_COURSE_SESSION_KEY, course.courseId);
    await instance.commandRegistry.run(scope, async () => {
      await meteorCallAsync('addUserToTeachersClass', course.teacherUserId, sectionId);
      const assignedTdfIds = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), sectionId);
      const teacher = {
        _id: course.teacherUserId,
        displayIdentifier: course.teacherDisplayName,
      };
      const curClass = {
        sectionId,
        sectionName: section.sectionName,
        courseId: course.courseId,
        courseName: course.courseName,
        teacherUserId: course.teacherUserId,
        visibility: course.visibility,
        timezone: course.timezone,
      };
      await meteorCallAsync(
        'setUserLoginData',
        'learn-course-join',
        Session.get('loginMode') || 'password',
        teacher,
        curClass,
        assignedTdfIds,
      );
      Session.set('curTeacher', teacher);
      Session.set('curClass', curClass);
      const expandedIds = getExpandedCourseIds();
      expandedIds.add(course.courseId);
      setExpandedCourseIds(expandedIds);
      await reloadCoursesSnapshot(instance);
      return { message: '' };
    }, {
      getErrorMessage: (error: any) => error?.reason || error?.message || String(error),
      onSuccess: () => {
        instance.commandRegistry.remove(scope);
      },
    });
    {
      Session.set(JOINING_COURSE_SESSION_KEY, null);
    }
  },
});

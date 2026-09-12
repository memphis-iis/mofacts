import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import './instructorReporting.html';
import './instructorReporting.css';
import '../shared/adminUi/adminUi';
import { meteorCallAsync } from '../..';
import { INVALID } from '../../../common/Definitions';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import {
  rejectLoad,
  resolveLoad,
  startLoad,
  type LoadableState,
} from '../../lib/adminUi/loadableState';
import { createTemplateLifetime, type TemplateLifetime } from '../../lib/adminUi/templateLifetime';
import type { AsyncCommandState } from '../../lib/adminUi/asyncCommandState';
import {
  createScopedAsyncCommandRegistry,
  type ScopedAsyncCommandRegistry,
} from '../../lib/adminUi/scopedAsyncCommandRegistry';
import {
  findAssignmentForTdf,
  findTdfSummary,
  getCourseAssignments,
  getReportingTotals,
  normalizePerformanceBuckets,
  resolveSelectedDueDate,
  rowsHaveData,
  toDateInputValue,
  toDateMillis,
  type ReportingAssignment,
  type ReportingAssignmentsByCourseId,
  type ReportingCourse,
  type ReportingPerformanceBuckets,
  type ReportingPerformanceRow,
  type ReportingTdfSummary,
} from './instructorReportingState';

declare const Tdfs: {
  find(): { fetch(): ReportingTdfSummary[] };
};

type ReportingCommandResult = Readonly<{ message: string }>;
type ReportingCommandStates = Record<string, AsyncCommandState<ReportingCommandResult>>;

type InstructorReportingInitialData = Readonly<{
  courses: ReportingCourse[];
  assignmentsByCourseId: ReportingAssignmentsByCourseId;
  allTdfs: ReportingTdfSummary[];
}>;

type InstructorReportingInstance = Blaze.TemplateInstance & {
  initialPresentation: ReactiveVar<LoadableState<InstructorReportingInitialData>>;
  performancePresentation: ReactiveVar<LoadableState<ReportingPerformanceBuckets>>;
  commandStates: ReactiveVar<ReportingCommandStates>;
  commandRegistry: ScopedAsyncCommandRegistry<ReportingCommandResult>;
  initialLifetime: TemplateLifetime;
  performanceLifetime: TemplateLifetime;
  nextInitialRequestId: number;
  nextPerformanceRequestId: number;
  selectedCourseId: ReactiveVar<string>;
  selectedTdfId: ReactiveVar<string>;
  selectedAssignmentId: ReactiveVar<string | null>;
  selectedDueDate: ReactiveVar<string>;
  deadlineDate: ReactiveVar<string>;
  exceptionDate: ReactiveVar<string>;
  dueDateFilter: ReactiveVar<boolean>;
  exceptionDateError: ReactiveVar<string>;
  exceptionDateValidationUserId: ReactiveVar<string>;
  tdfListingSub?: { stop(): void };
  tdfReadyComputation?: { stop(): void };
};

function reportingText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function errorMessage(error: unknown): string {
  const meteorError = error as { reason?: string; message?: string } | null;
  return meteorError?.reason || meteorError?.message || String(error);
}

function readyLoadValue<T>(state: LoadableState<T>): T | null {
  return state.status === 'ready' || state.status === 'empty' || state.status === 'refreshing' || state.status === 'refresh-error'
    ? state.value
    : null;
}

function loadErrorMessage<T>(state: LoadableState<T>): string {
  return state.status === 'error' || state.status === 'refresh-error' ? state.message : '';
}

function loadPending<T>(state: LoadableState<T>): boolean {
  return state.status === 'idle' || state.status === 'loading' || state.status === 'refreshing';
}

function loadBusy<T>(state: LoadableState<T>): boolean {
  return state.status === 'loading' || state.status === 'refreshing';
}

function performanceLoadError(instance: InstructorReportingInstance): string {
  return loadErrorMessage(instance.performancePresentation.get());
}

function reportingActionLabel(key: Parameters<typeof translatePlatformString>[1], row: ReportingPerformanceRow): string {
  const action = reportingText(key);
  const target = String(row?.username || '').trim();
  return target ? `${action}: ${target}` : action;
}

function getInitialData(instance: InstructorReportingInstance): InstructorReportingInitialData {
  return readyLoadValue(instance.initialPresentation.get()) || {
    courses: [],
    assignmentsByCourseId: {},
    allTdfs: [],
  };
}

function getPerformanceBuckets(instance: InstructorReportingInstance): ReportingPerformanceBuckets {
  return readyLoadValue(instance.performancePresentation.get()) || {
    met: [],
    notMet: [],
  };
}

function exceptionScope(userId: string): string {
  return `reporting:exception:${userId}`;
}

function navigationScope(userId: string): string {
  return `reporting:navigate:${userId}`;
}

function commandPresentation(
  state: AsyncCommandState<ReportingCommandResult> | undefined,
  id: string,
): { id: string; text: string; variant: 'info' | 'success' | 'error'; urgent: boolean } | null {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'pending') {
    return { id, text: reportingText('common.loading'), variant: 'info', urgent: false };
  }
  if (state.status === 'success') {
    return { id, text: state.result.message, variant: 'success', urgent: false };
  }
  return { id, text: state.message, variant: 'error', urgent: true };
}

function waitForTdfListing(instance: InstructorReportingInstance, sub: { ready(): boolean }): Promise<void> {
  instance.tdfReadyComputation?.stop();
  return new Promise<void>((resolve) => {
    instance.tdfReadyComputation = Tracker.autorun((computation) => {
      if (sub.ready()) {
        computation.stop();
        if (instance.tdfReadyComputation === computation) {
          delete instance.tdfReadyComputation;
        }
        resolve();
      }
    });
  });
}

async function loadInitialReportingData(instance: InstructorReportingInstance): Promise<void> {
  const requestId = ++instance.nextInitialRequestId;
  const generation = instance.initialLifetime.begin();
  instance.initialPresentation.set(startLoad(instance.initialPresentation.get(), requestId));
  instance.performancePresentation.set({ status: 'idle' });

  instance.tdfListingSub?.stop();
  const tdfListingSub = Meteor.subscribe('allTdfsListing');
  instance.tdfListingSub = tdfListingSub;

  try {
    const [assignmentsByCourseId, courses] = await Promise.all([
      meteorCallAsync('getTdfAssignmentsByCourseIdMap', Meteor.userId()),
      meteorCallAsync('getAllCoursesForInstructor', Meteor.userId()),
      waitForTdfListing(instance, tdfListingSub),
    ]);
    if (!instance.initialLifetime.isCurrent(generation)) return;

    const value = {
      courses: Array.isArray(courses) ? courses as ReportingCourse[] : [],
      assignmentsByCourseId: (assignmentsByCourseId || {}) as ReportingAssignmentsByCourseId,
      allTdfs: Tdfs.find().fetch(),
    };
    instance.initialPresentation.set(resolveLoad(
      instance.initialPresentation.get(),
      requestId,
      value,
      (data) => data.courses.length === 0,
    ));
  } catch (error: unknown) {
    if (!instance.initialLifetime.isCurrent(generation)) return;
    const message = errorMessage(error);
    instance.initialPresentation.set(rejectLoad(
      instance.initialPresentation.get(),
      requestId,
      { message, retryable: true },
    ));
  }
}

function clearTdfSelection(instance: InstructorReportingInstance): void {
  instance.selectedTdfId.set(String(INVALID));
  instance.selectedAssignmentId.set(null);
  instance.selectedDueDate.set('');
  instance.deadlineDate.set('');
  instance.exceptionDate.set('');
  instance.exceptionDateError.set('');
  instance.exceptionDateValidationUserId.set('');
  instance.dueDateFilter.set(false);
  instance.performancePresentation.set({ status: 'idle' });
}

function selectClass(instance: InstructorReportingInstance, courseId: string): void {
  instance.selectedCourseId.set(courseId);
  clearTdfSelection(instance);
}

function selectTdf(instance: InstructorReportingInstance, tdfId: string): void {
  const data = getInitialData(instance);
  const courseId = instance.selectedCourseId.get();
  const assignment = findAssignmentForTdf(data.assignmentsByCourseId, courseId, tdfId);
  const tdf = findTdfSummary(data.allTdfs, tdfId);
  const dueDate = toDateInputValue(resolveSelectedDueDate(assignment, tdf));
  instance.selectedTdfId.set(tdfId);
  instance.selectedAssignmentId.set(assignment?.assignmentId || null);
  instance.selectedDueDate.set(dueDate);
  instance.deadlineDate.set('');
  instance.exceptionDate.set('');
  instance.exceptionDateError.set('');
  instance.exceptionDateValidationUserId.set('');
  instance.dueDateFilter.set(false);
}

function currentFilterDate(instance: InstructorReportingInstance): number | false {
  if (instance.dueDateFilter.get()) {
    return toDateMillis(instance.selectedDueDate.get());
  }
  return toDateMillis(instance.deadlineDate.get());
}

function reloadPerformance(instance: InstructorReportingInstance, date: number | false = currentFilterDate(instance)): void {
  const courseId = instance.selectedCourseId.get();
  const tdfId = instance.selectedTdfId.get();
  if (!courseId || !tdfId || tdfId === String(INVALID)) {
    instance.performancePresentation.set({ status: 'idle' });
    return;
  }

  const requestId = ++instance.nextPerformanceRequestId;
  const generation = instance.performanceLifetime.begin();
  instance.performancePresentation.set(startLoad(instance.performancePresentation.get(), requestId));

  meteorCallAsync('getClassPerformanceByTDF', courseId, tdfId, date || false)
    .then((result) => {
      if (!instance.performanceLifetime.isCurrent(generation)) return;
      const buckets = normalizePerformanceBuckets(result);
      instance.performancePresentation.set(resolveLoad(
        instance.performancePresentation.get(),
        requestId,
        buckets,
        (value) => value.met.length === 0 && value.notMet.length === 0,
      ));
    })
    .catch((error) => {
      if (!instance.performanceLifetime.isCurrent(generation)) return;
      const message = errorMessage(error);
      instance.performancePresentation.set(rejectLoad(
        instance.performancePresentation.get(),
        requestId,
        { message, retryable: true },
      ));
    });
}

function exceptionRefreshDate(instance: InstructorReportingInstance): number | false {
  return toDateMillis(instance.selectedDueDate.get()) || currentFilterDate(instance);
}

function runExceptionCommand(
  instance: InstructorReportingInstance,
  userId: string,
  work: () => Promise<void>,
  successMessage: string,
): void {
  void instance.commandRegistry.run(exceptionScope(userId), async () => {
    await work();
    return { message: successMessage };
  }, {
    getErrorMessage: (error) => errorMessage(error),
    onSuccess: () => {
      reloadPerformance(instance, exceptionRefreshDate(instance));
    },
  });
}

Template.instructorReporting.onCreated(function(this: InstructorReportingInstance) {
  this.initialPresentation = new ReactiveVar<LoadableState<InstructorReportingInitialData>>({ status: 'idle' });
  this.performancePresentation = new ReactiveVar<LoadableState<ReportingPerformanceBuckets>>({ status: 'idle' });
  this.commandStates = new ReactiveVar<ReportingCommandStates>({});
  this.commandRegistry = createScopedAsyncCommandRegistry<ReportingCommandResult>((scope, state) => {
    this.commandStates.set({ ...this.commandStates.get(), [scope]: state });
  });
  this.initialLifetime = createTemplateLifetime();
  this.performanceLifetime = createTemplateLifetime();
  this.nextInitialRequestId = 0;
  this.nextPerformanceRequestId = 0;
  this.selectedCourseId = new ReactiveVar('');
  this.selectedTdfId = new ReactiveVar(String(INVALID));
  this.selectedAssignmentId = new ReactiveVar<string | null>(null);
  this.selectedDueDate = new ReactiveVar('');
  this.deadlineDate = new ReactiveVar('');
  this.exceptionDate = new ReactiveVar('');
  this.dueDateFilter = new ReactiveVar(false);
  this.exceptionDateError = new ReactiveVar('');
  this.exceptionDateValidationUserId = new ReactiveVar('');
  void loadInitialReportingData(this);
});

Template.instructorReporting.onDestroyed(function(this: InstructorReportingInstance) {
  this.initialLifetime.destroy();
  this.performanceLifetime.destroy();
  this.commandRegistry.destroy();
  this.tdfReadyComputation?.stop();
  this.tdfListingSub?.stop();
});

Template.instructorReporting.helpers({
  INVALID: INVALID,
  classes(): ReportingCourse[] {
    return getInitialData(Template.instance() as InstructorReportingInstance).courses;
  },
  selectedClassAttrs(courseId: string) {
    return (Template.instance() as InstructorReportingInstance).selectedCourseId.get() === String(courseId || '')
      ? { selected: true }
      : {};
  },
  curInstructorReportingTdfs(): ReportingAssignment[] {
    const instance = Template.instance() as InstructorReportingInstance;
    return getCourseAssignments(getInitialData(instance).assignmentsByCourseId, instance.selectedCourseId.get());
  },
  selectedTdfAttrs(tdfId: string) {
    return (Template.instance() as InstructorReportingInstance).selectedTdfId.get() === String(tdfId || '')
      ? { selected: true }
      : {};
  },
  initialLoading(): boolean {
    return loadPending((Template.instance() as InstructorReportingInstance).initialPresentation.get());
  },
  initialLoadError(): string {
    return loadErrorMessage((Template.instance() as InstructorReportingInstance).initialPresentation.get());
  },
  performanceLoading(): boolean {
    return loadBusy((Template.instance() as InstructorReportingInstance).performancePresentation.get());
  },
  loadError(): string {
    const instance = Template.instance() as InstructorReportingInstance;
    return loadErrorMessage(instance.initialPresentation.get())
      || loadErrorMessage(instance.performancePresentation.get());
  },
  reportingText(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return reportingText(key, options?.hash);
  },
  classReportingTableLabel(): string {
    return reportingText('reporting.classData');
  },
  classReportingTableData() {
    const instance = Template.instance() as InstructorReportingInstance;
    const buckets = getPerformanceBuckets(instance);
    return {
      metRows: buckets.met,
      notMetRows: buckets.notMet,
      hasMetRows: rowsHaveData(buckets.met),
      hasNotMetRows: rowsHaveData(buckets.notMet),
      totals: getReportingTotals([...buckets.met, ...buckets.notMet]),
      dueDateFilter: instance.dueDateFilter.get(),
      performanceLoading: loadBusy(instance.performancePresentation.get()),
      loadError: performanceLoadError(instance),
      commandStates: instance.commandStates.get(),
      exceptionDateError: instance.exceptionDateError.get(),
      exceptionDateValidationUserId: instance.exceptionDateValidationUserId.get(),
    };
  },
  selectedTdfDueDate(): string {
    return (Template.instance() as InstructorReportingInstance).selectedDueDate.get();
  },
  deadlineDateValue(): string {
    return (Template.instance() as InstructorReportingInstance).deadlineDate.get();
  },
  exceptionDateValue(): string {
    return (Template.instance() as InstructorReportingInstance).exceptionDate.get();
  },
  dueDateFilter(): boolean {
    return (Template.instance() as InstructorReportingInstance).dueDateFilter.get();
  },
  dueDateFilterChecked(): string | null {
    return (Template.instance() as InstructorReportingInstance).dueDateFilter.get() ? 'checked' : null;
  },
  tdfSelectDisabled(): boolean {
    const instance = Template.instance() as InstructorReportingInstance;
    return loadPending(instance.initialPresentation.get()) || !instance.selectedCourseId.get();
  },
  deadlineDisabled(): boolean {
    const instance = Template.instance() as InstructorReportingInstance;
    return !instance.selectedTdfId.get()
      || instance.selectedTdfId.get() === String(INVALID)
      || instance.dueDateFilter.get()
      || loadBusy(instance.performancePresentation.get());
  },
  exceptionDateError(): string {
    return (Template.instance() as InstructorReportingInstance).exceptionDateError.get();
  },
  exceptionDateAttrs() {
    return (Template.instance() as InstructorReportingInstance).exceptionDateError.get()
      ? { 'aria-invalid': 'true', 'aria-describedby': 'reporting-exception-date-error' }
      : { 'aria-invalid': 'false' };
  },
  exceptionBusy(): boolean {
    return Object.values((Template.instance() as InstructorReportingInstance).commandStates.get())
      .some((state) => state.status === 'pending');
  },
});

Template.instructorReportingClassTable.helpers({
  reportingText(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return reportingText(key, options?.hash);
  },
});

Template.instructorReportingStudentRow.helpers({
  reportingText(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return reportingText(key, options?.hash);
  },
  exceptionActionLabel(key: Parameters<typeof translatePlatformString>[1], row: ReportingPerformanceRow): string {
    return reportingActionLabel(key, row);
  },
  rowCommandFeedback(userId: string) {
    const states = Template.instance().data?.commandStates as ReportingCommandStates | undefined;
    return commandPresentation(
      states?.[exceptionScope(userId)] ?? states?.[navigationScope(userId)],
      `reporting-row-feedback-${userId}`,
    );
  },
  hasRowCommandFeedback(userId: string): boolean {
    const states = Template.instance().data?.commandStates as ReportingCommandStates | undefined;
    return Boolean(commandPresentation(
      states?.[exceptionScope(userId)] ?? states?.[navigationScope(userId)],
      `reporting-row-feedback-${userId}`,
    ));
  },
  rowActionAttrs(userId: string) {
    const states = Template.instance().data?.commandStates as ReportingCommandStates | undefined;
    const state = states?.[exceptionScope(userId)] ?? states?.[navigationScope(userId)];
    const describesDateError = Template.instance().data?.exceptionDateError
      && Template.instance().data?.exceptionDateValidationUserId === userId;
    return {
      ...(state?.status === 'pending' ? { disabled: true } : {}),
      'aria-busy': state?.status === 'pending' ? 'true' : 'false',
      ...(state && state.status !== 'idle' ? { 'aria-describedby': `reporting-row-feedback-${userId}` } : {}),
      ...(!state || state.status === 'idle'
        ? (describesDateError ? { 'aria-describedby': 'reporting-exception-date-error' } : {})
        : {}),
    };
  },
});

Template.instructorReporting.events({
  'change #class-select'(event: Event, instance: InstructorReportingInstance) {
    const courseId = String((event.currentTarget as HTMLSelectElement).value || '');
    selectClass(instance, courseId);
  },

  'change #tdf-select'(event: Event, instance: InstructorReportingInstance) {
    const tdfId = String((event.currentTarget as HTMLSelectElement).value || '');
    selectTdf(instance, tdfId);
    reloadPerformance(instance, false);
  },

  'change #practice-deadline-date'(event: Event, instance: InstructorReportingInstance) {
    const date = String((event.currentTarget as HTMLInputElement).value || '');
    instance.deadlineDate.set(date);
    const dateInt = toDateMillis(date);
    if (dateInt) {
      reloadPerformance(instance, dateInt);
    }
  },

  'change #exception-date'(event: Event, instance: InstructorReportingInstance) {
    instance.exceptionDate.set(String((event.currentTarget as HTMLInputElement).value || ''));
    instance.exceptionDateError.set('');
    instance.exceptionDateValidationUserId.set('');
  },

  'change #due-date-filter'(event: Event, instance: InstructorReportingInstance) {
    const checked = Boolean((event.currentTarget as HTMLInputElement).checked);
    instance.dueDateFilter.set(checked);
    if (checked) {
      instance.deadlineDate.set(instance.selectedDueDate.get());
      const dateInt = toDateMillis(instance.selectedDueDate.get());
      if (dateInt) {
        reloadPerformance(instance, dateInt);
      }
    } else {
      instance.deadlineDate.set('');
      reloadPerformance(instance, false);
    }
  },

  'click .instructor-reporting-student-link'(event: Event, instance: InstructorReportingInstance) {
    event.preventDefault();
    const username = String((event.currentTarget as HTMLElement).dataset.username || '');
    const navigateToStudentReporting = (globalThis as any).navigateToStudentReporting;
    const userId = String((event.currentTarget as HTMLElement).dataset.userid || username);
    void instance.commandRegistry.run(navigationScope(userId), async () => {
      navigateToStudentReporting(username);
      return { message: '' };
    }, { getErrorMessage: (error) => errorMessage(error) });
  },

  'click .add-exception'(event: Event, instance: InstructorReportingInstance) {
    event.preventDefault();
    const userId = String((event.currentTarget as HTMLElement).dataset.userid || '');
    const dateInt = toDateMillis(instance.exceptionDate.get());
    if (!dateInt) {
      instance.exceptionDateError.set(reportingText('reporting.exceptionDate'));
      instance.exceptionDateValidationUserId.set(userId);
      document.getElementById('exception-date')?.focus();
      return;
    }
    instance.exceptionDateError.set('');
    instance.exceptionDateValidationUserId.set('');
    const courseId = instance.selectedCourseId.get();
    const tdfId = instance.selectedTdfId.get();
    const assignmentId = instance.selectedAssignmentId.get() || undefined;
    runExceptionCommand(
      instance,
      userId,
      async () => {
        await meteorCallAsync('addUserDueDateException', userId, tdfId, courseId, dateInt, assignmentId);
      },
      reportingText('reporting.exceptionAdded'),
    );
  },

  'click .remove-exception'(event: Event, instance: InstructorReportingInstance) {
    event.preventDefault();
    const userId = String((event.currentTarget as HTMLElement).dataset.userid || '');
    const courseId = instance.selectedCourseId.get();
    const tdfId = instance.selectedTdfId.get();
    const assignmentId = instance.selectedAssignmentId.get() || undefined;
    runExceptionCommand(
      instance,
      userId,
      async () => {
        await meteorCallAsync('removeUserDueDateException', userId, tdfId, courseId, assignmentId);
      },
      reportingText('reporting.exceptionRemoved'),
    );
  },
});

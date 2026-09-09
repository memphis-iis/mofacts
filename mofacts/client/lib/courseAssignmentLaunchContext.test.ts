import { Session } from 'meteor/session';
import { expect } from 'chai';
import {
  applyCourseAssignmentLaunchContext,
  clearCourseAssignmentLaunchContext,
  courseAssignmentContextForStateWrite,
  getCourseAssignmentLaunchContext,
  restoreCourseAssignmentLaunchContextFromState,
  setCourseAssignmentLaunchContext,
} from './courseAssignmentLaunchContext';

describe('courseAssignmentLaunchContext', function() {
  it('persists the launch revision while stamping each trial with its source lesson', function() {
    const context = { assignmentId: 'p', courseId: 'c', TDFId: 'b', launchSource: 'courses' as const,
      launchMode: 'progressive' as const, progressiveEndpointTdfId: 'b', progressiveRevisionId: 'revision-1', progressiveReverseOrder: true };
    setCourseAssignmentLaunchContext(context);
    const row = applyCourseAssignmentLaunchContext({ TDFId: 'a', levelUnit: 1, levelUnitName: 'A practice' });
    expect(row).to.deep.include({ TDFId: 'a', levelUnit: 1, levelUnitName: 'A practice' });
    expect((row as any).courseAssignment).to.deep.equal({ ...context, TDFId: 'a' });
    expect(restoreCourseAssignmentLaunchContextFromState({ courseAssignmentLaunchContext: context })).to.deep.equal(context);
  });
  beforeEach(function() {
    clearCourseAssignmentLaunchContext();
    Session.set('currentRootTdfId', undefined);
    Session.set('currentTdfId', undefined);
  });

  afterEach(function() {
    clearCourseAssignmentLaunchContext();
    Session.set('currentRootTdfId', undefined);
    Session.set('currentTdfId', undefined);
  });

  it('stamps course assignment context onto assigned-root history records', function() {
    const context = {
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'tdf-1',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };
    setCourseAssignmentLaunchContext(context);

    const record = applyCourseAssignmentLaunchContext<Record<string, unknown>>({
      TDFId: 'tdf-1',
      levelUnitType: 'model',
    });

    expect(record.courseAssignment).to.deep.equal(context);
    expect(getCourseAssignmentLaunchContext()).to.deep.equal(context);
  });

  it('stamps course assignment context onto active resolved-child history records', function() {
    const context = {
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'root-tdf',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };
    setCourseAssignmentLaunchContext(context);
    Session.set('currentRootTdfId', 'root-tdf');
    Session.set('currentTdfId', 'child-tdf');

    const record = applyCourseAssignmentLaunchContext<Record<string, unknown>>({
      TDFId: 'child-tdf',
      levelUnitType: 'Instruction',
    });

    expect(record.courseAssignment).to.deep.equal(context);
  });

  it('fails before stamping stale course context onto unrelated history records', function() {
    setCourseAssignmentLaunchContext({
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'tdf-1',
      launchSource: 'courses',
          launchMode: 'individual',
    });

    expect(() => applyCourseAssignmentLaunchContext<Record<string, unknown>>({
        TDFId: 'other-tdf',
        levelUnitType: 'model',
      })
    ).to.throw(/History TDFId does not match course assignment launch context/);
  });

  it('fails clearly for malformed course launch context', function() {
    Session.set('courseAssignmentLaunchContext', {
      assignmentId: 'assignment-1',
      courseId: '',
      TDFId: 'tdf-1',
      launchSource: 'courses',
          launchMode: 'individual',
    });

    expect(
      () => getCourseAssignmentLaunchContext(),
    ).to.throw(/Invalid course assignment launch context/);
  });

  it('restores persisted course assignment launch context for card reloads', function() {
    const context = {
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'tdf-1',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };

    const restored = restoreCourseAssignmentLaunchContextFromState({
      courseAssignmentLaunchContext: context,
    });

    expect(restored).to.deep.equal(context);
    expect(getCourseAssignmentLaunchContext()).to.deep.equal(context);
  });

  it('does not erase an active course launch when older experiment state has no course field', function() {
    const context = {
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'tdf-1',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };
    setCourseAssignmentLaunchContext(context);

    const restored = restoreCourseAssignmentLaunchContextFromState({
      currentTdfId: 'tdf-1',
    });

    expect(restored).to.deep.equal(context);
    expect(getCourseAssignmentLaunchContext()).to.deep.equal(context);
  });

  it('clears course assignment context only when persisted state explicitly clears it', function() {
    setCourseAssignmentLaunchContext({
      assignmentId: 'assignment-1',
      courseId: 'course-1',
      TDFId: 'tdf-1',
      launchSource: 'courses',
          launchMode: 'individual',
    });

    const restored = restoreCourseAssignmentLaunchContextFromState({
      courseAssignmentLaunchContext: null,
    });

    expect(restored).to.equal(null);
    expect(getCourseAssignmentLaunchContext()).to.equal(null);
  });

  it('writes the active course launch context during state persistence', function() {
    const activeContext = {
      assignmentId: 'assignment-active',
      courseId: 'course-active',
      TDFId: 'tdf-active',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };
    setCourseAssignmentLaunchContext(activeContext);

    const resolved = courseAssignmentContextForStateWrite({
      existingState: {
        courseAssignmentLaunchContext: {
          assignmentId: 'assignment-old',
          courseId: 'course-old',
          TDFId: 'tdf-old',
          launchSource: 'courses',
          launchMode: 'individual',
        },
      },
      partialState: {
        currentTdfId: 'tdf-active',
      },
    });

    expect(resolved).to.deep.equal(activeContext);
  });

  it('clears existing durable course context when the active launch explicitly has no course context', function() {
    const existingContext = {
      assignmentId: 'assignment-old',
      courseId: 'course-old',
      TDFId: 'tdf-old',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };

    const resolved = courseAssignmentContextForStateWrite({
      existingState: {
        courseAssignmentLaunchContext: existingContext,
      },
      partialState: {
        currentTdfId: 'tdf-old',
      },
    });

    expect(resolved).to.equal(null);
  });

  it('preserves existing durable course context only before active launch context is initialized', function() {
    Session.set('courseAssignmentLaunchContext', undefined);
    const existingContext = {
      assignmentId: 'assignment-old',
      courseId: 'course-old',
      TDFId: 'tdf-old',
      launchSource: 'courses' as const,
      launchMode: 'individual' as const,
    };

    const resolved = courseAssignmentContextForStateWrite({
      existingState: {
        courseAssignmentLaunchContext: existingContext,
      },
      partialState: {
        currentTdfId: 'tdf-old',
      },
    });

    expect(resolved).to.deep.equal(existingContext);
  });

  it('honors explicit state writes that clear course context', function() {
    setCourseAssignmentLaunchContext({
      assignmentId: 'assignment-active',
      courseId: 'course-active',
      TDFId: 'tdf-active',
      launchSource: 'courses',
          launchMode: 'individual',
    });

    const resolved = courseAssignmentContextForStateWrite({
      existingState: {
        courseAssignmentLaunchContext: {
          assignmentId: 'assignment-old',
          courseId: 'course-old',
          TDFId: 'tdf-old',
          launchSource: 'courses',
          launchMode: 'individual',
        },
      },
      partialState: {
        courseAssignmentLaunchContext: null,
      },
    });

    expect(resolved).to.equal(null);
  });
});

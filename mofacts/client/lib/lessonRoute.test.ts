import { expect } from 'chai';
import {
  buildLessonRouteLocation,
  isLessonRoutePath,
  resolveLessonRouteRequest,
} from './lessonRoute';

describe('lesson route', function() {
  it('round-trips the authorized progressive revision through a page reload', function() {
    const context = { assignmentId: 'p', courseId: 'c', TDFId: 'b', launchSource: 'courses' as const,
      launchMode: 'progressive' as const, progressiveEndpointTdfId: 'b', progressiveRevisionId: 'old-order' };
    const location = buildLessonRouteLocation('/content', {
      rootTdfId: 'b', practiceLaunchMode: 'normal', courseAssignment: context,
    });
    const request = resolveLessonRouteRequest({
      routeTdfId: 'b', routeMode: undefined, routeCourseId: location.queryParams.courseId,
      routeAssignmentId: location.queryParams.assignmentId, routeProgressive: location.queryParams.progressive,
      routeProgressiveRevisionId: location.queryParams.progressiveRevisionId,
      activeRootTdfId: '', activeCurrentTdfId: '', activePracticeLaunchMode: 'normal',
    });
    expect(request.courseAssignment).to.deep.equal(context);
    expect(request.requiresBootstrap).to.equal(true);
    expect(() => resolveLessonRouteRequest({
      routeTdfId: 'b', routeMode: undefined, routeCourseId: 'c', routeAssignmentId: 'p', routeProgressive: '1',
      activeRootTdfId: '', activeCurrentTdfId: '', activePracticeLaunchMode: 'normal',
    })).to.throw('revision');
  });
  it('puts the exact TDF and Blocks mode in the content route', function() {
    expect(buildLessonRouteLocation('/content', {
      rootTdfId: 'times tables',
      practiceLaunchMode: 'blocks',
    })).to.deep.equal({
      path: '/content/times%20tables',
      queryParams: { mode: 'blocks' },
    });
  });

  it('keeps course assignment identity in learner-flow routes', function() {
    expect(buildLessonRouteLocation('/instructions', {
      rootTdfId: 'tdf-1',
      practiceLaunchMode: 'normal',
      courseAssignment: {
        assignmentId: 'assignment-1',
        courseId: 'course-1',
        TDFId: 'tdf-1',
        launchSource: 'courses',
          launchMode: 'individual',
      },
    })).to.deep.equal({
      path: '/instructions/tdf-1',
      queryParams: {
        courseId: 'course-1',
        assignmentId: 'assignment-1',
      },
    });
  });

  it('requires refresh bootstrap when the route TDF or launch mode is not active', function() {
    expect(resolveLessonRouteRequest({
      routeTdfId: 'times-tables',
      routeMode: 'blocks',
      routeCourseId: undefined,
      routeAssignmentId: undefined,
      activeRootTdfId: 'sparc',
      activeCurrentTdfId: 'sparc',
      activePracticeLaunchMode: 'normal',
    })).to.deep.include({
      rootTdfId: 'times-tables',
      practiceLaunchMode: 'blocks',
      requiresBootstrap: true,
    });
  });

  it('keeps an active condition child when its root and mode match the route', function() {
    expect(resolveLessonRouteRequest({
      routeTdfId: 'root-tdf',
      routeMode: undefined,
      routeCourseId: undefined,
      routeAssignmentId: undefined,
      activeRootTdfId: 'root-tdf',
      activeCurrentTdfId: 'condition-tdf',
      activePracticeLaunchMode: 'normal',
    }).requiresBootstrap).to.equal(false);
  });

  it('requires bootstrap when the active course assignment differs from the route', function() {
    expect(resolveLessonRouteRequest({
      routeTdfId: 'root-tdf',
      routeMode: undefined,
      routeCourseId: 'course-1',
      routeAssignmentId: 'assignment-1',
      activeRootTdfId: 'root-tdf',
      activeCurrentTdfId: 'root-tdf',
      activePracticeLaunchMode: 'normal',
      activeCourseAssignment: {
        assignmentId: 'assignment-2',
        courseId: 'course-1',
        TDFId: 'root-tdf',
        launchSource: 'courses',
          launchMode: 'individual',
      },
    }).requiresBootstrap).to.equal(true);
  });

  it('rejects ambiguous or unsupported route state', function() {
    expect(() => resolveLessonRouteRequest({
      routeTdfId: '',
      routeMode: undefined,
      routeCourseId: undefined,
      routeAssignmentId: undefined,
      activeRootTdfId: undefined,
      activeCurrentTdfId: undefined,
      activePracticeLaunchMode: 'normal',
    })).to.throw('Missing root TDF id');

    expect(() => resolveLessonRouteRequest({
      routeTdfId: 'tdf-1',
      routeMode: 'arcade',
      routeCourseId: undefined,
      routeAssignmentId: undefined,
      activeRootTdfId: undefined,
      activeCurrentTdfId: undefined,
      activePracticeLaunchMode: 'normal',
    })).to.throw('Unsupported practice mode');

    expect(() => resolveLessonRouteRequest({
      routeTdfId: 'tdf-1',
      routeMode: undefined,
      routeCourseId: 'course-1',
      routeAssignmentId: undefined,
      activeRootTdfId: undefined,
      activeCurrentTdfId: undefined,
      activePracticeLaunchMode: 'normal',
    })).to.throw('must be supplied together');
  });

  it('recognizes only descriptor-bearing learner-flow paths', function() {
    expect(isLessonRoutePath('/content/tdf-1')).to.equal(true);
    expect(isLessonRoutePath('/instructions/tdf-1', '/instructions')).to.equal(true);
    expect(isLessonRoutePath('/content')).to.equal(false);
    expect(isLessonRoutePath('/home')).to.equal(false);
  });
});

import { expect } from 'chai';
import { Meteor } from 'meteor/meteor';
import { createCourseMethods } from './courseMethods';

function cursor(rows: any[] = []) {
  return {
    async fetchAsync() {
      return rows;
    },
    async countAsync() {
      return rows.length;
    },
  };
}

function matchesSelector(row: any, selector: Record<string, any> = {}): boolean {
  if (Array.isArray(selector.$or)) {
    if (!selector.$or.some((branch: Record<string, any>) => matchesSelector(row, branch))) return false;
  }
  return Object.entries(selector).every(([key, expected]) => {
    if (key === '$or') return true;
    const actual = row[key];
    if (Array.isArray(expected)) return JSON.stringify(actual) === JSON.stringify(expected);
    if (expected === null) return actual === null || actual === undefined;
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) {
        return expected.$in.includes(actual);
      }
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === '$ne') return actual !== value;
        if (operator === '$exists') return value ? actual !== undefined : actual === undefined;
        return false;
      });
    }
    return actual === expected;
  });
}

function createMemoryCollection(initialRows: any[] = []) {
  const rows = initialRows.map((row) => ({ ...row }));
  return {
    rows,
    find: (selector: Record<string, any> = {}) => cursor(rows.filter((row) => matchesSelector(row, selector))),
    async findOneAsync(selector: Record<string, any> = {}) {
      return rows.find((row) => matchesSelector(row, selector)) || null;
    },
    async insertAsync(document: any) {
      const id = document._id || `inserted-${rows.length + 1}`;
      rows.push({ _id: id, ...document });
      return id;
    },
    async updateAsync(selector: Record<string, any>, modifier: any, options: Record<string, any> = {}) {
      let count = 0;
      for (const row of rows) {
        if (!matchesSelector(row, selector)) continue;
        if (modifier?.$set) {
          for (const [path, value] of Object.entries(modifier.$set)) {
            const parts = path.split('.');
            let target = row;
            for (const part of parts.slice(0, -1)) target = target[part] ||= {};
            target[parts[parts.length - 1]!] = value;
          }
        }
        if (!modifier?.$set) Object.assign(row, modifier);
        count += 1;
      }
      if (count === 0 && options.upsert) {
        const document = { ...selector, ...(modifier?.$set || modifier || {}) };
        rows.push(document);
        count = 1;
      }
      return count;
    },
    async removeAsync(selector: Record<string, any>) {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matchesSelector(rows[index], selector)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return count;
    },
    rawCollection: () => ({
      aggregate: () => ({
        async toArray() {
          return [];
        },
      }),
    }),
  };
}

function createDeps(overrides: Record<string, any> = {}) {
  const collection = {
    find: () => cursor(),
    async findOneAsync() {
      return null;
    },
    async insertAsync() {
      return 'inserted-id';
    },
    async updateAsync() {
      return 1;
    },
    async removeAsync() {
      return 1;
    },
    rawCollection: () => ({
      aggregate: () => ({
        async toArray() {
          return [];
        },
      }),
    }),
  };
  return {
    serverConsole: () => undefined,
    Courses: collection,
    Sections: collection,
    SectionUserMap: collection,
    Assignments: collection,
    Tdfs: collection,
    Histories: {
      async findOneAsync() {
        return null;
      },
    },
    itemSourceSentences: {
      find: () => ({ sourceSentences: [] }),
    },
    usersCollection: {
      find: () => cursor(),
      async findOneAsync() {
        return null;
      },
      async updateAsync() {
        return 1;
      },
    },
    getMethodAuthorizationDeps: () => ({
      async userIsInRoleAsync(_userId: string, roles: string[]) {
        return roles.includes('admin');
      },
    }),
    getUserDisplayIdentifier: () => 'user',
    normalizeCanonicalId: (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null,
    sendEmail: () => undefined,
    emailFrom: 'noreply@example.test',
    thisServerUrl: 'https://mofacts.example.test',
    getStimuliSetById: async () => [],
    removeRuntimeTdfSecrets: <T>(value: T) => value,
    ...overrides,
  };
}

describe('course method operational errors', function() {
  it('reads and removes exceptions by assignment without matching another course or old formats', async function() {
    const date = new Date('2026-09-10T12:00:00Z');
    const users = createMemoryCollection([{ _id: 'student', dueDateExceptions: [
      { assignmentId: 'other', courseId: 'other-course', TDFId: 'lesson', date },
      { tdfId: 'lesson', classId: 'course', date },
      { TDFId: 'lesson', courseId: 'course', date },
      { assignmentId: 'target', courseId: 'course', TDFId: 'lesson', date },
    ] }]);
    const methods = createCourseMethods(createDeps({
      usersCollection: users,
      Courses: createMemoryCollection([{ _id: 'course', teacherUserId: 'teacher' }]),
      Assignments: createMemoryCollection([{ _id: 'target', courseId: 'course', assignmentType: 'lesson', TDFId: 'lesson' }]),
    }));
    expect(await methods.checkForUserException.call({ userId: 'student' }, 'student', 'target')).to.equal(date.toLocaleDateString());
    expect(await methods.checkForUserException.call({ userId: 'student' }, 'student', 'lesson')).to.equal(false);
    await methods.removeUserDueDateException.call({ userId: 'teacher' }, 'student', 'lesson', 'course', 'target');
    expect(users.rows[0].dueDateExceptions).to.have.length(3);
    expect(users.rows[0].dueDateExceptions[0].assignmentId).to.equal('other');
    expect(await methods.checkForUserException.call({ userId: 'student' }, 'student', 'target')).to.equal(false);
  });
  it('returns an empty array for a valid empty broad course listing', async function() {
    const methods = createCourseMethods(createDeps());

    const result = await methods.getAllCourses.call({ userId: 'admin-user' });

    expect(result).to.deep.equal([]);
  });

  it('throws Meteor.Error instead of returning null for listing failures', async function() {
    const methods = createCourseMethods(createDeps({
      Courses: {
        ...createDeps().Courses,
        find: () => ({
          async fetchAsync() {
            throw new Error('database unavailable');
          },
        }),
      },
    }));

    try {
      await methods.getAllCourses.call({ userId: 'admin-user' });
      expect.fail('Expected getAllCourses to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(Meteor.Error);
      expect((error as Meteor.Error).error).to.equal('course-operation-failed');
      expect((error as Meteor.Error).reason).to.equal('getAllCourses failed');
    }
  });
});

describe('course assignment metadata methods', function() {
  it('defaults new courses to private visibility and persists explicit timezone metadata', async function() {
    const courses = createMemoryCollection();
    const deps = createDeps({
      Courses: courses,
      Sections: createMemoryCollection(),
      SectionUserMap: createMemoryCollection(),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
    });
    const methods = createCourseMethods(deps);

    await methods.addCourse.call({ userId: 'teacher-user' }, {
      courseName: 'Intro Course',
      semester: 'current',
      timezone: 'America/Chicago',
      beginDate: null,
      endDate: null,
      sections: ['A'],
    });

    expect(courses.rows[0]).to.include({
      courseName: 'Intro Course',
      teacherUserId: 'teacher-user',
      visibility: 'private',
      timezone: 'America/Chicago',
    });
  });

  it('creates a default section for new courses when no section names are supplied', async function() {
    const sections = createMemoryCollection();
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection(),
      Sections: sections,
      SectionUserMap: createMemoryCollection(),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
    }));

    const courseId = await methods.addCourse.call({ userId: 'teacher-user' }, {
      courseName: 'Intro Course',
      semester: 'current',
      timezone: 'America/Chicago',
      beginDate: null,
      endDate: null,
      sections: [],
    });

    expect(sections.rows).to.deep.include({
      _id: 'inserted-1',
      courseId,
      sectionName: '001',
    });
  });

  it('rejects duplicate course names for the same instructor and semester', async function() {
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection([{ _id: 'course-1', courseName: 'Intro Course', teacherUserId: 'teacher-user', semester: 'current' }]),
      Sections: createMemoryCollection(),
      SectionUserMap: createMemoryCollection(),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
    }));

    try {
      await methods.addCourse.call({ userId: 'teacher-user' }, {
        courseName: ' intro course ',
        semester: 'current',
        timezone: 'America/Chicago',
        sections: ['A'],
      });
      expect.fail('Expected duplicate course name to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(Meteor.Error);
      expect((error as Meteor.Error).reason).to.equal('A course with that name already exists for this instructor');
    }
  });

  it('deletes course management records without touching histories', async function() {
    const courses = createMemoryCollection([{ _id: 'course-1', courseName: 'Intro Course', teacherUserId: 'teacher-user', semester: 'current' }]);
    const sections = createMemoryCollection([{ _id: 'section-1', courseId: 'course-1', sectionName: '001' }]);
    const sectionUserMap = createMemoryCollection([{ _id: 'enrollment-1', sectionId: 'section-1', userId: 'student-user' }]);
    const assignments = createMemoryCollection([{ _id: 'assignment-1', courseId: 'course-1', assignmentType: 'lesson', TDFId: 'tdf-1' }]);
    const histories = {
      rows: [{ _id: 'history-1', userId: 'student-user', courseAssignment: { courseId: 'course-1' } }],
      async findOneAsync() {
        return this.rows[0] || null;
      },
    };
    const methods = createCourseMethods(createDeps({
      Courses: courses,
      Sections: sections,
      SectionUserMap: sectionUserMap,
      Assignments: assignments,
      Histories: histories,
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
    }));

    await methods.deleteCourse.call({ userId: 'teacher-user' }, 'course-1');

    expect(courses.rows).to.deep.equal([]);
    expect(sections.rows).to.deep.equal([]);
    expect(sectionUserMap.rows).to.deep.equal([]);
    expect(assignments.rows).to.deep.equal([]);
    expect(histories.rows).to.have.length(1);
  });

  it('rejects invalid course visibility values', async function() {
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection(),
      Sections: createMemoryCollection(),
      SectionUserMap: createMemoryCollection(),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
    }));

    try {
      await methods.addCourse.call({ userId: 'teacher-user' }, {
        courseName: 'Intro Course',
        semester: 'current',
        timezone: 'America/Chicago',
        visibility: 'secret',
        sections: ['A'],
      });
      expect.fail('Expected invalid visibility to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(Meteor.Error);
      expect((error as Meteor.Error).reason).to.equal('Course visibility must be private or public');
    }
  });

  it('sends one course assignment email when a learner joins a new section membership', async function() {
    const sentEmails: any[] = [];
    const sectionUserMap = createMemoryCollection();
    const users = createMemoryCollection([
      { _id: 'student-user', username: 'Student One', emails: [{ address: 'student@example.test' }], loginParams: {} },
    ]);
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection([{ _id: 'course-1', courseName: 'Course One', teacherUserId: 'teacher-1', semester: 'current', timezone: 'America/Chicago' }]),
      Sections: createMemoryCollection([{ _id: 'section-1', courseId: 'course-1', sectionName: 'Section A' }]),
      SectionUserMap: sectionUserMap,
      Assignments: createMemoryCollection([{ _id: 'assignment-1', courseId: 'course-1', assignmentType: 'lesson', TDFId: 'tdf-1' }]),
      usersCollection: users,
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection(),
      sendEmail: (to: string, from: string, subject: string, text: string) => {
        sentEmails.push({ to, from, subject, text });
      },
    }));

    await methods.addUserToTeachersClass.call({ userId: 'student-user' }, 'teacher-1', 'section-1');
    await methods.addUserToTeachersClass.call({ userId: 'student-user' }, 'teacher-1', 'section-1');

    expect(sectionUserMap.rows).to.have.length(1);
    expect(sentEmails).to.have.length(1);
    expect(sentEmails[0].to).to.equal('student@example.test');
    expect(sentEmails[0].subject).to.contain('Course One');
    expect(sentEmails[0].text).to.contain('https://mofacts.example.test/courses');
    expect(sentEmails[0].text).to.contain('choose Courses from the Learn menu');
    expect(users.rows.find((user) => user._id === 'student-user')?.loginParams).to.deep.equal({});
  });

  it('shows public courses as joinable but unavailable until section membership exists', async function() {
    const sectionUserMap = createMemoryCollection();
    const courseSnapshotCache = createMemoryCollection();
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection([
        { _id: 'course-public', courseName: 'Public Course', teacherUserId: 'teacher-1', semester: 'current', visibility: 'public', timezone: 'America/Chicago' },
      ]),
      Sections: createMemoryCollection([
        { _id: 'section-a', courseId: 'course-public', sectionName: 'A' },
        { _id: 'section-b', courseId: 'course-public', sectionName: 'B' },
      ]),
      SectionUserMap: sectionUserMap,
      Assignments: createMemoryCollection([
        { _id: 'assignment-1', courseId: 'course-public', assignmentType: 'lesson', TDFId: 'tdf-1', order: 0, required: true },
      ]),
      Tdfs: createMemoryCollection([
        { _id: 'tdf-1', ownerId: 'teacher-1', stimuliSetId: 'stim-1', content: { fileName: 'lesson.json', tdfs: { tutor: { setspec: { lessonname: 'Lesson One' } } } } },
      ]),
      usersCollection: createMemoryCollection([
        { _id: 'teacher-1', username: 'Teacher One', emails: [{ address: 'teacher@example.test' }] },
        { _id: 'student-user', username: 'Student One', emails: [{ address: 'student@example.test' }], loginParams: {} },
      ]),
      CourseLearnerSnapshotCache: courseSnapshotCache,
      UserDashboardCache: createMemoryCollection([{ userId: 'student-user', tdfStats: {} }]),
      getMethodAuthorizationDeps: () => ({
        async userIsInRoleAsync() {
          return false;
        },
      }),
    }));

    const beforeJoin = await methods.getLearnerCoursesSnapshot.call({ userId: 'student-user' });
    expect(beforeJoin.assignedCourses).to.deep.equal([]);
    expect(beforeJoin.publicCourses).to.have.length(1);
    const publicCourse = beforeJoin.publicCourses[0];
    if (!publicCourse) throw new Error('Expected public course before join');
    expect(publicCourse.membership).to.equal('public');
    expect(publicCourse.joinableSections).to.deep.equal([
      { sectionId: 'section-a', sectionName: 'A' },
      { sectionId: 'section-b', sectionName: 'B' },
    ]);
    expect(publicCourse.assignments[0]?.availability).to.equal('unavailable');

    await methods.addUserToTeachersClass.call({ userId: 'student-user' }, 'teacher-1', 'section-a');
    const afterJoin = await methods.getLearnerCoursesSnapshot.call({ userId: 'student-user' });
    expect(afterJoin.publicCourses).to.deep.equal([]);
    expect(afterJoin.assignedCourses).to.have.length(1);
    const assignedCourse = afterJoin.assignedCourses[0];
    if (!assignedCourse) throw new Error('Expected assigned course after join');
    expect(assignedCourse.membership).to.equal('assigned');
    expect(assignedCourse.joinableSections).to.deep.equal([]);
    expect(assignedCourse.assignments[0]?.availability).to.equal('available');
  });

  it('lets a teacher see and launch their private course from the learner course snapshot', async function() {
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection([
        { _id: 'course-private', courseName: 'Private Course', teacherUserId: 'teacher-user', semester: 'current', visibility: 'private', timezone: 'America/Chicago' },
      ]),
      Sections: createMemoryCollection([
        { _id: 'section-private', courseId: 'course-private', sectionName: '001' },
      ]),
      SectionUserMap: createMemoryCollection(),
      Assignments: createMemoryCollection([
        { _id: 'assignment-1', courseId: 'course-private', assignmentType: 'lesson', TDFId: 'tdf-1', order: 0, required: true },
      ]),
      Tdfs: createMemoryCollection([
        { _id: 'tdf-1', ownerId: 'teacher-user', stimuliSetId: 'stim-1', content: { fileName: 'lesson.json', tdfs: { tutor: { setspec: { lessonname: 'Lesson One' } } } } },
      ]),
      usersCollection: createMemoryCollection([
        { _id: 'teacher-user', username: 'Teacher One', emails: [{ address: 'teacher@example.test' }] },
      ]),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection([{ userId: 'teacher-user', tdfStats: {} }]),
      getMethodAuthorizationDeps: () => ({
        async userIsInRoleAsync(userId: string, roles: string[]) {
          return userId === 'teacher-user' && roles.includes('teacher');
        },
      }),
    }));

    const snapshot = await methods.getLearnerCoursesSnapshot.call({ userId: 'teacher-user' });
    expect(snapshot.publicCourses).to.deep.equal([]);
    expect(snapshot.assignedCourses).to.have.length(1);
    const teacherCourse = snapshot.assignedCourses[0];
    if (!teacherCourse) throw new Error('Expected teacher course');
    expect(teacherCourse.membership).to.equal('teacher');
    expect(teacherCourse.assignments[0]?.availability).to.equal('available');
  });

  it('saves and launches the current ordered progressive prefix without creating aggregate progress', async function() {
    const progressiveMember = (id: string, stimuliSetId: string) => ({
      _id: id,
      ownerId: 'teacher-user',
      stimuliSetId,
      content: {
        fileName: `${id}.json`,
        tdfs: {
          tutor: {
            setspec: { lessonname: id },
            unit: [
              { unitname: 'Instructions', unitinstructions: '<p>Read</p>' },
              { unitname: `${id} practice`, learningsession: { clusterlist: '0', maxTrials: 0 } },
            ],
          },
        },
      },
      rawStimuliFile: {
        setspec: {
          clusters: [{
            clusterKC: `${id}-cluster`,
            stims: [{ stimulusKC: `${id}-stim`, response: { correctResponse: id } }],
          }],
        },
      },
      stimuli: [{
        stimuliSetId,
        clusterKC: `${id}-cluster`,
        stimulusKC: `${id}-stim`,
        correctResponse: id,
      }],
    });
    const assignments = createMemoryCollection();
    const methods = createCourseMethods(createDeps({
      Courses: createMemoryCollection([{
        _id: 'course-progressive',
        courseName: 'Progressive Course',
        teacherUserId: 'teacher-user',
        semester: 'current',
        visibility: 'private',
        timezone: 'America/Chicago',
      }]),
      Sections: createMemoryCollection(),
      SectionUserMap: createMemoryCollection(),
      Assignments: assignments,
      Tdfs: createMemoryCollection([
        progressiveMember('lesson-1', 'set-1'),
        progressiveMember('lesson-2', 'set-2'),
        progressiveMember('lesson-3', 'set-3'),
      ]),
      CourseLearnerSnapshotCache: createMemoryCollection(),
      UserDashboardCache: createMemoryCollection([{ userId: 'teacher-user', tdfStats: {} }]),
      usersCollection: createMemoryCollection([{ _id: 'teacher-user', username: 'Teacher' }]),
    }));

    const saved = await methods.saveCourseAssignments.call({ userId: 'teacher-user' }, {
      courseId: 'course-progressive',
      assignments: [{
        assignmentType: 'progressive',
        title: 'Cumulative sequence',
        memberTdfIds: ['lesson-1', 'lesson-2', 'lesson-3'],
        order: 0,
        releaseAt: null,
        dueAt: null,
        required: true,
      }],
    });
    const progressive = saved.assignments[0];
    expect(progressive).to.include({ assignmentType: 'progressive', title: 'Cumulative sequence' });
    expect((progressive as any).memberTdfIds).to.deep.equal(['lesson-1', 'lesson-2', 'lesson-3']);
    expect((progressive as any).progress).to.equal(undefined);

    const launch = await methods.getProgressiveAssignmentLaunch.call(
      { userId: 'teacher-user' },
      String(progressive?.assignmentId),
      'lesson-2',
    );
    expect(launch.memberTdfIds).to.deep.equal(['lesson-1', 'lesson-2']);
    expect(launch.tdfs.map((tdf: any) => tdf._id)).to.deep.equal(['lesson-1', 'lesson-2']);
    expect(launch.tdfs.map((tdf: any) => tdf.stimuli[0].stimuliSetId)).to.deep.equal(['set-1', 'set-2']);
    // An insertion before the endpoint affects new launches only.
    await methods.saveCourseAssignments.call({ userId: 'teacher-user' }, {
      courseId: 'course-progressive',
      assignments: [{ assignmentId: progressive!.assignmentId, assignmentType: 'progressive',
        title: 'Cumulative sequence', memberTdfIds: ['lesson-1', 'lesson-3', 'lesson-2'], order: 0, required: true }],
    });
    const resumed = await methods.getProgressiveAssignmentLaunch.call(
      { userId: 'teacher-user' }, progressive!.assignmentId, 'lesson-2', launch.progressiveRevisionId,
    );
    expect(resumed.tdfs.map((tdf: any) => tdf._id)).to.deep.equal(['lesson-1', 'lesson-2']);
    const fresh = await methods.getProgressiveAssignmentLaunch.call(
      { userId: 'teacher-user' }, progressive!.assignmentId, 'lesson-2',
    );
    expect(fresh.memberTdfIds).to.deep.equal(['lesson-1', 'lesson-3', 'lesson-2']);
    expect(fresh.progressiveRevisionId).not.to.equal(launch.progressiveRevisionId);
  });
});

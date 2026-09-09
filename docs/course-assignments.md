# Course Assignments And Learner Courses Menu

## Goal

Add first-class course visibility, scheduled assignment metadata, and a learner-facing Courses page without changing the core MoFaCTS lesson ontology:

- A course has many assignments.
- An assignment is either a scheduled pointer to one reusable TDF/lesson or an ordered progressive group of reusable TDFs.
- A TDF remains singular and reusable; assignments do not copy lesson content.
- Learner progress remains keyed by each source `TDFId`; progressive groups do not introduce aggregate completion or progress state.
- Course browsing must not request full TDF documents when field-limited course, assignment, TDF-summary, and cached progress data are sufficient.
- Course browsing must use a persisted course snapshot/cache. Bounded live queries are not sufficient for v1.

The v1 user-facing result is:

- Class Management can mark a course `private` or `public`.
- Course Assignments replaces the current dual-select Chapter Assignments workflow with an ordered assignment metadata editor.
- Learners get an authenticated `/courses` route and a **Courses** item in the Practice/Home navigation.
- The Courses page shows each lesson with its own Practice-page progress metrics. Progressive members after the first also expose a prefix launch that combines the first member through the selected member.

## Current Code Surfaces

Implementation should stay inside the active MoFaCTS app tree under `mofacts/`.

- Course methods live in `mofacts/server/methods/courseMethods.ts`.
- Practice snapshot methods live in `mofacts/server/methods/dashboardPracticeSnapshotMethods.ts`.
- Dashboard progress projection helpers live in `mofacts/server/methods/dashboardCacheShared.ts`.
- Dashboard progress contracts live in `mofacts/server/methods/dashboardCacheMethods.contracts.ts`.
- Collections are declared in `mofacts/common/Collections.ts`; `Assignments` maps to Mongo collection `assessments`.
- Current Class Management UI lives in `mofacts/client/views/experimentSetup/classEdit.*`.
- Current Chapter Assignments UI lives in `mofacts/client/views/experimentSetup/tdfAssignmentEdit.*`.
- Home/sidebar/practice menu navigation lives in `mofacts/client/views/home/home.*`.
- Practice dashboard UI and local snapshot handling live in `mofacts/client/views/home/learningDashboard.*`.
- Routes are registered in `mofacts/client/lib/router.ts`; route access policies live in `mofacts/client/lib/routeAccessPolicies.ts`.

## Non-Negotiable Invariants

- Do not introduce TDF copying, per-course TDF instances, or assignment-owned lesson content.
- Do not silently default invalid input. Missing legacy fields may be normalized explicitly at read time, but malformed new payloads must fail clearly.
- Do not publish broad full course, assignment, TDF, or history collections for the Courses page.
- Do not request full TDF runtime content for course browsing.
- Preserve existing teacher/admin access checks for course management.
- Preserve existing practice launch behavior and runtime route guards.
- Public course browsing must not create section membership or enrollment records.
- Existing assignment rows containing only `courseId` and `TDFId` must remain readable during migration.
- Course assignment context must be recorded into learner history when a learner launches from a course assignment.
- Assignment `_id` is the durable assignment identity for history, reporting, due-date exceptions, cache entries, and client payloads.
- New course section membership must send the learner an assignment email with the MoFaCTS link, a direct `/courses` link, and instructions to find the assigned course from the Courses menu.

## Data Model

### Course Fields

Extend `Courses` documents with:

```ts
type CourseVisibility = 'private' | 'public';

interface CourseDocument {
  _id: string;
  courseName: string;
  teacherUserId: string;
  beginDate: Date | null;
  endDate: Date | null;
  timezone: string;
  visibility?: CourseVisibility;
}
```

Rules:

- New courses default to `private`.
- Existing courses with missing `visibility` read as `private` until migrated.
- Only literal `private` and `public` are valid persisted values.
- Server validation must reject any other value with a Meteor error.
- Course list APIs must return `visibility` explicitly after read normalization.
- Do not introduce new semester-based browse logic for this feature.
- Course availability is controlled by `beginDate`, `endDate`, and `timezone`.
- `beginDate: null` means the course is visible immediately once other access rules pass.
- `endDate: null` means the course has no scheduled end.
- If both dates are present, `endDate` must be greater than or equal to `beginDate`.
- `timezone` is required for new courses. Existing courses receive an explicit timezone value during migration, and the migration report must list the value applied.
- Teachers can edit visibility, begin date, end date, and timezone for their own courses.
- Admins can edit those fields for any course.
- Public courses are discoverable by every signed-in user, including teachers and admins, but ordinary learners must join a section before launching course assignments from the Courses page.

### Assignment Fields

Extend `Assignments` documents in Mongo collection `assessments` with:

```ts
interface LessonCourseAssignmentDocument {
  _id: string;
  courseId: string;
  assignmentType: 'lesson';
  TDFId: string;
  order: number;
  releaseAt?: Date | null;
  dueAt?: Date | null;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProgressiveCourseAssignmentDocument {
  _id: string;
  courseId: string;
  assignmentType: 'progressive';
  title: string;
  memberTdfIds: string[];
  order: number;
  releaseAt?: Date | null;
  dueAt?: Date | null;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Rules:

- `courseId` must reference an existing course.
- A lesson assignment's `TDFId`, and every progressive `memberTdfIds` entry, must reference an existing TDF that the acting teacher/admin can assign.
- `order` is zero-based, contiguous, and unique within a course after save.
- `required` defaults to `true` for legacy rows.
- `releaseAt` and `dueAt` are optional. Missing, `undefined`, and explicit clear actions normalize to `null`.
- `releaseAt` controls ordinary learner visibility and launch availability.
- `dueAt` controls deadline/status display and reporting; it does not block launch.
- Legacy rows missing `order`, `required`, `createdAt`, or `updatedAt` are read with deterministic normalized values. Save operations should write the full normalized shape.
- Assignment `_id` is first-class identity in contracts and UI payloads.
- A TDF may occur only once across all lesson assignments and progressive groups in one course.
- Learner progress summaries can still aggregate by `TDFId`, but history records must include assignment context when launched from a course assignment.
- Progressive groups require at least two ordered members. Teachers may insert, remove, or reorder members at any time; the next launch uses the saved order.
- Progressive members must contain exactly two units: Unit 1 instructions and Unit 2 a named learning session. Unit 2 must have a valid cluster list, canonical cluster/stimulus identity, and no positive `maxTrials` or `practiceseconds` limit.
- Progressive practice is intentionally unbounded and has no group completion state. Removing a member does not remove its learner history.

### Assignment Titles

Lesson assignment rows display the live TDF lesson name from field-limited TDF summary metadata. Progressive groups have a teacher-authored group title; member rows still display their live TDF lesson names.

Rules:

- Lesson assignment save payloads must not include a title field. Progressive assignment payloads require one.
- Assignment snapshots expose `title`, computed from the current TDF lesson name.
- Renaming the TDF updates assignment display title after the relevant course snapshot cache is invalidated or rebuilt.
- Progressive titles label the group and never mutate member TDF titles.

### Dates And Timezones

Date handling is course-timezone based:

- Client date inputs use native `datetime-local`.
- Client submits local date/time strings with the course `timezone`.
- Server interprets assignment `releaseAt` and `dueAt` in the course timezone and stores UTC `Date` values.
- Server stores valid dates as UTC `Date` values.
- Server rejects invalid dates, arrays, objects, and unparseable strings.
- Client displays course assignment dates in the course timezone, with the timezone label available in UI.
- Course `beginDate` and `endDate` use the same timezone interpretation.
- Use a real timezone identifier such as `America/Chicago`, not a raw numeric offset.

Course visibility window:

- A course is date-visible when `(beginDate === null || now >= beginDate)` and `(endDate === null || now <= endDate)`.
- Date-visible public courses appear in the public courses section for every signed-in user.
- Date-visible private courses appear only in assigned/managed contexts.
- Courses outside the date-visible window do not appear to ordinary learners.
- Teachers/admins may see outside-window courses in management surfaces, but `/courses` should mark them unavailable if shown for preview/admin contexts.

### Course Learner Snapshot Cache

Add a dedicated persisted cache collection for learner course browsing. Common collection name: `CourseLearnerSnapshotCache`. Mongo collection name: `course_learner_snapshot_cache`.

```ts
interface CourseLearnerSnapshotCacheDocument {
  _id: string;
  userId: string;
  version: 3;
  generatedAt: Date;
  invalidatedAt: Date | null;
  assignedCourseIds: string[];
  publicCourseIds: string[];
  assignmentIds: string[];
  tdfIds: string[];
  snapshot: LearnerCoursesSnapshot;
  rebuildReason: 'missing' | 'invalidated' | 'version' | 'progress-updated' | 'manual';
}
```

Rules:

- There is at most one current cache document per user and cache version.
- Cache documents must be registered in `mofacts/common/collectionOwnership.ts`, declared in `mofacts/common/Collections.ts`, and included in `serverComposition` dependencies before methods use them.
- Cache documents store summary payloads only; they must not store full TDF documents, full unit arrays, stimuli, raw stimuli, or secrets.
- Cache rebuilds must be bounded by the scale limits in this document.
- Cache rebuilds may use live course/assignment/TDF-summary queries, then persist the final summary snapshot.
- Course assignment metadata changes invalidate relevant learner cache documents.
- Public course changes invalidate cache documents whose `publicCourseIds` include the changed course id.
- Assigned/private course changes invalidate cache documents whose `assignedCourseIds` include the changed course id, plus enrolled learners who do not yet have a cache document.
- Practice progress updates invalidate or refresh only the active learner's course snapshot cache.
- Cache invalidation should set `invalidatedAt` rather than deleting documents silently.

### History Context

When a learner launches from a course assignment, history records for that runtime must include course assignment context:

```ts
interface CourseAssignmentHistoryContext {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  launchSource: 'courses';
  launchMode: 'individual' | 'progressive';
  progressiveEndpointTdfId?: string;
  progressiveRevisionId?: string;
  progressiveReverseOrder?: boolean;
}
```

Rules:

- `assignmentId` is required when launch source is `/courses`.
- `courseId` and `TDFId` are included for query convenience and historical readability.
- Runtime code validates that the assignment is released, belongs to the course, still contains the launched/source TDF, and—on a progressive launch—still contains the endpoint.
- Public course launch context must be recorded even when the learner is not enrolled.
- Existing non-course Practice launches continue without assignment context.
- Progressive trial rows use the original member `TDFId`, original `stimuliSetId`, original item and cluster identities, and the original Unit 2 name. This lets an individual member launch replay trials previously completed in the progressive runtime.
- An individual course launch reads all history for its TDF plus same-course rows from other TDFs with matching `clusterKC`. A progressive launch reads all history whose source `TDFId` is in its authorized ordering revision's prefix. Identical cluster names outside that prefix are excluded, while exact source-TDF history remains reusable across contexts.
- Reporting should prefer `assignmentId` for assignment-specific reporting and may use `courseId`/`TDFId` for legacy compatibility.

## Indexes

Add or verify indexes in the existing performance-index migration path:

```ts
Courses.rawCollection().createIndex(
  { visibility: 1, beginDate: 1, endDate: 1, teacherUserId: 1 },
  { name: 'course_visibility_dates_teacher', background: true }
);

Assignments.rawCollection().createIndex(
  { courseId: 1, order: 1 },
  { name: 'assignment_course_order', background: true }
);

Assignments.rawCollection().createIndex(
  { courseId: 1, TDFId: 1 },
  {
    name: 'assignment_course_tdf_unique',
    unique: true,
    background: true,
    partialFilterExpression: { assignmentType: 'lesson' }
  }
);

Assignments.rawCollection().createIndex(
  { courseId: 1, memberTdfIds: 1 },
  {
    name: 'assignment_course_progressive_members',
    background: true,
    partialFilterExpression: { assignmentType: 'progressive' }
  }
);

Assignments.rawCollection().createIndex(
  { courseId: 1, releaseAt: 1 },
  { name: 'assignment_course_release', background: true }
);

Assignments.rawCollection().createIndex(
  { _id: 1, courseId: 1, TDFId: 1 },
  { name: 'assignment_identity_course_tdf', background: true }
);

Sections.rawCollection().createIndex(
  { courseId: 1 },
  { name: 'section_courseId', background: true }
);

SectionUserMap.rawCollection().createIndex(
  { userId: 1, sectionId: 1 },
  { name: 'section_user_lookup', background: true }
);

CourseLearnerSnapshotCache.rawCollection().createIndex(
  { userId: 1, version: 3 },
  { name: 'course_snapshot_user_version', unique: true, background: true }
);

CourseLearnerSnapshotCache.rawCollection().createIndex(
  { userId: 1, version: 3, invalidatedAt: 1 },
  { name: 'course_snapshot_user_version_invalidated', background: true }
);

CourseLearnerSnapshotCache.rawCollection().createIndex(
  { assignedCourseIds: 1, version: 3 },
  { name: 'course_snapshot_assigned_course_version', background: true }
);

CourseLearnerSnapshotCache.rawCollection().createIndex(
  { publicCourseIds: 1, version: 3 },
  { name: 'course_snapshot_public_course_version', background: true }
);

CourseLearnerSnapshotCache.rawCollection().createIndex(
  { assignmentIds: 1, version: 3 },
  { name: 'course_snapshot_assignment_version', background: true }
);

Histories.rawCollection().createIndex(
  { userId: 1, 'courseAssignment.assignmentId': 1, recordedServerTime: -1 },
  { name: 'history_user_assignment_time', background: true }
);
```

Before adding a unique index, migration must detect duplicate `(courseId, TDFId)` rows and fail with a report rather than deleting data silently.

## Shared Contracts

Create shared contracts in `mofacts/common/courseAssignments.contracts.ts`.

```ts
export type CourseVisibility = 'private' | 'public';

export interface LessonCourseAssignmentInput {
  assignmentType: 'lesson';
  assignmentId?: string;
  TDFId: string;
  order: number;
  releaseAt?: string | Date | null;
  dueAt?: string | Date | null;
  required: boolean;
}

export interface ProgressiveCourseAssignmentInput {
  assignmentType: 'progressive';
  assignmentId?: string;
  title: string;
  memberTdfIds: string[];
  order: number;
  releaseAt?: string | Date | null;
  dueAt?: string | Date | null;
  required: boolean;
}

export type CourseAssignmentInput =
  | LessonCourseAssignmentInput
  | ProgressiveCourseAssignmentInput;

export interface SaveCourseAssignmentsInput {
  courseId: string;
  assignments: CourseAssignmentInput[];
}

export interface CourseAssignmentSummary {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  title: string;
  order: number;
  releaseAt: Date | null;
  dueAt: Date | null;
  required: boolean;
  availability: 'available' | 'scheduled' | 'unavailable';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface LearnerCourseSnapshotCourse {
  courseId: string;
  courseName: string;
  visibility: CourseVisibility;
  beginDate: Date | null;
  endDate: Date | null;
  timezone: string;
  teacherUserId: string;
  teacherDisplayName: string;
  membership: 'assigned' | 'public' | 'teacher' | 'admin';
  assignments: LearnerCourseSnapshotAssignment[];
}

export interface LearnerCourseSnapshotAssignment extends CourseAssignmentSummary {
  assignmentId: string;
  fileName: string;
  tags: string[];
  currentStimuliSetId: string | number | null;
  progress: PracticeDashboardProgressStats;
  isUsed: boolean;
  hasBeenAttempted: boolean;
}

export interface LearnerCoursesSnapshot {
  version: 3;
  userId: string;
  generatedAt: number;
  assignedCourses: LearnerCourseSnapshotCourse[];
  publicCourses: LearnerCourseSnapshotCourse[];
  invalidatedAt: Date | null;
  source: 'cache' | 'rebuilt';
}
```

Do not duplicate these payload shapes independently in client and server modules.

## Server APIs

### Course Snapshot Cache Helpers

Implement cache helpers in `mofacts/server/lib/courseLearnerSnapshotCache.ts`.

Required helper behavior:

- `ensureLearnerCoursesSnapshot(userId)` returns the current cache when version matches and `invalidatedAt` is null.
- If no cache exists, version differs, or `invalidatedAt` is set, it rebuilds and upserts the cache.
- `invalidateCourseSnapshotsForCourse(courseId, reason)` invalidates learners enrolled in the course and any cached public-course snapshots affected by a public course.
- `invalidateCourseSnapshotForUser(userId, reason)` invalidates one learner cache after practice progress changes.
- `invalidateCourseSnapshotsForAssignment(assignmentId, reason)` invalidates cache documents whose `assignmentIds` include the changed assignment id.
- `refreshCourseSnapshotAfterPractice(userId, TDFId)` invalidates or rebuilds the active learner's course snapshot after dashboard practice stats update for that TDF.
- Cache writes must be idempotent and safe to call repeatedly.
- Cache invalidation must log counts for broad invalidations.

The cache rebuild path must reuse shared query/projection helpers so `/courses` and future course-management surfaces do not fork their own TDF summary logic.

Invalidation trigger points:

- `addCourse` and `editCourse` invalidate affected course snapshots when visibility, begin date, end date, timezone, teacher, or name changes.
- `saveCourseAssignments` invalidates affected course snapshots when assignment rows are inserted, removed, reordered, released, due-dated, required/optional changed, or pointed at a different TDF.
- Section membership changes invalidate the affected user's course snapshot and the affected course snapshot cohort.
- New section membership sends the learner a course assignment email. Repeated calls for an existing membership must not resend the email.
- Practice history insertion and the dashboard cache update hook invalidate or refresh the current learner's course snapshot after `UserDashboardCache.tdfStats` changes.
- Admin progress reset invalidates the affected learner course snapshots for any reset TDFs.
- Migration jobs that normalize course visibility, course timezone, or assignment metadata invalidate all affected course snapshot caches after writes.

### `getCourseAssignmentEditorSnapshot(courseId)`

Purpose: load the Course Assignments editor for one course without publishing full TDFs.

Authorization:

- Requires authentication.
- Requires admin or teacher role.
- Teacher must own the course.
- Admin may load any course.

Returns:

```ts
interface CourseAssignmentEditorSnapshot {
  course: {
    courseId: string;
    courseName: string;
    visibility: CourseVisibility;
    teacherUserId: string;
  };
  assignments: CourseAssignmentSummary[];
  assignableTdfs: Array<{
    TDFId: string;
    fileName: string;
    displayName: string;
    tags: string[];
    ownerId: string;
    progressiveEligible: boolean;
    progressiveIneligibilityReasons: string[];
  }>;
}
```

Query requirements:

- Course query fields: `_id`, `courseName`, `visibility`, `teacherUserId`, `beginDate`, `endDate`, `timezone`.
- Assignment query fields include the discriminant plus either `TDFId` or `title` and ordered `memberTdfIds`, along with schedule and audit metadata.
- The server inspects projected tutor units, delivery settings, identity availability, `stimuliSetId`, and raw cluster structure to calculate progressive eligibility.
- The client receives only summary metadata and eligibility reasons. It does not receive tutor units, stimuli, raw clusters, or runtime secret fields in this editor response.

### `saveCourseAssignments(input)`

Replaces `editCourseAssignments({ courseId, tdfs })` for new UI code.

Authorization:

- Requires authentication.
- Requires admin or teacher role.
- Teacher must own the course.
- Admin may save any course.

Validation:

- `courseId` must normalize to an existing course id.
- `assignments` must be an array with a bounded length. Proposed v1 bound: 250 assignments per course.
- Each row must have a valid `TDFId`.
- Duplicate `TDFId`s in one save payload are rejected.
- `order` values are recomputed server-side from array order; client-supplied order may be validated but must not be trusted as authoritative.
- `releaseAt` and `dueAt` must parse to valid dates in the course timezone or `null`.
- If both dates are present, reject `dueAt < releaseAt`.
- Unknown fields are rejected to catch UI contract drift.

Write behavior:

- Fetch existing assignment rows for `courseId`.
- Upsert rows by existing `assignmentId` when present and owned by the same course.
- For v1 duplicate-forbidden behavior, match existing rows by `TDFId` when no `assignmentId` exists.
- Remove rows omitted from the save payload.
- Set `createdAt` only on inserted rows.
- Set `updatedAt` on every inserted or modified row.
- Keep `Assignments` and `SectionUserMap` authoritative; do not copy assigned TDF ids into learner `loginParams`.
- Invalidate course learner snapshot caches for enrolled learners and relevant public-course cache cohorts after any assignment metadata, course date, course timezone, course visibility, or assignment membership change.
- Metadata-only changes do not require dashboard practice cache rebuilds. History-derived progress changes are handled through the practice history/dashboard-cache path.

### `getLearnerCoursesSnapshot()`

Purpose: render `/courses` from a persisted learner course snapshot cache, rebuilding the cache when missing or invalidated. This mirrors the Practice page goal of avoiding repeated broad reads, but uses a dedicated course snapshot cache because course availability and assignment metadata are first-class course-management data.

Authorization:

- Requires authentication.
- Ordinary learners receive assigned private courses where enrolled plus visible public courses.
- Teachers receive public courses plus their own assigned/managed courses.
- Admins receive public courses plus admin-visible assigned/managed courses through bounded UI filters.
- Every signed-in user can discover public courses, including learners, teachers, admins, and users who also participate in experiment flows.

Cache rebuild query strategy:

1. Resolve caller role flags once.
2. Fetch enrolled section ids for user with fields `{ sectionId: 1 }`.
3. Fetch enrolled course ids from `Sections` with fields `{ _id: 1, courseId: 1 }`.
4. Build bounded course selector:
   - public courses whose `beginDate`/`endDate` window makes them visible,
   - enrolled private courses whose `beginDate`/`endDate` window makes them visible,
   - teacher-owned visible courses for teachers,
   - admin-selected scope for admins.
5. Fetch courses with fields `{ _id, courseName, visibility, teacherUserId, beginDate, endDate, timezone }`.
6. Fetch assignment rows for those course ids with field-limited assignment projection.
7. Include unreleased assignments, but mark them `scheduled` and locked for ordinary learners.
8. Fetch only referenced TDF summary fields.
9. Fetch `UserDashboardCache.findOneAsync({ userId })`.
10. Build assignment progress with `buildDashboardStatsProjection(cache?.tdfStats?.[TDFId], null)`.
11. Store the resulting snapshot in `CourseLearnerSnapshotCache`.

Snapshot response:

- `version: 3`
- `userId`
- `generatedAt`
- `assignedCourses`, sorted above public courses when non-empty.
- `publicCourses`, always present for signed-in users.
- Hide the assigned-courses section in the UI when `assignedCourses.length === 0`.
- Assignment rows sorted by `order`, then title.

Unreleased behavior:

- Ordinary learners see unreleased assignments as locked rows.
- Locked rows show the release date/time in the course timezone.
- Locked rows cannot launch.
- Teachers and admins may see unreleased assignments in `/courses`.

Caching behavior:

- Create a dedicated persisted course learner snapshot cache.
- Reuse `UserDashboardCache.tdfStats` for learner progress.
- Client local storage is allowed only as a display warm-start; the persisted server cache is authoritative.
- Course assignment metadata changes invalidate relevant course snapshot caches.
- Practice history changes that update `UserDashboardCache.tdfStats` must also invalidate or refresh the current learner's course snapshot cache so `/courses` reflects progress after restart.
- Course snapshot cache rebuilds reuse the existing dashboard stats projection helpers instead of recomputing history.
- Dashboard practice cache rebuild/update remains tied to practice history changes; course snapshot invalidation does not imply full practice-history recomputation.

### Assignment Launch Context

Add a launch path contract so `/courses` can launch the same TDF runtime while preserving assignment context.

Required behavior:

- The Courses page calls the existing lesson launch runner with `TDFId` plus `{ assignmentId, courseId, launchSource: 'courses' }`.
- The launch runner stores the context in the same client/session state path that runtime history insertion can read.
- Runtime startup validates that `assignmentId` belongs to `courseId` and `TDFId`.
- History insert methods persist the context under the `courseAssignment` field.
- If the assignment context is invalid, the launch fails clearly before history rows are written.
- Non-course launches continue to write no `courseAssignment` field.

Required history shape:

```ts
courseAssignment: {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  launchSource: 'courses';
}
```

## Scalability Targets

Design and test the v1 implementation against these approximate upper bounds:

- Hundreds of total courses in the system.
- Up to 250 assignments in one course.
- Up to 500 enrolled learners in one course.
- Up to 5 assigned/enrolled courses per learner.
- Public courses visible to all signed-in users, with launch access gated by course section membership for ordinary learners.

Performance rules:

- `/courses` must be one primary method call from the client after authentication.
- The method must read or rebuild a persisted learner course snapshot cache.
- Course snapshot rebuilds must use field-limited course, assignment, TDF-summary, and dashboard-cache queries.
- No rebuild may scan all TDFs or all histories.
- Broad public-course invalidations must be explicit and logged.
- Course snapshot rebuilds should be concurrency-limited if batch refresh jobs are added.

## Existing Method Changes

### `addCourse`

- Normalize and validate `visibility`.
- If missing, set `visibility: 'private'`.
- Validate `beginDate`, `endDate`, and `timezone`.
- Require `timezone` for new courses.
- Reject invalid visibility values.
- Preserve existing teacher/admin ownership behavior.
- Insert only recognized course fields; avoid persisting arbitrary UI fields from the client payload.

### `editCourse`

- Normalize and validate `visibility`.
- If editing a legacy course whose payload omits `visibility`, keep existing persisted visibility; if none exists, write `private`.
- Validate `beginDate`, `endDate`, and `timezone`.
- Preserve existing course timezone when the edit payload omits timezone for a legacy caller.
- Reject invalid visibility values.
- Preserve existing teacher/admin ownership behavior.
- Update only recognized course fields.

### `getAllCourseSections`

- Include `visibility`, `beginDate`, `endDate`, and `timezone` in the projected course fields so Class Management can render existing values without an extra method call.
- Keep the method field-limited.

### Legacy `editCourseAssignments`

- Keep temporarily only for confirmed old callers, but new UI must call `saveCourseAssignments`.
- If retained, implement it as a thin compatibility wrapper around `saveCourseAssignments` that converts the old file-name array into assignment rows.
- Assignment writers accept TDF IDs directly and fail clearly when an ID is missing or inaccessible; filenames are presentation metadata only.
- Do not maintain two independent assignment-save paths.

## Course Management UI

Update Class Management:

- Add a compact visibility control next to class name.
- Add begin date, end date, and course timezone controls.
- Use a segmented control or select with exactly two options: `Private` and `Public`.
- Default new classes to `Private`.
- Default new class timezone from the teacher's browser timezone when available, then require the teacher to save an explicit timezone.
- When selecting an existing class, hydrate the control from normalized course visibility.
- Show concise helper text: private courses are visible to enrolled students; public courses are browsable by signed-in learners.
- Save payload must include `visibility`, `beginDate`, `endDate`, and `timezone`.
- On save error, show inline/page-level error using existing admin UI patterns. Avoid adding modal popup flows.

Because current `classEdit.ts` uses jQuery and Session state, keep the initial implementation consistent with that surface.

## Course Assignments Editor UI

Rename the navigation label from **Chapter Assignments** to **Course Assignments**.

Replace the dual multi-select workflow with a single course-scoped assignment editor:

- Course selector at top.
- Loading state while `getCourseAssignmentEditorSnapshot(courseId)` runs.
- Left/add area: searchable assignable lesson list using TDF display name, file name, and tags.
- Main area: ordered selected assignment rows.
- Save bar with dirty state, save button, and reset/reload action.

Each assignment row includes:

- Drag handle and keyboard reorder buttons.
- Lesson title from TDF summary.
- Required toggle.
- Visible on date control.
- Due on date control.
- Remove button.
- Status text for invalid local row state.

A progressive row additionally includes:

- A group title.
- An ordered list of at least two eligible lessons, with add, remove, move-up, and move-down controls.
- The same group-level required, release, and due controls as an ordinary assignment.
- Inline eligibility enforcement; incompatible TDF structures cannot be added.

Date controls:

- Use native `datetime-local` inputs in a compact popover or inline expandable panel.
- Include explicit clear buttons for optional dates.
- Convert to ISO strings before method call.
- Display empty optional dates as blank, not as "Invalid Date" or current date.

Client-side validation before save:

- Course selected.
- At least zero assignments allowed. Empty list means remove all assignments from the course.
- No duplicate `TDFId`.
- Dates parse before submission.
- Recompute order from rendered row order.

Server-side validation remains authoritative.

## Learner Courses Page UI

Add route:

- Path: `/courses`
- Route name: `client.courses`
- Access: authenticated route, available to every signed-in user.
- Template/module: new `mofacts/client/views/home/courses.*` or equivalent under the home view family.

Navigation:

- Add **Courses** under Learn in the main left sidebar.
- Add **Courses** to the compact practice menu.
- Active-route highlighting should include `/courses`.

Layout:

- Use the Practice dashboard visual language: dense, restrained, scan-friendly, and responsive.
- Desktop: two stacked sections with course cards or course bands; My Courses first, public courses below.
- Mobile: the same two sections with assignment rows stacked inside each course card.
- Avoid decorative marketing-style cards; this is an operational learner surface.

Required v1 structure:

- My Courses section at top for enrolled courses and teacher/admin-owned courses.
- Hide the My Courses section entirely when the learner has no enrolled or owned courses.
- Public courses section below My Courses and visible for every signed-in user.
- Public course rows/cards expose a Join action. If multiple sections are available, the learner chooses a section before joining.
- Public course assignment Start/Continue actions remain unavailable until the learner joins a section.
- Private courses only appear for enrolled learners, the course owner, or admins. Teacher-owned private courses appear in My Courses and remain launchable for the teacher.
- Top toolbar: search and sort menu.
- Course row/card: course name, instructor, visibility/membership badge, assignment count, last practiced summary.
- Assignment row/card: title, due/release labels, required/optional badge, progress metrics, action button.

Assignment row fields:

- Assignment title.
- Course name.
- Instructor display name.
- Required/optional status.
- Visible date when relevant.
- Due date and due status: no due date, due soon, due today, overdue, completed/attempted if a completion concept is later defined.
- Trials/attempts.
- Accuracy, with "not applicable" handling from Practice projection.
- Items practiced, with "not applicable" handling from Practice projection.
- Session days.
- Time.
- Last practice.
- Start/Continue action.
- For each progressive member, its own metrics and ordinary individual launch action.
- For progressive member 2 and later, a second action that practices the ordered prefix through that member. Member 1 has no redundant progressive action.
- Each progressive group offers **Newest lesson first** (off by default). It reverses lesson assembly within the authorized prefix, preserving item order within each lesson, shared-cluster merging, original item ownership, and endpoint model/settings. The choice is retained in the launch URL/context across reloads; it does not change assignment membership or history scope. Adaptive selection still determines which item is practiced next.

Launch behavior:

- Use the same launch runner/path as the Practice page for the assignment's `TDFId`.
- Pass `assignmentId` and `courseId` into launch context when launching from `/courses`.
- Runtime history insertion must persist that assignment context.
- If launch is blocked because `releaseAt` is in the future, show inline disabled state before launch.
- A progressive launch fetches the currently authorized prefix in one server operation, then composes it on the client. It uses the endpoint lesson's Unit 1 instructions and Unit 2 learning model/settings while merging all prefix stimuli by normalized `clusterKC` and preserving distinct item identities.
- The composed runtime has no positive trial or practice-time limit and does not create a shared progressive experiment/completion state.

## Instructor Reporting

Reporting due-date precedence:

1. User due-date exception for matching `assignmentId`, if present.
2. Assignment `dueAt`.
3. Legacy TDF `setspec.duedate`.
4. No due date.

Compatibility:

- Existing due-date exceptions matching `{ classId/courseId, TDFId }` must continue to work.
- New due-date exceptions must store `assignmentId`.
- Existing exceptions continue to read old `{ classId/courseId, TDFId }` shapes.
- Assignment `dueAt` is authoritative over TDF `setspec.duedate` for course reporting.

New due-date exception shape:

```ts
interface AssignmentDueDateException {
  assignmentId: string;
  courseId: string;
  TDFId: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

Rules:

- Store new exceptions under the existing user due-date exception mechanism.
- Validate that `assignmentId`, `courseId`, and `TDFId` refer to the same assignment before writing.
- When reading exceptions, check `assignmentId` first, then legacy `{ classId/courseId, TDFId }`.
- Do not write new legacy-only exceptions.

Reporting query requirements:

- Do not fetch full TDFs only to determine due dates.
- Use assignment rows and field-limited TDF summaries.
- Preserve existing instructor ownership checks.

## Migration Plan

1. Add shared contracts and validation helpers.
2. Add read normalization helpers for course visibility and assignment metadata.
3. Add duplicate detection/reporting for existing assignment rows.
4. Add `CourseLearnerSnapshotCache` ownership and collection declarations.
5. Add indexes after duplicate report passes.
6. Add server methods, cache invalidation helpers, and tests.
7. Update Class Management to persist visibility, dates, and timezone.
8. Replace assignment editor with `saveCourseAssignments`.
9. Add learner course snapshot cache method and `/courses` UI.
10. Add course assignment launch context to runtime history insertion.
11. Update reporting due-date precedence.
12. Remove or narrow legacy assignment save path after all callers move to the new method.

Legacy normalization:

- Course with missing `visibility` reads as `private`.
- Course with missing timezone receives explicit migration value before it becomes editable through the new UI.
- Assignment with missing `order` sorts by existing insertion order when available, then title, then `_id`.
- Assignment with missing `required` reads as `true`.
- Assignment with missing dates reads as `null`.
- Assignment with missing timestamps reads as `null` in snapshots and gets real timestamps on next save.

No migration may silently delete assignments or infer public visibility.

## Test Plan

Server tests:

- Course visibility defaults to private on add.
- Missing legacy visibility reads as private.
- Invalid visibility is rejected on add/edit.
- Non-owner teacher cannot edit course visibility.
- Admin can edit course visibility.
- Assignment save rejects unauthenticated users.
- Assignment save rejects non-teachers/non-admins.
- Teacher cannot save assignments for another teacher's course.
- Assignment save rejects duplicate `TDFId`s in one course.
- Assignment save normalizes required flags, dates, order, and timestamps.
- Assignment save removes omitted rows and preserves included metadata.
- Legacy assignment rows remain readable with normalized defaults.
- Learner course snapshot returns public courses to signed-in ordinary learners.
- Private courses appear only for enrolled learners, owning teachers, and admins.
- Public course browsing does not insert `SectionUserMap` rows.
- New section membership sends a course assignment email with the app link, `/courses` link, and course-finding instructions.
- Existing section membership does not resend the course assignment email.
- Unreleased assignments appear as locked rows for ordinary learners and cannot launch.
- Snapshot uses `UserDashboardCache.tdfStats` and `buildDashboardStatsProjection`.
- Snapshot reads from `CourseLearnerSnapshotCache` when current.
- Snapshot rebuilds and upserts `CourseLearnerSnapshotCache` when missing, invalidated, or version-mismatched.
- Course assignment metadata changes invalidate relevant course snapshot caches.
- Practice progress updates invalidate or refresh only the active learner's course snapshot cache.
- Snapshot does not query full TDF unit/stimuli fields.
- Course launch history records include `courseAssignment.assignmentId`, `courseId`, `TDFId`, and `launchSource`.
- Reporting due-date precedence prefers assignment-id exceptions, then assignment `dueAt`, then TDF `setspec.duedate`.

Client/unit tests:

- Date input parse/clear produces ISO string or `null`.
- Course timezone controls store and display real timezone identifiers.
- Assignment row ordering is recomputed from UI order.
- Assignment title display uses the live TDF lesson name.
- Courses page progress formatting matches Practice dashboard helpers.
- Courses page shows My Courses as the top section only when enrolled or owned courses are present.
- Courses page shows public courses below My Courses for every signed-in user, with Join required before ordinary learners can launch course assignments.
- Sidebar and compact menu route mappings include `/courses`.

Verification commands:

```bash
cd mofacts
npm run typecheck
npm run lint
```

UI verification:

- Use the canonical localhost hotfix server from `deploy/`.
- Use the MoFaCTS Playwright sidecar against `http://host.docker.internal:3200`.
- Verify Class Management visibility save/hydrate.
- Verify Course Assignments add/reorder/date/save/reload.
- Verify `/courses` desktop and mobile layouts.
- Verify public course browsing does not enroll the learner.
- Verify unreleased assignment rows are visible but locked.
- Verify assignment launch reaches the same runtime path as Practice.
- Verify assignment launch writes course assignment context to history.

## Answered Decisions

- Course browsing uses course `beginDate`, `endDate`, and `timezone`; it does not introduce new semester-based browse behavior.
- `/courses` shows assigned courses in a top section when present and public courses underneath for every signed-in user.
- Public course browsing does not enroll the learner.
- Launching from `/courses` records assignment context in history.
- Assignment `_id` is the durable assignment identity for history, reporting, due-date exceptions, cache entries, and client payloads.
- A TDF may appear only once across a course's ordinary and progressive assignments.
- Unreleased assignments are visible as locked rows.
- Teachers and admins can see unreleased assignments in `/courses`.
- Course timezone owns course dates and assignment dates.
- New due-date exceptions attach to `assignmentId`; old `{ classId/courseId, TDFId }` exceptions remain readable.
- Course and assignment metadata changes invalidate learner course snapshot caches.
- A dedicated persisted course snapshot cache is required.
- Scale targets are hundreds of courses, up to 250 assignments per course, up to 500 enrolled learners per course, and up to 5 assigned courses per learner.
- `Chapter Assignments` is renamed to `Course Assignments`.
- All teachers can edit course visibility immediately for courses they own.
- Public courses are discoverable by signed-in learners, teachers, and admins; learners join a section before launching course assignments.
- Ordinary assignment title overrides remain deferred; progressive groups have their own label.
- Progressive practice has no aggregate completion state. Per-member history and metrics remain authoritative even when teachers later insert, remove, or reorder members.
- A new progressive launch uses the current saved order. The server records the ordering in `Assignments.progressiveRevisions`, keyed by its SHA-256 digest, when first launched. Identical orderings reuse the same entry; assignment edits preserve existing entries. The required `progressiveRevisionId` travels through the lesson URL, runtime context, and trial context. Reads, writes, crowd statistics, and reloads resolve the original prefix from that server-owned revision. Inserting or reordering lessons affects subsequent launches only. Removing a member revokes writes for that source and excludes it from subsequent course-context reads; removing the endpoint revokes the session. Reloading a session whose prefix includes a removed member requires a new launch. Existing history is retained. Deleting the assignment deletes its revisions and revokes its launches.
- Existing trial records do not require migration: their original lesson and unit identities remain unchanged. An open progressive URL/context without a revision must be relaunched from Courses after this update; the server never infers an old ordering from the current assignment.
- Due-date exceptions use only `assignmentId`, `courseId`, `TDFId`, `date`, `createdAt`, and `updatedAt`. Reads and removals match assignment identity; `checkForUserException(userId, assignmentId)` accepts an assignment ID. Older assignment-less and lowercase identity formats are unsupported. No exception migration is required for the production database checked on September 4, 2026 (zero exception records).

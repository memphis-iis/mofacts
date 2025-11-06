/**
 * MoFaCTS Performance Optimization - Database Indexes
 *
 * Phase 1 Migration: Add critical indexes to improve query performance
 *
 * This migration adds 15 indexes to optimize the most frequently-used queries:
 * - Teacher dashboard queries (histories, performance aggregations)
 * - Course/assignment lookups
 * - Experiment state queries
 * - TDF lookups
 * - User lookups
 *
 * Expected Impact:
 * - 10-100x speedup on teacher dashboard queries
 * - Eliminates N+1 query problems
 * - Reduces slow query warnings in MongoDB logs
 *
 * Security Impact: NONE
 * - Indexes only affect query performance, not data access
 * - No changes to authentication, authorization, or security logic
 *
 * Rollback: See rollback_performance_indexes.js
 *
 * Date: 2025-01-06
 */

// @ts-nocheck

import { Meteor } from 'meteor/meteor';

const serverConsole = (...args) => {
  const disp = [(new Date()).toString()];
  for (let i = 0; i < args.length; ++i) {
    disp.push(args[i]);
  }
  console.log.apply(this, disp);
};

/**
 * Create all performance indexes
 */
export async function createPerformanceIndexes() {
  serverConsole('========================================');
  serverConsole('Starting Performance Index Migration');
  serverConsole('========================================');

  try {
    // ===== HISTORIES COLLECTION =====
    // These indexes optimize teacher dashboard and student performance queries
    serverConsole('Creating indexes for Histories collection...');

    // Index 1: User + TDF + Type + Time (most common query pattern)
    await Histories.rawCollection().createIndex(
      { userId: 1, TDFId: 1, levelUnitType: 1, recordedServerTime: -1 },
      { name: 'perf_userId_TDFId_type_time', background: true }
    );
    serverConsole('  ✓ Created: userId_TDFId_type_time');

    // Index 2: TDF + Type + Time (for class-wide queries)
    await Histories.rawCollection().createIndex(
      { TDFId: 1, levelUnitType: 1, recordedServerTime: -1 },
      { name: 'perf_TDFId_type_time', background: true }
    );
    serverConsole('  ✓ Created: TDFId_type_time');

    // Index 3: User + Time (for recent activity queries)
    await Histories.rawCollection().createIndex(
      { userId: 1, recordedServerTime: -1 },
      { name: 'perf_userId_time', background: true }
    );
    serverConsole('  ✓ Created: userId_time');

    // ===== COURSE/ASSIGNMENT COLLECTIONS =====
    // These indexes optimize teacher dashboard course queries
    serverConsole('Creating indexes for Course/Assignment collections...');

    // Index 4: Assignments by course and TDF
    await Assignments.rawCollection().createIndex(
      { courseId: 1, TDFId: 1 },
      { name: 'perf_course_tdf', background: true }
    );
    serverConsole('  ✓ Created: Assignments.course_tdf');

    // Index 5: Section user mappings
    await SectionUserMap.rawCollection().createIndex(
      { sectionId: 1, userId: 1 },
      { name: 'perf_section_user', background: true }
    );
    serverConsole('  ✓ Created: SectionUserMap.section_user');

    // Index 6: Sections by course
    await Sections.rawCollection().createIndex(
      { courseId: 1 },
      { name: 'perf_courseId', background: true }
    );
    serverConsole('  ✓ Created: Sections.courseId');

    // Index 7: Courses by teacher and semester
    await Courses.rawCollection().createIndex(
      { teacherUserId: 1, semester: 1 },
      { name: 'perf_teacher_semester', background: true }
    );
    serverConsole('  ✓ Created: Courses.teacher_semester');

    // ===== EXPERIMENT STATE COLLECTIONS =====
    // These indexes optimize student progress and state queries
    serverConsole('Creating indexes for Experiment State collections...');

    // Index 8: Global experiment states by user and TDF
    await GlobalExperimentStates.rawCollection().createIndex(
      { userId: 1, TDFId: 1 },
      { name: 'perf_user_tdf', background: true }
    );
    serverConsole('  ✓ Created: GlobalExperimentStates.user_tdf');

    // Index 9: Component states by user and TDF
    await ComponentStates.rawCollection().createIndex(
      { userId: 1, TDFId: 1 },
      { name: 'perf_user_tdf', background: true }
    );
    serverConsole('  ✓ Created: ComponentStates.user_tdf');

    // ===== TDF COLLECTION =====
    // These indexes optimize TDF lookups by various fields
    serverConsole('Creating indexes for TDFs collection...');

    // Index 10: TDF by fileName (very common lookup)
    await Tdfs.rawCollection().createIndex(
      { 'content.fileName': 1 },
      { name: 'perf_fileName', background: true }
    );
    serverConsole('  ✓ Created: Tdfs.fileName');

    // Index 11: TDF by experimentTarget
    await Tdfs.rawCollection().createIndex(
      { 'content.tdfs.tutor.setspec.experimentTarget': 1 },
      { name: 'perf_experimentTarget', background: true }
    );
    serverConsole('  ✓ Created: Tdfs.experimentTarget');

    // Index 12: TDF by stimuliSetId
    await Tdfs.rawCollection().createIndex(
      { stimuliSetId: 1 },
      { name: 'perf_stimuliSetId', background: true }
    );
    serverConsole('  ✓ Created: Tdfs.stimuliSetId');

    // Index 13: TDF by ownerId
    await Tdfs.rawCollection().createIndex(
      { ownerId: 1 },
      { name: 'perf_ownerId', background: true }
    );
    serverConsole('  ✓ Created: Tdfs.ownerId');

    // Index 14: TDF by accessors (for shared TDFs)
    await Tdfs.rawCollection().createIndex(
      { accessors: 1 },
      { name: 'perf_accessors', background: true }
    );
    serverConsole('  ✓ Created: Tdfs.accessors');

    // ===== USERS COLLECTION =====
    // This index optimizes user lookups by username
    serverConsole('Creating indexes for Users collection...');

    // Index 15: Users by username (very common lookup)
    await Meteor.users.rawCollection().createIndex(
      { username: 1 },
      { name: 'perf_username', background: true }
    );
    serverConsole('  ✓ Created: Users.username');

    serverConsole('========================================');
    serverConsole('✅ All 15 performance indexes created successfully!');
    serverConsole('========================================');
    serverConsole('');
    serverConsole('Next steps:');
    serverConsole('1. Verify indexes with: db.collection.getIndexes()');
    serverConsole('2. Check query plans with: query.explain("executionStats")');
    serverConsole('3. Monitor slow query log for improvements');
    serverConsole('');

    return { success: true, indexesCreated: 15 };

  } catch (error) {
    serverConsole('========================================');
    serverConsole('❌ ERROR creating performance indexes:', error);
    serverConsole('========================================');
    throw error;
  }
}

/**
 * List all indexes created by this migration
 * Useful for verification and documentation
 */
export function listPerformanceIndexes() {
  return [
    { collection: 'Histories', name: 'perf_userId_TDFId_type_time', keys: { userId: 1, TDFId: 1, levelUnitType: 1, recordedServerTime: -1 } },
    { collection: 'Histories', name: 'perf_TDFId_type_time', keys: { TDFId: 1, levelUnitType: 1, recordedServerTime: -1 } },
    { collection: 'Histories', name: 'perf_userId_time', keys: { userId: 1, recordedServerTime: -1 } },
    { collection: 'Assignments', name: 'perf_course_tdf', keys: { courseId: 1, TDFId: 1 } },
    { collection: 'SectionUserMap', name: 'perf_section_user', keys: { sectionId: 1, userId: 1 } },
    { collection: 'Sections', name: 'perf_courseId', keys: { courseId: 1 } },
    { collection: 'Courses', name: 'perf_teacher_semester', keys: { teacherUserId: 1, semester: 1 } },
    { collection: 'GlobalExperimentStates', name: 'perf_user_tdf', keys: { userId: 1, TDFId: 1 } },
    { collection: 'ComponentStates', name: 'perf_user_tdf', keys: { userId: 1, TDFId: 1 } },
    { collection: 'Tdfs', name: 'perf_fileName', keys: { 'content.fileName': 1 } },
    { collection: 'Tdfs', name: 'perf_experimentTarget', keys: { 'content.tdfs.tutor.setspec.experimentTarget': 1 } },
    { collection: 'Tdfs', name: 'perf_stimuliSetId', keys: { stimuliSetId: 1 } },
    { collection: 'Tdfs', name: 'perf_ownerId', keys: { ownerId: 1 } },
    { collection: 'Tdfs', name: 'perf_accessors', keys: { accessors: 1 } },
    { collection: 'Users', name: 'perf_username', keys: { username: 1 } }
  ];
}

// Run migration on server startup if needed
// Uncomment the next line to run automatically:
// Meteor.startup(() => createPerformanceIndexes());

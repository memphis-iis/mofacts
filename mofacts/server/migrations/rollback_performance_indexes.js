/**
 * MoFaCTS Performance Optimization - Rollback Indexes
 *
 * This script removes all indexes created by add_performance_indexes.js
 *
 * Use this if:
 * - Indexes are causing issues
 * - Need to rebuild indexes with different options
 * - Testing performance with and without indexes
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
 * Remove all performance indexes
 */
export async function rollbackPerformanceIndexes() {
  serverConsole('========================================');
  serverConsole('Rolling Back Performance Indexes');
  serverConsole('========================================');

  let droppedCount = 0;
  const errors = [];

  try {
    // Helper to safely drop index
    const dropIndex = async (collection, collectionName, indexName) => {
      try {
        await collection.rawCollection().dropIndex(indexName);
        serverConsole(`  ✓ Dropped: ${collectionName}.${indexName}`);
        droppedCount++;
      } catch (error) {
        if (error.code === 27 || error.message.includes('index not found')) {
          serverConsole(`  ⊘ Skipped: ${collectionName}.${indexName} (not found)`);
        } else {
          serverConsole(`  ✗ Error dropping ${collectionName}.${indexName}:`, error.message);
          errors.push({ collection: collectionName, index: indexName, error: error.message });
        }
      }
    };

    // Drop Histories indexes
    serverConsole('Dropping Histories indexes...');
    await dropIndex(Histories, 'Histories', 'perf_userId_TDFId_type_time');
    await dropIndex(Histories, 'Histories', 'perf_TDFId_type_time');
    await dropIndex(Histories, 'Histories', 'perf_userId_time');

    // Drop Course/Assignment indexes
    serverConsole('Dropping Course/Assignment indexes...');
    await dropIndex(Assignments, 'Assignments', 'perf_course_tdf');
    await dropIndex(SectionUserMap, 'SectionUserMap', 'perf_section_user');
    await dropIndex(Sections, 'Sections', 'perf_courseId');
    await dropIndex(Courses, 'Courses', 'perf_teacher_semester');

    // Drop Experiment State indexes
    serverConsole('Dropping Experiment State indexes...');
    await dropIndex(GlobalExperimentStates, 'GlobalExperimentStates', 'perf_user_tdf');
    await dropIndex(ComponentStates, 'ComponentStates', 'perf_user_tdf');

    // Drop TDF indexes
    serverConsole('Dropping TDF indexes...');
    await dropIndex(Tdfs, 'Tdfs', 'perf_fileName');
    await dropIndex(Tdfs, 'Tdfs', 'perf_experimentTarget');
    await dropIndex(Tdfs, 'Tdfs', 'perf_stimuliSetId');
    await dropIndex(Tdfs, 'Tdfs', 'perf_ownerId');
    await dropIndex(Tdfs, 'Tdfs', 'perf_accessors');

    // Drop Users indexes
    serverConsole('Dropping Users indexes...');
    await dropIndex(Meteor.users, 'Users', 'perf_username');

    serverConsole('========================================');
    if (errors.length === 0) {
      serverConsole(`✅ Successfully dropped ${droppedCount} indexes!`);
    } else {
      serverConsole(`⚠️  Dropped ${droppedCount} indexes with ${errors.length} errors`);
      serverConsole('Errors:', errors);
    }
    serverConsole('========================================');

    return { success: errors.length === 0, indexesDropped: droppedCount, errors };

  } catch (error) {
    serverConsole('========================================');
    serverConsole('❌ CRITICAL ERROR during rollback:', error);
    serverConsole('========================================');
    throw error;
  }
}

// Uncomment to run on server startup:
// Meteor.startup(() => rollbackPerformanceIndexes());

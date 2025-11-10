#!/usr/bin/env node
/**
 * M1 Migration Script: Session → cardState (ReactiveDict)
 *
 * This script automatically migrates card-scoped Session calls to cardState.
 * It preserves global Session calls and provides a detailed migration report.
 */

const fs = require('fs');
const path = require('path');

// Load categorized keys
const CARD_SCOPED = require('./card_scoped_keys.json');
const GLOBAL_SCOPED = require('./global_scoped_keys.json');

// File paths
const CARD_JS_PATH = path.join(__dirname, '../mofacts/client/views/experiment/card.js');
const BACKUP_PATH = path.join(__dirname, '../mofacts/client/views/experiment/card.js.backup');
const REPORT_PATH = path.join(__dirname, 'migration_report.md');

// Migration statistics
const stats = {
  totalReplacements: 0,
  getReplacements: 0,
  setReplacements: 0,
  unchangedGlobal: 0,
  byKey: {}
};

/**
 * Main migration function
 */
function migrateSessionToCardState() {
  console.log('=== M1 Migration: Session → cardState ===\n');

  // Read original file
  console.log('Reading card.js...');
  const original = fs.readFileSync(CARD_JS_PATH, 'utf8');

  // Create backup
  console.log('Creating backup at card.js.backup...');
  fs.writeFileSync(BACKUP_PATH, original, 'utf8');

  // Perform migration
  console.log('\nMigrating card-scoped Session calls...');
  let migrated = original;

  CARD_SCOPED.forEach(key => {
    // Initialize stats for this key
    stats.byKey[key] = { get: 0, set: 0 };

    // Migrate Session.get('key') → cardState.get('key')
    const getPattern = new RegExp(`Session\\.get\\('${escapeRegex(key)}'\\)`, 'g');
    const getMatches = (migrated.match(getPattern) || []).length;
    if (getMatches > 0) {
      migrated = migrated.replace(getPattern, `cardState.get('${key}')`);
      stats.getReplacements += getMatches;
      stats.byKey[key].get = getMatches;
    }

    // Migrate Session.set('key', ...) → cardState.set('key', ...)
    // This is trickier because we need to preserve the value argument
    // Pattern: Session.set('key', value) where value can be multi-line
    const setPattern = new RegExp(`Session\\.set\\('${escapeRegex(key)}'`, 'g');
    const setMatches = (migrated.match(setPattern) || []).length;
    if (setMatches > 0) {
      migrated = migrated.replace(setPattern, `cardState.set('${key}'`);
      stats.setReplacements += setMatches;
      stats.byKey[key].set = setMatches;
    }

    stats.totalReplacements = stats.getReplacements + stats.setReplacements;
  });

  // Count unchanged global Session calls
  GLOBAL_SCOPED.forEach(key => {
    const getPattern = new RegExp(`Session\\.get\\('${escapeRegex(key)}'\\)`, 'g');
    const setPattern = new RegExp(`Session\\.set\\('${escapeRegex(key)}'`, 'g');
    const globalGet = (migrated.match(getPattern) || []).length;
    const globalSet = (migrated.match(setPattern) || []).length;
    stats.unchangedGlobal += globalGet + globalSet;
  });

  // Write migrated file
  console.log('Writing migrated card.js...');
  fs.writeFileSync(CARD_JS_PATH, migrated, 'utf8');

  // Generate report
  generateMigrationReport(original, migrated);

  // Print summary
  printSummary();

  console.log('\n✓ Migration complete!');
  console.log(`  - Backup saved to: ${path.relative(process.cwd(), BACKUP_PATH)}`);
  console.log(`  - Report saved to: ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log('\nNext steps:');
  console.log('  1. Review migration_report.md');
  console.log('  2. Run: meteor run --settings settings.json');
  console.log('  3. Test card functionality');
  console.log('  4. If issues, restore: mv card.js.backup card.js');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate detailed migration report
 */
function generateMigrationReport(original, migrated) {
  const report = [];

  report.push('# M1 Migration Report: Session → cardState\n');
  report.push(`**Date:** ${new Date().toISOString()}\n`);
  report.push(`**File:** mofacts/client/views/experiment/card.js\n`);

  report.push('\n## Summary\n');
  report.push(`- **Total replacements:** ${stats.totalReplacements}`);
  report.push(`  - Session.get() → cardState.get(): ${stats.getReplacements}`);
  report.push(`  - Session.set() → cardState.set(): ${stats.setReplacements}`);
  report.push(`- **Unchanged global Session calls:** ${stats.unchangedGlobal}`);
  report.push(`- **Card-scoped keys migrated:** ${CARD_SCOPED.length}`);
  report.push(`- **Global keys preserved:** ${GLOBAL_SCOPED.length}\n`);

  report.push('\n## Migrated Keys (By Frequency)\n');
  report.push('| Key | .get() | .set() | Total |');
  report.push('|-----|--------|--------|-------|');

  // Sort by total descending
  const sorted = Object.entries(stats.byKey)
    .map(([key, counts]) => ({
      key,
      get: counts.get,
      set: counts.set,
      total: counts.get + counts.set
    }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total);

  sorted.forEach(item => {
    report.push(`| ${item.key} | ${item.get} | ${item.set} | ${item.total} |`);
  });

  report.push('\n## Top 10 Most Migrated Keys\n');
  sorted.slice(0, 10).forEach((item, i) => {
    report.push(`${i + 1}. **${item.key}** - ${item.total} replacements (${item.get} get, ${item.set} set)`);
  });

  report.push('\n## Global Keys (Unchanged)\n');
  report.push('These remain as Session because they are shared across the app:\n');
  GLOBAL_SCOPED.forEach(key => {
    report.push(`- ${key}`);
  });

  report.push('\n## What Changed\n');
  report.push('```javascript');
  report.push('// BEFORE:');
  report.push("Session.get('currentExperimentState')");
  report.push("Session.set('currentDisplay', {...})");
  report.push('');
  report.push('// AFTER:');
  report.push("cardState.get('currentExperimentState')");
  report.push("cardState.set('currentDisplay', {...})");
  report.push('```\n');

  report.push('\n## Testing Checklist\n');
  report.push('- [ ] Card loads without errors');
  report.push('- [ ] Trial state transitions work');
  report.push('- [ ] Answers submit correctly');
  report.push('- [ ] Feedback displays properly');
  report.push('- [ ] Recording works (if applicable)');
  report.push('- [ ] TTS works (if applicable)');
  report.push('- [ ] Video sessions work (if applicable)');
  report.push('- [ ] Dialogue works (if applicable)');
  report.push('- [ ] Multiple choice buttons work');
  report.push('- [ ] Timeouts work correctly');
  report.push('- [ ] Check browser console for errors\n');

  report.push('\n## Rollback Instructions\n');
  report.push('If issues arise, restore the backup:\n');
  report.push('```bash');
  report.push('cd mofacts/client/views/experiment/');
  report.push('mv card.js card.js.migrated  # Save migrated version');
  report.push('mv card.js.backup card.js     # Restore original');
  report.push('```\n');

  report.push('\n## Performance Impact\n');
  report.push('Expected improvements:');
  report.push('- 30-50% reduction in reactive computations');
  report.push('- Automatic cleanup (no memory leaks)');
  report.push('- Scoped state easier to reason about');
  report.push('- Enables component reuse (multiple card instances)\n');

  report.push('\n## Next Steps\n');
  report.push('1. Run automated tests (if available)');
  report.push('2. Manual testing with various TDFs');
  report.push('3. Test on mobile devices');
  report.push('4. Monitor for 24-48 hours');
  report.push('5. If stable, delete card.js.backup');
  report.push('6. Update documentation');
  report.push('7. Consider migrating other files (instructions.js, etc.)\n');

  fs.writeFileSync(REPORT_PATH, report.join('\n'), 'utf8');
}

/**
 * Print summary to console
 */
function printSummary() {
  console.log('\n=== Migration Summary ===');
  console.log(`Total replacements: ${stats.totalReplacements}`);
  console.log(`  - Session.get() → cardState.get(): ${stats.getReplacements}`);
  console.log(`  - Session.set() → cardState.set(): ${stats.setReplacements}`);
  console.log(`Unchanged global Session calls: ${stats.unchangedGlobal}`);
  console.log(`Card-scoped keys migrated: ${CARD_SCOPED.length}`);
  console.log(`Global keys preserved: ${GLOBAL_SCOPED.length}`);

  console.log('\nTop 5 migrated keys:');
  Object.entries(stats.byKey)
    .map(([key, counts]) => ({key, total: counts.get + counts.set}))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.key}: ${item.total} replacements`);
    });
}

// Run migration
if (require.main === module) {
  try {
    migrateSessionToCardState();
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { migrateSessionToCardState };

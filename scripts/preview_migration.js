#!/usr/bin/env node
/**
 * Preview M1 Migration: Shows what will change without modifying files
 */

const fs = require('fs');
const path = require('path');

// Load categorized keys
const CARD_SCOPED = require('./card_scoped_keys.json');

// File paths
const CARD_JS_PATH = path.join(__dirname, '../mofacts/client/views/experiment/card.js');

function previewMigration() {
  console.log('=== M1 Migration Preview ===\n');

  const content = fs.readFileSync(CARD_JS_PATH, 'utf8');
  const lines = content.split('\n');

  const changes = [];
  let totalChanges = 0;

  // Find all lines that will change
  lines.forEach((line, lineNum) => {
    let changed = false;
    let newLine = line;

    CARD_SCOPED.forEach(key => {
      const getPattern = new RegExp(`Session\\.get\\('${escapeRegex(key)}'\\)`, 'g');
      const setPattern = new RegExp(`Session\\.set\\('${escapeRegex(key)}'`, 'g');

      if (getPattern.test(line) || setPattern.test(line)) {
        changed = true;
        newLine = newLine
          .replace(getPattern, `cardState.get('${key}')`)
          .replace(setPattern, `cardState.set('${key}'`);
      }
    });

    if (changed) {
      changes.push({
        lineNum: lineNum + 1,
        before: line.trim(),
        after: newLine.trim(),
        key: extractKey(line)
      });
      totalChanges++;
    }
  });

  // Show preview
  console.log(`Found ${totalChanges} lines to change\n`);
  console.log('First 20 examples:\n');

  changes.slice(0, 20).forEach((change, i) => {
    console.log(`${i + 1}. Line ${change.lineNum} (${change.key}):`);
    console.log(`   BEFORE: ${change.before.substring(0, 100)}${change.before.length > 100 ? '...' : ''}`);
    console.log(`   AFTER:  ${change.after.substring(0, 100)}${change.after.length > 100 ? '...' : ''}`);
    console.log('');
  });

  if (changes.length > 20) {
    console.log(`... and ${changes.length - 20} more changes\n`);
  }

  // Summary by key
  console.log('\nChanges by key (top 10):');
  const keyStats = {};
  changes.forEach(change => {
    keyStats[change.key] = (keyStats[change.key] || 0) + 1;
  });

  Object.entries(keyStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([key, count]) => {
      console.log(`  ${key}: ${count} lines`);
    });

  console.log('\n=== Preview Complete ===');
  console.log('\nTo proceed with migration, run:');
  console.log('  node scripts/migrate_session_to_cardstate.js\n');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKey(line) {
  const match = line.match(/Session\.[gs]et\('([^']+)'/);
  return match ? match[1] : 'unknown';
}

if (require.main === module) {
  previewMigration();
}

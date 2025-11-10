#!/usr/bin/env node
/**
 * HOTFIX: Revert currentExperimentState back to Session
 * Reason: It's shared between card.js and unitEngine.js, so must be global
 */

const fs = require('fs');
const path = require('path');

const CARD_JS_PATH = path.join(__dirname, '../mofacts/client/views/experiment/card.js');

function revertCurrentExperimentState() {
  console.log('=== Reverting currentExperimentState to Session ===\n');

  let content = fs.readFileSync(CARD_JS_PATH, 'utf8');

  // Count before
  const beforeGet = (content.match(/cardState\.get\('currentExperimentState'\)/g) || []).length;
  const beforeSet = (content.match(/cardState\.set\('currentExperimentState'/g) || []).length;

  console.log(`Before: ${beforeGet} cardState.get(), ${beforeSet} cardState.set()`);

  // Revert get calls
  content = content.replace(/cardState\.get\('currentExperimentState'\)/g, "Session.get('currentExperimentState')");

  // Revert set calls
  content = content.replace(/cardState\.set\('currentExperimentState'/g, "Session.set('currentExperimentState'");

  // Count after
  const afterGet = (content.match(/Session\.get\('currentExperimentState'\)/g) || []).length;
  const afterSet = (content.match(/Session\.set\('currentExperimentState'/g) || []).length;

  console.log(`After: ${afterGet} Session.get(), ${afterSet} Session.set()`);

  // Write back
  fs.writeFileSync(CARD_JS_PATH, content, 'utf8');

  console.log('\n✓ Reverted currentExperimentState to global Session');
  console.log('  Reason: Shared between card.js and unitEngine.js');
}

revertCurrentExperimentState();

#!/usr/bin/env node
/**
 * HOTFIX: Revert shared keys back to Session
 * Reason: These keys are shared between card.js and unitEngine.js
 */

const fs = require('fs');
const path = require('path');

const CARD_JS_PATH = path.join(__dirname, '../mofacts/client/views/experiment/card.js');

// Keys that are shared between card.js and unitEngine.js
// Must stay as global Session, not cardState
const SHARED_KEYS = [
  'clozeQuestionParts',
  'clusterIndex',
  'clusterMapping',
  'hiddenItems',
  'hintLevel',
  'instructionQuestionResult',
  'isVideoSession',
  'questionIndex',
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function revertSharedKeys() {
  console.log('=== Reverting Shared Keys to Session ===\n');
  console.log(`Reverting ${SHARED_KEYS.length} keys shared with unitEngine.js:\n`);

  let content = fs.readFileSync(CARD_JS_PATH, 'utf8');
  let totalReverted = 0;

  SHARED_KEYS.forEach(key => {
    const getPattern = new RegExp(`cardState\\.get\\('${escapeRegex(key)}'\\)`, 'g');
    const setPattern = new RegExp(`cardState\\.set\\('${escapeRegex(key)}'`, 'g');

    const getCount = (content.match(getPattern) || []).length;
    const setCount = (content.match(setPattern) || []).length;

    if (getCount > 0 || setCount > 0) {
      content = content.replace(getPattern, `Session.get('${key}')`);
      content = content.replace(setPattern, `Session.set('${key}'`);

      const total = getCount + setCount;
      totalReverted += total;
      console.log(`  ✓ ${key}: ${total} occurrences (${getCount} get, ${setCount} set)`);
    }
  });

  fs.writeFileSync(CARD_JS_PATH, content, 'utf8');

  console.log(`\n✓ Reverted ${totalReverted} occurrences across ${SHARED_KEYS.length} keys`);
  console.log('\nReason: These keys are shared between card.js and unitEngine.js');
  console.log('They must stay as global Session for cross-file communication.');
}

revertSharedKeys();

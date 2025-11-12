const fs = require('fs');
const path = require('path');

// Complete compression mapping for card.js (combining all analyses)
const compressions = [
  // Block 1: The massive 80-line file header
  {
    startLine: 170,
    endLine: 249,
    compressed: "// Main GUI logic for MoFaCTS with TDF/Stim abstraction via currentTestingHelpers.js. Trial timeouts: purestudy (study display), drill (answer time), reviewstudy (incorrect feedback), correctprompt (correct feedback). Admin/teacher simulation via simTimeout/simCorrectProb TDF params. Scrollable history enabled via <showhistory>true</deliveryparams>."
  },
  // Block 2-3: Headers and state management
  {
    startLine: 251,
    endLine: 252,
    compressed: "// Global variables and helper functions for them"
  },
  {
    startLine: 254,
    endLine: 257,
    compressed: "// PHASE 2: Scoped Reactive State - Use ReactiveDict for card-specific state to prevent memory leaks and improve performance"
  },
  {
    startLine: 259,
    endLine: 259,
    compressed: "// M3: Additional scoped ReactiveDict instances for specialized state management"
  },
  {
    startLine: 275,
    endLine: 275,
    compressed: "// M3: Track if waiting for Google Speech API response (converted to reactive state)"
  },
  {
    startLine: 280,
    endLine: 280,
    compressed: "// M3: Audio input mode flag (converted to reactive state)"
  },
  {
    startLine: 282,
    endLine: 283,
    compressed: "// Cache speech recognition answer grammar and phonetic index per unit (invalidate when currentStimuliSet changes)"
  },
  {
    startLine: 297,
    endLine: 303,
    compressed: "// M3: Track timeout state reactively (name/ID for clear/reset, function/delay for reset); Functions cannot be stored in ReactiveDict - timeout vars moved to cardTimeouts.js module (Phase 1)"
  },
  {
    startLine: 308,
    endLine: 316,
    compressed: "// Timeout functions extracted to cardTimeouts.js module (Phase 1): register/clear/reset timeouts, intervals, display helpers; clearCardTimeout aliased to avoid wrapper conflict"
  },
  {
    startLine: 318,
    endLine: 320,
    compressed: "// Wrapper adds simTimeoutName clearing to module clearCardTimeout; temporary until checkSimulation migrates to cardUtils (Phase 3)"
  },
  {
    startLine: 322,
    endLine: 323,
    compressed: "// Import from module is aliased; first clear simTimeoutName if present"
  },
  {
    startLine: 332,
    endLine: 332,
    compressed: "// Then call module function with required parameters"
  },
  {
    startLine: 336,
    endLine: 337,
    compressed: "// Simulation timeout handler (migrates to cardUtils.js in Phase 3)"
  },
  {
    startLine: 353,
    endLine: 353,
    compressed: "// If we are here, set timeout to simulate a correct answer"
  },
  {
    startLine: 363,
    endLine: 363,
    compressed: "// Clean up on navigation away from page"
  },
  {
    startLine: 372,
    endLine: 372,
    compressed: "// Clean up session check interval"
  },
  {
    startLine: 411,
    endLine: 413,
    compressed: "// PHASE 2: Batch DOM updates via Tracker.autorun to prevent unnecessary re-renders"
  },
  {
    startLine: 417,
    endLine: 417,
    compressed: "// Cache SR icon colors from CSS to avoid repeated getComputedStyle calls"
  },
  {
    startLine: 424,
    endLine: 425,
    compressed: "// Compute audio input mode reactively once per change; Tracker.nonreactive prevents cascade invalidation"
  },
  {
    startLine: 427,
    endLine: 427,
    compressed: "// Explicitly track only the dependencies we care about"
  },
  {
    startLine: 431,
    endLine: 431,
    compressed: "// Compute in non-reactive context to prevent cascade"
  },
  {
    startLine: 440,
    endLine: 443,
    compressed: "// Autorun manages feedback visibility (RESTORED after 40-90% perf regression from manual jQuery DOM updates violating Blaze reactivity)"
  },
  {
    startLine: 450,
    endLine: 450,
    compressed: "// Show feedback in correct position"
  },
  {
    startLine: 462,
    endLine: 462,
    compressed: "// Hide all feedback containers when not in feedback"
  },
  {
    startLine: 469,
    endLine: 470,
    compressed: "// M3: Auto-stop recording when leaving PRESENTING_AWAITING state (fail-safe against wrong-state recording)"
  },
  {
    startLine: 475,
    endLine: 475,
    compressed: "// Auto-stop recording when leaving PRESENTING_AWAITING state"
  },
  {
    startLine: 484,
    endLine: 485,
    compressed: "// M3: Auto-restart recording after TTS completes when in PRESENTING_AWAITING state (centralized coordination prevents manual sync errors)"
  },
  {
    startLine: 494,
    endLine: 500,
    compressed: "// Auto-restart recording when: not locked (TTS finished), no TTS requested, in PRESENTING_AWAITING, not already recording, audio enabled, not processing speech"
  },
  {
    startLine: 509,
    endLine: 511,
    compressed: "// M3: Auto-enable inputs in AWAITING/STUDY states, disable elsewhere; auto-focus text input when enabled"
  },
  {
    startLine: 515,
    endLine: 515,
    compressed: "// Enable input when in states that accept input"
  },
  {
    startLine: 525,
    endLine: 525,
    compressed: "// Auto-focus text input when enabled (not for button trials)"
  },
  {
    startLine: 532,
    endLine: 532,
    compressed: "// Ignore - focus may fail if element not in DOM"
  },
  {
    startLine: 543,
    endLine: 544,
    compressed: "// M3/MO5: Apply TDF-configurable styles via CSS custom properties (CSP-compliant alternative to inline styles)"
  },
  {
    startLine: 546,
    endLine: 546,
    compressed: "// Font size from TDF settings (replaces getFontSizeStyle helper)"
  },
  {
    startLine: 555,
    endLine: 555,
    compressed: "// Stimuli box background color from TDF UI settings (replaces stimuliBoxStyle helper)"
  },
  {
    startLine: 568,
    endLine: 569,
    compressed: "// Image button backgrounds from data-image-url attribute (CSP compliance, replaces inline style)"
  },
  {
    startLine: 580,
    endLine: 580,
    compressed: "// Initialize card state defaults"
  },
  {
    startLine: 601,
    endLine: 602,
    compressed: "// Backup 1-second multi-tab detection (primary: BroadcastChannel)"
  },
  {
    startLine: 610,
    endLine: 610,
    compressed: "// Intercept navigation (back button) for cleanup via onpopstate"
  },
  {
    startLine: 623,
    endLine: 626,
    compressed: "// Enable audio input if: user toggled SR on, TDF audioInputEnabled='true', and API key exists (user or TDF)"
  },
  {
    startLine: 633,
    endLine: 633,
    compressed: "// Check for API key availability"
  },
  {
    startLine: 639,
    endLine: 639,
    compressed: "// Don't initialize audio without API key"
  },
  {
    startLine: 642,
    endLine: 642,
    compressed: "// Default to 60 (very sensitive) if TDF doesn't specify audioInputSensitivity"
  },
  {
    startLine: 651,
    endLine: 651,
    compressed: "// Default to 1 if TDF doesn't specify audioInputSilenceDelay"
  },
  {
    startLine: 656,
    endLine: 656,
    compressed: "// Get hidden items list from DB on card load"
  },
  {
    startLine: 663,
    endLine: 663,
    compressed: "// Check if audio recorder pre-initialized during warmup"
  },
  // Continue with the comprehensive final mapping
  ...require('./comment_compression_final.json')
];

// Apply compressions to card.js
function applyCompressions(filePath, compressions) {
  console.log(`Reading ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Sort compressions by startLine (descending) to apply from bottom-up
  const sorted = compressions.sort((a, b) => b.startLine - a.startLine);

  console.log(`Applying ${sorted.length} compressions...`);

  for (const compression of sorted) {
    const { startLine, endLine, compressed } = compression;

    // Validate line numbers
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      console.warn(`⚠ Skipping invalid range: ${startLine}-${endLine}`);
      continue;
    }

    // Extract leading whitespace from first line
    const firstLine = lines[startLine - 1];
    const leadingWhitespace = firstLine.match(/^(\s*)/)[1];

    // Create compressed line with same indentation
    const compressedLine = leadingWhitespace + compressed.replace(/^\/\/\s*/, '// ');

    // Replace lines (startLine-1 to endLine-1 inclusive)
    lines.splice(startLine - 1, endLine - startLine + 1, compressedLine);

    console.log(`  ✓ Lines ${startLine}-${endLine} → 1 line`);
  }

  return lines.join('\n');
}

// card.html compressions
const htmlCompressions = [
  {
    startLine: 4,
    endLine: 7,
    compressed: "<!-- VIDEO SESSION MODE - Instructional video player interface -->"
  },
  {
    startLine: 31,
    endLine: 31,
    compressed: "<!-- back icon -->"
  },
  {
    startLine: 42,
    endLine: 44,
    compressed: "<!-- ADMIN/DEBUG WARNINGS -->"
  },
  {
    startLine: 63,
    endLine: 66,
    compressed: "<!-- ACCESSIBILITY: ARIA Live Region for screen reader announcements -->"
  },
  {
    startLine: 68,
    endLine: 68,
    compressed: "<!-- Updated by JavaScript with trial state messages -->"
  },
  {
    startLine: 71,
    endLine: 74,
    compressed: "<!-- PRACTICE CARD - Main learning interface -->"
  },
  {
    startLine: 193,
    endLine: 193,
    compressed: "<!-- Text input: visibility controlled by CSS based on buttonTrial and SR mode -->"
  },
  {
    startLine: 207,
    endLine: 207,
    compressed: "<!-- Button/Multiple choice: visibility controlled by CSS -->"
  },
  {
    startLine: 218,
    endLine: 218,
    compressed: "<!-- Multiple choice buttons dynamically added -->"
  },
  {
    startLine: 280,
    endLine: 283,
    compressed: "<!-- DEBUG PANELS - Teacher/Admin only displays -->"
  },
  {
    startLine: 316,
    endLine: 321,
    compressed: "<!-- Removed readyPromptString display to prevent 'Loading...' flash -->"
  },
  {
    startLine: 361,
    endLine: 361,
    compressed: "<!-- Fixed footer for timeout display -->"
  },
  {
    startLine: 365,
    endLine: 365,
    compressed: "<!-- timer bar -->"
  },
  {
    startLine: 381,
    endLine: 381,
    compressed: "<!-- back icon -->"
  },
  {
    startLine: 389,
    endLine: 389,
    compressed: "<!-- card lower feedback -->"
  },
  {
    startLine: 409,
    endLine: 410,
    compressed: "// Event delegation for .play-btn clicks (handles static and dynamic buttons efficiently without MutationObserver)"
  }
];

// Main execution
console.log('═══════════════════════════════════════════');
console.log('   Comment Compression Application');
console.log('═══════════════════════════════════════════\n');

const cardJsPath = path.join(process.cwd(), 'mofacts/client/views/experiment/card.js');
const cardHtmlPath = path.join(process.cwd(), 'mofacts/client/views/experiment/card.html');

// Create backups
console.log('Creating backups...');
fs.copyFileSync(cardJsPath, cardJsPath + '.backup');
fs.copyFileSync(cardHtmlPath, cardHtmlPath + '.backup');
console.log('✓ Backups created with .backup extension\n');

// Apply to card.js
console.log('Processing card.js...');
const compressedJs = applyCompressions(cardJsPath, compressions);
fs.writeFileSync(cardJsPath, compressedJs, 'utf8');
console.log('✓ card.js updated\n');

// Apply to card.html
console.log('Processing card.html...');
const compressedHtml = applyCompressions(cardHtmlPath, htmlCompressions);
fs.writeFileSync(cardHtmlPath, compressedHtml, 'utf8');
console.log('✓ card.html updated\n');

console.log('═══════════════════════════════════════════');
console.log('✓ All compressions applied successfully!');
console.log('═══════════════════════════════════════════');
console.log('\nBackup files:');
console.log('  - card.js.backup');
console.log('  - card.html.backup');

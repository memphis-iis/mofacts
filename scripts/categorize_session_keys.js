#!/usr/bin/env node
/**
 * Categorize Session keys as card-scoped vs global
 * Card-scoped: State specific to current trial/card instance
 * Global: State shared across app (user context, current TDF, etc.)
 */

const CARD_SCOPED = [
  // Trial state
  'currentExperimentState',      // Trial FSM state
  'currentDisplay',              // What's showing on card
  'displayReady',                // Card ready to display
  'buttonList',                  // Multiple choice buttons
  'buttonTrial',                 // Is this a button trial
  'buttonEntriesTemp',           // Temp button data

  // Recording state
  'recording',                   // Currently recording
  'recordingLocked',             // Recording locked
  'audioRecorderInitialized',    // Recorder ready
  'sampleRate',                  // Audio sample rate
  'srWarmedUp',                  // Speech recognition warmed up
  'ignoreOutOfGrammarResponses', // SR config

  // Timing & timeouts
  'trialStartTimestamp',         // When trial started
  'trialEndTimeStamp',           // When trial ended
  'cardStartTimestamp',          // When card loaded
  'CurTimeoutId',                // Current timeout ID
  'CurIntervalId',               // Current interval ID
  'varLenTimeoutName',           // Timeout name
  'mainCardTimeoutStart',        // Main timeout start
  'feedbackTimeoutBegins',       // Feedback timeout start
  'feedbackTimeoutEnds',         // Feedback timeout end
  'skipTimeout',                 // Skip timeout flag

  // Answer & feedback state
  'currentAnswer',               // Current answer text
  'userAnswer',                  // User's answer
  'feedbackForAnswer',           // Feedback to show
  'displayFeedback',             // Should display feedback
  'feedbackUnset',               // Feedback not set
  'feedbackTypeFromHistory',     // Feedback type
  'isCorrectAccumulator',        // Accumulator for correctness
  'instructionQuestionResult',   // Instruction Q result

  // TTS state
  'ttsRequested',                // TTS requested
  'ttsWarmedUp',                 // TTS warmed up
  'audioWarmupInProgress',       // Audio warming up

  // Video session state
  'isVideoSession',              // Is this a video session
  'videoSource',                 // Video source URL

  // Dialogue state
  'dialogueHistory',             // Dialogue history
  'dialogueDisplay',             // Dialogue display
  'dialogueLoopStage',           // Dialogue loop stage
  'dialogueTotalTime',           // Total dialogue time
  'dialogueCacheHint',           // Dialogue cache hint
  'showDialogueHints',           // Show hints
  'showDialogueText',            // Show text

  // Cluster/question state
  'clusterIndex',                // Current cluster
  'clusterMapping',              // Cluster mapping
  'questionIndex',               // Current question
  'originalQuestion',            // Original question
  'clozeQuestionParts',          // Cloze parts
  'alternateDisplayIndex',       // Alternate display

  // UI state
  'pausedLocks',                 // Number of paused locks
  'enterKeyLock',                // Enter key locked
  'submmissionLock',             // Submission locked
  'scrollListCount',             // Scroll list count
  'numVisibleCards',             // Number visible
  'hiddenItems',                 // Hidden items

  // Hint/help state
  'hintLevel',                   // Current hint level

  // Scoring
  'currentScore',                // Current score
  'scoringEnabled',              // Is scoring on

  // Trial metadata
  'isTimeout',                   // Did trial timeout
  'isRefutation',                // Is refutation
  'wasReportedForRemoval',       // Was reported

  // Countdown
  'ReviewStudyCountdown',        // Countdown value

  // Debug
  '_debugTrialState',            // Debug state
  'debugParms',                  // Debug params
];

const GLOBAL_SCOPED = [
  // Current TDF/Unit context (shared across card instances)
  'currentTdfFile',              // Entire TDF file
  'currentTdfId',                // TDF ID
  'currentRootTdfId',            // Root TDF ID
  'currentTdfName',              // TDF name
  'currentTdfUnit',              // Current unit
  'currentUnitNumber',           // Unit number
  'currentDeliveryParams',       // Delivery params (shared)
  'curTdfUISettings',            // TDF UI settings
  'curTdfTips',                  // TDF tips

  // User context
  'curSectionId',                // Current section
  'curTeacher',                  // Current teacher
  'studentUsername',             // Student username
  'testType',                    // Test type (d/o/x/etc)

  // Unit/schedule state (persists across cards)
  'engineIndices',               // Engine indices
  'currentUnitStartTime',        // When unit started
  'currentStimuliSet',           // Stimuli set
  'currentStimuliSetId',         // Stimuli set ID
  'currentStimProbFunctionParameters', // Prob function params
  'schedule',                    // Schedule
  'resetSchedule',               // Reset schedule flag
  'furthestUnit',                // Furthest unit reached
  'subTdfIndex',                 // Sub-TDF index
  'unitType',                    // Unit type

  // Session state (persists across cards)
  'fromInstructions',            // Came from instructions
  'curUnitInstructionsSeen',     // Instructions seen
  'inResume',                    // In resume mode
  'sessionCheckInterval',        // Session check interval
  'errorReportStart',            // Error report started

  // History (persists across trials)
  'overallOutcomeHistory',       // Overall outcome
  'overallStudyHistory',         // Overall study

  // Config/settings (global)
  'enableAudioPromptAndFeedback', // Audio enabled
  'audioPromptVoice',            // TTS voice
  'audioPromptSpeakingRate',     // TTS rate
  'audioPromptFeedbackVoice',    // Feedback voice
  'audioPromptFeedbackSpeakingRate', // Feedback rate
  'audioPromptFeedbackVolume',   // Feedback volume
  'audioPromptQuestionVolume',   // Question volume
  'audioPromptQuestionSpeakingRate', // Question rate
  'audioInputSensitivity',       // Input sensitivity
  'speechAPIKey',                // Speech API key
  'useEmbeddedAPIKeys',          // Use embedded keys
  'source',                      // Source

  // Experiment condition
  'experimentXCond',             // Experiment condition

  // Simulation
  'runSimulation',               // Run simulation

  // Display type mapping
  'stimDisplayTypeMap',          // Display type map

  // Feedback settings
  'resetFeedbackSettingsFromIndex', // Reset feedback

  // Submission timestamp (user-level, not trial-level)
  'userAnswerSubmitTimestamp',   // When submitted
];

const UNCERTAIN = [
  // Need to analyze usage context
];

// Generate categorization report
function generateReport() {
  console.log('=== M1 MIGRATION: Session Key Categorization ===\n');

  console.log(`CARD-SCOPED (migrate to cardState): ${CARD_SCOPED.length} keys`);
  console.log('These are specific to current trial/card instance:\n');
  CARD_SCOPED.forEach(key => console.log(`  - ${key}`));

  console.log(`\n\nGLOBAL-SCOPED (keep in Session): ${GLOBAL_SCOPED.length} keys`);
  console.log('These are shared across cards/app:\n');
  GLOBAL_SCOPED.forEach(key => console.log(`  - ${key}`));

  console.log(`\n\nTOTAL: ${CARD_SCOPED.length + GLOBAL_SCOPED.length} categorized`);
  console.log(`UNCERTAIN: ${UNCERTAIN.length} keys need manual review\n`);

  // Export for migration script
  const fs = require('fs');
  const path = require('path');

  const outputDir = path.join(__dirname);
  fs.writeFileSync(path.join(outputDir, 'card_scoped_keys.json'), JSON.stringify(CARD_SCOPED, null, 2));
  fs.writeFileSync(path.join(outputDir, 'global_scoped_keys.json'), JSON.stringify(GLOBAL_SCOPED, null, 2));

  console.log('✓ Exported to scripts/card_scoped_keys.json and scripts/global_scoped_keys.json');
}

if (require.main === module) {
  generateReport();
}

module.exports = { CARD_SCOPED, GLOBAL_SCOPED, UNCERTAIN };

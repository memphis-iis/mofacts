# C1: card.js Split - Implementation Plan

**Date:** 2025-01-10
**Status:** Planning Phase
**Effort:** 125 hours estimated
**Safety:** LOW (2/10) - High risk, requires extreme care

---

## Executive Summary

This document outlines a **phased, incremental approach** to splitting card.js (8,700+ lines) into 8-10 focused modules. The split will improve maintainability, testability, and performance while minimizing risk through careful dependency management and comprehensive testing.

**Key Principle:** No big-bang migrations. Each module extraction must be independently testable and reversible.

---

## Current State (Before Split)

**File:** `mofacts/client/views/experiment/card.js`
**Lines:** 8,700+
**Functions:** 80+
**Template Helpers:** 110+
**Event Handlers:** 18
**Session Keys:** 107
**Module Variables:** 40+

---

## Proposed Module Structure

### 1. **cardTimeouts.js** (~500 lines) - PHASE 1 (START HERE)
**Priority:** 🟢 **LOW RISK** - Pure utility functions
**Why First:** Minimal dependencies, easy to test, immediate value
**Contains:**
- Timeout/interval registry (`activeTimeouts` Map)
- `registerTimeout()`, `registerInterval()`, `clearRegisteredTimeout()`
- `clearAllRegisteredTimeouts()`, `listActiveTimeouts()`
- `elapsedSecs()`, `clearCardTimeout()`
- `beginMainCardTimeout()`, `resetMainCardTimeout()`
- `getDisplayTimeouts()`, `setDispTimeoutText()`
- `varLenDisplayTimeout()`, `getReviewTimeout()`

**Exports:**
```javascript
export {
  registerTimeout,
  registerInterval,
  clearRegisteredTimeout,
  clearAllRegisteredTimeouts,
  listActiveTimeouts,
  elapsedSecs,
  clearCardTimeout,
  beginMainCardTimeout,
  resetMainCardTimeout,
  getDisplayTimeouts,
  setDispTimeoutText,
  varLenDisplayTimeout,
  getReviewTimeout,
  restartMainCardTimeoutIfNecessary
};
```

**Dependencies:** Session, cardState (minimal)
**Estimated Effort:** 8 hours
**Testing Strategy:** Unit tests for each timeout function

---

### 2. **cardStateMachine.js** (~600 lines) - PHASE 2
**Priority:** 🟡 **MEDIUM RISK** - Core state management
**Why Second:** Establishes state contract for other modules
**Contains:**
- `TRIAL_STATES` constants
- `VALID_TRANSITIONS` map
- `trialState` ReactiveDict
- `transitionTrialState()`, `announceTrialStateToScreenReader()`
- `shouldSkipFadeIn()`, `beginFadeIn()`, `completeFadeIn()`
- `getResponseType()`, `getTransitionDuration()`

**Exports:**
```javascript
export {
  TRIAL_STATES,
  trialState,
  transitionTrialState,
  announceTrialStateToScreenReader,
  shouldSkipFadeIn,
  beginFadeIn,
  completeFadeIn,
  getResponseType,
  getTransitionDuration
};
```

**Dependencies:** cardState, jQuery (for ARIA)
**Estimated Effort:** 12 hours
**Testing Strategy:** State transition validation tests

---

### 3. **cardUtils.js** (~800 lines) - PHASE 3
**Priority:** 🟢 **LOW RISK** - Helper utilities
**Why Third:** Support functions for other modules
**Contains:**
- `getButtonTrial()`, `getCurrentFalseResponses()`
- `getCurrentClusterAndStimIndices()`, `setUpButtonTrial()`
- `checkSimulation()`, `parseSchedItemCondition()`
- `getTrialTime()`, `gatherAnswerLogRecord()`
- `curStimHasSoundDisplayType()`, `curStimHasImageDisplayType()`
- Content cache management (`soundsDict`, `imagesDict`)
- Phonetic utilities (`levenshteinDistance`, `getPhoneticCodes`, `buildPhoneticIndex`)

**Exports:**
```javascript
export {
  getButtonTrial,
  getCurrentFalseResponses,
  getCurrentClusterAndStimIndices,
  setUpButtonTrial,
  checkSimulation,
  parseSchedItemCondition,
  getTrialTime,
  gatherAnswerLogRecord,
  curStimHasSoundDisplayType,
  curStimHasImageDisplayType,
  soundsDict,
  imagesDict,
  onEndCallbackDict,
  // Phonetic utilities
  levenshteinDistance,
  getPhoneticCodes,
  buildPhoneticIndex,
  findPhoneticMatch,
  tryPhoneticMatch,
  findPhoneticConflictsWithCorrectAnswer,
  filterPhoneticConflicts
};
```

**Dependencies:** Session, Answers module
**Estimated Effort:** 15 hours
**Testing Strategy:** Unit tests for each utility function

---

### 4. **cardContent.js** (~700 lines) - PHASE 4
**Priority:** 🟡 **MEDIUM RISK** - Content loading
**Why Fourth:** Needed before audio/video modules
**Contains:**
- `preloadVideos()`, `preloadImages()`, `waitForDOMImageReady()`
- `getCurrentStimDisplaySources()`, `preloadStimuliFiles()`
- `cleanupTrialContent()`, `hideUserFeedback()`
- Content caching and preloading logic

**Exports:**
```javascript
export {
  preloadVideos,
  preloadImages,
  waitForDOMImageReady,
  getCurrentStimDisplaySources,
  preloadStimuliFiles,
  cleanupTrialContent,
  hideUserFeedback
};
```

**Dependencies:** Session, cardUtils, imagesDict, soundsDict
**Estimated Effort:** 12 hours
**Testing Strategy:** Async preload tests with mocked Image/Audio

---

### 5. **cardAudio.js** (~1800 lines) - PHASE 5
**Priority:** 🔴 **HIGH RISK** - Complex SR/TTS system
**Why Fifth:** Depends on utils, state machine, timeouts
**Contains:**
- **Speech Recognition (SR):**
  - `initializeAudio()`, `startUserMedia()`, `startRecording()`, `stopRecording()`
  - `speechAPICallback()`, `generateRequestJSON()`, `processLINEAR16()`
  - `pollMediaDevices()`, `reinitializeMediaDueToDeviceChange()`
  - `clearAudioContextAndRelatedVariables()`
- **Text-to-Speech (TTS):**
  - `speakMessageIfAudioPromptFeedbackEnabled()`
  - `checkUserAudioConfigCompatability()`
  - `checkAndWarmupAudioIfNeeded()`
- **Module State:**
  - `srState` ReactiveDict
  - `audioContext`, `recorder`, `selectedInputDevice`, `userMediaStream`
  - `streamSource`, `speechEvents`, `pollMediaDevicesInterval`
  - Cached state: `cachedAnswerGrammar`, `cachedPhoneticIndex`, `lastCachedUnitNumber`

**Exports:**
```javascript
export {
  // SR State
  srState,
  checkAudioInputMode,

  // Initialization
  initializeAudio,
  checkAndWarmupAudioIfNeeded,

  // Recording
  startRecording,
  stopRecording,

  // Device Management
  pollMediaDevices,
  reinitializeMediaDueToDeviceChange,
  clearAudioContextAndRelatedVariables,

  // TTS
  speakMessageIfAudioPromptFeedbackEnabled,
  checkUserAudioConfigCompatability,

  // Phonetic Matching (from cardUtils, re-exported for convenience)
  buildPhoneticIndex,
  findPhoneticMatch
};
```

**Dependencies:** cardUtils (phonetic), cardStateMachine, Hark, Google Speech API, Plyr
**Estimated Effort:** 35 hours (most complex module)
**Testing Strategy:** Mock Web Audio API, test SR state machine separately

---

### 6. **cardFeedback.js** (~1000 lines) - PHASE 6
**Priority:** 🟠 **MEDIUM-HIGH RISK** - Complex callback chain
**Why Sixth:** Depends on audio, state machine, timeouts
**Contains:**
- `showUserFeedback()` - Display feedback with countdown
- `afterAnswerFeedbackCallback()` - Coordinate TTS + countdown wait
- `afterFeedbackCallback()` - Transition to next trial
- `doClearForceCorrect()` - Mandatory correction flow
- Countdown timer creation and management
- Feedback positioning logic (M3 autorun integration)

**Exports:**
```javascript
export {
  showUserFeedback,
  afterAnswerFeedbackCallback,
  afterFeedbackCallback,
  doClearForceCorrect,
  hideUserFeedback
};
```

**Dependencies:** cardAudio, cardStateMachine, cardTimeouts, cardUtils
**Estimated Effort:** 20 hours
**Testing Strategy:** Mock async feedback flow, test countdown coordination

---

### 7. **cardInput.js** (~900 lines) - PHASE 7
**Priority:** 🟠 **MEDIUM-HIGH RISK** - User input handling
**Why Seventh:** Depends on audio, feedback, state machine
**Contains:**
- `allowUserInput()`, `stopUserInput()`
- `handleUserInput()` - Main answer submission handler
- `handleUserForceCorrectInput()` - Force correct handler
- `userAnswerFeedback()` - Answer validation
- `determineUserFeedback()` - Route to feedback
- `writeCurrentToScrollList()` - Scroll history
- `startQuestionTimeout()`, `beginQuestionAndInitiateUserInput()`

**Exports:**
```javascript
export {
  allowUserInput,
  stopUserInput,
  handleUserInput,
  handleUserForceCorrectInput,
  userAnswerFeedback,
  determineUserFeedback,
  writeCurrentToScrollList,
  startQuestionTimeout,
  beginQuestionAndInitiateUserInput
};
```

**Dependencies:** cardAudio, cardFeedback, cardStateMachine, cardTimeouts, Answers
**Estimated Effort:** 18 hours
**Testing Strategy:** Mock answer validation, test input flow

---

### 8. **cardLifecycle.js** (~800 lines) - PHASE 8
**Priority:** 🟡 **MEDIUM RISK** - Orchestration layer
**Why Eighth:** Orchestrates all other modules
**Contains:**
- `cardStart()` - Main entry point
- `initCard()` - Template initialization (onRendered)
- `prepareCard()` - Prepare next trial
- `newQuestionHandler()` - Set up next question
- `cardEnd()` - End of trial cleanup
- `unitIsFinished()` - End of unit
- `revisitUnit()` - Go to previous unit
- `leavePage()` - Navigation and cleanup
- `removeCardByUser()` - Report question
- `processUserTimesLog()` - Save timing data

**Exports:**
```javascript
export {
  cardStart,
  initCard,
  prepareCard,
  newQuestionHandler,
  cardEnd,
  unitIsFinished,
  revisitUnit,
  leavePage,
  removeCardByUser,
  processUserTimesLog
};
```

**Dependencies:** ALL other modules
**Estimated Effort:** 15 hours
**Testing Strategy:** Integration tests for trial flow

---

### 9. **cardHelpers.js** (~1200 lines) - PHASE 9
**Priority:** 🟢 **LOW RISK** - Template helpers
**Why Ninth:** Pure view layer, depends on all modules
**Contains:**
- All 110+ Template.card.helpers
- Organized by category (see CARD_JS_ARCHITECTURE.md section 3)
- Pure reactive helpers, no side effects

**Exports:**
```javascript
// Helpers are registered directly on Template.card
// This file just contains the helper definitions
```

**Dependencies:** Session, cardState, all other modules
**Estimated Effort:** 12 hours
**Testing Strategy:** Test helper return values with mocked state

---

### 10. **cardEvents.js** (~500 lines) - PHASE 10
**Priority:** 🟢 **LOW RISK** - Event handlers
**Why Last:** Pure event delegation, depends on all modules
**Contains:**
- All 18 Template.card.events
- Input events (`keypress #userAnswer`, `keypress #dialogueUserAnswer`)
- Button events (`click .multipleChoiceButton`, `click #confirmButton`)
- Navigation events (`click #continueButton`, `click #stepBackButton`)
- Force correct events (`keypress #userForceCorrect`)

**Exports:**
```javascript
// Events are registered directly on Template.card
// This file just contains the event handler definitions
```

**Dependencies:** cardInput, cardLifecycle, cardFeedback
**Estimated Effort:** 8 hours
**Testing Strategy:** Test event handlers with mocked DOM events

---

## Phased Implementation Timeline

### Phase 1: cardTimeouts.js (Week 1)
- **Days 1-2:** Extract timeout functions
- **Day 3:** Write unit tests
- **Day 4:** Integration testing
- **Day 5:** Code review and adjustments

**Deliverables:**
- ✅ cardTimeouts.js module
- ✅ Unit tests (80%+ coverage)
- ✅ Updated card.js with imports
- ✅ Documentation

### Phase 2: cardStateMachine.js (Week 2)
- **Days 1-2:** Extract state machine
- **Day 3:** Write state transition tests
- **Day 4:** Integration testing
- **Day 5:** Code review

### Phase 3: cardUtils.js (Week 3)
- **Days 1-3:** Extract utility functions
- **Day 4:** Write unit tests
- **Day 5:** Integration testing

### Phase 4: cardContent.js (Week 4)
- **Days 1-2:** Extract content loading
- **Day 3:** Write async preload tests
- **Days 4-5:** Integration testing

### Phase 5: cardAudio.js (Weeks 5-7)
- **Week 5:** Extract SR functions, basic tests
- **Week 6:** Extract TTS, device management, tests
- **Week 7:** Integration testing, SR state machine validation

### Phase 6: cardFeedback.js (Weeks 8-9)
- **Week 8:** Extract feedback display, countdown coordination
- **Week 9:** Write async feedback tests, integration testing

### Phase 7: cardInput.js (Weeks 10-11)
- **Week 10:** Extract input handling, answer validation
- **Week 11:** Write input flow tests, integration testing

### Phase 8: cardLifecycle.js (Weeks 12-13)
- **Week 12:** Extract lifecycle functions, orchestration
- **Week 13:** Integration testing, trial flow validation

### Phase 9: cardHelpers.js (Week 14)
- **Days 1-3:** Extract and organize helpers
- **Days 4-5:** Test helper reactivity

### Phase 10: cardEvents.js (Week 15)
- **Days 1-3:** Extract event handlers
- **Days 4-5:** Event delegation testing

### Phase 11: Final Integration (Weeks 16-17)
- **Week 16:** Full system testing, bug fixes
- **Week 17:** Performance testing, documentation, deployment

---

## File Structure (After Split)

```
mofacts/client/views/experiment/
├── card.html                    (unchanged)
├── card.js                      (~500 lines - imports + template registration)
├── modules/
│   ├── cardTimeouts.js         (~500 lines) ✅ PHASE 1
│   ├── cardStateMachine.js     (~600 lines)
│   ├── cardUtils.js            (~800 lines)
│   ├── cardContent.js          (~700 lines)
│   ├── cardAudio.js            (~1800 lines)
│   ├── cardFeedback.js         (~1000 lines)
│   ├── cardInput.js            (~900 lines)
│   ├── cardLifecycle.js        (~800 lines)
│   ├── cardHelpers.js          (~1200 lines)
│   └── cardEvents.js           (~500 lines)
└── tests/
    ├── cardTimeouts.test.js
    ├── cardStateMachine.test.js
    ├── cardUtils.test.js
    ├── cardContent.test.js
    ├── cardAudio.test.js
    ├── cardFeedback.test.js
    ├── cardInput.test.js
    ├── cardLifecycle.test.js
    ├── cardHelpers.test.js
    └── cardEvents.test.js
```

**Total:** 8,700 lines → ~500 (main) + ~8,800 (modules) = ~9,300 lines (includes tests, docs)

---

## Risk Mitigation Strategies

### 1. Rollback Plan
- Every phase has a git branch
- Can revert to previous working state
- Feature flag to enable/disable new modules

### 2. Testing Coverage
- Minimum 70% coverage for each module
- Integration tests for module interactions
- Manual testing after each phase

### 3. Incremental Deployment
- Deploy to staging after each phase
- Test with real users
- Monitor for regressions

### 4. Documentation
- Update CLAUDE.md after each phase
- Document module dependencies
- Create migration guide for future developers

---

## Success Criteria

**Phase Complete When:**
1. ✅ Module extracted and tested
2. ✅ All tests passing
3. ✅ No regressions in manual testing
4. ✅ Code review approved
5. ✅ Documentation updated

**Project Complete When:**
1. ✅ All 10 modules extracted
2. ✅ card.js reduced to ~500 lines
3. ✅ 70%+ test coverage
4. ✅ No performance regressions
5. ✅ Deployed to production successfully

---

## Next Steps

1. **Review this plan** - Get stakeholder approval
2. **Set up testing infrastructure** - Mocha, Chai, Sinon
3. **Create feature branch** - `feature/card-split-phase1`
4. **Start Phase 1** - Extract cardTimeouts.js

---

**Ready to begin Phase 1?** Let's start with cardTimeouts.js - the lowest risk, highest value extraction!

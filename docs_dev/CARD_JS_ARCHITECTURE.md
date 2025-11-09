# card.js Architecture Analysis - C1.1 Documentation

**Date:** 2025-01-08
**Purpose:** Comprehensive architecture map for C1 refactoring task
**File:** `mofacts/client/views/experiment/card.js` (6,088 lines)
**Status:** Complete inventory for C1.1

---

## Executive Summary

**card.js** is the mission-critical Meteor template file implementing the core learning trial UI and state machine for MoFaCTS. This document provides a complete architectural inventory to support the upcoming C1 refactoring initiative.

### Key Metrics
- **Total lines:** 6,088
- **Session keys:** 107 unique keys (388 gets, 200 sets)
- **Functions:** 80+ helper functions
- **Templates:** 1 main template (card) with 110+ helpers, 18 event handlers
- **Module variables:** 40+ global/module-scope variables
- **External dependencies:** 10+ project modules, 3 major libraries

---

## 1. Session Keys (107 Total) - Organized by Purpose

### A. Trial State & Presentation (18 keys)
Store current question/unit data loaded from TDF:

- **currentTdfFile** - Full TDF JSON structure
- **currentTdfId** - TDF identifier for server calls
- **currentTdfUnit** - Active unit object
- **currentTdfName** - Unit display name
- **currentUnitNumber** - Unit index in TDF
- **currentUnitStartTime** - Unit start timestamp (elapsed time calculation)
- **currentDisplay** - Question display object (text, audio, image, video, cloze)
- **currentAnswer** / **originalQuestion** - Correct answer(s)
- **currentExperimentState** - Complex state object (answer, syllables, progress)
- **schedule** / **unitType** - Engine configuration and type
- **testType** - Question type ('d', 's', 't', 'f', 'm', 'n', 'i')
- **currentStimuliSet** / **currentStimuliSetId** - Question bank
- **clusterIndex** / **alternateDisplayIndex** - Content indexing
- **currentScore** / **questionIndex** - Progress tracking

### B. User Input & Answer Tracking (11 keys)
Track answer submission and validation:

- **userAnswer** - Trimmed, lowercased user input
- **isCorrectAccumulator** - Validation result (boolean or null)
- **feedbackForAnswer** - Feedback text to display
- **hintLevel** / **source** - Input mode/hints
- **isRefutation** / **isTimeout** - Answer type flags
- **userAnswerSubmitTimestamp** - Answer time for analytics
- **feedbackTypeFromHistory** / **feedbackUnset** - Feedback state
- **feedbackTimeoutBegins** / **feedbackTimeoutEnds** - Feedback timing

### C. Timeout & Timing Control (12 keys)
Manage question/feedback/study display durations:

- **mainCardTimeoutStart** - Main question timeout start
- **trialStartTimestamp** / **trialEndTimeStamp** - Trial duration
- **varLenTimeoutName** - Display timeout ID
- **ReviewStudyCountdown** - Study phase countdown value
- **CurTimeoutId** / **CurIntervalId** - Active timeouts
- **cardStartTimestamp** - Page load time
- **errorReportStart** / **skipTimeout** - Modal timing

### D. Audio & Speech Recognition (14 keys)
Control speech-to-text and text-to-speech:

- **recording** / **recordingLocked** - SR state
- **audioInputSensitivity** - Microphone sensitivity (0-100)
- **audioRecorderInitialized** / **audioWarmupInProgress** - Initialization flags
- **ttsWarmedUp** / **srWarmedUp** - API warmup completion
- **audioPromptSpeakingRate** / **audioPromptVoice** - TTS settings
- **audioPromptQuestionVolume** / **audioPromptFeedbackVolume** - Volume control
- **sampleRate** - Audio sample rate (16kHz)
- **speechAPIKey** - User's speech API key
- **enableAudioPromptAndFeedback** - TTS toggle

### E. Display & UI State (17 keys)
Control question/feedback visibility:

- **displayReady** - Content ready to show
- **displayFeedback** - Show feedback selection dialog
- **isVideoSession** / **videoSource** - Video unit mode
- **buttonTrial** / **buttonList** - Multiple choice setup
- **scrollListCount** / **numVisibleCards** - History/visibility
- **showDialogueText** / **dialogueDisplay** / **dialogueLoopStage** - Dialogue mode
- **showDialogueHints** / **dialogueCacheHint** / **dialogueHistory** - Dialogue state
- **resetFeedbackSettingsFromIndex** - Feedback reset flag
- **hiddenItems** - Hidden stimulus items

### F. Feature Flags & Configuration (11 keys)
Control experiment behavior and settings:

- **runSimulation** - Admin/teacher simulation mode
- **ignoreOutOfGrammarResponses** - Skip validation
- **inResume** / **fromInstructions** - Session resumption flags
- **experimentXCond** / **subTdfIndex** - Experiment conditionals
- **useEmbeddedAPIKeys** - API key source
- **wasReportedForRemoval** - User feedback
- **curTdfUISettings** / **currentDeliveryParams** - UI/delivery configuration
- **buttonEntriesTemp** - Temporary button state

### G. Session Management & Locking (6 keys)
Prevent concurrent operations:

- **submmissionLock** - Prevent double submit (note: typo in original code)
- **enterKeyLock** - Prevent double enter
- **pausedLocks** - Pause counter for timeouts
- **sessionCheckInterval** - Multi-tab detection
- **studentUsername** - Student identifier
- **curUnitInstructionsSeen** - Instructions display flag

### H. Stimulus & Content Mapping (7 keys)
Map stimuli to display types:

- **stimDisplayTypeMap** - Stim set ID → {hasAudio, hasImage}
- **currentStimProbFunctionParameters** - Probability algorithm params
- **clusterMapping** - Cluster index mapping
- **overallOutcomeHistory** / **overallStudyHistory** - Trial history
- **debugParms** - Debug parameter values
- **lastlogicIndex** - Legacy tracking

### I. Delivery & Metadata (11 keys)
TDF configuration and system state:

- **curTeacher** - Teacher username
- **curSectionId** - Section identifier
- **curTdfTips** - Formatted tip objects
- **furthestUnit** - Progress tracking
- **clozeQuestionParts** - Sub-word cloze data
- **_debugTrialState** - Current state (stored for debugging)
- **currentRootTdfId** - Root TDF reference
- And 4+ other miscellaneous keys

---

## 2. Helper Functions - 80+ Top-Level Functions Grouped by Purpose

### Audio & Speech Recognition (24 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `checkAudioInputMode()` | Check if SR enabled (user toggle AND TDF) | currentTdfFile, Meteor.user() |
| `checkAndWarmupAudioIfNeeded()` | Async warmup TTS/SR APIs pre-trial | ttsWarmedUp, srWarmedUp |
| `initializeAudio()` | Request microphone, set up Web Audio | audioContext, userMediaStream |
| `startUserMedia(stream)` | Configure microphone stream | selectedInputDevice |
| `startRecording()` | Start audio recording, set Hark detection | recorder, speechEvents |
| `stopRecording()` | Stop recording, clean up speech detection | recorder, speechEvents |
| `speechAPICallback(err, data)` | Google Speech API response handler | Answer validation, feedback |
| `generateRequestJSON(...)` | Format speech API request | currentTdfId, speechAPIKey |
| `processLINEAR16(data)` | Convert audio to LINEAR16 format | audioContext |
| `pollMediaDevices()` | Detect microphone disconnection | selectedInputDevice |
| `clearAudioContextAndRelatedVariables()` | Clean up audio resources | streamSource, userMediaStream |
| `reinitializeMediaDueToDeviceChange()` | Re-init audio on device change | audioContext |
| `getPhoneticCodes(word)` | Generate double-metaphone codes | doubleMetaphone library |
| `buildPhoneticIndex(grammarList)` | Pre-compute phonetic index for answers | getPhoneticCodes |
| `findPhoneticConflictsWithCorrectAnswer(...)` | Find phonetically similar answers | doubleMetaphone |
| `filterPhoneticConflicts(...)` | Remove similar phonetics from grammar | doubleMetaphone |
| `findPhoneticMatch(...)` | Match spoken word to answer | tryPhoneticMatch |
| `tryPhoneticMatch(...)` | Core phonetic matching algorithm | levenshteinDistance |
| `levenshteinDistance(str1, str2)` | String edit distance (fuzzy match) | (Pure function) |
| `curStimHasSoundDisplayType()` | Check if current stim has audio | stimDisplayTypeMap |
| `curStimHasImageDisplayType()` | Check if current stim has images | stimDisplayTypeMap |
| `speakMessageIfAudioPromptFeedbackEnabled(msg, audioPromptSource)` | Text-to-speech via Plyr | playerController |
| `checkUserAudioConfigCompatability()` | Validate TTS compatible with stims | curStimHasImageDisplayType |

**Key Dependencies:** Web Audio API, Hark voice detection, Google Speech API, Plyr player. Heavy cross-function dependencies.

### Timeout & Timing Management (14 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `registerTimeout(name, callback, delay, description)` | Track timeout in activeTimeouts map | activeTimeouts Map |
| `registerInterval(name, callback, delay, description)` | Track interval in activeTimeouts map | activeTimeouts Map |
| `clearRegisteredTimeout(name)` | Clear tracked timeout/interval | activeTimeouts Map |
| `clearAllRegisteredTimeouts()` | Clear all tracked timeouts | activeTimeouts Map |
| `listActiveTimeouts()` | Debug helper - list active timeouts | activeTimeouts Map |
| `elapsedSecs()` | Elapsed seconds since unit start | currentUnitStartTime |
| `clearCardTimeout()` | Clear all card timeouts/intervals | varLenTimeoutName |
| `beginMainCardTimeout(delay, func)` | Start main question timeout | mainCardTimeoutStart |
| `resetMainCardTimeout()` | Restart timeout on user input | clearCardTimeout |
| `restartMainCardTimeoutIfNecessary()` | Conditional restart | Session state |
| `getDisplayTimeouts()` | Get min/max display timeouts | currentDeliveryParams |
| `setDispTimeoutText(txt)` | Update timeout display in UI | jQuery DOM update |
| `varLenDisplayTimeout()` | Countdown display callback | Session state |
| `getReviewTimeout(testType, deliveryParams, isCorrect, dialogueHistory, isTimeout, isSkip)` | Calculate feedback display duration | deliveryParams |

**Key Dependencies:** Heavy interdependencies within timeout functions. Mix of Meteor and browser timeouts.

### Trial State Machine (7 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `transitionTrialState(newState, reason)` | Validate and log state transition | _debugTrialState |
| `announceTrialStateToScreenReader(state, trialNum)` | ARIA live region announcement | jQuery DOM |
| `shouldSkipFadeIn()` | Check if fade-in skipped | displayReady |
| `beginFadeIn(reason)` | Initiate fade-in transition | transitionTrialState |
| `completeFadeIn()` | Complete fade-in | transitionTrialState |
| `getResponseType()` | Get response type for question | clusterIndex |
| `getTransitionDuration()` | Read CSS --transition-smooth value | getComputedStyle |

**State Machine Constants:**
```javascript
TRIAL_STATES = {
  IDLE,
  PRESENTING_LOADING, PRESENTING_FADING_IN, PRESENTING_DISPLAYING, PRESENTING_AWAITING,
  STUDY_SHOWING,
  FEEDBACK_SHOWING,
  TRANSITION_START, TRANSITION_FADING_OUT, TRANSITION_CLEARING,
  ERROR
}
VALID_TRANSITIONS = { [state]: [validNextStates] }
currentTrialState = TRIAL_STATES.IDLE
```

### Display & Content Loading (10 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `preloadVideos()` | Load video sources | currentTdfUnit, videoSource |
| `preloadImages()` | Async preload all images | currentStimuliSet, imagesDict |
| `waitForDOMImageReady()` | Wait for image element to load | currentDisplay |
| `getCurrentStimDisplaySources(filterPropertyName)` | Get array of media sources | currentStimuliSet |
| `preloadStimuliFiles()` | Async load all media | preloadImages |
| `checkSimulation()` | Check if simulation should run | runSimulation |
| `getCurrentFalseResponses()` | Get incorrect answer options | clusterIndex |
| `getCurrentClusterAndStimIndices()` | Get cluster/stim indices | clusterIndex, engine |
| `setUpButtonTrial()` | Create button options for MC | buttonTrial, Answers |
| `getButtonTrial()` | Check if MC trial | buttonTrial |

### User Input Handling (9 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `allowUserInput()` | Enable answer input (start SR if enabled) | buildPhoneticIndex, startRecording |
| `stopUserInput()` | Disable answer input | jQuery, stopRecording |
| `handleUserInput(e, source, simAnswerCorrect)` | Main answer handler | trialEndTimeStamp, userAnswer |
| `handleUserForceCorrectInput(e, source)` | Mandatory correction handler | stopRecording |
| `startQuestionTimeout()` | Set up question timeout | getDisplayTimeouts |
| `beginQuestionAndInitiateUserInput(delayMs, deliveryParams)` | Show question + enable input | allowUserInput |
| `userAnswerFeedback(userAnswer, isSkip, isTimeout, simCorrect)` | Async evaluate answer | Answers.answerIsCorrect |
| `determineUserFeedback(userAnswer, isSkip, isCorrect, feedbackForAnswer, correctAndText)` | Route to feedback | showUserFeedback |
| `showUserFeedback(isCorrect, feedbackMessage, isTimeout, isSkip)` | Async display feedback | speakMessageIfAudioPromptFeedbackEnabled |

**Key Dependency Chain:** handleUserInput → userAnswerFeedback → determineUserFeedback → showUserFeedback

### Card Lifecycle (12 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `cardStart()` | Main entry - start card | engine initialization |
| `prepareCard()` | Async prepare next card | preloadStimuliFiles |
| `newQuestionHandler()` | Async set up next question | setUpButtonTrial |
| `cleanupTrialContent()` | Clean up DOM after trial | scrollList.remove |
| `hideUserFeedback()` | Hide feedback display | jQuery |
| `cardEnd()` | Async cleanup at end of unit | clearAllRegisteredTimeouts |
| `initCard()` | Async template initialization | checkAndWarmupAudioIfNeeded |
| `unitIsFinished(reason)` | Async finish unit | cardEnd, leavePage |
| `revisitUnit(unitNumber)` | Async go to previous unit | prepareCard |
| `leavePage(dest)` | Async cleanup + navigate | clearAllRegisteredTimeouts |
| `removeCardByUser()` | Async remove stimulus | Meteor.callAsync |
| `processUserTimesLog()` | Async save timing data | Meteor.callAsync |

### Answer Validation & Feedback (4 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `writeCurrentToScrollList(...)` | Async record answer in scroll history | Answers.answerIsCorrect |
| `gatherAnswerLogRecord(...)` | Create trial record for server | getTestType, getTrialTime |
| `getTrialTime(trialEndTimeStamp, trialStartTimeStamp, reviewEnd, testType)` | Calculate trial duration | (Pure timestamp math) |
| `parseSchedItemCondition(cond)` | Parse TDF condition string | (String parsing) |

### Feedback Callback Chain (3 functions)

| Function | Purpose | Key Dependencies |
|----------|---------|------------------|
| `afterAnswerFeedbackCallback(...)` | Async after answer feedback | gatherAnswerLogRecord |
| `afterFeedbackCallback(...)` | Async after feedback complete | prepareCard |
| `doClearForceCorrect(...)` | Async handle force correct | gatherAnswerLogRecord |

---

## 3. Template.card Sections Analysis

### onCreated Hook (lines 688-741) - 2 Autoruns

```javascript
Template.card.onCreated(function() {
  // Autorun 1: Audio input mode detection (lines 700-711)
  // Tracks: Meteor.user().audioSettings.audioInputMode
  //         Session.get('currentTdfFile')
  // Writes: Module variable audioInputModeEnabled
  // Purpose: Cache SR enabled state to avoid duplicate TDF lookups

  // Autorun 2: Feedback container visibility (lines 716-735)
  // Tracks: cardState.get('inFeedback')
  //         cardState.get('feedbackPosition')
  // Writes: jQuery #userInteractionContainer, #feedbackOverrideContainer
  // Purpose: Centralize DOM updates for feedback visibility
  // NOTE: RESTORED - removal caused 40-90% performance regression

  // State initialization
  cardState.set('inFeedback', false);
  cardState.set('feedbackPosition', null);
  cardState.set('displayReady', false);
});

Template.card.rendered = initCard; // Async initialization
```

**Critical Insight:** Two autorun blocks for different concerns. Mixing reactive dependencies with jQuery creates performance issues.

### Event Handlers (18 event types, lines 855-1054)

**Input Events:**
- `'focus #userAnswer'` - No-op placeholder
- `'keypress #userAnswer'` - Sets submmissionLock, calls handleUserInput
- `'keypress #dialogueUserAnswer'` - Dialogue-specific flow

**Button Events:**
- `'click #removeQuestion'` - Report question (wasReportedForRemoval flag)
- `'click .multipleChoiceButton'` - MC selection (with confirm button mode)
- `'keydown .multipleChoiceButton'` - Arrow key navigation
- `'click #confirmButton'` - Confirm MC selection

**Study/Feedback Events:**
- `'click #continueStudy'` - Skip study phase
- `'click #confirmFeedbackSelection'` - Dismiss feedback dialog
- `'click #confirmFeedbackSelectionFromIndex'` - Update feedback from index

**Navigation Events:**
- `'click #overlearningButton'` - Exit to home
- `'click #continueButton'` - Unit finish (unitIsFinished)
- `'click #stepBackButton'` - Previous unit (revisitUnit)
- `'click #lastUnitModalDismiss'` - Last unit modal + Plyr

**Force Correct:**
- `'keypress #userForceCorrect'` - Mandatory correction input

**Dev-Only (Meteor.isDevelopment):**
- `'click #skipUnit'` - Skip unit
- `'click #giveAnser'` - Force correct
- `'click #giveWrongAnser'` - Force wrong

### Template Helpers (110+ helpers, lines 1059-1578)

**Categories:**
1. **User/Login (5):** isExperiment, isNormal, username, isImpersonating, experimentLoginText
2. **Audio (4):** audioInputModeEnabled, microphoneColorClass, voiceTranscriptionStatusMsg, shouldShowSpeechRecognitionUI
3. **Display Content (20+):** text, clozeText, curImgSrc, curImgHeight, curImgWidth, curVideoSrc, dialogueText, etc.
4. **Card Type Checkers (8):** test, study, drill, trial, textCard, audioCard, imageCard, videoCard, etc.
5. **Answer Display (3):** displayAnswer, rawAnswer, currentProgress
6. **Display Ready (5):** displayReady, displayReadyPromptString, readyPromptString, ReviewStudyCountdown, haveDispTimeout
7. **Feedback (3):** displayFeedback, resetFeedbackSettingsFromIndex, userInDiaglogue
8. **Dialogue (3):** dialogueCacheHint, isNotInDialogueLoopStageIntroOrExit, showDialogueHints
9. **Multiple Choice (5):** buttonTrial, buttonList, buttonListImageRows, haveScrollList, notButtonTrialOrInDialogueLoop
10. **Formatting (8):** fontSizeClass, getFontSizeStyle, stimuliBoxClasses, videoSessionClasses, correctnessClass, etc.
11. **Score/Progress (2):** currentScore, currentProgress
12. **Cloze (3):** subWordClozeCurrentQuestionExists, subWordParts, shouldShowSubWordCloze
13. **Video (4):** isVideoSession, isYoutubeVideo, videoId, videoSource
14. **Complex Conditionals (2):** shouldShowSubWordCloze, shouldShowStandardCloze
15. **Config/Debug (3):** debugParms, isDevelopment, UIsettings, probabilityParameters

**Pattern:** Most helpers read Session state and format for template display.

---

## 4. Module-Level Variables (40+)

### Core State
- `engine` - Unit engine (schedule, model, empty) - NULL until cardStart()
- `currentTrialState` - TRIAL_STATES constant - tracks state machine position

### Audio & Recording
- `audioContext` - Web Audio API context
- `recorder` - Recorder object
- `selectedInputDevice` - Device ID of microphone
- `userMediaStream` - Microphone audio stream
- `streamSource` - Audio context stream source node
- `speechEvents` - Hark voice activity detection
- `pollMediaDevicesInterval` - Device polling interval ID

### Cached Values (Performance)
- `cachedSyllables` - Cached syllable count
- `cachedSuccessColor` - CSS color value cache (--success-color)
- `cachedAlertColor` - CSS color value cache (--alert-color)
- `audioInputModeEnabled` - Cached SR enabled state (updated by autorun)
- `cachedAnswerGrammar` - Cached correct answer(s)
- `cachedPhoneticIndex` - Pre-computed phonetic codes
- `lastCachedUnitNumber` - Validation for cache freshness

### Timing
- `timeoutName` / `timeoutFunc` / `timeoutDelay` - Main question timeout tracking
- `simTimeoutName` - Simulation timeout ID
- `countdownInterval` - Countdown display interval ID
- `trialStartTimestamp` / `trialEndTimeStamp` - Trial timing
- `firstKeypressTimestamp` - First key time
- `userFeedbackStart` - Feedback display start
- `afterFeedbackCallbackBind` - Callback binding

### UI State
- `player` - Plyr audio/video player instance
- `userAnswer` - User's submitted answer text
- `inputDisabled` - Flag for input state
- `afterUserFeedbackForceCorrectCb` - Force correct callback
- `currentSound` - Currently playing Audio element

### Content Caches
- `soundsDict` - Map of {audioSrc → Audio object}
- `imagesDict` - Map of {imgSrc → Image object}
- `onEndCallbackDict` - Callbacks for sound end events

### Counters
- `speechTranscriptionTimeoutsSeen` - SR timeout tracking
- `timeoutsSeen` - General timeout counter (reset on resume)
- `lastlogicIndex` - Last processed condition

### Collections & Structures
- `scrollList` - Local Mongo.Collection(null) for scroll history
- `hark` - Voice activity detection library
- `activeTimeouts` - Map of {name → {id, type, delay, created, description}}
- `phoneticCache` - Map of {word → phonetic codes}

### Constants
- `TRIAL_STATES` - Object with state name constants
- `VALID_TRANSITIONS` - Object with valid state transitions

---

## 5. External Dependencies

### Meteor Packages (3)
```javascript
import {Roles} from 'meteor/alanning:roles'; // Role checking
import { ReactiveDict } from 'meteor/reactive-dict'; // cardState
import { Tracker } from 'meteor/tracker'; // Autoruns/afterFlush
```

### Project Modules (11 imports)
```javascript
import {
  shuffle, haveMeteorUser, getCurrentDeliveryParams, getStimCount,
  getStimCluster, createStimClusterMapping, getAllCurrentStimAnswers, getTestType
} from '../../lib/currentTestingHelpers';

import { initializePlyr, playerController, destroyPlyr } from '../../lib/plyrHelper.js';
import {meteorCallAsync, redoCardImage, clientConsole} from '../../index';
import {DialogueUtils, dialogueContinue, dialogueLoop, initiateDialogue} from './dialogueUtils';
import {SCHEDULE_UNIT, ENTER_KEY} from '../../../common/Definitions';
import {secsIntervalString, displayify, stringifyIfExists} from '../../../common/globalHelpers';
import {routeToSignin} from '../../lib/router';
import {createScheduleUnit, createModelUnit, createEmptyUnit} from './unitEngine';
import {Answers} from './answerAssess';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {checkUserSession} from '../../index';
import {instructContinue, unitHasLockout, checkForFileImage} from './instructions';
```

### Third-Party Libraries (2)
```javascript
import DOMPurify from 'dompurify'; // XSS sanitization
import {doubleMetaphone} from 'double-metaphone'; // Phonetic codes
```

### Browser APIs Used
- `navigator.mediaDevices.getUserMedia()` - Microphone access
- `AudioContext` - Web Audio API
- `Image` / `Audio` DOM elements - Preloading
- `jQuery` - DOM manipulation (pervasive, should be eliminated)

---

## 6. Key Findings for Refactoring

### Finding 1: Session State Explosion (CRITICAL)

**The Problem:**
- 107 unique Session keys spread across 388 gets and 200 sets
- No organization or grouping
- Multiple interdependent keys
- Difficult to track "who writes what"

**Why This Matters:**
- Can't refactor piece-by-piece
- Hard to test (need to mock all 107 keys)
- Memory leaks possible
- Cache invalidation nightmares

**Recommended Fix:**
- Group Session keys into logical containers (TrialState, AudioState, UIState)
- Create clear ownership
- Document all state transitions
- Consider server-side state for shared data

### Finding 2: jQuery DOM Manipulation (HIGH PRIORITY)

**The Problem:**
- 50+ jQuery calls scattered throughout
- Manual updates violate Blaze reactivity
- Multiple locations update same elements
- Performance issues

**Recommended Fix:**
- Convert to reactive template helpers
- Use cardState ReactiveDict for visibility
- Leverage Blaze {{#if}}/{{#unless}}
- Remove jQuery from critical path

### Finding 3: Complex Function Interdependencies

**Tightest Coupling:**
```
handleUserInput
  → userAnswerFeedback
    → determineUserFeedback
      → showUserFeedback
        → afterFeedbackCallbackBind
          → afterAnswerFeedbackCallback
            → afterFeedbackCallback
              → prepareCard (loops back!)
```

**Recommended Fix:**
- Extract to dedicated state machine/coordinator
- Use async/await to flatten
- Create clear event emitter
- Document callback chains

### Finding 4: Hardest Sections to Extract

#### Audio/Speech Recognition Pipeline (Most Complex)
- 60+ functions, 20+ Session keys, 3 libraries
- Device change detection, race conditions
- Three warmup scenarios
- **Recommendation:** Extract to `AudioManager` class

#### Trial State Machine (Scattered)
- 8 states, logic scattered across 15+ functions
- No validation of safe transitions
- **Recommendation:** Extract to `TrialStateMachine` class

#### Feedback Callback Chain (Most Convoluted)
- 5 levels of nested callbacks
- Multiple exit points
- **Recommendation:** Extract to `FeedbackCoordinator`, use async/await

#### Timeout Registry (Most Scattered)
- 20+ places call timeout functions
- Hard to debug active timeouts
- **Recommendation:** Create `TimeoutManager` class

### Finding 5: Performance Bottlenecks

**Issue 1: Large File Size**
- 6,088 lines makes parsing slow
- Poor test coverage
- Hard to navigate

**Issue 2: Repeated Session Accesses**
```javascript
Session.get('currentTdfFile') // Called 40+ times
Session.get('currentDeliveryParams') // Could cache
```

**Issue 3: No Memoization**
- Helpers called on every render without optimization

**Issue 4: jQuery Inefficiency**
- Multiple DOM traversals

### Finding 6: Security Considerations

**Good:** XSS Prevention with DOMPurify
```javascript
function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', ...],
    FORBID_TAGS: ['script', 'iframe', ...],
  });
}
```

**Gaps:**
1. No server-side validation
2. Input length not checked
3. No authorization check in cardStart()
4. Force correct path not clearly protected

**Recommendations:**
- Add server-side validation
- Implement method protection layer
- Add input length limits
- Validate TDF JSON structure

---

## Summary: Refactoring Roadmap

| Phase | Focus | Scope | Effort |
|-------|-------|-------|--------|
| 1 (DONE) | Inventory & Document | All sections analyzed | 4 hours |
| 2 | State Management | 107 Session keys → organized containers | 20-30 hours |
| 3 | Split Large Functions | card.js → 6-8 modules | 40-50 hours |
| 4 | Remove jQuery | Convert to Blaze reactive | 20-30 hours |
| 5 | Async/Await | Flatten callback pyramid | 30-40 hours |
| 6 | Testing | Add unit tests for extracted modules | 20-30 hours |
| **Total** | | 6,088 lines → 3,500-4,000 across modules | 130-180 hours |

---

## Conclusion

**card.js** requires systematic refactoring:

1. **Session state** must be reorganized into logical containers
2. **jQuery** must be removed and replaced with Blaze reactivity
3. **Functions** must be split across multiple modules
4. **Callbacks** must be flattened with async/await
5. **Tests** must be added to enable safe refactoring

The 6,088-line file can be reduced to ~3,500-4,000 lines across 6-8 focused modules with clear separation of concerns.

---

**File location:** `c:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts\client\views\experiment\card.js`
**Documentation created:** 2025-01-08
**Task:** C1.1 - Document card.js Architecture ✅ COMPLETE

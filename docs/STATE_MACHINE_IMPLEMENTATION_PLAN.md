# State Machine Implementation Plan for MoFaCTS Trial Flow

**Date:** 2025-10-10
**Author:** Claude Code
**Status:** Planning Document
**Priority:** Medium (Enhancement for maintainability and debugging)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [The Hidden State Machine](#the-hidden-state-machine)
4. [Implementation Approaches](#implementation-approaches)
5. [Recommended Approach: Explicit State Tracking](#recommended-approach-explicit-state-tracking)
6. [Detailed Implementation Plan](#detailed-implementation-plan)
7. [Benefits Analysis](#benefits-analysis)
8. [Future Upgrade Paths](#future-upgrade-paths)
9. [Appendix A: Complete State Diagram](#appendix-a-complete-state-diagram)
10. [Appendix B: Code Examples](#appendix-b-code-examples)
11. [Appendix C: Testing Strategy](#appendix-c-testing-strategy)

---

## Executive Summary

### The Key Insight

**MoFaCTS trial flow is already a state machine** - it's just not explicitly modeled as one. The current implementation uses implicit state through:
- Boolean flags (`displayReady`, `inputDisabled`, `inFeedback`)
- Session variables
- DOM state
- Async timing

### The Problem

Without explicit state tracking:
- Bugs are hard to debug ("why is input missing?")
- Invalid state transitions are possible (content clearing during fade-out)
- Code intent is unclear (what state should we be in before calling X?)
- Race conditions emerge between async operations

### The Solution

Add **explicit state tracking** to existing code without major refactoring:
- Define clear states and transitions using **hierarchical model** (3 phases with substates)
- Add state transition logging showing both phase and detail
- Validate operations against current state
- Document the state machine in code
- Handle trial-type-specific flows (study vs drill/test)

**Key Design Decision: Hierarchical States**
- **High-level:** 3 phases matching user experience (PRESENTING → FEEDBACK → TRANSITION)
- **Low-level:** Substates for debugging timing issues (PRESENTING.LOADING, TRANSITION.FADING_OUT, etc.)
- **Trial-type-aware:** Study trials skip PRESENTING.AWAITING, have instant feedback

### Implementation Cost vs Benefit

| Approach | Time | Benefit | Risk |
|----------|------|---------|------|
| **Explicit State Tracking (Recommended)** | 2-3 days | High (debugging, docs) | Very Low |
| **XState Integration (Advanced)** | 2-3 weeks | Very High (formal verification) | Medium |
| **Full React + XState Rewrite** | 6-12 months | Complete modernization | High |

**Recommendation:** Start with explicit state tracking (Phase 1), evaluate XState integration for new features (Phase 2), consider full migration as long-term goal (Phase 3).

---

## Current State Analysis

### Technology Stack

```
Meteor 1.12 (June 2020 - 5 years old)
├── Blaze (template layer)
├── jQuery (DOM manipulation)
├── Session (global reactive state)
├── ReactiveDict (scoped reactive state)
└── Tracker (reactivity system)

Node.js 12 (EOL April 2022)
```

### Trial Flow Architecture

**File:** `mofacts/client/views/experiment/card.js` (~4000 lines)

**Key Functions:**
- `prepareCard()` - Starts new trial (lines ~2935+)
- `newQuestionHandler()` - Sets up trial type (lines ~2987+)
- `startQuestionTimeout()` - Begins display pipeline (lines ~3040+)
- `checkAndDisplayPrestimulus()` - Shows prestimulus if configured (lines ~3106+)
- `checkAndDisplayTwoPartQuestion()` - Displays main question (lines ~3147+)
- `allowUserInput()` - Enables user interaction (lines ~3214+)
- `showUserFeedback()` - Displays correctness feedback (lines ~1917+)
- `cardEnd()` - Ends trial and starts next (lines ~2271+)

### Current Implicit State Indicators

| Indicator | Location | Purpose | Problem |
|-----------|----------|---------|---------|
| `displayReady` | Session | Controls CSS opacity via `.trial-hidden` class | Doesn't tell you WHICH state you're in |
| `inputDisabled` | Global var | Prevents input during transitions | Can be out of sync with actual state |
| `inFeedback` | cardState (ReactiveDict) | Shows feedback is displaying | Only tracks one state |
| `isVideoSession` | Session | Video unit vs regular trial | Orthogonal concern, not a state |
| `buttonTrial` | Session | Multiple choice vs text input | Trial type, not state |

**The Problem:** You need to check MULTIPLE variables to know "what state am I in?"

Example:
```javascript
// What state is this?
if (!displayReady && !inputDisabled && !inFeedback) {
  // Are we in HIDDEN_CLEARING? LOADING_NEXT? FADING_OUT?
  // Impossible to tell!
}
```

---

## The Hidden State Machine

### IMPORTANT: Trial Type Variations

**MoFaCTS has different trial types with DIFFERENT state flows:**

| Trial Type | Code | User Experience | Template Block | Shows Feedback? |
|------------|------|-----------------|----------------|-----------------|
| **Study** | 's', 'f' | Show stimulus+answer, user reads | `{{#if study}}` | ❌ No - has separate STUDY phase |
| **Drill** | 'd' | Show question, user answers, then show feedback | `{{#if testordrill}}` | ✅ Yes (2-5s in FEEDBACK phase) |
| **Test** | 't' | Show question, user answers, NO feedback | `{{#if testordrill}}` | ❌ No |

**Key Differences:**
- **Study trials use STUDY phase** - separate state from FEEDBACK, different template rendering
- **Study trials don't render input fields** - template shows `{{#if study}}` block (lines 157-163), skips `{{#if testordrill}}` block
- **Drill trials use FEEDBACK phase** - calls `showUserFeedback()` to show correct/incorrect for 2-5s
- **Test trials skip FEEDBACK entirely** - same template as drill but no feedback display
- **Study is NOT "feedback without input"** - it's a completely separate code path with different DOM structure

### Hierarchical State Model

The state machine has **3 distinct flows** based on trial type:

```
Study Flow:  PRESENTING (LOADING→FADING_IN→DISPLAYING) → STUDY.SHOWING → TRANSITION → (loop)
Drill Flow:  PRESENTING (LOADING→FADING_IN→DISPLAYING→AWAITING) → FEEDBACK.SHOWING → TRANSITION → (loop)
Test Flow:   PRESENTING (LOADING→FADING_IN→DISPLAYING→AWAITING) → TRANSITION → (loop)

All trials share first 3 PRESENTING substates; diverge after DISPLAYING
```

### Discovered States (Hierarchical)

Through code analysis, we've identified **4 primary phases** with **substates**:

```
┌────────────────────────────────────────────────────────────┐
│              TRIAL STATE MACHINE (Hierarchical)            │
└────────────────────────────────────────────────────────────┘

PRESENTING PHASE (user sees question/content)
    ├─ PRESENTING.LOADING          Selecting card, loading assets
    ├─ PRESENTING.FADING_IN        New content appearing (100ms)
    ├─ PRESENTING.DISPLAYING       Visible, input not yet enabled
    └─ PRESENTING.AWAITING         Input enabled, waiting (SKIP for study trials)

STUDY PHASE (study trials only - stimulus+answer displayed)
    └─ STUDY.SHOWING               Display stimulus+answer for purestudy timeout (study only)

FEEDBACK PHASE (drill trials only - shows correctness)
    └─ FEEDBACK.SHOWING            Display stimulus+answer+correct/incorrect (drill only, 2-5s)

TRANSITION PHASE (between trials)
    ├─ TRANSITION.START            Brief cleanup
    ├─ TRANSITION.FADING_OUT       Old content disappearing (100ms)
    └─ TRANSITION.CLEARING         Clearing DOM while invisible

(loop back to PRESENTING.LOADING)
```

### Trial-Type-Specific Flows

#### Study Trial Flow ('s' or 'f')
```
PRESENTING.LOADING (50-500ms)
    ↓ engine.selectNextCard(), preload images
PRESENTING.FADING_IN (100ms)
    ↓ displayReady=true, opacity 0→1
    ↓ Template shows {{#if study}} block with answer display (line 157-163)
    ↓ NO input fields rendered ({{#if testordrill}} not shown)
PRESENTING.DISPLAYING (brief ~10ms)
    ↓ Content visible
[SKIP AWAITING] ← Study trials don't render input or call allowUserInput()!
    ↓ Go directly to STUDY phase
STUDY.SHOWING (purestudy timeout, e.g., 3 seconds)
    ↓ Shows stimulus+answer together via {{#if study}} template block
    ↓ Display continues for `purestudy` timeout (e.g., 3 seconds)
    ↓ User reads content (no interaction possible)
    ↓ Timeout fires → handleUserInput({}, 'timeout')
    ↓ Auto-submit, userAnswer = '' (empty string)
    ↓ Code SKIPS showUserFeedback() (line 1909-1916)
TRANSITION.START (10ms)
    ↓ cardEnd() cleanup
TRANSITION.FADING_OUT (100ms)
    ↓ displayReady=false, opacity 1→0
TRANSITION.CLEARING (50ms)
    ↓ Clear DOM, reset Session vars
(back to PRESENTING.LOADING)
```

**Key Characteristics:**
- Study trials use a SEPARATE state (STUDY.SHOWING) not shared with feedback
- Template renders different HTML (`{{#if study}}` vs `{{#if testordrill}}`)
- No input fields rendered at all for study trials
- `beginQuestionAndInitiateUserInput()` still calls `allowUserInput()`, but there's nothing to enable
- Code explicitly skips `showUserFeedback()` for non-drill types

#### Drill Trial Flow ('d')
```
PRESENTING.LOADING (50-500ms)
    ↓ engine.selectNextCard(), preload images
PRESENTING.FADING_IN (100ms)
    ↓ displayReady=true, opacity 0→1
    ↓ Template shows {{#if testordrill}} block with input fields (line 165-227)
    ↓ Input fields rendered but disabled
PRESENTING.DISPLAYING (brief ~10ms)
    ↓ Content visible, input disabled
PRESENTING.AWAITING (2-30 seconds)
    ↓ allowUserInput() called - inputDisabled=false
    ↓ User types OR timeout
    ↓ handleUserInput() called with answer
FEEDBACK.SHOWING (2-5 seconds)
    ↓ showUserFeedback() called (line 1907) - ONLY for drills!
    ↓ $('#correctAnswerDisplayContainer').html(answer).removeClass('d-none')
    ↓ isCorrect = true/false (evaluated)
    ↓ Wait for reviewTimeout (2-5s based on correctness)
TRANSITION.START (10ms)
    ↓ cardEnd() cleanup
TRANSITION.FADING_OUT (100ms)
    ↓ displayReady=false, opacity 1→0
TRANSITION.CLEARING (50ms)
    ↓ Clear DOM, reset Session vars
(back to PRESENTING.LOADING)
```

**Key Characteristics:**
- Drill trials use `{{#if testordrill}}` template block (same as test)
- Input fields rendered and enabled via `allowUserInput()`
- Code explicitly calls `showUserFeedback()` (line 1898-1908: `if (isDrill)`)
- Uses `reviewTimeout` for feedback duration (2-5s based on correctness)

#### Test Trial Flow ('t')
```
PRESENTING.LOADING (50-500ms)
    ↓ engine.selectNextCard(), preload images
PRESENTING.FADING_IN (100ms)
    ↓ displayReady=true, opacity 0→1
    ↓ Template shows {{#if testordrill}} block with input fields (line 165-227)
    ↓ Input fields rendered but disabled (SAME as drill)
PRESENTING.DISPLAYING (brief ~10ms)
    ↓ Content visible, input disabled
PRESENTING.AWAITING (2-30 seconds)
    ↓ allowUserInput() called - inputDisabled=false
    ↓ User types OR timeout
    ↓ handleUserInput() called with answer
[SKIP FEEDBACK] ← Test trials don't show feedback!
    ↓ Answers recorded in database
    ↓ Code skips showUserFeedback() (line 1909: isDrill check fails)
    ↓ Goes directly to afterAnswerFeedbackCallback() (line 1915)
TRANSITION.START (10ms)
    ↓ cardEnd() cleanup
TRANSITION.FADING_OUT (100ms)
    ↓ displayReady=false, opacity 1→0
TRANSITION.CLEARING (50ms)
    ↓ Clear DOM, reset Session vars
(back to PRESENTING.LOADING)
```

**Key Characteristics:**
- Test trials use `{{#if testordrill}}` template block (SAME as drill)
- Input fields rendered and enabled (identical to drill during PRESENTING phase)
- Code explicitly skips `showUserFeedback()` (line 1898-1916: `!isDrill` check)
- Goes directly to TRANSITION after input (no FEEDBACK phase)

### State-to-Code Mapping

| Hierarchical State | Current Code Location | Indicators |
|-------|----------------------|------------|
| **IDLE** | Initial page load, before `cardStart()` | `displayReady=undefined` |
| **PRESENTING.LOADING** | `engine.selectNextCard()` → `newQuestionHandler()` | `displayReady=false`, async operations |
| **PRESENTING.FADING_IN** | `checkAndDisplayTwoPartQuestion()` sets `displayReady=true` | `displayReady=true`, opacity 0→1 |
| **PRESENTING.DISPLAYING** | After fade-in completes | `displayReady=true`, `inputDisabled=true` |
| **PRESENTING.AWAITING** | After `allowUserInput()` called (drill/test only) | `displayReady=true`, `inputDisabled=false` |
| **STUDY.SHOWING** | Study trials display for purestudy timeout | `{{#if study}}` template, no input fields |
| **FEEDBACK.SHOWING** | `showUserFeedback()` → `cardEnd()` (drill only) | `cardState.get('inFeedback')=true` |
| **TRANSITION.START** | `cardEnd()` cleanup | Brief moment |
| **TRANSITION.FADING_OUT** | `prepareCard()` sets `displayReady=false` | `displayReady=false`, opacity 1→0 |
| **TRANSITION.CLEARING** | After 120ms await in `prepareCard()` | `displayReady=false`, clearing Session vars |

### Invalid Transitions (Bugs)

These transitions should **never happen** but can occur due to race conditions:

```javascript
// BUG: Jump from FADING_OUT to LOADING without waiting
TRANSITION.FADING_OUT → PRESENTING.LOADING
❌ Skips TRANSITION.CLEARING, content clears during visible fade

// BUG: Call allowUserInput before content visible
PRESENTING.LOADING → PRESENTING.AWAITING
❌ User can't see what they're typing

// BUG: Show feedback before input enabled (drill only)
PRESENTING.DISPLAYING → FEEDBACK.SHOWING
❌ Skips PRESENTING.AWAITING, user never had a chance to respond

// BUG: Go to STUDY phase for non-study trial
PRESENTING.DISPLAYING → STUDY.SHOWING (when testType !== 's' and !== 'f')
❌ Wrong trial flow, study template shown for drill/test

// BUG: Start fade-in before loading completes
TRANSITION.CLEARING → PRESENTING.FADING_IN
❌ Skips PRESENTING.LOADING, showing empty or partial content
```

**Recent fixes prevented these by adding `await` statements** - which enforces sequential state transitions!

---

## Implementation Approaches

### Approach 1: Explicit State Tracking (Recommended)

**What:** Add a single state variable and transition tracking to existing code.

**Pros:**
- ✅ Minimal code changes (add calls, don't refactor)
- ✅ Immediate debugging benefits
- ✅ Documents state machine in code
- ✅ Zero risk to existing functionality
- ✅ Can be done incrementally

**Cons:**
- ⚠️ Still imperative code (not declarative)
- ⚠️ Requires discipline to maintain
- ⚠️ No automatic state validation

**Implementation Time:** 2-3 days

**Best For:** Current situation - legacy code that needs better debugging

---

### Approach 2: XState Integration (Advanced)

**What:** Use XState library to formally model and execute state machine.

**Example:**
```javascript
import { createMachine, interpret } from 'xstate';

const trialMachine = createMachine({
  id: 'trial',
  initial: 'idle',
  states: {
    idle: {
      on: { START: 'loadingNext' }
    },
    loadingNext: {
      invoke: {
        src: 'loadNextCard',
        onDone: { target: 'fadingIn' },
        onError: { target: 'error' }
      }
    },
    fadingIn: {
      after: {
        100: 'displayingContent'  // Automatic transition after 100ms
      }
    },
    displayingContent: {
      on: { ENABLE_INPUT: 'awaitingInput' }
    },
    awaitingInput: {
      on: {
        SUBMIT: 'inFeedback',
        TIMEOUT: 'inFeedback'
      }
    },
    inFeedback: {
      after: {
        2000: 'transitioning'  // Feedback timeout
      }
    },
    transitioning: {
      on: { NEXT: 'fadingOut' }
    },
    fadingOut: {
      after: {
        100: 'hiddenClearing'
      }
    },
    hiddenClearing: {
      invoke: {
        src: 'clearContent',
        onDone: { target: 'loadingNext' }
      }
    }
  }
});

const service = interpret(trialMachine)
  .onTransition(state => {
    console.log('STATE:', state.value);
  })
  .start();

// In your code
service.send('START');  // Triggers state transition
```

**Pros:**
- ✅ Formal verification (impossible states prevented)
- ✅ Automatic state validation
- ✅ Visual state charts (can generate diagrams)
- ✅ Time-based transitions built-in
- ✅ Better testing (test state machine separately)

**Cons:**
- ⚠️ Learning curve (team needs to understand XState)
- ⚠️ Requires refactoring async code
- ⚠️ Bundle size increase (~10KB gzipped)
- ⚠️ Integration complexity with Blaze/Meteor

**Implementation Time:** 2-3 weeks

**Best For:** New features or major refactors where formal correctness matters

---

### Approach 3: Full React + XState Rewrite

**What:** Migrate trial system to React with XState from scratch.

**Example:**
```jsx
import { useMachine } from '@xstate/react';
import { trialMachine } from './trialMachine';

function TrialCard() {
  const [state, send] = useMachine(trialMachine);

  return (
    <div className={state.matches('fadingOut') ? 'opacity-0' : 'opacity-100'}>
      {state.matches('displayingContent') && <QuestionDisplay />}
      {state.matches('awaitingInput') && <InputField />}
      {state.matches('inFeedback') && <FeedbackDisplay />}
    </div>
  );
}
```

**Pros:**
- ✅ Complete modernization
- ✅ Industry-standard patterns
- ✅ Excellent developer experience
- ✅ State machines are first-class
- ✅ Better performance
- ✅ Easier to hire for

**Cons:**
- 🔴 Complete rewrite (6-12 months)
- 🔴 High risk during transition
- 🔴 Team needs React expertise
- 🔴 Must maintain old code during migration

**Implementation Time:** 6-12 months

**Best For:** Long-term modernization strategy

---

## Recommended Approach: Explicit State Tracking

### Phase 1: Foundation (Week 1)

#### Step 1.1: Define State Constants

**File:** `mofacts/client/views/experiment/card.js`
**Location:** After `TRANSITION_CONFIG` constant (~line 1232)

```javascript
// TRIAL STATE MACHINE CONSTANTS (Hierarchical Model)
// Three distinct trial flows (based on trial type):
//   Study:  PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → STUDY.SHOWING → TRANSITION
//   Drill:  PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → PRESENTING.AWAITING → FEEDBACK.SHOWING → TRANSITION
//   Test:   PRESENTING.LOADING → PRESENTING.FADING_IN → PRESENTING.DISPLAYING → PRESENTING.AWAITING → TRANSITION
// All trials share the first 3 PRESENTING substates (LOADING, FADING_IN, DISPLAYING)
// Study skips AWAITING and uses STUDY phase; Drill adds FEEDBACK; Test skips both STUDY and FEEDBACK

const TRIAL_STATES = {
  // PRESENTING PHASE - User sees question/content (drill/test share this)
  // Duration: 15-30s for drill/test (waiting for input)
  PRESENTING_LOADING: 'PRESENTING.LOADING',          // Selecting card, loading assets (50-500ms)
  PRESENTING_FADING_IN: 'PRESENTING.FADING_IN',      // New content appearing (100ms)
  PRESENTING_DISPLAYING: 'PRESENTING.DISPLAYING',    // Visible, input disabled (brief ~10ms)
  PRESENTING.AWAITING: 'PRESENTING.AWAITING',        // Input enabled, waiting (drill/test only)

  // STUDY PHASE - Study trials only (completely separate from presenting/feedback)
  // Duration: purestudy timeout (e.g., 3 seconds)
  STUDY_SHOWING: 'STUDY.SHOWING',                    // Display stimulus+answer (study only)

  // FEEDBACK PHASE - Drill trials only (shows correctness after input)
  // Duration: 2-5s for drill
  FEEDBACK_SHOWING: 'FEEDBACK.SHOWING',              // Display correct/incorrect (drill only)

  // TRANSITION PHASE - Between trials (all trial types use this)
  // Duration: ~260ms total
  TRANSITION_START: 'TRANSITION.START',              // Brief cleanup (10ms)
  TRANSITION_FADING_OUT: 'TRANSITION.FADING_OUT',    // Old content disappearing (100ms)
  TRANSITION_CLEARING: 'TRANSITION.CLEARING',        // Clearing DOM while invisible (50ms)

  // Special states
  IDLE: 'IDLE',                                      // Initial page load only
  ERROR: 'ERROR'                                     // Error recovery
};

// Helper: Get high-level phase from detailed state
function getTrialPhase(state) {
  if (!state) return null;
  return state.split('.')[0]; // 'PRESENTING.AWAITING' → 'PRESENTING'
}

// Helper: Check if in a particular phase
function isInPhase(phase) {
  const currentPhase = getTrialPhase(currentTrialState);
  return currentPhase === phase;
}

// Helper: Check if this trial type requires input
function trialRequiresInput() {
  const testType = getTestType();
  return testType === 'd' || testType === 't'; // Drill or test
}

// Helper: Check if this is a study trial
function isStudyTrial() {
  const testType = getTestType();
  return testType === 's' || testType === 'f';
}

// Helper: Check if this trial type shows feedback (FEEDBACK phase only, not STUDY)
function trialShowsFeedback() {
  const testType = getTestType();
  return testType === 'd'; // Drill only (NOT study/test)
}

// Helper: Check if this trial type uses STUDY phase
function trialUsesStudyPhase() {
  const testType = getTestType();
  return testType === 's' || testType === 'f';
}

// Helper: Check if this is a test trial
function isTestTrial() {
  const testType = getTestType();
  return testType === 't';
}

// Track current state
let currentTrialState = TRIAL_STATES.IDLE;

// Valid state transitions (varies by trial type)
const VALID_TRANSITIONS = {
  [TRIAL_STATES.IDLE]: [TRIAL_STATES.PRESENTING_LOADING],

  // PRESENTING phase transitions
  [TRIAL_STATES.PRESENTING_LOADING]: [TRIAL_STATES.PRESENTING_FADING_IN],
  [TRIAL_STATES.PRESENTING_FADING_IN]: [TRIAL_STATES.PRESENTING_DISPLAYING],
  [TRIAL_STATES.PRESENTING_DISPLAYING]: [
    TRIAL_STATES.PRESENTING_AWAITING,  // For drill/test
    TRIAL_STATES.STUDY_SHOWING         // For study (skips AWAITING, goes to STUDY phase)
  ],
  [TRIAL_STATES.PRESENTING_AWAITING]: [
    TRIAL_STATES.FEEDBACK_SHOWING,     // For drill (shows feedback)
    TRIAL_STATES.TRANSITION_START      // For test (skips feedback)
  ],

  // STUDY phase transitions (study trials only)
  [TRIAL_STATES.STUDY_SHOWING]: [TRIAL_STATES.TRANSITION_START],

  // FEEDBACK phase transitions (drill trials only)
  [TRIAL_STATES.FEEDBACK_SHOWING]: [TRIAL_STATES.TRANSITION_START],

  // TRANSITION phase transitions
  [TRIAL_STATES.TRANSITION_START]: [TRIAL_STATES.TRANSITION_FADING_OUT],
  [TRIAL_STATES.TRANSITION_FADING_OUT]: [TRIAL_STATES.TRANSITION_CLEARING],
  [TRIAL_STATES.TRANSITION_CLEARING]: [TRIAL_STATES.PRESENTING_LOADING], // Loop

  // Error recovery
  [TRIAL_STATES.ERROR]: [] // Terminal state
};
```

**Rationale:** Having states as constants prevents typos and makes refactoring easier.

#### Step 1.2: Create State Transition Functions

**Location:** After state constants

```javascript
/**
 * Transition to a new trial state with logging and validation
 * @param {string} newState - The state to transition to (from TRIAL_STATES)
 * @param {string} reason - Human-readable reason for transition
 */
function transitionTrialState(newState, reason = '') {
  const previousState = currentTrialState;
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;

  // Validate transition
  const validNextStates = VALID_TRANSITIONS[previousState] || [];
  if (!validNextStates.includes(newState) && newState !== TRIAL_STATES.ERROR) {
    console.error(
      `❌ [Trial ${trialNum}] INVALID STATE TRANSITION: ${previousState} → ${newState}`,
      `\n   Valid transitions from ${previousState}: ${validNextStates.join(', ')}`,
      reason ? `\n   Reason: ${reason}` : ''
    );
    // Don't throw - just log. In production we might want to transition to ERROR state
    // For now, allow the transition but flag it
  }

  // Log transition
  console.log(
    `✓ [Trial ${trialNum}] STATE: ${previousState} → ${newState}`,
    reason ? `(${reason})` : ''
  );

  currentTrialState = newState;

  // Optional: Store in Session for debugging/visibility
  Session.set('_debugTrialState', newState);
}

/**
 * Assert that we're in one of the expected states before performing an operation
 * @param {string[]} expectedStates - Array of valid states for this operation
 * @param {string} operation - Name of operation being performed
 * @throws {Error} If in wrong state (in development)
 */
function assertTrialState(expectedStates, operation) {
  if (!expectedStates.includes(currentTrialState)) {
    const error = `❌ INVALID OPERATION: ${operation} called in state ${currentTrialState}, expected one of: ${expectedStates.join(', ')}`;
    console.error(error);

    // In development, throw to catch bugs early
    if (Meteor.isDevelopment) {
      throw new Error(error);
    }

    // In production, log but continue
    return false;
  }
  return true;
}

/**
 * Get current trial state (for debugging/testing)
 */
function getCurrentTrialState() {
  return currentTrialState;
}

/**
 * Reset trial state (for testing or error recovery)
 */
function resetTrialState() {
  console.log('🔄 Resetting trial state to IDLE');
  currentTrialState = TRIAL_STATES.IDLE;
  Session.set('_debugTrialState', TRIAL_STATES.IDLE);
}
```

**Rationale:**
- Centralized state management
- Validation catches bugs early
- Logging helps debugging
- Development mode throws errors (fail fast)
- Production mode logs but continues (graceful degradation)

#### Step 1.3: Export for Testing

**Location:** In export section at top of file (~line 30)

```javascript
export {
  speakMessageIfAudioPromptFeedbackEnabled,
  startRecording,
  stopRecording,
  getExperimentState,
  updateExperimentState,
  restartMainCardTimeoutIfNecessary,
  getCurrentClusterAndStimIndices,
  initCard,
  unitIsFinished,
  revisitUnit,
  gatherAnswerLogRecord,
  newQuestionHandler,
  // Add state machine exports
  TRIAL_STATES,
  getCurrentTrialState,
  resetTrialState,
  transitionTrialState,
  assertTrialState
};
```

**Rationale:** Allows unit tests to verify state transitions.

---

### Phase 2: Instrument Core Functions (Week 1-2)

#### Step 2.1: Instrument `prepareCard()`

**Location:** ~line 2943

**Before:**
```javascript
async function prepareCard() {
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;
  console.log('=== prepareCard START (Trial #' + trialNum + ') ===');
  console.log('  displayReady before:', Session.get('displayReady'));
  Meteor.logoutOtherClients();
  Session.set('wasReportedForRemoval', false);
  cleanupTrialContent();
  console.log('  Setting displayReady=false to start fade-out');
  Session.set('displayReady', false);
  // ...
}
```

**After:**
```javascript
async function prepareCard() {
  const trialNum = (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1;
  console.log('=== prepareCard START (Trial #' + trialNum + ') ===');

  // STATE TRANSITION: Begin fade-out
  transitionTrialState(TRIAL_STATES.FADING_OUT, 'prepareCard: starting trial transition');

  console.log('  displayReady before:', Session.get('displayReady'));
  Meteor.logoutOtherClients();
  Session.set('wasReportedForRemoval', false);
  cleanupTrialContent();
  console.log('  Setting displayReady=false to start fade-out');
  Session.set('displayReady', false);

  // Wait for CSS fade-out transition to complete
  const fadeDelay = TRANSITION_CONFIG.FADE_DURATION_MS + TRANSITION_CONFIG.FADE_BUFFER_MS;
  console.log(`  Waiting ${fadeDelay}ms for fade-out transition to complete...`);
  await new Promise(resolve => setTimeout(resolve, fadeDelay));

  // STATE TRANSITION: Fade complete, now clearing
  transitionTrialState(TRIAL_STATES.HIDDEN_CLEARING, 'prepareCard: fade-out complete, clearing content');
  console.log('  Fade-out complete, clearing content while invisible');

  Session.set('submmissionLock', false);
  Session.set('currentDisplay', {});
  Session.set('buttonTrial', undefined);
  Session.set('buttonList', []);
  $('#helpButton').prop("disabled",false);

  if (engine.unitFinished()) {
    unitIsFinished('Unit Engine');
  } else if (Session.get('isVideoSession')) {
    // Video session logic...
  } else {
    // STATE TRANSITION: Content cleared, loading next card
    transitionTrialState(TRIAL_STATES.LOADING_NEXT, 'prepareCard: selecting next card');

    await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    await newQuestionHandler();
    Session.set('cardStartTimestamp', Date.now());
    Session.set('engineIndices', undefined);
  }
}
```

**Key Points:**
- Three state transitions: `FADING_OUT` → `HIDDEN_CLEARING` → `LOADING_NEXT`
- Each transition has descriptive reason
- State changes BEFORE the operation that defines the state

#### Step 2.2: Instrument `newQuestionHandler()`

**Location:** ~line 2987

```javascript
async function newQuestionHandler() {
  // We should be in LOADING_NEXT when this is called
  assertTrialState([TRIAL_STATES.LOADING_NEXT], 'newQuestionHandler');

  console.log('=== newQuestionHandler START ===');
  console.log('  #userAnswer at start:', $('#userAnswer').length, 'display:', $('#userAnswer').css('display'));
  console.log('  Secs since unit start:', elapsedSecs());

  const experimentState = Session.get('currentExperimentState');

  scrollList.update(
      {'justAdded': 1},
      {'$set': {'justAdded': 0}},
      {'multi': true},
      function(err, numrecs) {
        if (err) console.log('UDPATE ERROR:', displayify(err));
      },
  );

  Session.set('buttonList', []);
  speechTranscriptionTimeoutsSeen = 0;
  const isButtonTrial = getButtonTrial();
  Session.set('buttonTrial', isButtonTrial);
  console.log('newQuestionHandler, isButtonTrial', isButtonTrial, 'displayReady', Session.get('displayReady'));

  // Batch DOM updates in single animation frame to reduce reflows/repaints
  // IMPORTANT: Await this so DOM updates complete BEFORE displayReady=true
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      if (isButtonTrial) {
        $('#textEntryRow').hide();
        console.log('  Button trial - hiding #textEntryRow');
      } else {
        $('#textEntryRow').removeAttr('hidden');
        console.log('  Text trial - showing #textEntryRow, .input-box elements:', $('.input-box').length);
        console.log('  #userAnswer after showing textEntryRow:', $('#userAnswer').length, 'display:', $('#userAnswer').css('display'));
      }
      resolve();
    });
  });

  if (isButtonTrial) {
    setUpButtonTrial();
  }

  if ((getTestType() === 's' || getTestType() === 'f') && !!(experimentState.currentDisplayEngine.clozeText)) {
    const currentDisplay = experimentState.currentDisplayEngine;
    const clozeQuestionFilledIn = Answers.clozeStudy(currentDisplay.clozeText, experimentState.currentAnswer);
    currentDisplay.clozeText = clozeQuestionFilledIn;
    const newExperimentState = {currentDisplayEngine: currentDisplay};
    updateExperimentState(newExperimentState, 'card.newQuestionHandler');
    experimentState.currentDisplayEngine = currentDisplay;
  }

  // Still in LOADING_NEXT, about to start display pipeline
  startQuestionTimeout();

  checkSimulation();

  if (experimentState.showOverlearningText) {
    $('#overlearningRow').removeAttr('hidden');
  }
}
```

**Key Points:**
- Asserts we're in correct state at entry
- No state transition here (handled by pipeline)

#### Step 2.3: Instrument `checkAndDisplayTwoPartQuestion()`

**Location:** ~line 3147

```javascript
async function checkAndDisplayTwoPartQuestion(deliveryParams, currentDisplayEngine, closeQuestionParts, nextStageCb) {
  // We should be in LOADING_NEXT when content is ready to display
  assertTrialState([TRIAL_STATES.LOADING_NEXT], 'checkAndDisplayTwoPartQuestion');

  console.log('=== checkAndDisplayTwoPartQuestion START ===');
  console.log('  displayReady at start:', Session.get('displayReady'));

  const isVideoSession = Session.get('isVideoSession')

  // Update display directly without toggling displayReady (prevents input shimmer)
  Session.set('currentDisplay', currentDisplayEngine);
  Session.get('currentExperimentState').clozeQuestionParts = closeQuestionParts;

  // Set displayReady once for the trial (no toggle to prevent shimmer)
  const currentDisplayReady = Session.get('displayReady');
  console.log('  Before setting displayReady - current value:', currentDisplayReady, 'isVideoSession:', isVideoSession);

  if (!currentDisplayReady && !isVideoSession) {
    console.log('  Setting displayReady=true in checkAndDisplayTwoPartQuestion');

    // STATE TRANSITION: Content loaded, starting fade-in
    transitionTrialState(TRIAL_STATES.FADING_IN, 'checkAndDisplayTwoPartQuestion: content loaded, fading in');

    Session.set('displayReady', true);

    // Wait for fade-in to complete before considering content "displayed"
    // Note: We don't await here because the function continues with two-part logic
    // The fade-in happens in parallel with timing setup
    setTimeout(() => {
      // STATE TRANSITION: Fade-in complete, content now fully visible
      transitionTrialState(TRIAL_STATES.DISPLAYING_CONTENT, 'checkAndDisplayTwoPartQuestion: fade-in complete');
    }, TRANSITION_CONFIG.FADE_DURATION_MS);
  }

  // Handle two part questions
  const currentQuestionPart2 = Session.get('currentExperimentState').currentQuestionPart2;
  if (currentQuestionPart2) {
    const twoPartQuestionWrapper = {'text': currentQuestionPart2};
    const initialviewTimeDelay = deliveryParams.initialview;
    setTimeout(function() {
      Session.set('currentDisplay', twoPartQuestionWrapper);
      Session.get('currentExperimentState').currentQuestionPart2 = undefined;
      redoCardImage();
      nextStageCb();
    }, initialviewTimeDelay);
  } else {
    nextStageCb();
  }
}
```

**Key Points:**
- Transition from `LOADING_NEXT` → `FADING_IN` → `DISPLAYING_CONTENT`
- Uses setTimeout to transition after fade completes
- Content is "displaying" while fading in

#### Step 2.4: Instrument `allowUserInput()`

**Location:** ~line 3214

```javascript
function allowUserInput() {
  // Content should be displayed before allowing input
  assertTrialState([TRIAL_STATES.DISPLAYING_CONTENT], 'allowUserInput');

  console.log('allow user input');

  // STATE TRANSITION: Input now enabled
  transitionTrialState(TRIAL_STATES.AWAITING_INPUT, 'allowUserInput: enabling user interaction');

  $('#confirmButton').show();

  inputDisabled = false;
  startRecording();

  if(Meteor.user().profile?.typeOfAudioPrompt === 'continuous') {
    beginMainCardTimeout();
  }
  setTimeout(async function() {
    $('#userAnswer').prop('disabled', inputDisabled);
    $('#userAnswer').focus();
  }, 200);
}
```

**Key Points:**
- Asserts content is displaying
- Transitions to `AWAITING_INPUT`

#### Step 2.5: Instrument `showUserFeedback()`

**Location:** ~line 1917

```javascript
function showUserFeedback(userCorrect, currentAnswer, isTimeout, isSkip) {
  // Should only show feedback when awaiting input
  assertTrialState([TRIAL_STATES.AWAITING_INPUT], 'showUserFeedback');

  console.log('=== showUserFeedback START ===');

  // STATE TRANSITION: Showing feedback
  transitionTrialState(TRIAL_STATES.IN_FEEDBACK, 'showUserFeedback: displaying correctness feedback');

  // ... rest of function

  // PHASE 2: Set reactive state, let Tracker.autorun handle DOM updates
  cardState.set('feedbackPosition', feedbackDisplayPosition);
  cardState.set('inFeedback', true);

  // ... rest of function
}
```

**Key Points:**
- Only valid from `AWAITING_INPUT` state
- Transitions to `IN_FEEDBACK`

#### Step 2.6: Instrument `cardEnd()`

**Location:** ~line 2271

```javascript
async function cardEnd() {
  // Should be in feedback when ending card
  assertTrialState([TRIAL_STATES.IN_FEEDBACK], 'cardEnd');

  hideUserFeedback();
  cardState.set('inFeedback', false);

  // STATE TRANSITION: Feedback ended, transitioning to next trial
  transitionTrialState(TRIAL_STATES.TRANSITIONING, 'cardEnd: feedback complete, preparing next trial');

  $('#CountdownTimerText').text("Continuing...");
  $('#userLowerInteraction').html('');
  $('#userAnswer').val('');
  Session.set('feedbackTimeoutEnds', Date.now())
  await prepareCard();
}
```

**Key Points:**
- Transitions from `IN_FEEDBACK` → `TRANSITIONING`
- `prepareCard()` then transitions to `FADING_OUT`

---

### Phase 3: Add State Visualization (Week 2)

#### Step 3.1: Add Debug Panel to Template

**File:** `mofacts/client/views/experiment/card.html`
**Location:** After opening `<div class="container">` tag

```html
<div class="container position-relative outer-container-spacing">

    <!-- ============================================================
         DEBUG STATE PANEL (only in development)
         ============================================================ -->
    {{#if isDevelopment}}
    <div id="trialStateDebug" style="position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #0f0; padding: 10px; font-family: monospace; font-size: 12px; z-index: 10000; border-radius: 5px; min-width: 250px;">
        <div style="font-weight: bold; margin-bottom: 5px; color: #fff;">Trial State Machine</div>
        <div>State: <span style="color: #0ff;">{{_debugTrialState}}</span></div>
        <div>Trial: <span style="color: #ff0;">{{currentProgress}}</span></div>
        <div>displayReady: <span style="color: {{#if displayReady}}#0f0{{else}}#f00{{/if}};">{{displayReady}}</span></div>
        <div>inFeedback: <span style="color: {{#if inFeedback}}#0f0{{else}}#f00{{/if}};">{{inFeedback}}</span></div>
        <div style="margin-top: 5px; font-size: 10px; color: #888;">
            Press Ctrl+Shift+D to toggle
        </div>
    </div>
    {{/if}}

    <!-- Rest of template... -->
```

#### Step 3.2: Add Keyboard Toggle

**File:** `mofacts/client/views/experiment/card.js`
**Location:** In event handlers section

```javascript
Template.card.events({
  // ... existing events ...

  // Toggle debug panel with Ctrl+Shift+D
  'keydown'(event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      const panel = document.getElementById('trialStateDebug');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    }
  }
});
```

#### Step 3.3: Add Console Command

For easy debugging in browser console:

```javascript
// Make state accessible globally in development
if (Meteor.isDevelopment) {
  window.getTrialState = getCurrentTrialState;
  window.TRIAL_STATES = TRIAL_STATES;
  window.resetTrialState = resetTrialState;

  console.log('%c🎓 MoFaCTS Debug Commands Available:', 'color: #0f0; font-weight: bold');
  console.log('%c  window.getTrialState() - Get current trial state', 'color: #0ff');
  console.log('%c  window.TRIAL_STATES - View all possible states', 'color: #0ff');
  console.log('%c  window.resetTrialState() - Reset to IDLE', 'color: #0ff');
}
```

---

### Phase 4: Add State History Tracking (Week 2)

For debugging complex issues, track state history:

```javascript
// Add after state constants
const STATE_HISTORY_SIZE = 20;
const stateHistory = [];

function recordStateTransition(from, to, reason, timestamp) {
  stateHistory.push({
    from,
    to,
    reason,
    timestamp,
    trialNum: (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1
  });

  // Keep only last N transitions
  if (stateHistory.length > STATE_HISTORY_SIZE) {
    stateHistory.shift();
  }
}

// Modify transitionTrialState to record history
function transitionTrialState(newState, reason = '') {
  const previousState = currentTrialState;
  const timestamp = Date.now();

  // ... validation logic ...

  // Record in history
  recordStateTransition(previousState, newState, reason, timestamp);

  currentTrialState = newState;
  Session.set('_debugTrialState', newState);
}

// Export for debugging
function getStateHistory() {
  return stateHistory.slice(); // Return copy
}

function printStateHistory() {
  console.table(stateHistory.map(entry => ({
    Trial: entry.trialNum,
    From: entry.from,
    To: entry.to,
    Reason: entry.reason,
    Time: new Date(entry.timestamp).toLocaleTimeString()
  })));
}

// Make available in development
if (Meteor.isDevelopment) {
  window.getStateHistory = getStateHistory;
  window.printStateHistory = printStateHistory;
}
```

**Usage in console:**
```javascript
// Print state history as a table
printStateHistory();

// Get raw history
const history = getStateHistory();
console.log(history);
```

---

### Phase 5: Add State-Based Error Recovery (Week 3)

Handle errors gracefully based on current state:

```javascript
/**
 * Error recovery - transition to safe state based on current state
 * @param {Error} error - The error that occurred
 * @param {string} context - Where the error occurred
 */
function handleTrialError(error, context) {
  console.error(`❌ ERROR in ${context} while in state ${currentTrialState}:`, error);

  // Log to server
  Meteor.call('logClientError', {
    error: error.toString(),
    stack: error.stack,
    state: currentTrialState,
    context,
    trialNum: (Session.get('currentExperimentState')?.numQuestionsAnswered || 0) + 1,
    timestamp: Date.now()
  });

  // Attempt recovery based on state
  try {
    switch (currentTrialState) {
      case TRIAL_STATES.LOADING_NEXT:
        // Failed to load card - try to skip to next
        console.log('⚠️ Recovery: Skipping failed card');
        transitionTrialState(TRIAL_STATES.ERROR, 'handleTrialError: load failure');
        Session.set('displayReady', false);
        setTimeout(() => {
          resetTrialState();
          prepareCard().catch(err => {
            console.error('Recovery failed:', err);
            alert('Unable to continue. Please refresh the page.');
          });
        }, 1000);
        break;

      case TRIAL_STATES.FADING_OUT:
      case TRIAL_STATES.HIDDEN_CLEARING:
        // Error during transition - force to next state
        console.log('⚠️ Recovery: Forcing transition to next state');
        transitionTrialState(TRIAL_STATES.LOADING_NEXT, 'handleTrialError: forced recovery');
        prepareCard();
        break;

      case TRIAL_STATES.AWAITING_INPUT:
        // Error during input - treat as incorrect timeout
        console.log('⚠️ Recovery: Treating as timeout');
        showUserFeedback(false, Session.get('currentAnswer'), true, false);
        break;

      default:
        // Unknown state or unrecoverable - reset
        console.log('⚠️ Recovery: Resetting to IDLE');
        transitionTrialState(TRIAL_STATES.ERROR, 'handleTrialError: unrecoverable');
        setTimeout(() => {
          resetTrialState();
          location.reload();
        }, 2000);
    }
  } catch (recoveryError) {
    console.error('❌ Recovery failed:', recoveryError);
    alert('A critical error occurred. The page will reload.');
    setTimeout(() => location.reload(), 2000);
  }
}

// Wrap critical async functions with error handling
const withErrorHandling = (fn, context) => {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      handleTrialError(error, context);
      throw error; // Re-throw after handling
    }
  };
};

// Example usage: Wrap prepareCard
const prepareCardOriginal = prepareCard;
prepareCard = withErrorHandling(prepareCardOriginal, 'prepareCard');
```

---

## Detailed Implementation Plan

### Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1: Foundation** | 2 days | State constants, transition functions |
| **Phase 2: Instrumentation** | 3 days | All core functions instrumented |
| **Phase 3: Visualization** | 1 day | Debug panel, console commands |
| **Phase 4: History Tracking** | 1 day | State history logging |
| **Phase 5: Error Recovery** | 2 days | Error handling, recovery logic |
| **Testing & Refinement** | 2 days | Integration testing, bug fixes |
| **Total** | **11 days** | Complete explicit state machine |

### Resource Requirements

**Developer Time:**
- 1 senior developer for implementation
- 1 QA engineer for testing
- ~80 hours total

**No External Dependencies:**
- ✅ No new packages required
- ✅ No build system changes
- ✅ No database changes
- ✅ Compatible with existing code

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Low | High | Add, don't modify; extensive testing |
| Team doesn't maintain state tracking | Medium | Medium | Make it easy; enforce in code review |
| Performance impact from logging | Low | Low | Use console.log (cheap); disable in production |
| State gets out of sync with reality | Low | Medium | Use assertions; fail fast in dev |

---

## Benefits Analysis

### Immediate Benefits (Week 1)

1. **Debugging Speed Increase: 5-10x**
   - Before: "Why is input missing?" → check 10 variables, add logging, reload, reproduce
   - After: Look at console → "Oh, `showUserFeedback` was called while in `LOADING_NEXT` state - invalid transition"

2. **Bug Prevention**
   - `assertTrialState` catches invalid operations before they cause visible bugs
   - Transition validation prevents race conditions

3. **Documentation**
   - Code documents itself - `transitionTrialState(TRIAL_STATES.AWAITING_INPUT, 'allowUserInput')` is self-explanatory
   - New developers see state flow in console

### Medium-Term Benefits (Months)

4. **Easier Refactoring**
   - Can refactor individual states without breaking others
   - Clear contracts: "This function must be called in state X"

5. **Better Testing**
   - Can unit test: "Does this function transition to correct state?"
   - Can integration test: "Does trial flow through all states correctly?"

6. **Reduced Support Time**
   - Users report bugs with console logs attached
   - Logs show exact state flow that led to bug

### Long-Term Benefits (Years)

7. **Migration Path to Formal State Machine**
   - States are already identified and documented
   - Transitions are already mapped
   - Can migrate to XState incrementally

8. **Team Knowledge Transfer**
   - New developers understand trial flow by reading states
   - State machine diagram becomes onboarding documentation

9. **Code Quality**
   - Forces thinking about states upfront
   - Prevents spaghetti code ("just add another if statement")

### Quantitative Estimates

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to debug rendering issues | 2-4 hours | 20-30 minutes | **6x faster** |
| Bug reproduction rate | 50% | 90% | **1.8x better** |
| Code review time | 30 min | 15 min | **2x faster** |
| Onboarding time | 2 weeks | 1 week | **2x faster** |
| Production bugs per release | 5-10 | 2-3 | **3x reduction** |

**Estimated ROI:**
- Investment: 80 hours (2 weeks)
- Time saved per bug: 2 hours
- Bugs per month: 5
- Monthly savings: 10 hours
- **Payback period: 2 months**

---

## Future Upgrade Paths

### Path 1: Incremental XState Integration (6-12 months)

**Phase 1: Learn XState (Month 1-2)**
- Build new small feature with XState
- Example: User preferences panel
- Team gains expertise

**Phase 2: Migrate One Complex Flow (Month 3-4)**
- Choose one self-contained flow
- Example: Dialogue mode
- Build with XState alongside existing code

**Phase 3: Core Trial Flow Migration (Month 5-8)**
- Use explicit state tracking as blueprint
- Rewrite trial state machine in XState
- Keep old code as fallback during transition

**Phase 4: Cleanup (Month 9-12)**
- Remove old state tracking code
- Full migration to XState
- Documentation and training

**Risk:** Medium (can keep old code running)
**Benefit:** Formal verification, better debugging
**Cost:** 6-12 months, 1-2 developers

---

### Path 2: React + XState Rewrite (12-24 months)

**Phase 1: Architecture & Planning (Month 1-3)**
- Design new architecture
- Choose state management (XState + Zustand/Redux)
- Set up build tooling (Vite)
- Plan migration strategy

**Phase 2: Core Components (Month 4-9)**
- Rewrite trial display in React
- Implement XState machine for trial flow
- Build new UI components
- Parallel development with old code

**Phase 3: Feature Parity (Month 10-15)**
- Migrate all trial types
- Migrate feedback system
- Migrate analytics
- A/B testing old vs new

**Phase 4: Data Migration (Month 16-18)**
- Migrate user data
- Update database schemas
- Ensure backward compatibility

**Phase 5: Cutover (Month 19-21)**
- Roll out to users gradually
- Monitor for bugs
- Fix edge cases

**Phase 6: Cleanup (Month 22-24)**
- Remove old Blaze code
- Documentation
- Team training

**Risk:** High (complete rewrite)
**Benefit:** Modern stack, easier to hire, better performance
**Cost:** 12-24 months, 2-3 developers

---

## Appendix A: Complete State Diagram

### Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MoFaCTS TRIAL STATE MACHINE                      │
│                                                                         │
│  Legend:                                                                │
│    → Normal transition                                                  │
│    ⇢ Async operation                                                   │
│    ⊗ Error path                                                        │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │   IDLE   │
                              └─────┬────┘
                                    │ cardStart()
                                    │ resumeFromComponentState()
                                    ↓
                        ┌───────────────────────┐
                        │    LOADING_NEXT       │
                        │  • selectNextCard()   │
                        │  • preloadImages()    │
                        │  • newQuestionHandler │
                        └──────────┬────────────┘
                                   │ Images loaded
                                   │ Content ready
                                   ↓
                        ┌───────────────────────┐
                        │     FADING_IN         │
                        │  • displayReady=true  │
                        │  • opacity: 0→1       │
                        │  • Duration: 100ms    │
                        └──────────┬────────────┘
                                   │ After 100ms
                                   ↓
                        ┌───────────────────────┐
                        │ DISPLAYING_CONTENT    │
                        │  • Content visible    │
                        │  • Input disabled     │
                        └──────────┬────────────┘
                                   │ allowUserInput()
                                   ↓
                        ┌───────────────────────┐
                        │   AWAITING_INPUT      │
                        │  • User can interact  │
                        │  • inputDisabled=false│
                        │  • Focus on input     │
                        └──────────┬────────────┘
                                   │ User submits OR timeout
                                   │ showUserFeedback()
                                   ↓
                        ┌───────────────────────┐
                        │     IN_FEEDBACK       │
                        │  • Show correctness   │
                        │  • Display answer     │
                        │  • inFeedback=true    │
                        └──────────┬────────────┘
                                   │ Feedback timeout
                                   │ cardEnd()
                                   ↓
                        ┌───────────────────────┐
                        │   TRANSITIONING       │
                        │  • Brief moment       │
                        │  • Cleanup feedback   │
                        └──────────┬────────────┘
                                   │ prepareCard()
                                   ↓
                        ┌───────────────────────┐
                        │     FADING_OUT        │
                        │  • displayReady=false │
                        │  • opacity: 1→0       │
                        │  • Duration: 100ms    │
                        └──────────┬────────────┘
                                   │ await 120ms
                                   ↓
                        ┌───────────────────────┐
                        │   HIDDEN_CLEARING     │
                        │  • opacity: 0         │
                        │  • Clear old content  │
                        │  • Reset session vars │
                        └──────────┬────────────┘
                                   │ Content cleared
                                   │
                                   ↓ (LOOP BACK)
                        ┌───────────────────────┐
                        │    LOADING_NEXT       │
                        └───────────────────────┘

                                   ⊗ (from any state)
                                   ↓
                        ┌───────────────────────┐
                        │       ERROR           │
                        │  • handleTrialError() │
                        │  • Attempt recovery   │
                        │  • Log to server      │
                        └───────────────────────┘
```

### State Duration Times

| State | Typical Duration | Variable | Notes |
|-------|------------------|----------|-------|
| IDLE | Until page load | N/A | Only on initial load |
| LOADING_NEXT | 50-500ms | Depends on card selection | Async operations |
| FADING_IN | 100ms | Fixed | CSS transition |
| DISPLAYING_CONTENT | 0-100ms | Brief | Until input enabled |
| AWAITING_INPUT | 2-30 seconds | User-dependent | Waiting for response |
| IN_FEEDBACK | 2-5 seconds | Config: `reviewstudy`, `reviewtest` | Feedback timeout |
| TRANSITIONING | <10ms | Brief | Just cleanup |
| FADING_OUT | 100ms | Fixed | CSS transition |
| HIDDEN_CLEARING | <50ms | Brief | Clear DOM |

### State Entry/Exit Actions

```javascript
const STATE_ACTIONS = {
  [TRIAL_STATES.FADING_OUT]: {
    onEnter: () => {
      Session.set('displayReady', false);
      cleanupTrialContent();
    },
    onExit: () => {
      // Fade complete, content now invisible
    }
  },

  [TRIAL_STATES.HIDDEN_CLEARING]: {
    onEnter: () => {
      Session.set('currentDisplay', {});
      Session.set('buttonTrial', undefined);
      Session.set('buttonList', []);
    },
    onExit: () => {
      // Content cleared, ready to load next
    }
  },

  [TRIAL_STATES.LOADING_NEXT]: {
    onEnter: async () => {
      await engine.selectNextCard();
      await newQuestionHandler();
    },
    onExit: () => {
      // Card selected, assets loaded
    }
  },

  [TRIAL_STATES.FADING_IN]: {
    onEnter: () => {
      Session.set('displayReady', true);
    },
    onExit: () => {
      // Content now visible
    }
  },

  [TRIAL_STATES.AWAITING_INPUT]: {
    onEnter: () => {
      inputDisabled = false;
      $('#userAnswer').focus();
      startRecording();
    },
    onExit: () => {
      inputDisabled = true;
      stopRecording();
    }
  },

  [TRIAL_STATES.IN_FEEDBACK]: {
    onEnter: () => {
      cardState.set('inFeedback', true);
    },
    onExit: () => {
      cardState.set('inFeedback', false);
      hideUserFeedback();
    }
  }
};
```

*Note: This is conceptual - not recommended for Phase 1 implementation*

---

## Appendix B: Code Examples

### Example 1: State-Based Input Validation

**Before (implicit state):**
```javascript
function handleUserSubmit() {
  if ($('#userAnswer').val().trim() === '') {
    alert('Please enter an answer');
    return;
  }

  // What if we're not in the right state?
  // What if input was already submitted?
  // No way to tell!

  processAnswer($('#userAnswer').val());
}
```

**After (explicit state):**
```javascript
function handleUserSubmit() {
  // Validate state first
  if (currentTrialState !== TRIAL_STATES.AWAITING_INPUT) {
    console.warn(`⚠️ Submit ignored - not in AWAITING_INPUT state (current: ${currentTrialState})`);
    return;
  }

  const answer = $('#userAnswer').val().trim();
  if (answer === '') {
    alert('Please enter an answer');
    return;
  }

  // Safe to process
  processAnswer(answer);
}
```

---

### Example 2: Debugging Race Condition

**Scenario:** Input box disappears on trial 2

**Before (implicit state):**
```
Console log:
  prepareCard START
  Setting displayReady=false
  newQuestionHandler START
  Text trial - showing #textEntryRow
  Setting displayReady=true
  allowUserInput

// Where did it go wrong? Hard to tell!
```

**After (explicit state):**
```
Console log:
  ✓ [Trial 2] STATE: AWAITING_INPUT → FADING_OUT (prepareCard: starting trial transition)
  prepareCard START
  Setting displayReady=false
  Waiting 120ms for fade-out...
  ✓ [Trial 2] STATE: FADING_OUT → HIDDEN_CLEARING (prepareCard: fade-out complete)
  Clearing content...
  ✓ [Trial 2] STATE: HIDDEN_CLEARING → LOADING_NEXT (prepareCard: selecting next card)
  newQuestionHandler START
  Text trial - showing #textEntryRow
  ✓ [Trial 2] STATE: LOADING_NEXT → FADING_IN (checkAndDisplay: content loaded)
  Setting displayReady=true
  ✓ [Trial 2] STATE: FADING_IN → DISPLAYING_CONTENT (checkAndDisplay: fade-in complete)
  ❌ INVALID OPERATION: allowUserInput called in state DISPLAYING_CONTENT, expected one of: AWAITING_INPUT

// Aha! allowUserInput is being called too early, before we transition to AWAITING_INPUT
// The assertion caught the bug before it caused visible problems
```

---

### Example 3: Unit Test with State Machine

```javascript
// tests/unit/trialStateMachine.tests.js

import { assert } from 'chai';
import {
  TRIAL_STATES,
  transitionTrialState,
  getCurrentTrialState,
  resetTrialState
} from '../../client/views/experiment/card';

describe('Trial State Machine', () => {
  beforeEach(() => {
    resetTrialState();
  });

  it('should start in IDLE state', () => {
    assert.equal(getCurrentTrialState(), TRIAL_STATES.IDLE);
  });

  it('should allow valid transition from IDLE to LOADING_NEXT', () => {
    transitionTrialState(TRIAL_STATES.LOADING_NEXT, 'test');
    assert.equal(getCurrentTrialState(), TRIAL_STATES.LOADING_NEXT);
  });

  it('should log error for invalid transition', () => {
    // Capture console.error
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args);

    // Try invalid transition
    transitionTrialState(TRIAL_STATES.AWAITING_INPUT, 'test'); // Skip states

    // Should log error
    assert.isTrue(errors.length > 0);
    assert.isTrue(errors[0][0].includes('INVALID STATE TRANSITION'));

    // Restore console.error
    console.error = originalError;
  });

  it('should follow complete trial cycle', () => {
    const expectedStates = [
      TRIAL_STATES.IDLE,
      TRIAL_STATES.LOADING_NEXT,
      TRIAL_STATES.FADING_IN,
      TRIAL_STATES.DISPLAYING_CONTENT,
      TRIAL_STATES.AWAITING_INPUT,
      TRIAL_STATES.IN_FEEDBACK,
      TRIAL_STATES.TRANSITIONING,
      TRIAL_STATES.FADING_OUT,
      TRIAL_STATES.HIDDEN_CLEARING
    ];

    // Simulate trial cycle
    for (let i = 1; i < expectedStates.length; i++) {
      transitionTrialState(expectedStates[i], `step ${i}`);
      assert.equal(getCurrentTrialState(), expectedStates[i]);
    }
  });
});
```

---

### Example 4: State History Analysis

```javascript
// In browser console after bug occurs:

printStateHistory();

/* Output:
┌─────────┬───────┬──────────────────────┬──────────────────────┬─────────────────┐
│ (index) │ Trial │ From                 │ To                   │ Time            │
├─────────┼───────┼──────────────────────┼──────────────────────┼─────────────────┤
│ 0       │ 1     │ IDLE                 │ LOADING_NEXT         │ 10:23:45        │
│ 1       │ 1     │ LOADING_NEXT         │ FADING_IN            │ 10:23:45        │
│ 2       │ 1     │ FADING_IN            │ DISPLAYING_CONTENT   │ 10:23:45        │
│ 3       │ 1     │ DISPLAYING_CONTENT   │ AWAITING_INPUT       │ 10:23:46        │
│ 4       │ 1     │ AWAITING_INPUT       │ IN_FEEDBACK          │ 10:23:48        │
│ 5       │ 1     │ IN_FEEDBACK          │ TRANSITIONING        │ 10:23:50        │
│ 6       │ 1     │ TRANSITIONING        │ FADING_OUT           │ 10:23:50        │
│ 7       │ 1     │ FADING_OUT           │ HIDDEN_CLEARING      │ 10:23:50        │
│ 8       │ 1     │ HIDDEN_CLEARING      │ LOADING_NEXT         │ 10:23:50        │
│ 9       │ 2     │ LOADING_NEXT         │ FADING_IN            │ 10:23:51        │
│ 10      │ 2     │ FADING_IN            │ DISPLAYING_CONTENT   │ 10:23:51        │
│ 11      │ 2     │ DISPLAYING_CONTENT   │ IN_FEEDBACK          │ 10:23:51 ⚠️    │
└─────────┴───────┴──────────────────────┴──────────────────────┴─────────────────┘

Analysis: Trial 2 jumped from DISPLAYING_CONTENT to IN_FEEDBACK,
skipping AWAITING_INPUT state. This means allowUserInput() was never called!
*/
```

---

## Appendix C: Testing Strategy

### Unit Tests (2-3 hours)

**Test State Transitions:**
```javascript
describe('State Transitions', () => {
  test('all valid transitions succeed', () => {
    Object.keys(VALID_TRANSITIONS).forEach(fromState => {
      resetTrialState();
      // Force to fromState
      currentTrialState = fromState;

      VALID_TRANSITIONS[fromState].forEach(toState => {
        transitionTrialState(toState, 'test');
        expect(getCurrentTrialState()).toBe(toState);
      });
    });
  });

  test('invalid transitions log errors', () => {
    // Test a few known invalid transitions
    const invalidTransitions = [
      [TRIAL_STATES.FADING_OUT, TRIAL_STATES.AWAITING_INPUT],
      [TRIAL_STATES.HIDDEN_CLEARING, TRIAL_STATES.IN_FEEDBACK],
      [TRIAL_STATES.LOADING_NEXT, TRIAL_STATES.TRANSITIONING]
    ];

    invalidTransitions.forEach(([from, to]) => {
      resetTrialState();
      currentTrialState = from;

      const errors = captureConsoleErrors(() => {
        transitionTrialState(to, 'test');
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('INVALID STATE TRANSITION');
    });
  });
});
```

**Test State Assertions:**
```javascript
describe('State Assertions', () => {
  test('assertTrialState allows valid operations', () => {
    currentTrialState = TRIAL_STATES.AWAITING_INPUT;
    expect(() => {
      assertTrialState([TRIAL_STATES.AWAITING_INPUT], 'testOperation');
    }).not.toThrow();
  });

  test('assertTrialState throws in development for invalid operations', () => {
    currentTrialState = TRIAL_STATES.LOADING_NEXT;

    // In development, should throw
    Meteor.isDevelopment = true;
    expect(() => {
      assertTrialState([TRIAL_STATES.AWAITING_INPUT], 'showUserFeedback');
    }).toThrow('INVALID OPERATION');

    // In production, should log but not throw
    Meteor.isDevelopment = false;
    expect(() => {
      assertTrialState([TRIAL_STATES.AWAITING_INPUT], 'showUserFeedback');
    }).not.toThrow();
  });
});
```

---

### Integration Tests (4-6 hours)

**Test Complete Trial Flow:**
```javascript
describe('Complete Trial Cycle', () => {
  test('trial goes through all states in order', async () => {
    const statesSeen = [];

    // Spy on transitionTrialState
    const originalTransition = transitionTrialState;
    transitionTrialState = (newState, reason) => {
      statesSeen.push(newState);
      originalTransition(newState, reason);
    };

    // Run one trial
    await prepareCard();
    await simulateUserInput('correct answer');
    await waitForFeedbackTimeout();

    // Verify states occurred in correct order
    const expectedStates = [
      TRIAL_STATES.FADING_OUT,
      TRIAL_STATES.HIDDEN_CLEARING,
      TRIAL_STATES.LOADING_NEXT,
      TRIAL_STATES.FADING_IN,
      TRIAL_STATES.DISPLAYING_CONTENT,
      TRIAL_STATES.AWAITING_INPUT,
      TRIAL_STATES.IN_FEEDBACK,
      TRIAL_STATES.TRANSITIONING
    ];

    expect(statesSeen).toEqual(expectedStates);

    // Restore
    transitionTrialState = originalTransition;
  });

  test('trial handles timeout correctly', async () => {
    await prepareCard();

    // Wait for timeout instead of submitting
    await waitForTimeout(5000);

    // Should be in feedback with timeout flag
    expect(getCurrentTrialState()).toBe(TRIAL_STATES.IN_FEEDBACK);
    expect($('#UserInteraction').text()).toContain('timeout');
  });

  test('multiple trials cycle correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await prepareCard();
      await simulateUserInput('test answer');
      await waitForFeedbackTimeout();

      // Should be back in LOADING_NEXT, ready for next trial
      expect(getCurrentTrialState()).toBe(TRIAL_STATES.LOADING_NEXT);
    }
  });
});
```

---

### Manual Testing Checklist (1-2 hours)

**Trial 1 (First Trial):**
- [ ] Page loads, state is IDLE
- [ ] First trial loads, state goes LOADING_NEXT → FADING_IN → DISPLAYING_CONTENT
- [ ] Input becomes enabled, state goes to AWAITING_INPUT
- [ ] Submit answer, state goes to IN_FEEDBACK
- [ ] Feedback timeout, state goes to TRANSITIONING

**Trial 2+ (Subsequent Trials):**
- [ ] State goes FADING_OUT → HIDDEN_CLEARING → LOADING_NEXT
- [ ] Old content not visible during FADING_OUT
- [ ] Content cleared during HIDDEN_CLEARING
- [ ] New content loads during LOADING_NEXT
- [ ] Content fades in during FADING_IN
- [ ] Input visible and enabled during AWAITING_INPUT

**Error Cases:**
- [ ] Refresh during trial - state resets correctly
- [ ] Network error during load - state handles gracefully
- [ ] Click submit before input enabled - assertion catches it
- [ ] Multiple rapid clicks - state prevents double submission

**Debug Panel:**
- [ ] Ctrl+Shift+D toggles panel
- [ ] Panel shows current state
- [ ] Panel updates in real-time
- [ ] printStateHistory() works in console

---

### Performance Testing (1 hour)

**State Transition Overhead:**
```javascript
// Measure state transition performance
const iterations = 10000;
const start = performance.now();

for (let i = 0; i < iterations; i++) {
  transitionTrialState(TRIAL_STATES.LOADING_NEXT, 'perf test');
  transitionTrialState(TRIAL_STATES.FADING_IN, 'perf test');
  transitionTrialState(TRIAL_STATES.DISPLAYING_CONTENT, 'perf test');
  resetTrialState();
}

const end = performance.now();
const avgTime = (end - start) / iterations;

console.log(`Average state transition time: ${avgTime.toFixed(3)}ms`);
// Expected: < 0.01ms per transition (negligible)
```

**Console Logging Overhead:**
```javascript
// Test with console disabled
console.log = () => {};
const withoutLogging = measureTrialCycleTime(); // ~5 seconds

// Test with console enabled
console.log = originalConsoleLog;
const withLogging = measureTrialCycleTime(); // ~5.1 seconds

console.log(`Logging overhead: ${((withLogging - withoutLogging) / withoutLogging * 100).toFixed(1)}%`);
// Expected: < 5% overhead
```

---

## Conclusion

### Key Takeaways

1. **MoFaCTS trial flow is already a state machine** - making it explicit improves debugging and maintainability

2. **Explicit state tracking is the right first step** - low risk, high benefit, fast implementation

3. **XState is the right long-term goal** - but only after React migration or for new features

4. **State machine thinking prevents bugs** - by making invalid states impossible

### Next Steps

1. **Approve this plan** - Review and get team buy-in

2. **Implement Phase 1** - Add state constants and transition functions (2 days)

3. **Instrument core functions** - Add state tracking to prepareCard, newQuestionHandler, etc (3 days)

4. **Add visualization** - Debug panel and console commands (1 day)

5. **Test and refine** - Integration testing, fix edge cases (2 days)

6. **Document and train** - Update docs, train team on state machine thinking (1 day)

**Total timeline: 2 weeks to complete explicit state machine implementation**

### Questions?

Contact: Claude Code
Date: 2025-10-10
Version: 1.0

---

---

## REVISION NOTES

### 2025-10-10 Update: Hierarchical State Model

**Major revision** to reflect actual trial flows:

1. **Changed from 8 flat states to 3-phase hierarchical model:**
   - PRESENTING phase (with 4 substates)
   - FEEDBACK phase (1 substate)
   - TRANSITION phase (3 substates)

2. **Documented trial-type differences:**
   - Study ('s', 'f'): Skip PRESENTING.AWAITING, go to separate STUDY phase (different template, no input)
   - Drill ('d'): Full PRESENTING.AWAITING, then FEEDBACK shows stimulus+answer+correct/incorrect for 2-5s
   - Test ('t'): Full PRESENTING.AWAITING, skip FEEDBACK (records answer only)

3. **Added STUDY phase as separate from FEEDBACK:**
   - Study trials use STUDY.SHOWING state (not FEEDBACK.SHOWING)
   - Different template blocks: `{{#if study}}` vs `{{#if testordrill}}`
   - Different code paths: study skips `showUserFeedback()` entirely
   - This matches code reality: study and feedback are NOT the same thing

4. **Added helper functions:**
   - `getTrialPhase()` - Extract high-level phase
   - `isInPhase()` - Check current phase
   - `trialRequiresInput()` - Check if trial type needs input
   - `isStudyTrial()` - Check if study trial
   - `trialShowsFeedback()` - Check if trial type shows feedback (drill ONLY, not study/test)
   - `trialUsesStudyPhase()` - Check if trial type uses STUDY phase
   - `isTestTrial()` - Check if test trial

5. **Updated valid transitions:**
   - PRESENTING.DISPLAYING can go to:
     * PRESENTING.AWAITING (drill/test - need input)
     * STUDY.SHOWING (study - separate phase with different template)
   - PRESENTING.AWAITING can go to:
     * FEEDBACK.SHOWING (drill - show feedback)
     * TRANSITION.START (test - skip feedback)
   - STUDY.SHOWING can go to:
     * TRANSITION.START (study completes, no feedback)
   - This models the conditional flow based on trial type

**Why hierarchical?**
- Matches mental model: "We're in PRESENTING, why isn't input working?"
- Allows checking both phase-level ("are we showing content?") and detail-level ("is input enabled?")
- Makes trial-type differences explicit

**Implementation impact:**
- Same 11-day timeline
- Same core approach (add tracking, don't refactor)
- Slightly more code for helpers, but clearer intent

---

**End of Document**

# Phase 2 Safety Analysis: Adaptive Trial Selection

**Status:** ⚠️ **BLOCKING ISSUE IDENTIFIED**
**Date:** 2025-10-09
**Issue:** TransitionController prefetching is **NOT SAFE** for adaptive learning engines

---

## Problem Statement

Your concern is **100% correct**. The Phase 2 TransitionController implementation includes prefetching logic that attempts to load "next trial data" during the current trial:

```javascript
// From TransitionController.js - UNSAFE FOR ADAPTIVE ENGINES
async _prefetchNextTrial() {
  try {
    const nextCard = await Meteor.callAsync('getNextCardData', {
      currentClusterIndex: Session.get('currentClusterIndex'),
      currentStimulusIndex: Session.get('currentStimulusIndex'),
      userId: Meteor.userId(),
      tdfId: Session.get('currentTdfId')
    });

    this.nextTrialData = nextCard;  // ← This assumes trial N+1 is deterministic
  } catch (error) {
    console.warn('Prefetch failed', error);
  }
}
```

**This is incorrect** because MoFaCTS uses **adaptive spaced repetition** where:
- Trial N's **answer correctness** affects which card is selected for trial N+1
- Trial N's **response time** updates ACT-R activation calculations
- Trial N's **hint level** progression determines next difficulty

---

## Evidence from Code Audit

### 1. Model Unit Engine Uses Adaptive Selection

**File:** `unitEngine.js:1479-1616` (modelUnitEngine.selectNextCard)

```javascript
selectNextCard: async function(indices, curExperimentState) {
  if(indices === undefined || indices === null){
    // Calculate indices DYNAMICALLY based on current probabilities
    indices = await this.calculateIndices();
  }

  newClusterIndex = indices.clusterIndex;  // ← Selected AFTER calculating probabilities
  newStimIndex = indices.stimIndex;
  newHintLevel = indices.hintLevelIndex;

  // Indices determined by:
  // - selectCardAndHintBelowOptimalProbability() or
  // - selectCardAndHintClosestToOptimalProbability()
  // Both functions depend on cardProbabilities updated by previous answers
}
```

### 2. Card Probabilities Updated After Each Answer

**File:** `unitEngine.js:1626-1754` (modelUnitEngine.cardAnswered)

```javascript
cardAnswered: async function(wasCorrect, practiceTime) {
  const card = cardProbabilities.cards[cluster.shufIndex];
  const stim = card.stims[whichStim];

  // Update statistics that affect NEXT card selection:
  if (wasCorrect) {
    card.priorCorrect += 1;      // ← Affects probability calculation
    stim.priorCorrect += 1;
  } else {
    card.priorIncorrect += 1;
    stim.priorIncorrect += 1;
  }

  // Update ACT-R activation (affects next selection)
  this.updatePracticeTime(practiceTime);

  // Recalculate ALL card probabilities for next selection
  // (This is why we can't prefetch - probabilities change!)
}
```

### 3. Probability Calculation Depends on Answer History

**File:** `unitEngine.js:684-714` (calculateCardProbabilities)

```javascript
calculateCardProbabilities: function calculateCardProbabilities() {
  for (clusterIndex of unitClusterList) {
    const card = cardProbabilities.cards[clusterIndex];

    for (let stimIndex = 0; stimIndex < card.stims.length; stimIndex++) {
      const stim = card.stims[stimIndex];

      // Probability calculated from:
      // - card.priorCorrect / card.priorIncorrect  ← Updated by cardAnswered
      // - stim.lastSeen, stim.firstSeen             ← Updated by cardAnswered
      // - card.trialsSinceLastSeen                  ← Updated after each trial
      // - card.otherPracticeTime                    ← Cumulative time metric

      stim.probabilityEstimate = calculateActivation(...);
    }
  }
}
```

### 4. Schedule Unit is Pre-Determined (SAFE)

**File:** `unitEngine.js:2128-2162` (scheduleUnitEngine.selectNextCard)

```javascript
selectNextCard: async function(indices, curExperimentState) {
  const questionIndex = Session.get('questionIndex');
  const sched = this.getSchedule();  // ← Schedule created at unit start
  const questInfo = sched.q[questionIndex];  // ← Fixed sequence

  // Schedule engine is SAFE for prefetching because:
  // - Schedule is pre-computed (sched.q array)
  // - questionIndex just increments sequentially
  // - No adaptive logic affects card selection
}
```

**Key difference:** Schedule units could safely prefetch `sched.q[questionIndex + 1]`, but model units **cannot** predict the next card until current answer is processed.

---

## Data Flow Diagram: Why Prefetch Fails

```
Trial N (Current):
  User sees question → User answers → cardAnswered() updates stats
                                            ↓
                                   cardProbabilities.cards[i].priorCorrect++
                                   cardProbabilities.cards[i].lastSeen = now
                                   cardProbabilities.cards[i].otherPracticeTime += duration
                                            ↓
Trial N+1 (Next):
  prepareCard() → engine.selectNextCard()
                     ↓
                  calculateIndices()
                     ↓
                  calculateCardProbabilities()  ← Uses updated stats from Trial N
                     ↓
                  selectCardAndHintClosestToOptimalProbability()
                     ↓
                  Returns { clusterIndex, stimIndex, hintLevel }
                     ↓
                  ONLY NOW do we know what Trial N+1 will be
```

**Prefetching fails at:**
❌ Trying to call `getNextCardData()` before `cardAnswered()` completes
❌ Assumes `currentStimulusIndex + 1` is next (it's not - adaptive selection)
❌ Ignores that next card depends on correctness of current answer

---

## When Prefetching IS Safe

### ✅ Safe Scenarios:

1. **Schedule Unit (Assessment Mode)**
   - Pre-computed sequence in `sched.q` array
   - Can prefetch `sched.q[questionIndex + 1]` anytime
   - Example: `getNextCardData()` just returns `sched.q[nextIndex]`

2. **Image/Asset Preloading (with constraints)**
   - Can preload **all possible next cards** from probability distribution
   - If top 3 cards have 80% combined probability, preload those 3 images
   - Still useful even if some images unused

3. **Non-Adaptive Content**
   - Instruction pages
   - Video sessions
   - Linear tutorials

### ❌ Unsafe Scenarios:

1. **Model Unit (Adaptive Mode)**
   - Next card selected by ACT-R activation
   - Cannot predict until current answer processed
   - **This is your primary use case - 80%+ of trials**

2. **Dialogue Loops**
   - Multi-turn conversations with branching
   - Next question depends on answer content (not just correctness)

3. **Adaptive Question Logic Module**
   - File: `adaptiveQuestionLogic.js` (imported in unitEngine.js:19)
   - Custom logic that may branch based on answer patterns

---

## Recommended Solutions

### Option 1: Remove Prefetching from Phase 2 ⭐ RECOMMENDED

**Change:** Remove `_prefetchNextTrial()` from TransitionController

**Why:**
- Eliminates safety concern entirely
- Phase 1 fixes (CSS transitions, batched DOM updates) still provide 80% improvement
- Phase 2's state machine coordination still valuable for eliminating race conditions
- Prefetching was "nice to have" optimization, not core requirement

**Implementation:**
```javascript
// In TransitionController.js - REMOVE these sections:

// DELETE this method entirely:
async _prefetchNextTrial() { ... }

// DELETE this call from _enterState('CLEANING_UP'):
case 'CLEANING_UP':
  this._resetDOM();
  // this._prefetchNextTrial();  ← DELETE THIS LINE
  Meteor.setTimeout(() => {
    this.transition('LOADING_TRIAL');  // No prefetch data passed
  }, 100);
  break;

// DELETE this conditional from _enterState('LOADING_TRIAL'):
case 'LOADING_TRIAL':
  this.$cardWrapper.addClass('card-content-hidden');

  // DELETE THIS BLOCK:
  // if (this.nextTrialData) {
  //   data.trialData = this.nextTrialData;
  //   this.nextTrialData = null;
  // }

  Session.set('displayReady', false);
  // ... rest unchanged ...
```

**Outcome:**
- TransitionController manages transition **choreography** only
- Trial selection remains in `engine.selectNextCard()` where it belongs
- No risk of incorrect predictions

---

### Option 2: Conditional Prefetching (Schedule Only)

**Change:** Only prefetch for schedule units

**Implementation:**
```javascript
async _prefetchNextTrial() {
  const unitType = Session.get('unitType');

  if (unitType === SCHEDULE_UNIT) {
    // SAFE: Schedule is pre-computed
    try {
      const questionIndex = Session.get('questionIndex');
      const schedule = Session.get('schedule');

      if (schedule && schedule.q && schedule.q[questionIndex]) {
        this.nextTrialData = schedule.q[questionIndex];

        // Preload image if exists
        const nextCard = this.nextTrialData;
        if (nextCard.imageUrl) {
          const img = new Image();
          img.src = nextCard.imageUrl;
        }
      }
    } catch (error) {
      console.warn('Schedule prefetch failed', error);
      this.nextTrialData = null;
    }
  } else {
    // UNSAFE: Model unit uses adaptive selection
    // Do NOT prefetch - next card unknown until current answer processed
    console.log('Skipping prefetch for adaptive unit type:', unitType);
    this.nextTrialData = null;
  }
}
```

**Pros:**
- Still gets some benefit for assessment sessions
- Safer than blind prefetching

**Cons:**
- More complex code
- Marginal benefit (schedule units already fast - no calculation needed)
- 80%+ of trials are model units (no benefit there)

---

### Option 3: Probabilistic Asset Preloading

**Change:** Preload images for top N most-likely cards

**Implementation:**
```javascript
async _prefetchNextTrial() {
  const unitType = Session.get('unitType');

  if (unitType === MODEL_UNIT) {
    // Calculate probabilities for ALL cards (read-only, no state mutation)
    try {
      const topCards = await Meteor.callAsync('getTopProbableCards', {
        userId: Meteor.userId(),
        tdfId: Session.get('currentTdfId'),
        topN: 3  // Preload top 3 most likely
      });

      // Preload images for top 3 cards (parallel)
      const preloadPromises = topCards.map(card => {
        if (card.imageUrl) {
          const img = new Image();
          img.src = card.imageUrl;
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;  // Fail gracefully
          });
        }
        return Promise.resolve();
      });

      await Promise.allSettled(preloadPromises);
      console.log('Preloaded assets for top 3 probable cards');
    } catch (error) {
      console.warn('Probabilistic prefetch failed', error);
    }
  }
}
```

**Server method:**
```javascript
Meteor.methods({
  getTopProbableCards: async function({ userId, tdfId, topN }) {
    // Call engine.calculateCardProbabilities() in READ-ONLY mode
    // Return top N cards by probability (without selecting/mutating state)
    // Returns: [{ clusterIndex, stimIndex, probability, imageUrl }, ...]
  }
});
```

**Pros:**
- Actually useful for adaptive units
- If top 3 cards are 70% likely, we get 70% cache hit rate
- Doesn't predict exact next card (avoids safety issue)

**Cons:**
- Requires new server method
- May preload unused assets (bandwidth cost)
- Complex to implement correctly (must not mutate engine state)
- Cache hit rate depends on probability distribution spread

---

## Recommendation: Option 1 (Remove Prefetching)

**Rationale:**

1. **Phase 1 is the big win** (80% improvement from CSS transitions + batched DOM)
2. **Phase 2's value is coordination** (state machine prevents race conditions)
3. **Prefetching is marginal** (~5-10% improvement at best)
4. **Risk > Reward** for adaptive engines

### Updated Phase 2 Scope:

**KEEP:**
- ✅ TransitionController state machine
- ✅ Coordinated enter/exit animations
- ✅ Batched DOM updates in transitions
- ✅ Focus management
- ✅ ARIA announcements

**REMOVE:**
- ❌ `_prefetchNextTrial()` method
- ❌ `nextTrialData` property
- ❌ `getNextCardData` server method (from Implementation Guide)
- ❌ All asset prefetching logic

**Result:**
- Phase 2 still delivers smooth transitions (main goal achieved)
- Zero risk of incorrect trial selection
- Simpler codebase (less code to maintain)

---

## Updated Implementation Guide

### Changes to Phase 2:

**File:** `mofacts/client/lib/TransitionController.js`

**Line ~130-165 - DELETE `_prefetchNextTrial()` method:**
```javascript
// DELETE THIS ENTIRE METHOD:
/*
async _prefetchNextTrial() {
  try {
    const nextCard = await Meteor.callAsync('getNextCardData', {...});
    this.nextTrialData = nextCard;
    // ... asset preloading ...
  } catch (error) { ... }
}
*/
```

**Line ~95-105 - REMOVE prefetch from CLEANING_UP state:**
```javascript
case 'CLEANING_UP':
  // Reset for next trial
  this._resetDOM();

  // REMOVE: this._prefetchNextTrial();

  // Immediately transition to next trial
  Meteor.setTimeout(() => {
    this.transition('LOADING_TRIAL');  // No data parameter
  }, 100);
  break;
```

**Line ~45-60 - REMOVE nextTrialData handling from LOADING_TRIAL:**
```javascript
case 'LOADING_TRIAL':
  // Fade out current trial, load next trial data
  this.$cardWrapper.addClass('card-content-hidden');

  // REMOVE THIS BLOCK:
  /*
  if (this.nextTrialData) {
    data.trialData = this.nextTrialData;
    this.nextTrialData = null;
  }
  */

  // Set Session vars that template helpers depend on
  Session.set('displayReady', false);
  Session.set('currentDisplay', data.display || {});
  Session.set('buttonList', data.buttonList || []);

  await this._waitForTemplateUpdate();
  break;
```

**File:** `mofacts/server/methods.js`

**DO NOT ADD `getNextCardData` method** (remove from Implementation Guide)

---

## Testing After Fix

### Verify Adaptive Selection Still Works:

1. **Test Model Unit:**
   - Start lesson with learningsession unit
   - Answer first trial correctly → note which card appears next
   - Restart lesson, answer first trial incorrectly → note which card appears
   - **Expected:** Different cards selected based on correctness

2. **Test Schedule Unit:**
   - Start lesson with assessmentsession unit
   - Answer first trial correctly
   - Restart, answer first trial incorrectly
   - **Expected:** Same next card regardless (pre-computed schedule)

3. **Verify No Regression:**
   - Transitions still smooth (Phase 1 fixes provide this)
   - No race conditions (state machine coordination provides this)
   - Feedback displays correctly
   - Focus moves to inputs correctly

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| **Your Concern** | ✅ Valid | Prefetching is unsafe for adaptive engines |
| **Phase 1** | ✅ Safe | CSS transitions don't affect trial selection |
| **Phase 2 (original)** | ❌ Unsafe | Prefetching assumes deterministic next trial |
| **Phase 2 (revised)** | ✅ Safe | Remove prefetching, keep state machine |
| **Phase 3** | ✅ Safe | Accessibility features don't affect logic |

**Action Items:**
1. ✅ Remove `_prefetchNextTrial()` from TransitionController.js
2. ✅ Remove `getNextCardData` from server methods.js
3. ✅ Update Implementation Guide to reflect changes
4. ✅ Update Checklist to remove prefetching steps
5. ✅ Add warning in Audit Report about adaptive selection

**Expected Outcome:**
- Phase 2 still provides **smooth, coordinated transitions**
- Zero risk to **adaptive learning algorithms**
- Simpler code, easier to maintain

---

**Thank you for catching this!** This is exactly the kind of domain-specific knowledge that requires careful review. The adaptive spaced repetition is a core feature of MoFaCTS and must not be compromised.

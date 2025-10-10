# MoFaCTS Transition Implementation Guide

**Related:** [FOUC Audit Report](./FOUC_AUDIT_REPORT.md)

This guide provides step-by-step instructions for implementing smooth, elegant trial transitions without FOUC.

---

## Implementation Phases

### Phase 1: Immediate Fixes (High Impact, 1-2 days)
- Replace `displayReady` conditional rendering with CSS
- Add critical CSS inline
- Batch DOM updates with requestAnimationFrame

### Phase 2: TransitionController (Medium Term, 3-5 days)
- Centralized state machine for transitions
- Coordinated enter/exit animations
- Prefetch next trial data

### Phase 3: Accessibility (Medium Term, 2-3 days)
- Reduced motion support
- ARIA live regions
- Focus management

### Phase 4: Performance Optimization (Long Term, 1-2 weeks)
- Service worker caching
- IndexedDB stimulus storage
- Consider framework migration

---

## Phase 1: Immediate Fixes

### Fix 1: Replace `displayReady` Conditional with CSS ⚡ HIGHEST PRIORITY

**Problem:** `{{#if displayReady}}` causes Blaze to destroy/rebuild entire DOM tree

**Solution:** Keep DOM in place, toggle CSS classes for visibility

#### Step 1.1: Update card.html Template

**File:** `mofacts/client/views/experiment/card.html`

**Before (Lines 68-291):**
```handlebars
{{#if displayReady}}
<div id="userInteractionContainer" class="smooth-transition" hidden>
    <div class="text-center {{fontSizeClass}} smooth-transition" id="UserInteraction" hidden></div>
    ...
</div>
{{/if}}
```

**After:**
```handlebars
<!-- Remove {{#if displayReady}} wrapper, add id for CSS targeting -->
<div id="cardContentWrapper" class="{{#unless displayReady}}card-content-hidden{{/unless}}">
  <div id="userInteractionContainer" class="smooth-transition" hidden>
      <div class="text-center {{fontSizeClass}} smooth-transition" id="UserInteraction" hidden></div>
      ...
  </div>
</div>
```

**Changes:**
1. Remove `{{#if displayReady}}` on line 68
2. Add wrapper div with id `cardContentWrapper`
3. Use `{{#unless displayReady}}card-content-hidden{{/unless}}` for CSS class toggling
4. Remove closing `{{/if}}` on line 291

#### Step 1.2: Add CSS Classes

**File:** `mofacts/public/styles/classic.css`

Already exists (lines 183-192)! Just verify:

```css
/* Smooth trial transitions - cross-fade approach */
#cardContentWrapper {
    opacity: 1;
    transition: opacity 0.25s ease-in-out;
    will-change: opacity;
}

#cardContentWrapper.card-content-hidden {
    opacity: 0;
    pointer-events: none; /* Prevent interaction during transition */
}
```

#### Step 1.3: Update card.js Helper

**File:** `mofacts/client/views/experiment/card.js`

**Find (Line 871-872):**
```javascript
'displayReady': function() {
  return Session.get('displayReady');
}
```

**Keep unchanged** - template now uses it for class toggling, not conditional rendering

#### Step 1.4: Test

1. Start Meteor app: `meteor`
2. Navigate to `/card` route
3. Observe trial transitions - should see smooth fade instead of flash
4. Check browser DevTools → Performance tab → Record during trial
5. Verify no large Layout Shift entries (< 0.05 per trial)

**Expected Improvement:**
- Flashes reduced from 4-5 to 0-1 per trial
- CLS reduced from 0.6-0.75 to < 0.1

---

### Fix 2: Batch DOM Updates with requestAnimationFrame

**Problem:** Multiple jQuery operations cause separate paint cycles

**Solution:** Group related DOM changes into single rAF callback

#### Step 2.1: Create Utility Function

**File:** `mofacts/client/views/experiment/card.js`

**Add after smoothHide (line 66):**
```javascript
/*
 * Batch multiple DOM operations into single paint cycle
 * Usage: batchDOMUpdate(() => { /* all DOM changes */ });
 */
function batchDOMUpdate(fn) {
  requestAnimationFrame(() => {
    Tracker.nonreactive(() => {
      fn();
    });
  });
}
```

**Explanation:**
- `requestAnimationFrame`: Waits for next browser paint cycle
- `Tracker.nonreactive`: Prevents triggering reactive updates during batch
- Groups multiple DOM manipulations into single reflow/repaint

#### Step 2.2: Update showUserFeedback Function

**File:** `mofacts/client/views/experiment/card.js`

**Find (Lines 2006-2023):**
```javascript
// Hide inputs immediately
$('.input-box').attr('hidden', '').css('opacity', '1');
$('#multipleChoiceContainer').attr('hidden', '').css('opacity', '1');

// Trigger reactive autorun
cardState.set('feedbackPosition', feedbackDisplayPosition);
cardState.set('inFeedback', true);

// Change layout
$('#displayContainer').removeClass('col-md-6').addClass('mx-auto');
$('#displaySubContainer').addClass(uiSettings.textInputDisplay);

// Show correct answer
$('#correctAnswerDisplayContainer').html(correctAnswer).removeClass('d-none');
```

**Replace with:**
```javascript
// Batch all non-reactive DOM updates
batchDOMUpdate(() => {
  // Hide inputs
  $('.input-box').attr('hidden', '').css('opacity', '1');
  $('#multipleChoiceContainer').attr('hidden', '').css('opacity', '1');

  // Change layout
  $('#displayContainer').removeClass('col-md-6').addClass('mx-auto');
  $('#displaySubContainer').addClass(uiSettings.textInputDisplay);

  // Show correct answer
  $('#correctAnswerDisplayContainer').html(correctAnswer).removeClass('d-none');
});

// Trigger reactive updates AFTER DOM batch (next tick)
Meteor.setTimeout(() => {
  cardState.set('feedbackPosition', feedbackDisplayPosition);
  cardState.set('inFeedback', true);
}, 0);
```

**Why separate reactive updates:**
- DOM changes happen in single rAF (no intermediate paint)
- Reactive updates triggered after, causing second (controlled) paint
- Total paints: 2 instead of 5-6

#### Step 2.3: Update newQuestionHandler Function

**File:** `mofacts/client/views/experiment/card.js`

**Find (Lines 2963-2966):**
```javascript
if (isButtonTrial) {
  smoothHide($('#textEntryRow'));
  setUpButtonTrial();
} else {
  smoothShow($('#textEntryRow'));
}
```

**Replace with:**
```javascript
batchDOMUpdate(() => {
  if (isButtonTrial) {
    smoothHide($('#textEntryRow'));
    setUpButtonTrial();
  } else {
    smoothShow($('#textEntryRow'));
  }
});
```

#### Step 2.4: Update cardEnd Function

**File:** `mofacts/client/views/experiment/card.js`

**Find (Lines 2318-2323):**
```javascript
hideUserFeedback();
cardState.set('feedbackPosition', null);
cardState.set('inFeedback', false);
$('#CountdownTimerText').text("Continuing...");
$('#userLowerInteraction').html('');
$('#userAnswer').val('');
```

**Replace with:**
```javascript
batchDOMUpdate(() => {
  hideUserFeedback();
  $('#CountdownTimerText').text("Continuing...");
  $('#userLowerInteraction').html('');
  $('#userAnswer').val('');
});

// Reset state after DOM cleanup
Meteor.setTimeout(() => {
  cardState.set('feedbackPosition', null);
  cardState.set('inFeedback', false);
}, 0);
```

---

### Fix 3: Inline Critical CSS

**Problem:** External CSS blocks first paint for 1-2 seconds

**Solution:** Extract critical styles to `<head>`, defer non-critical

#### Step 3.1: Extract Critical CSS

Create file: `mofacts/client/lib/criticalCSS.html`

```html
<template name="criticalCSS">
<style>
/* Critical CSS - inlined for fast first paint */

/* Layout essentials */
body{background-color:#F2F2F2;color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;}
#cardContainer{background-color:#F2F2F2;contain:layout style paint;}
.container{max-width:1200px;margin:0 auto;padding:0 15px;}

/* FOUC prevention - HIGHEST PRIORITY */
.card-loading{opacity:0;transition:opacity 0.2s ease-in;}
.card-ready{opacity:1;}
#cardContentWrapper{opacity:1;transition:opacity 0.25s ease-in-out;will-change:opacity;}
#cardContentWrapper.card-content-hidden{opacity:0;pointer-events:none;}

/* Hidden elements */
#userInteractionContainer[hidden],
#UserInteraction[hidden],
#forceCorrectionEntry[hidden],
#feedbackOverrideContainer[hidden],
#CountdownTimerText[hidden]{opacity:0;display:block!important;visibility:hidden;height:0;overflow:hidden;}

/* Basic transitions */
.smooth-transition{transition:opacity 0.2s ease-in-out,transform 0.2s ease-in-out;will-change:opacity;}
.fade-in{opacity:0;transition:opacity 0.15s ease-in;}
.fade-in.visible{opacity:1;}

/* Button basics */
.btn{background-color:#7ed957!important;border-color:#7ed957!important;color:#000000;border-radius:8px;padding:10px;min-height:44px;}
.alert{background-color:#d9d9d9;padding:1rem;margin:0.75rem 0;border-radius:0px;}

/* Prevent layout shift */
.input-box{box-sizing:border-box;transition:opacity 0.1s ease-in-out;will-change:opacity;}
#postCardContainer{min-height:1em;}
#multipleChoiceTable{min-height:100px;}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .smooth-transition,.fade-in,#cardContentWrapper,#progressbar{transition:none!important;animation:none!important;}
}
</style>
</template>
```

#### Step 3.2: Include in Head

**File:** `mofacts/client/index.html`

**Before line 17 (before Bootstrap link):**
```html
<head>
  <meta charset="utf-8">
  <title>mofacts_app</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">

  <!-- DNS prefetch for external CDNs -->
  ...

  <!-- CRITICAL CSS - Inline for fast first paint -->
  {{> criticalCSS}}

  <!-- Non-critical CSS loaded normally -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" ...>
  ...
</head>
```

#### Step 3.3: Defer Non-Critical CSS (Optional)

For further optimization, load Bootstrap/FontAwesome asynchronously:

**Replace:**
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" ...>
```

**With:**
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css"
      rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" ...></noscript>
```

**Benefit:** First paint 500-1000ms faster (2.5s → 1.5-2.0s FCP)

---

## Phase 2: TransitionController Module

### Architecture Overview

```
TransitionController (State Machine)
    │
    ├─ State: IDLE
    ├─ State: LOADING_TRIAL      (prepareCard)
    ├─ State: SHOWING_PRESTIMULUS (optional 2s display)
    ├─ State: SHOWING_QUESTION    (user input phase)
    ├─ State: SHOWING_FEEDBACK    (correctness display)
    └─ State: CLEANING_UP         (cardEnd)

Each state has:
  - enter(): Setup for this state
  - exit(): Cleanup before next state
  - animate(): CSS class management for transitions
```

### Implementation

#### Step 1: Create TransitionController Class

**File:** `mofacts/client/lib/TransitionController.js` (new file)

```javascript
import { ReactiveDict } from 'meteor/reactive-dict';

/**
 * TransitionController - Manages smooth trial transitions
 *
 * Replaces scattered Session.set('displayReady', ...) calls with
 * coordinated state machine that batches DOM updates and animations.
 *
 * Usage:
 *   const controller = new TransitionController();
 *   controller.transition('LOADING_TRIAL', { trialData });
 *   controller.transition('SHOWING_QUESTION');
 */
export class TransitionController {
  constructor() {
    this.state = new ReactiveDict('transitionState');
    this.currentState = 'IDLE';
    this.nextTrialData = null; // Prefetched data

    // Animation timing constants (ms)
    this.FADE_DURATION = 250;
    this.PRESTIMULUS_DURATION = 2000;
    this.FEEDBACK_MIN_DURATION = 1000;

    // DOM element cache for performance
    this.$cardWrapper = null;
    this.$userInteraction = null;
    this.$feedbackOverride = null;
    this.$displayContainer = null;

    // Initialize
    this.cacheElements();
    this.state.set('current', 'IDLE');
    this.state.set('transitioning', false);
  }

  /**
   * Cache DOM elements on first access to avoid repeated jQuery queries
   */
  cacheElements() {
    this.$cardWrapper = $('#cardContentWrapper');
    this.$userInteraction = $('#userInteractionContainer');
    this.$feedbackOverride = $('#feedbackOverrideContainer');
    this.$displayContainer = $('#displayContainer');

    // Re-cache if elements don't exist (template not rendered yet)
    if (this.$cardWrapper.length === 0) {
      Meteor.setTimeout(() => this.cacheElements(), 100);
    }
  }

  /**
   * Transition to new state with optional data
   *
   * @param {string} newState - Target state name
   * @param {object} data - Optional data for state (e.g., trial info)
   * @returns {Promise} Resolves when transition animation completes
   */
  async transition(newState, data = {}) {
    if (this.state.get('transitioning')) {
      console.warn('TransitionController: Transition already in progress, queuing...');
      // Queue this transition to run after current one completes
      return new Promise(resolve => {
        const checkInterval = Meteor.setInterval(() => {
          if (!this.state.get('transitioning')) {
            Meteor.clearInterval(checkInterval);
            resolve(this.transition(newState, data));
          }
        }, 50);
      });
    }

    console.log(`TransitionController: ${this.currentState} → ${newState}`, data);

    this.state.set('transitioning', true);

    // Exit current state
    await this._exitState(this.currentState);

    // Enter new state
    this.currentState = newState;
    this.state.set('current', newState);
    await this._enterState(newState, data);

    this.state.set('transitioning', false);
  }

  /**
   * Exit current state (cleanup, fade-out animations)
   */
  async _exitState(state) {
    const animations = [];

    switch (state) {
      case 'IDLE':
        // No cleanup needed
        break;

      case 'LOADING_TRIAL':
        // Trial data loaded, fade out loading state
        animations.push(this._fadeOut(this.$cardWrapper));
        break;

      case 'SHOWING_PRESTIMULUS':
        // Prestimulus done, no animation (already faded)
        break;

      case 'SHOWING_QUESTION':
        // User answered or timed out, fade out question
        animations.push(this._fadeOut(this.$userInteraction));
        break;

      case 'SHOWING_FEEDBACK':
        // Feedback timeout expired, fade out feedback
        animations.push(this._fadeOut(this.$feedbackOverride));
        animations.push(this._fadeOut($('#correctAnswerDisplayContainer')));
        break;

      case 'CLEANING_UP':
        // Cleanup done, ready for next trial
        break;
    }

    // Wait for all exit animations to complete
    await Promise.all(animations);
  }

  /**
   * Enter new state (setup, fade-in animations)
   */
  async _enterState(state, data) {
    const animations = [];

    switch (state) {
      case 'IDLE':
        // Reset everything
        this._resetDOM();
        break;

      case 'LOADING_TRIAL':
        // Fade out current trial, load next trial data
        this.$cardWrapper.addClass('card-content-hidden');

        // If next trial already prefetched, use it
        if (this.nextTrialData) {
          data.trialData = this.nextTrialData;
          this.nextTrialData = null;
        }

        // Set Session vars that template helpers depend on
        Session.set('displayReady', false);
        Session.set('currentDisplay', data.display || {});
        Session.set('buttonList', data.buttonList || []);

        // Wait for template to update with new data
        await this._waitForTemplateUpdate();
        break;

      case 'SHOWING_PRESTIMULUS':
        // Show prestimulus for configured duration
        Session.set('displayReady', true);
        this.$cardWrapper.removeClass('card-content-hidden');

        // Auto-transition after delay
        Meteor.setTimeout(() => {
          this.transition('SHOWING_QUESTION');
        }, data.duration || this.PRESTIMULUS_DURATION);
        break;

      case 'SHOWING_QUESTION':
        // Show question, enable input
        Session.set('displayReady', true);
        this.$cardWrapper.removeClass('card-content-hidden');
        animations.push(this._fadeIn(this.$userInteraction));

        // Enable input after fade-in
        await Promise.all(animations);
        this._enableInput();
        break;

      case 'SHOWING_FEEDBACK':
        // Hide input, show feedback
        this._disableInput();

        requestAnimationFrame(() => {
          // Batch DOM updates
          $('.input-box').attr('hidden', '');
          $('#multipleChoiceContainer').attr('hidden', '');
          $('#displayContainer').removeClass('col-md-6').addClass('mx-auto');

          // Show feedback
          const feedbackHtml = data.feedbackHtml || '';
          this.$feedbackOverride.html(feedbackHtml);
        });

        animations.push(this._fadeIn(this.$feedbackOverride));

        // Auto-transition after feedback duration
        const feedbackDuration = data.duration || this.FEEDBACK_MIN_DURATION;
        Meteor.setTimeout(() => {
          this.transition('CLEANING_UP');
        }, feedbackDuration);
        break;

      case 'CLEANING_UP':
        // Reset for next trial
        this._resetDOM();

        // Prefetch next trial data
        this._prefetchNextTrial();

        // Immediately transition to next trial
        Meteor.setTimeout(() => {
          this.transition('LOADING_TRIAL', { trialData: this.nextTrialData });
        }, 100);
        break;
    }

    await Promise.all(animations);
  }

  /**
   * Fade out element (returns Promise that resolves when animation done)
   */
  _fadeOut($el) {
    return new Promise(resolve => {
      if (!$el || $el.length === 0) {
        resolve();
        return;
      }

      $el.css('opacity', '1').animate({ opacity: 0 }, this.FADE_DURATION, function() {
        $(this).attr('hidden', '');
        resolve();
      });
    });
  }

  /**
   * Fade in element (returns Promise that resolves when animation done)
   */
  _fadeIn($el) {
    return new Promise(resolve => {
      if (!$el || $el.length === 0) {
        resolve();
        return;
      }

      $el.css('opacity', '0').removeAttr('hidden').animate({ opacity: 1 }, this.FADE_DURATION, function() {
        resolve();
      });
    });
  }

  /**
   * Wait for Blaze template to update after reactive data changes
   */
  _waitForTemplateUpdate() {
    return new Promise(resolve => {
      Tracker.afterFlush(() => {
        // Give browser one frame to paint
        requestAnimationFrame(() => resolve());
      });
    });
  }

  /**
   * Reset DOM to clean state for next trial
   */
  _resetDOM() {
    requestAnimationFrame(() => {
      this.$cardWrapper.removeClass('card-content-hidden');
      this.$userInteraction.attr('hidden', '').css('opacity', '1');
      this.$feedbackOverride.attr('hidden', '').html('');
      $('#correctAnswerDisplayContainer').addClass('d-none').html('');
      $('#userLowerInteraction').html('');
      $('#userAnswer').val('');
      $('.input-box').removeAttr('hidden');
      $('#multipleChoiceContainer').removeAttr('hidden');
      $('#displayContainer').removeClass('mx-auto').addClass('col-md-6');
    });
  }

  /**
   * Enable user input (text field or buttons)
   */
  _enableInput() {
    requestAnimationFrame(() => {
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', false);
      $('#confirmButton').removeAttr('hidden');

      // Focus text input if present
      const $textInput = $('#userAnswer');
      if ($textInput.length > 0 && $textInput.is(':visible')) {
        $textInput.focus();
      }
    });
  }

  /**
   * Disable user input
   */
  _disableInput() {
    requestAnimationFrame(() => {
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', true);
      $('#confirmButton').attr('hidden', '');
    });
  }

  /**
   * Prefetch next trial data in background
   */
  async _prefetchNextTrial() {
    try {
      // Call engine to get next trial (without advancing state)
      const nextCard = await Meteor.callAsync('getNextCardData', {
        currentClusterIndex: Session.get('currentClusterIndex'),
        currentStimulusIndex: Session.get('currentStimulusIndex'),
        userId: Meteor.userId(),
        tdfId: Session.get('currentTdfId')
      });

      this.nextTrialData = nextCard;

      // Preload images/videos in background
      if (nextCard && nextCard.display && nextCard.display.imageUrl) {
        const img = new Image();
        img.src = nextCard.display.imageUrl;
      }

      console.log('TransitionController: Next trial prefetched', nextCard);
    } catch (error) {
      console.warn('TransitionController: Failed to prefetch next trial', error);
      this.nextTrialData = null;
    }
  }

  /**
   * Get current state (reactive)
   */
  getCurrentState() {
    return this.state.get('current');
  }

  /**
   * Check if transitioning (reactive)
   */
  isTransitioning() {
    return this.state.get('transitioning');
  }
}

// Export singleton instance
export const transitionController = new TransitionController();
```

#### Step 2: Integrate TransitionController into card.js

**File:** `mofacts/client/views/experiment/card.js`

**Add import at top:**
```javascript
import { transitionController } from '../../lib/TransitionController';
```

**Replace prepareCard function (line 2906):**
```javascript
async function prepareCard() {
  console.log('prepareCard called');

  // OLD: Session.set('displayReady', false);
  // NEW: Use transition controller
  await transitionController.transition('LOADING_TRIAL');

  // ... rest of function unchanged ...

  // Instead of calling newQuestionHandler directly, let controller handle it
  const trialData = await engine.selectNextCard();
  await transitionController.transition('SHOWING_QUESTION', { trialData });
}
```

**Replace userAnswerFeedback function (line 1735):**
```javascript
async function userAnswerFeedback() {
  // ... assessment logic unchanged ...

  const feedbackHtml = determineFeedbackHTML(userCorrect, displayAnswer);
  const feedbackDuration = userCorrect ? correctPromptMS : reviewStudyMS;

  // OLD: showUserFeedback()
  // NEW: Use transition controller
  await transitionController.transition('SHOWING_FEEDBACK', {
    feedbackHtml,
    duration: feedbackDuration
  });
}
```

**Replace cardEnd function (line 2317):**
```javascript
async function cardEnd() {
  console.log('cardEnd called');

  // OLD: hideUserFeedback(); prepareCard();
  // NEW: Use transition controller
  await transitionController.transition('CLEANING_UP');

  // Controller will auto-transition to LOADING_TRIAL
}
```

---

## Phase 3: Accessibility Features

### Feature 1: Reduced Motion Support

**Already implemented in critical CSS** (see Phase 1, Step 3.1)

Verify with:
1. Open DevTools → Rendering tab
2. Check "Emulate CSS media feature prefers-reduced-motion: reduce"
3. Navigate through trials - should see instant transitions, no animations

### Feature 2: ARIA Live Regions

#### Step 1: Add Live Region to card.html

**File:** `mofacts/client/views/experiment/card.html`

**Add after line 67 (before card content):**
```handlebars
<!-- Screen reader announcements for trial state changes -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only" id="trialStatusAnnouncer">
  {{trialStatusMessage}}
</div>

<div role="alert" aria-live="assertive" aria-atomic="true" class="sr-only" id="feedbackAnnouncer">
  {{feedbackMessage}}
</div>
```

**Add CSS for `.sr-only`:**
```css
/* Screen reader only - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

#### Step 2: Add Template Helpers

**File:** `mofacts/client/views/experiment/card.js`

**Add to Template.card.helpers (line 750+):**
```javascript
'trialStatusMessage': function() {
  const state = transitionController.getCurrentState();
  const questionNum = Session.get('currentStimulusIndex') + 1;
  const totalQuestions = Session.get('totalStimuli');

  switch (state) {
    case 'LOADING_TRIAL':
      return `Loading question ${questionNum} of ${totalQuestions}`;
    case 'SHOWING_PRESTIMULUS':
      return 'Please read the information shown';
    case 'SHOWING_QUESTION':
      const isButtonTrial = Session.get('buttonTrial');
      if (isButtonTrial) {
        return `Question ${questionNum} of ${totalQuestions}. Select your answer from the choices shown.`;
      } else {
        return `Question ${questionNum} of ${totalQuestions}. Type your answer in the text field.`;
      }
    case 'SHOWING_FEEDBACK':
      return ''; // Feedback uses separate announcer
    default:
      return '';
  }
},

'feedbackMessage': function() {
  const state = transitionController.getCurrentState();
  if (state !== 'SHOWING_FEEDBACK') return '';

  const userCorrect = Session.get('userCorrect');
  const displayAnswer = Session.get('displayAnswer');

  if (userCorrect) {
    return 'Correct!';
  } else {
    return `Incorrect. The correct answer is: ${displayAnswer}`;
  }
}
```

### Feature 3: Focus Management

#### Step 1: Update TransitionController

**File:** `mofacts/client/lib/TransitionController.js`

**Add to `_enableInput()` method:**
```javascript
_enableInput() {
  requestAnimationFrame(() => {
    $('#userAnswer, #multipleChoiceContainer button').prop('disabled', false);
    $('#confirmButton').removeAttr('hidden');

    // Smart focus management
    const $textInput = $('#userAnswer');
    const $firstButton = $('#multipleChoiceContainer button:first');

    if ($textInput.length > 0 && $textInput.is(':visible')) {
      // Text trial - focus input
      $textInput.focus();

      // Announce input mode to screen readers
      $textInput.attr('aria-label', 'Type your answer here. Press Enter to submit.');
    } else if ($firstButton.length > 0) {
      // Button trial - focus first button
      $firstButton.focus();

      // Set up keyboard navigation hints
      $('#multipleChoiceContainer').attr('role', 'radiogroup');
      $('#multipleChoiceContainer').attr('aria-label', 'Answer choices');
      $('#multipleChoiceContainer button').each(function(index) {
        $(this).attr('role', 'radio');
        $(this).attr('aria-checked', 'false');
      });
    }
  });
}
```

**Add to `_disableInput()` method:**
```javascript
_disableInput() {
  requestAnimationFrame(() => {
    // Store current focus before disabling
    const activeElement = document.activeElement;
    const focusedId = activeElement ? activeElement.id : null;
    Session.set('lastFocusedElement', focusedId);

    $('#userAnswer, #multipleChoiceContainer button').prop('disabled', true);
    $('#confirmButton').attr('hidden', '');

    // Move focus to feedback container
    $('#feedbackOverrideContainer').attr('tabindex', '-1').focus();
  });
}
```

**Add method to restore focus:**
```javascript
/**
 * Restore focus after feedback (called when returning to question state)
 */
_restoreFocus() {
  const lastFocusedId = Session.get('lastFocusedElement');

  if (lastFocusedId) {
    const $lastFocused = $('#' + lastFocusedId);
    if ($lastFocused.length > 0) {
      $lastFocused.focus();
      return;
    }
  }

  // Fallback: focus first interactive element
  this._enableInput();
}
```

---

## Phase 4: Data Prefetching

### Implementation

#### Step 1: Create Server Method for Next Trial Data

**File:** `mofacts/server/methods.js`

**Add method:**
```javascript
Meteor.methods({
  /**
   * Get next trial data without advancing user state
   * Used for prefetching during current trial
   */
  getNextCardData: async function({ currentClusterIndex, currentStimulusIndex, userId, tdfId }) {
    check(currentClusterIndex, Number);
    check(currentStimulusIndex, Number);
    check(userId, String);
    check(tdfId, String);

    // Simulate engine logic to get next card (read-only, no mutations)
    const tdf = Tdfs.findOne(tdfId);
    if (!tdf) return null;

    const stimuli = tdf.content.tdfs.tutor.unit[currentClusterIndex].stimuli;
    if (!stimuli) return null;

    const nextIndex = (currentStimulusIndex + 1) % stimuli.length;
    const nextStimulus = stimuli[nextIndex];

    // Return display data (text, images, buttons, etc.)
    return {
      display: {
        text: nextStimulus.stem || '',
        imageUrl: nextStimulus.imageUrl || null,
        videoUrl: nextStimulus.videoUrl || null
      },
      buttonList: nextStimulus.choices || [],
      answer: nextStimulus.answer || '',
      stimulusIndex: nextIndex
    };
  }
});
```

#### Step 2: Preload Images/Videos

**File:** `mofacts/client/lib/AssetPrefetcher.js` (new file)

```javascript
/**
 * AssetPrefetcher - Preloads images/videos in background
 *
 * Usage:
 *   AssetPrefetcher.preloadImage('/path/to/image.jpg');
 *   AssetPrefetcher.preloadVideo('/path/to/video.mp4');
 */
export const AssetPrefetcher = {
  // Cache of loaded assets (prevents duplicate loads)
  loadedAssets: new Set(),

  // Currently loading assets (promises)
  loadingAssets: new Map(),

  /**
   * Preload image in background
   * @param {string} url - Image URL
   * @returns {Promise<Image>} Resolves when image loaded
   */
  preloadImage(url) {
    if (!url) return Promise.resolve(null);

    // Already loaded
    if (this.loadedAssets.has(url)) {
      return Promise.resolve(null);
    }

    // Currently loading
    if (this.loadingAssets.has(url)) {
      return this.loadingAssets.get(url);
    }

    // Start loading
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedAssets.add(url);
        this.loadingAssets.delete(url);
        console.log('AssetPrefetcher: Image loaded', url);
        resolve(img);
      };
      img.onerror = () => {
        this.loadingAssets.delete(url);
        console.warn('AssetPrefetcher: Image failed to load', url);
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });

    this.loadingAssets.set(url, promise);
    return promise;
  },

  /**
   * Preload video in background
   * @param {string} url - Video URL
   * @returns {Promise<void>} Resolves when video metadata loaded
   */
  preloadVideo(url) {
    if (!url) return Promise.resolve();

    if (this.loadedAssets.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingAssets.has(url)) {
      return this.loadingAssets.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        this.loadedAssets.add(url);
        this.loadingAssets.delete(url);
        console.log('AssetPrefetcher: Video metadata loaded', url);
        resolve();
      };
      video.onerror = () => {
        this.loadingAssets.delete(url);
        console.warn('AssetPrefetcher: Video failed to load', url);
        reject(new Error(`Failed to load video: ${url}`));
      };
      video.src = url;
    });

    this.loadingAssets.set(url, promise);
    return promise;
  },

  /**
   * Clear cache (useful between lessons)
   */
  clearCache() {
    this.loadedAssets.clear();
    this.loadingAssets.clear();
  }
};
```

#### Step 3: Integrate into TransitionController

**File:** `mofacts/client/lib/TransitionController.js`

**Add import:**
```javascript
import { AssetPrefetcher } from './AssetPrefetcher';
```

**Update `_prefetchNextTrial()` method:**
```javascript
async _prefetchNextTrial() {
  try {
    const nextCard = await Meteor.callAsync('getNextCardData', {
      currentClusterIndex: Session.get('currentClusterIndex'),
      currentStimulusIndex: Session.get('currentStimulusIndex'),
      userId: Meteor.userId(),
      tdfId: Session.get('currentTdfId')
    });

    this.nextTrialData = nextCard;

    // Preload assets in parallel
    const preloadPromises = [];

    if (nextCard && nextCard.display) {
      if (nextCard.display.imageUrl) {
        preloadPromises.push(AssetPrefetcher.preloadImage(nextCard.display.imageUrl));
      }
      if (nextCard.display.videoUrl) {
        preloadPromises.push(AssetPrefetcher.preloadVideo(nextCard.display.videoUrl));
      }
    }

    // Wait for assets to preload (non-blocking)
    await Promise.allSettled(preloadPromises);

    console.log('TransitionController: Next trial prefetched with assets', nextCard);
  } catch (error) {
    console.warn('TransitionController: Failed to prefetch next trial', error);
    this.nextTrialData = null;
  }
}
```

---

## Testing Checklist

### Functionality Tests
- [ ] Trial transitions are smooth (no flashing)
- [ ] Button trials display correctly
- [ ] Text input trials display correctly
- [ ] Feedback appears/disappears smoothly
- [ ] Multiple choice buttons render without flash
- [ ] Images load without layout shift
- [ ] Videos play correctly
- [ ] Audio playback works
- [ ] Countdown timers display smoothly

### Accessibility Tests
- [ ] Screen reader announces trial state changes
- [ ] Screen reader announces feedback messages
- [ ] Focus moves to input field on new trial
- [ ] Focus moves to first button in button trials
- [ ] Focus returns after feedback
- [ ] Keyboard navigation works (Tab, Enter, Arrow keys)
- [ ] Reduced motion setting disables animations
- [ ] All interactive elements have min 44x44px touch target

### Performance Tests
- [ ] Lighthouse Performance Score > 85
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Time to Interactive (TTI) < 3.8s
- [ ] No long tasks > 50ms during transitions
- [ ] Memory usage stable (no leaks)

### Cross-Browser Tests
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)
- [ ] Test on slow 3G network throttling

---

## Rollback Plan

If issues occur, revert changes in reverse order:

1. **Remove TransitionController** (Phase 2)
   - Comment out TransitionController imports
   - Restore original prepareCard, userAnswerFeedback, cardEnd functions
   - Keep batchDOMUpdate improvements

2. **Remove Accessibility Features** (Phase 3)
   - Remove ARIA live regions from card.html
   - Remove focus management code
   - Keep reduced-motion CSS

3. **Remove Critical CSS** (Phase 1, Step 3)
   - Remove {{> criticalCSS}} from index.html
   - Keep all other Phase 1 improvements

4. **Restore displayReady Conditional** (Phase 1, Step 1)
   - Restore {{#if displayReady}} wrapper in card.html
   - Remove #cardContentWrapper div
   - Restore original template structure

---

## Next Steps

After implementing Phase 1-3:

1. **Measure improvement** with Lighthouse
2. **Gather user feedback** on transition smoothness
3. **Monitor error logs** for any new issues
4. **Consider Phase 4** (service worker, IndexedDB) if further optimization needed

---

**Questions or issues?** See [FOUC Audit Report](./FOUC_AUDIT_REPORT.md) for detailed analysis of root causes.

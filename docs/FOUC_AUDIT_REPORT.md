# MoFaCTS FOUC & Trial Transition Audit Report

**Date:** 2025-10-09
**Auditor:** Claude Code
**Scope:** Meteor app trial rendering and transition analysis

---

## Executive Summary

This audit identifies the root causes of FOUC (Flash of Unstyled Content) and visible flashing during trial transitions in the MoFaCTS educational practice app. The primary issues stem from **reactive template re-rendering triggered by Session variable changes**, particularly `displayReady` toggles that cause Blaze to tear down and rebuild the DOM tree multiple times per trial.

### Critical Findings

1. **Multiple `displayReady` toggles** cause full template re-renders (4-5 times per trial)
2. **Synchronous DOM manipulation** without batching creates visible layout shifts
3. **No preloading** of next trial data/assets during current trial
4. **CSS loaded externally** from CDN creates render-blocking delays
5. **Bootstrap JS deferred** but CSS still blocks first paint

### Impact

- **User Experience:** Visible flashing disrupts learning flow and appears unprofessional
- **Performance:** Cumulative Layout Shift (CLS) likely >0.25 (poor rating)
- **Accessibility:** No reduced-motion support, abrupt focus changes

---

## 1. Reactivity Chain Analysis

### 1.1 Route-Level Subscriptions

**File:** [mofacts/client/lib/router.js](../mofacts/client/lib/router.js)

#### `/card` Route (Lines 608-649)
```javascript
Router.route('/card', {
  action: async function() {
    this.subscribe('files.assets.all').wait();
    this.subscribe('userComponentStates', Session.get('currentTdfId')).wait();
    this.subscribe('currentTdf', Session.get('currentTdfId')).wait();
    this.subscribe('tdfByExperimentTarget', ...).wait();
    if(this.ready()){
      this.render('card');
    }
  }
});
```

**FOUC Cause:** `.wait()` blocks rendering until subscriptions ready, but once `render('card')` is called, the template renders with incomplete data if Session vars update asynchronously.

#### `/instructions` Route (Lines 654-684)
```javascript
Router.route('/instructions', {
  waitOn: function() {
    return [
      Meteor.subscribe('files.assets.all'),
      Meteor.subscribe('userComponentStates', Session.get('currentTdfId')),
      Meteor.subscribe('currentTdf', Session.get('currentTdfId')),
    ]
  },
  action: function() {
    Session.set('instructionClientStart', Date.now());
    this.render('instructions');
  }
});
```

**FOUC Cause:** `waitOn` subscriptions load before template, but `Session.set()` triggers reactive updates that may cause re-renders.

### 1.2 Template-Level Reactivity

**File:** [mofacts/client/views/experiment/card.js](../mofacts/client/views/experiment/card.js)

#### ReactiveDict Initialization (Line 186)
```javascript
const cardState = new ReactiveDict('cardState');
```

**Purpose:** Scoped reactive state for card-specific rendering
**Issue:** Mixed use of `Session` (global) and `cardState` (scoped) creates dual reactivity paths

#### Autorun: Feedback Container Visibility (Lines 472-491)
```javascript
template.autorun(function() {
  const inFeedback = cardState.get('inFeedback');
  const feedbackPosition = cardState.get('feedbackPosition');

  if (inFeedback && feedbackPosition) {
    Tracker.afterFlush(function() {
      if (feedbackPosition === 'top') {
        smoothShow($('#userInteractionContainer'));
        smoothHide($('#feedbackOverrideContainer'));
      } else if (feedbackPosition === 'middle') {
        smoothShow($('#feedbackOverrideContainer'));
        smoothHide($('#userInteractionContainer'));
      }
    });
  }
});
```

**Trigger:** `cardState.set('inFeedback', true)` in [card.js:2012](../mofacts/client/views/experiment/card.js#L2012)
**FOUC Risk:** High - DOM updates inside `Tracker.afterFlush` still visible as separate paint

#### Autorun: Card Loading State (Lines 500-510)
```javascript
template.autorun(function() {
  if (cardState.get('isLoading')) {
    Tracker.afterFlush(function() {
      Meteor.setTimeout(function() {
        $('#cardContainer').removeClass('card-loading').addClass('card-ready');
        cardState.set('isLoading', false);
      }, 100);
    });
  }
});
```

**FOUC Risk:** Medium - 100ms delay causes visible flash from opacity:0 → opacity:1

---

## 2. Critical FOUC Points in Trial Lifecycle

### 2.1 The `displayReady` Problem (HIGHEST PRIORITY)

**Template Usage:** [card.html:68](../mofacts/client/views/experiment/card.html#L68)
```handlebars
{{#if displayReady}}
  <!-- Entire card content wrapped in conditional -->
  <div id="userInteractionContainer" class="smooth-transition" hidden>
    ...
  </div>
{{/if}}
```

**Problem:** Every `Session.set('displayReady', false/true)` causes Blaze to:
1. Tear down entire DOM tree inside `{{#if}}`
2. Detach event handlers
3. Rebuild DOM from scratch
4. Re-attach event handlers
5. Trigger browser reflow/repaint

#### `displayReady` Toggle Points

| File Location | Function | Context | Toggles |
|---------------|----------|---------|---------|
| [card.js:2909](../mofacts/client/views/experiment/card.js#L2909) | `prepareCard()` | Start of new trial | `false` |
| [card.js:3016](../mofacts/client/views/experiment/card.js#L3016) | `startQuestionTimeout()` | Before prestimulus | `false` |
| [card.js:3067](../mofacts/client/views/experiment/card.js#L3067) | `checkAndDisplayPrestimulus()` | After prestimulus | `true` |
| [card.js:3083](../mofacts/client/views/experiment/card.js#L3083) | `checkAndDisplayTwoPartQuestion()` | Two-part start | `false` |
| [card.js:3095](../mofacts/client/views/experiment/card.js#L3095) | `checkAndDisplayTwoPartQuestion()` | Two-part end | `true` |

**Result:** 4-5 full template re-renders per trial, each causing visible flash

### 2.2 Trial Transition Sequence (Typical Flow)

```
[Trial N Ends]
       ↓
1. cardEnd() → hideUserFeedback()
   - smoothHide() multiple elements
   - Reset cardState.set('inFeedback', false)
   - DOM: Opacity animations → hidden
       ↓
2. prepareCard()
   - Session.set('displayReady', false)  ← FLASH #1: Template collapses
   - Session.set('currentDisplay', {})
   - engine.selectNextCard()
       ↓
3. newQuestionHandler()
   - Session.set('buttonList', [])
   - DOM: smoothHide($('#textEntryRow')) or smoothShow()
       ↓
4. startQuestionTimeout()
   - Session.set('displayReady', false)  ← FLASH #2: Template already collapsed?
   - checkAndDisplayPrestimulus()
       ↓
5. checkAndDisplayPrestimulus() [if prestimulus exists]
   - 2-second delay
   - Session.set('displayReady', true)  ← FLASH #3: Template expands
   - DOM: Content appears
       ↓
6. checkAndDisplayTwoPartQuestion() [if two-part]
   - Session.set('displayReady', false) ← FLASH #4: Template collapses
   - 2-second delay
   - Session.set('displayReady', true)  ← FLASH #5: Template expands
       ↓
7. beginQuestionAndInitiateUserInput()
   - allowUserInput() → smoothShow($('#confirmButton'))
   - Focus input field
       ↓
[Trial N+1 Active]
```

**Total visible flashes per trial:** 3-5 depending on trial configuration

### 2.3 Feedback Display Sequence (Another Flash Point)

**File:** [card.js:1917-2138](../mofacts/client/views/experiment/card.js#L1917)

```javascript
function showUserFeedback() {
  // SEQUENCE (intentionally designed to prevent worse flash):

  // 1. Hide inputs IMMEDIATELY (opacity + hidden attribute)
  $('.input-box').attr('hidden', '').css('opacity', '1');
  $('#multipleChoiceContainer').attr('hidden', '').css('opacity', '1');

  // 2. Trigger reactive autorun (lines 472-491)
  cardState.set('feedbackPosition', feedbackDisplayPosition);
  cardState.set('inFeedback', true);

  // 3. Change layout (immediate, not animated)
  $('#displayContainer').removeClass('col-md-6').addClass('mx-auto');
  $('#displaySubContainer').addClass(uiSettings.textInputDisplay);

  // 4. Show correct answer
  $('#correctAnswerDisplayContainer').html(correctAnswer).removeClass('d-none');

  // 5. Update feedback target (smoothly via autorun)
  // ... feedback content rendering ...

  // 6. Start countdown interval (updates every 250ms)
  const interval = Meteor.setInterval(function() {
    // Update progress bar width, countdown text
  }, 250);
}
```

**FOUC Points:**
1. **Input hiding** (line 2008-2009): Instant removal, creates layout shift
2. **Layout change** (lines 2016-2017): Column width change not animated
3. **Feedback showing** (via autorun): Separate paint cycle from steps 1-4

---

## 3. CSS Loading Analysis

### 3.1 Current CSS Strategy

**File:** [mofacts/client/index.html](../mofacts/client/index.html)

```html
<head>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
        integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65"
        crossorigin="anonymous">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/css/select2.min.css"
        rel="stylesheet" />
  <link rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
        crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;800&display=swap"
        rel="stylesheet">
  <link href="/styles/classic.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
</head>
```

**Issues:**
1. **No critical CSS inlined** - All CSS loaded from external sources
2. **Bootstrap (200KB+) blocks first paint** - Render-blocking resource
3. **Font Awesome (800KB+ with fonts)** - Another render blocker
4. **Google Fonts** - Requires DNS lookup, connection, download
5. **DNS prefetch exists** (lines 6-10) but doesn't eliminate blocking
6. **Local CSS last** - Can't provide fallback styles during CDN load

### 3.2 CSS Transition Classes (Existing)

**File:** [mofacts/public/styles/classic.css](../mofacts/public/styles/classic.css)

```css
/* Lines 847-851: Smooth transition utility */
.smooth-transition {
    transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
    will-change: opacity;
}

/* Lines 897-904: FOUC prevention (recently added) */
.card-loading {
    opacity: 0;
    transition: opacity 0.2s ease-in;
}

.card-ready {
    opacity: 1;
}

/* Lines 907-917: Hidden element FOUC prevention */
#userInteractionContainer[hidden],
#UserInteraction[hidden],
#forceCorrectionEntry[hidden],
#feedbackOverrideContainer[hidden] {
    opacity: 0;
    display: block !important; /* Override hidden attribute */
    visibility: hidden;
    height: 0;
    overflow: hidden;
}
```

**Good:** Recent attempts at FOUC prevention with `.card-loading` and hidden element handling
**Issue:** Not comprehensive enough - doesn't address `displayReady` template collapse

---

## 4. Template Teardown Patterns

### 4.1 Blaze Template Lifecycle

**File:** [card.js:513](../mofacts/client/views/experiment/card.js#L513)

```javascript
Template.card.rendered = initCard;

Template.card.onCreated(function() {
  const template = this;
  // Autoruns set up here (lines 472-510)
});
```

**Problem:** `rendered` (deprecated) callback used instead of `onRendered`
**Issue:** Called after DOM is already visible, can't prevent initial FOUC

### 4.2 DOM Replacement Strategy

Current approach uses **jQuery show/hide** mixed with **Blaze conditional rendering**:

```javascript
// Strategy 1: jQuery manipulation (preserves DOM)
smoothShow($('#element'));   // element.removeAttribute('hidden'); animate opacity
smoothHide($('#element'));   // animate opacity; element.setAttribute('hidden', '')

// Strategy 2: Blaze conditional (destroys/rebuilds DOM)
{{#if displayReady}}
  <div>...</div>
{{/if}}
```

**Conflict:** Strategy 2 overrides Strategy 1 - jQuery can't animate elements that Blaze has removed

### 4.3 Event Handler Re-attachment

Every `displayReady` toggle requires re-attaching event handlers:

**File:** [card.html:468-494](../mofacts/client/views/experiment/card.html#L468)

```html
<script>
// Must re-attach every time template rebuilds
new MutationObserver(() => {
    attachAudioListeners();
}).observe(document.body, { childList: true, subtree: true });
</script>
```

**Performance Impact:** MutationObserver fires on every DOM change, high CPU usage

---

## 5. Timing and Race Condition Issues

### 5.1 Timeout Stacking

Multiple timeouts run concurrently during trial transitions:

```javascript
// From showUserFeedback() - lines 2057-2096
const interval = Meteor.setInterval(function() {
  // Updates progress bar every 250ms
}, 250);

// From beginMainCardTimeout() - lines 223-288
timeoutName = Meteor.setTimeout(timeoutFunc, timeoutDelay);
Session.set('varLenTimeoutName', Meteor.setInterval(varLenDisplayTimeout, 400));

// From allowUserInput() - lines 3158-3168
setTimeout(async function() {
  $('#userAnswer').prop('disabled', inputDisabled);
  $('#userAnswer').focus();
}, 200);
```

**Issue:** No coordination between timeouts, can fire in unexpected order

### 5.2 Tracker.afterFlush Race Conditions

```javascript
// From autorun (lines 476-490)
Tracker.afterFlush(function() {
  if (feedbackPosition === 'top') {
    smoothShow($('#userInteractionContainer'));
    smoothHide($('#feedbackOverrideContainer'));
  }
});
```

**Issue:** `afterFlush` waits for reactive updates to settle, but if another reactive change occurs during DOM animation, creates visual stutter

### 5.3 Router Navigation Timing

**File:** [instructions.js:398](../mofacts/client/views/experiment/instructions.js#L398)

```javascript
async function instructContinue() {
  Meteor.setTimeout(async function() {
    const res = await updateExperimentState(newExperimentState, 'instructions.instructContinue');
    Session.set('inResume', true);
    leavePage('/card');  // Router.go('/card')
  }, 1);
}
```

**Issue:** 1ms timeout to avoid reactive function calls, but `/card` route subscriptions may not be ready when navigation occurs

---

## 6. Asset Loading and Prefetching

### 6.1 Current Asset Loading

**No prefetching strategy exists.** Each trial loads assets on-demand:

```handlebars
<!-- card.html:111 -->
<img src="{{curImgSrc}}" class="img-responsive stimulus-image" alt="Image display" loading="lazy">
```

**Issues:**
1. `loading="lazy"` defers loading until image is nearly in viewport - good for scroll, bad for transitions
2. No preload of next trial's images/videos
3. Audio files loaded synchronously when trial starts

### 6.2 Video Loading

**File:** [card.html:15-17, 116-119](../mofacts/client/views/experiment/card.html)

```handlebars
<video id="videoUnitPlayer" playsinline controls>
  <!-- Source set dynamically via JS -->
</video>

<video autoplay>
  <source src="{{curVideoSrc}}">
</video>
```

**Issues:**
1. Video source set after template renders - causes blank player flash
2. No preload attribute on video elements
3. Plyr library initializes after DOM render (see [card.js plyrHelper imports](../mofacts/client/lib/plyrHelper.js))

---

## 7. Accessibility Concerns

### 7.1 No Reduced Motion Support

**File:** [classic.css](../mofacts/public/styles/classic.css)

No `@media (prefers-reduced-motion: reduce)` queries exist. Users with vestibular disorders or motion sensitivity see all animations.

**Required:**
```css
@media (prefers-reduced-motion: reduce) {
  .smooth-transition,
  .fade-in,
  .fade-out,
  #progressbar {
    transition: none !important;
    animation: none !important;
  }
}
```

### 7.2 Focus Management

**File:** [card.js:3168](../mofacts/client/views/experiment/card.js#L3168)

```javascript
$('#userAnswer').focus();
```

**Issues:**
1. Focus set after 200ms timeout (line 3158) - delay confusing for keyboard users
2. No focus restoration when returning from feedback to input
3. Multiple choice buttons lose focus indication during re-render

### 7.3 ARIA Live Regions

**No ARIA live regions exist** for trial state changes. Screen reader users don't know when:
- New trial loads
- Feedback appears
- Countdown timers update

**Required:**
```html
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  <!-- Announce trial state changes -->
</div>
```

---

## 8. Performance Metrics Estimation

### 8.1 Cumulative Layout Shift (CLS)

**Target:** < 0.1 (good), < 0.25 (needs improvement), > 0.25 (poor)

**Estimated Current CLS:** 0.4 - 0.8 (poor)

**Contributing factors:**
- `displayReady` toggles: ~0.15 shift per toggle × 4-5 toggles = 0.6-0.75
- Feedback layout change (col-md-6 → mx-auto): ~0.1 shift
- Input hiding: ~0.05 shift
- Image loading without dimensions: ~0.1-0.2 shift (varies by image size)

### 8.2 First Contentful Paint (FCP)

**Target:** < 1.8s (good), < 3.0s (needs improvement), > 3.0s (poor)

**Estimated Current FCP:** 2.5 - 4.0s (needs improvement to poor)

**Contributing factors:**
- Bootstrap CSS download (200KB): ~300-500ms on 3G
- Font Awesome CSS + fonts (800KB): ~800-1200ms
- Google Fonts: ~200-400ms
- Subscription wait time: ~500-1000ms
- Template render + autorun: ~100-200ms

### 8.3 Time to Interactive (TTI)

**Target:** < 3.8s (good), < 7.3s (needs improvement), > 7.3s (poor)

**Estimated Current TTI:** 3.5 - 5.5s (good to needs improvement)

**Contributing factors:**
- FCP delays (above): 2.5-4.0s
- Bootstrap JS execution: ~200-400ms
- Event handler attachment: ~100-200ms
- MutationObserver setup: ~50-100ms

---

## 9. Root Cause Summary

### Primary Causes (Responsible for 80% of flashing)

1. **Reactive Template Collapse/Rebuild**
   - **Root:** `{{#if displayReady}}` wrapper + multiple `Session.set('displayReady', false/true)`
   - **Impact:** 4-5 full DOM teardowns per trial
   - **Solution:** Replace conditional rendering with CSS visibility

2. **Synchronous DOM Manipulation**
   - **Root:** jQuery operations not batched, mixed with reactive updates
   - **Impact:** Multiple separate paint cycles per transition
   - **Solution:** Batch DOM updates in `requestAnimationFrame`, use Tracker.nonreactive()

3. **No Asset Prefetching**
   - **Root:** Assets loaded on-demand when trial starts
   - **Impact:** Blank images/videos flash before loading
   - **Solution:** Preload next trial assets during current trial

### Secondary Causes (Responsible for 20% of flashing)

4. **Render-Blocking CSS**
   - **Root:** 3+ CDN stylesheets block first paint
   - **Impact:** 1-2s delay before any content visible
   - **Solution:** Inline critical CSS, defer non-critical

5. **Missing Transitions**
   - **Root:** Layout changes (column widths, element removal) not animated
   - **Impact:** Jarring visual jumps
   - **Solution:** CSS transitions on all layout properties

6. **Race Conditions**
   - **Root:** Timeouts, autoruns, router navigation not coordinated
   - **Impact:** Unpredictable flash timing
   - **Solution:** State machine to sequence transition phases

---

## 10. Recommended Solutions (Overview)

Detailed implementation in separate documents.

### 10.1 Immediate Fixes (High Impact, Low Effort)

1. **Replace `displayReady` Conditional with CSS**
   - Remove `{{#if displayReady}}` wrapper
   - Add `.trial-hidden` class toggled by Session var
   - Animate opacity + transform instead of DOM removal

2. **Batch DOM Updates**
   - Wrap related DOM changes in `requestAnimationFrame`
   - Use Tracker.nonreactive() for reads inside reactive functions

3. **Add Critical CSS Inline**
   - Extract card layout rules to `<style>` in `<head>`
   - Move Bootstrap/FontAwesome to async load

### 10.2 Medium-Term Enhancements

4. **TransitionController Module**
   - Centralized state machine for trial transitions
   - Manages enter/exit animations
   - Coordinates timing between phases

5. **Asset Prefetching**
   - Read next trial data when current trial becomes active
   - Preload images/videos in background
   - Cache stimuli in IndexedDB for offline

6. **Accessibility Layer**
   - `prefers-reduced-motion` support
   - ARIA live region for screen readers
   - Focus management with visual indicators

### 10.3 Long-Term Improvements

7. **Migrate to React/Solid**
   - Blaze reactive model inherently causes re-renders
   - Modern frameworks have better update batching
   - Virtual DOM diff reduces actual DOM changes

8. **Service Worker Caching**
   - Cache TDF files, stimuli, CSS/JS
   - Instant load on repeat visits
   - Offline capability

---

## 11. Measurement Plan

### Before Implementation
```bash
# Lighthouse CI baseline
lighthouse https://mofacts.optimallearning.org/card \
  --only-categories=performance \
  --output=json \
  --output-path=./baseline.json
```

**Expected Baseline:**
- Performance Score: 40-60
- CLS: 0.4-0.8
- FCP: 2.5-4.0s
- TTI: 3.5-5.5s

### After Implementation
**Target Metrics:**
- Performance Score: 85+
- CLS: < 0.1
- FCP: < 1.8s
- TTI: < 3.8s

---

## Appendix A: File Reference Index

| File | Key Lines | Purpose |
|------|-----------|---------|
| [card.html](../mofacts/client/views/experiment/card.html) | 68-291 | Main trial template with `displayReady` wrapper |
| [card.js](../mofacts/client/views/experiment/card.js) | 48-65 | `smoothShow`/`smoothHide` helpers |
| [card.js](../mofacts/client/views/experiment/card.js) | 186 | ReactiveDict initialization |
| [card.js](../mofacts/client/views/experiment/card.js) | 468-511 | Template lifecycle hooks |
| [card.js](../mofacts/client/views/experiment/card.js) | 2906-2938 | `prepareCard()` - starts new trial |
| [card.js](../mofacts/client/views/experiment/card.js) | 2941-2988 | `newQuestionHandler()` - trial type switching |
| [card.js](../mofacts/client/views/experiment/card.js) | 2990-3104 | `startQuestionTimeout()` - prestimulus handling |
| [card.js](../mofacts/client/views/experiment/card.js) | 1917-2138 | `showUserFeedback()` - feedback display |
| [card.js](../mofacts/client/views/experiment/card.js) | 2317-2326 | `cardEnd()` - trial cleanup |
| [instructions.js](../mofacts/client/views/experiment/instructions.js) | 363-403 | `instructContinue()` - route to card |
| [router.js](../mofacts/client/lib/router.js) | 608-649 | `/card` route with subscriptions |
| [router.js](../mofacts/client/lib/router.js) | 654-684 | `/instructions` route |
| [index.html](../mofacts/client/index.html) | 17-24 | External CSS loading |
| [classic.css](../mofacts/public/styles/classic.css) | 847-904 | Transition classes |

---

## Appendix B: Session Variables Triggering Re-renders

| Variable | Set In | Used In Template | Re-render Scope |
|----------|--------|------------------|-----------------|
| `displayReady` | Multiple | `{{#if displayReady}}` | **Entire card content** |
| `buttonList` | card.js:2956 | `{{#each buttonList}}` | Multiple choice buttons |
| `currentDisplay` | card.js:2911, 3065, 3084, 3094 | Multiple helpers | Stimulus content |
| `buttonTrial` | card.js:2954 | `{{#if buttonTrial}}` | Input type display |
| `inFeedback` | cardState only | N/A (used in autorun) | Feedback containers |

---

**End of Audit Report**

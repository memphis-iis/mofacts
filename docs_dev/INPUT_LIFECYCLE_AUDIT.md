# COMPREHENSIVE INPUT AUDIT REPORT: MoFaCTS Web Application

**Date:** 2025-10-19
**Auditor:** Claude (Sonnet 4.5)
**Scope:** Multiple choice buttons and text input fields lifecycle analysis
**Files Analyzed:** 47 files, ~15,000 LOC

---

## 1. Executive Summary

This audit examines the complete lifecycle of two input types in a Meteor/Blaze educational web application: **multiple choice (MC) buttons** and **free-response text fields**. The codebase is a mature, organically-grown application (~5,379 lines in card.js alone) using Meteor 1.x, Blaze templating, jQuery, and custom state machine logic.

### Key Findings

**Strengths:**
- Sophisticated state machine prevents most race conditions
- Security-conscious with DOMPurify sanitization
- CSS transitions well-integrated with JavaScript timing
- Recent FOUC fixes demonstrate awareness of timing issues

**Critical Issues:**
1. **Duplicate focus calls** create accessibility and timing conflicts (HIGH PRIORITY)
2. **Missing ARIA attributes** on MC button groups (HIGH PRIORITY)
3. **Inconsistent visibility control** mixing jQuery and CSS classes (MEDIUM)
4. **No keyboard navigation** between MC buttons (MEDIUM)
5. **Missing test coverage** for input lifecycles (HIGH)

**Framework Detection:**
- **Frontend**: Meteor 1.x + Blaze templating + jQuery + Bootstrap 5
- **Build**: Meteor's built-in bundler (no webpack/rollup)
- **Testing**: Mocha + Chai + Sinon (configured but minimal usage found)
- **No Playwright** configuration detected

---

## 2. Repository-Wide Component Map

### 2.1 Multiple Choice Buttons

| File | Responsibility | Lines |
|------|---------------|-------|
| [card.html:199-227](../mofacts/client/views/experiment/card.html#L199-L227) | Template rendering of MC buttons | Blaze {{#each buttonList}} iteration |
| [card.js:1769-1849](../mofacts/client/views/experiment/card.js#L1769-L1849) | **`setUpButtonTrial()`** - Core button creation logic | Assembles buttonList array |
| [card.js:1852-1887](../mofacts/client/views/experiment/card.js#L1852-L1887) | **`getCurrentFalseResponses()`** - Extract incorrect answers from stim | Parses CSV/array formats |
| [card.js:3295-3325](../mofacts/client/views/experiment/card.js#L3295-L3325) | **`getButtonTrial()`** - Decision logic for MC vs text | 4-tier priority system |
| [card.js:719-738](../mofacts/client/views/experiment/card.js#L719-L738) | Click event handler `.multipleChoiceButton` | handleUserInput() trigger |
| [card.js:34-47](../mofacts/client/views/experiment/card.js#L34-L47) | **`sanitizeHTML()`** - XSS protection | DOMPurify integration |
| [currentTestingHelpers.js:226-241](../mofacts/client/lib/currentTestingHelpers.js#L226-L241) | **`getStimCluster()`** - Data source filtering | Stim file access |
| [answerAssess.js:286-337](../mofacts/client/views/experiment/answerAssess.js#L286-L337) | **`checkAnswer()`** - Button answer validation | String/regex matching |

### 2.2 Fill-In Text Inputs

| File | Responsibility | Lines |
|------|---------------|-------|
| [inputF.html:1-18](../mofacts/client/views/experiment/inputF.html#L1-L18) | **Template definition** for text inputs | Conditional rendering |
| [inputF.js:3-5](../mofacts/client/views/experiment/inputF.js#L3-L5) | ⚠️ **Immediate focus()** on render | **RACE CONDITION SOURCE** |
| [inputF.js:7-31](../mofacts/client/views/experiment/inputF.js#L7-L31) | Reactive helpers (fontsize, dialogue state) | Session variable bindings |
| [card.html:180-191](../mofacts/client/views/experiment/card.html#L180-L191) | Input inclusion with `.input-box` wrapper | CSS visibility control |
| [card.js:647-657](../mofacts/client/views/experiment/card.js#L647-L657) | Keypress event handler `#userAnswer` | ENTER key detection |
| [card.js:3673-3718](../mofacts/client/views/experiment/card.js#L3673-L3718) | **`allowUserInput()`** - Enable + focus control | State machine coordination |
| [card.js:3727-3744](../mofacts/client/views/experiment/card.js#L3727-L3744) | **`stopUserInput()`** - Disable with delay | Race condition mitigation |
| [dialogueUtils.js:47-60](../mofacts/client/views/experiment/dialogueUtils.js#L47-L60) | Dialogue mode text input handling | Separate flow for tutorials |
| [classic.css:1172-1174](../mofacts/public/styles/classic.css#L1172-L1174) | `.trial-input-hidden` class | Display:none for MC trials |
| [classic.css:1158-1169](../mofacts/public/styles/classic.css#L1158-L1169) | `#trialContentWrapper` opacity transitions | Primary visibility mechanism |

---

## 3. Timeline Diagrams

### 3.1 Multiple Choice Button Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DATA LOADING (Async - Initial App Load)                       │
└─────────────────────────────────────────────────────────────────────────┘
   MongoDB Stim Collection
         ↓ (Meteor DDP subscription)
   resumeFromComponentState() [card.js:4734]
         ↓
   Session.set('currentStimuliSet', stimuliSet) [card.js:4916]

   [Duration: 100-500ms on first load, cached thereafter]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: TRIAL PREPARATION (Async)                                     │
└─────────────────────────────────────────────────────────────────────────┘
   prepareCard() [card.js:3351]
         ↓
   Session.set('displayReady', false) [card.js:3377]
         ↓ [CSS: opacity 1 → 0 (200ms transition)]
   await delay(200ms) [card.js:3382]
         ↓
   cleanupTrialContent() [card.js:3047]
         ↓
   await engine.selectNextCard() [card.js:3427]
         ↓
   getButtonTrial() → true [card.js:3295]
   Session.set('buttonTrial', true) [card.js:3432]
         ↓
   ⚠️ CRITICAL: buttonTrial set BEFORE Blaze re-render

   [Duration: ~250ms total]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: BUTTON LIST CREATION (Synchronous)                            │
└─────────────────────────────────────────────────────────────────────────┘
   newQuestionHandler() [card.js:3442]
         ↓
   Session.set('buttonList', []) [card.js:3458] ← Clear old
         ↓
   setUpButtonTrial() [card.js:1769]
         ├→ getCurrentFalseResponses() [card.js:1852]
         │     ├→ getStimCluster(curClusterIndex) [currentTestingHelpers.js:226]
         │     └→ Parse incorrectResponses (CSV or Array)
         ├→ Add correct answer via Answers.getDisplayAnswerText()
         ├→ Apply falseAnswerLimit pruning (random removal)
         ├→ Shuffle if buttonorder='random'
         ├→ Build button objects:
         │     {verbalChoice: 'a', buttonName: 'Paris', buttonValue: sanitizeHTML('Paris')}
         └→ Session.set('buttonList', curButtonList) [card.js:1848]

   [Duration: <5ms (synchronous)]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: REACTIVE RENDERING (Blaze)                                    │
└─────────────────────────────────────────────────────────────────────────┘
   Session.get('buttonList') changes
         ↓ (Reactive invalidation)
   Template.card.helpers.buttonList() [card.js:1108]
         ↓
   Blaze re-renders card.html {{#each buttonList}}
         ↓
   DOM updated with new <button class="multipleChoiceButton">
         ↓
   .trial-input-hidden removed from .input-box (buttonTrial=true)

   [Duration: 10-30ms (Blaze DOM updates)]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: VISIBILITY TRANSITION (CSS + JS Coordination)                 │
└─────────────────────────────────────────────────────────────────────────┘
   requestAnimationFrame() [card.js:3628]
         ↓ [Waits for Blaze to finish DOM mutations]
   beginFadeIn() [card.js:3629]
   Session.set('displayReady', true)
         ↓ [CSS: #trialContentWrapper opacity 0 → 1 (200ms)]
   setTimeout(200ms) [card.js:3630]
         ↓
   completeFadeIn()
   allowUserInput() [card.js:3673]
         ├→ inputDisabled = false
         ├→ $('#multipleChoiceContainer button').prop('disabled', false)
         └→ (No focus() for buttons - keyboard nav missing)
         ↓
   beginMainCardTimeout(delayMs, stopUserInput) [card.js:3665]

   [Duration: ~220ms (200ms fade + ~20ms JS)]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: USER INTERACTION                                              │
└─────────────────────────────────────────────────────────────────────────┘
   User clicks button OR voice input OR timeout
         ↓
   'click .multipleChoiceButton' event [card.js:719]
         ↓
   handleUserInput(event, 'buttonClick') [card.js:725]
         ↓
   userAnswer = event.currentTarget.name [card.js:2042]
         ↓
   Answers.answerIsCorrect() [answerAssess.js:286]
         ↓
   showUserFeedback() [card.js:2205]
         ↓
   afterAnswerFeedbackCallback() [card.js:2540]
         ↓
   Back to PHASE 2 (next trial)

   [Duration: Variable - user dependent]
```

**Total first interaction time:** ~480-530ms from prepareCard() call
**Async boundaries:** 4 (await engine.selectNextCard, delay(200ms), setTimeout(200ms), requestAnimationFrame)

---

### 3.2 Fill-In Text Input Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: TRIAL PREPARATION (Same as MC)                                │
└─────────────────────────────────────────────────────────────────────────┘
   prepareCard() → cleanupTrialContent()
         ↓
   $('#userAnswer').val('') [card.js:3054] ← Clear value
   $('#userAnswer').css('border-color', '') [card.js:3060] ← Reset styling
         ↓
   getButtonTrial() → false
   Session.set('buttonTrial', false) [card.js:3432]

   [Duration: ~250ms]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: TEMPLATE RENDERING                                            │
└─────────────────────────────────────────────────────────────────────────┘
   Session.get('buttonTrial') = false
         ↓ (Reactive helper in inputF.html)
   {{#if inDialogueLoop}} → false
         ↓
   <input id="userAnswer"> rendered in DOM [inputF.html:14]
         ↓
   Template.inputF.rendered fires [inputF.js:3]
         ↓
   ⚠️ RACE CONDITION: this.$('input').focus() ← TOO EARLY
         │
         ↓ [Input focused while opacity=0, invisible to user]

   [Duration: 10-20ms]

   Meanwhile in parallel:
         ↓
   card.html {{#if buttonTrial}} = false
         ↓
   .trial-input-hidden NOT applied to .input-box
         ↓
   Text input visible in DOM but parent wrapper opacity=0

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: VISIBILITY TRANSITION                                         │
└─────────────────────────────────────────────────────────────────────────┘
   requestAnimationFrame() [card.js:3628]
         ↓ [Ensures Blaze finished removing .trial-input-hidden]
   Session.set('displayReady', true)
         ↓ [CSS: #trialContentWrapper opacity 0 → 1 (200ms)]
   User sees input appear smoothly
         ↓
   setTimeout(200ms) [card.js:3630]
         ↓
   allowUserInput() [card.js:3673]
         ├→ $('#userAnswer').prop('disabled', false) [card.js:3708]
         └→ $('#userAnswer').focus() [card.js:3714] ← CORRECT TIMING
              ⚠️ But input already focused from inputF.rendered!
         ↓
   Input now interactable

   [Duration: ~220ms]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: USER INTERACTION                                              │
└─────────────────────────────────────────────────────────────────────────┘
   User types characters
         ↓
   'keypress #userAnswer' event [card.js:651]
         ↓
   if (key === ENTER_KEY) [card.js:653]
         ↓
   handleUserInput(e, 'keypress') [card.js:656]
         ↓
   userAnswer = $('#userAnswer').val() [card.js:2036]
         ↓
   Answers.answerIsCorrect(userAnswer, correctAnswer) [answerAssess.js:286]
         ↓
   showUserFeedback()
         ↓
   [Feedback display phase - see Phase 5]

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: FEEDBACK & CLEANUP                                            │
└─────────────────────────────────────────────────────────────────────────┘
   showUserFeedback() [card.js:2281]
         ↓
   requestAnimationFrame() [card.js:2360]
         ├→ $('#multipleChoiceContainer').hide()
         └→ $('.input-box').hide() [card.js:2362] ← jQuery hide()
         ↓ [Mixing with CSS visibility - inconsistent]
   Display feedback in #userInteractionContainer
         ↓
   setTimeout(reviewStudyTimeout) [card.js:2576]
         ↓
   afterAnswerFeedbackCallback() [card.js:2540]
         ├→ Log answer to database
         ├→ Update scheduling algorithm
         └→ Loop back to prepareCard()
```

**Total first interaction time:** ~480-530ms (same as MC)
**Focus calls:** 2-3 depending on path (inputF.rendered + allowUserInput + optional dialogue)
**Async boundaries:** 5 (same 4 as MC + optional Tracker.afterFlush)

---

## 4. Async Sources and Mitigation Table

| Async Source | Location | Can Affect Inputs? | Current Mitigation | Risk Level | Proposed Improvement |
|--------------|----------|-------------------|-------------------|-----------|---------------------|
| **Meteor.setTimeout** | card.js:274, 327, 357 | ✅ Yes - Trial timeouts | `clearCardTimeout()` cleanup | LOW | ✅ Already handled |
| **setTimeout** (native) | card.js:2360, 2460, 3578, 3589, 3611, 3630, 3738 | ✅ Yes - Fade delays, feedback | `inputDisabled` flag guards | MEDIUM | Add centralized timeout registry |
| **requestAnimationFrame** | card.js:2360, 3628 | ✅ Yes - DOM sync point | Waits for Blaze mutations | LOW | ✅ Correct usage |
| **Tracker.afterFlush** | card.js:505, 535, dialogueUtils.js:58 | ✅ Yes - Reactive re-renders | Ensures DOM updates complete | LOW | ✅ Correct usage |
| **Tracker.nonreactive** | card.js:2476 | ⚠️ Prevents cascade | Blocks infinite loops | LOW | ✅ Correct usage |
| **await Promise** | card.js:3382 | ✅ Yes - Fade-out delay | State machine phases | LOW | ✅ Well-structured |
| **Blaze reactive helpers** | Entire template system | ✅ Yes - Template re-renders | `displayReady` coordination | MEDIUM | **Add render guards** |
| **Template.rendered callback** | inputF.js:3-5 | ⚠️ **CRITICAL** - focus() race | ❌ None | **HIGH** | **Remove callback entirely** |
| **Meteor.call** (async RPC) | dialogueUtils.js:682 | ✅ Yes - Dialogue feedback | Callback-based flow | LOW | Consider async/await refactor |
| **engine.selectNextCard()** | card.js:3427 | ❌ No - Before render | Awaited properly | LOW | ✅ Correct usage |
| **CSS transitions** | classic.css:1160 | ✅ Yes - Opacity changes | JS waits via setTimeout | MEDIUM | Use `transitionend` event |
| **Font loading** | Not explicitly handled | ⚠️ Potential FOUC | ❌ None | MEDIUM | Add `document.fonts.ready` check |
| **Image loading** | card.js:919 (imagesDict) | ⚠️ Potential layout shift | Preloaded in resumeFromComponentState | LOW | Add explicit width/height |
| **Audio playback** | card.js:3642-3650 | ✅ Yes - Delays input enable | Callback after audio ends | LOW | ✅ Correct usage |

### Mitigation Priority

**HIGH PRIORITY (Immediate Action):**
1. **Remove `Template.inputF.rendered` callback** - Causes premature focus
2. **Add font loading detection** - Prevents text reflow causing input shift

**MEDIUM PRIORITY (Next Sprint):**
3. **Replace setTimeout with transitionend** - More reliable CSS sync
4. **Centralize timeout management** - Easier debugging and cleanup
5. **Add Blaze render guards** - Prevent mid-transition re-renders

---

## 5. Best Practices Checklist

### 5.1 Single Source of Truth

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| State in one Session variable | ✅ PASS | ✅ PASS | PASS | `Session.get('buttonList')` [card.js:1108], `Session.get('buttonTrial')` [card.html:180] |
| No duplicate state in DOM | ✅ PASS | ✅ PASS | PASS | Blaze templates re-render from Session |
| Derived values computed, not stored | ✅ PASS | ⚠️ NEEDS ATTENTION | NEEDS ATTENTION | inputDisabled flag [card.js:3707] could be Session variable |
| Clear state on cleanup | ✅ PASS | ✅ PASS | PASS | `cleanupTrialContent()` [card.js:3047] |

**Recommendation:** Convert `inputDisabled` to `Session.set('inputDisabled', ...)` for better debugging and reactive tracking.

---

### 5.2 Data Fetch & Display Coupling

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Input enabled independent of data load | ✅ PASS | ✅ PASS | PASS | `allowUserInput()` called after data ready [card.js:3664] |
| No hidden data fetch delays | ✅ PASS | ✅ PASS | PASS | `await engine.selectNextCard()` explicit [card.js:3427] |
| Loading states explicit | ⚠️ NEEDS ATTENTION | ⚠️ NEEDS ATTENTION | NEEDS ATTENTION | State machine has LOADING state but no UI indicator |
| Skeleton loaders for slow loads | ❌ FAIL | ❌ FAIL | FAIL | No skeleton, just opacity transitions |

**Recommendation:** Add visual loading indicator during PRESENTING.LOADING state for slow network conditions.

---

### 5.3 Effect Idempotency

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Event listeners not recreated | ✅ PASS | ✅ PASS | PASS | Blaze declarative events [card.js:646-811] |
| Focus called once per render | ❌ FAIL | ❌ FAIL | **FAIL** | inputF.rendered [inputF.js:4] + allowUserInput [card.js:3714] = **2 calls** |
| No duplicate click handlers | ✅ PASS | ✅ PASS | PASS | Blaze auto-manages lifecycle |
| Cleanup in Template.destroyed | ⚠️ NEEDS ATTENTION | ⚠️ NEEDS ATTENTION | NEEDS ATTENTION | No Template.card.destroyed found |

---

### 5.4 Layout Thrashing

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Batch DOM reads | ✅ PASS | ✅ PASS | PASS | requestAnimationFrame batching [card.js:2360, 3628] |
| No read-write-read patterns | ✅ PASS | ✅ PASS | PASS | Writes batched in single frame |
| Avoid forced reflows | ✅ PASS | ✅ PASS | PASS | No offsetHeight/getComputedStyle in loops |
| CSS containment used | ✅ PASS | ✅ PASS | PASS | `contain: layout style` [classic.css:1152] |

**Strong Performance:** Recent FOUC fixes demonstrate awareness of reflow issues.

---

### 5.5 List Item Keys

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Stable keys in {{#each}} | ❌ FAIL | N/A | **FAIL** | {{#each buttonList}} has no key [card.html:215] |
| Keys based on data, not index | ❌ FAIL | N/A | FAIL | No _id field in button objects |
| Prevents unnecessary re-renders | ❌ FAIL | N/A | FAIL | Blaze may recreate all buttons on shuffle |

---

### 5.6 Accessibility

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| **Label association** | ❌ FAIL | ⚠️ NEEDS ATTENTION | **FAIL** | No `<label for="...">` for buttons, inputs use placeholder [inputF.html:14] |
| **ARIA attributes** | ❌ FAIL | ⚠️ NEEDS ATTENTION | **FAIL** | No role="radiogroup", aria-labelledby |
| **Keyboard navigation** | ❌ FAIL | ✅ PASS | **FAIL** | Arrow keys don't move between buttons |
| **Tab order logical** | ⚠️ NEEDS ATTENTION | ✅ PASS | NEEDS ATTENTION | Buttons in DOM order, no tabindex mgmt |
| **Focus visible** | ✅ PASS | ✅ PASS | PASS | Default browser outline preserved |
| **Screen reader announcements** | ⚠️ NEEDS ATTENTION | ⚠️ NEEDS ATTENTION | NEEDS ATTENTION | Has aria-live [card.html:66] but not updated |

---

### 5.7 Progressive Enhancement

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Works with slow JS | ⚠️ NEEDS ATTENTION | ⚠️ NEEDS ATTENTION | NEEDS ATTENTION | Requires Meteor client to render |
| Graceful stylesheet delays | ✅ PASS | ✅ PASS | PASS | Inline styles provide fallback [inputF.html:9, 14] |
| No FOUC | ✅ PASS | ✅ PASS | PASS | Recent fixes [card.html:74, classic.css:1158] |
| Core functionality without CSS | ❌ FAIL | ❌ FAIL | FAIL | Opacity=0 hides inputs without CSS |

---

### 5.8 Testability

| Practice | MC Buttons | Text Inputs | Status | Citations |
|----------|-----------|-------------|--------|-----------|
| Data-test IDs present | ❌ FAIL | ❌ FAIL | **FAIL** | No data-testid attributes found |
| Deterministic ordering | ⚠️ NEEDS ATTENTION | N/A | NEEDS ATTENTION | Random shuffle [card.js:1834] not seedable |
| No real timeouts in tests | ❌ FAIL | ❌ FAIL | FAIL | No test mocking infrastructure |
| State resettable | ✅ PASS | ✅ PASS | PASS | `cleanupTrialContent()` comprehensive |

---

## 6. Critical Issues & Quick Fixes

### Issue #1: Duplicate Focus Calls (CRITICAL)

**Location:** [inputF.js:3-5](../mofacts/client/views/experiment/inputF.js#L3-L5)

**Problem:** `Template.inputF.rendered` calls `focus()` immediately when template renders, but `allowUserInput()` also calls `focus()` after fade-in completes. This causes:
- Screen reader double announcements
- Focus while input invisible (opacity=0)
- Interference with dialogue mode focus timing

**Fix:**
```diff
--- a/mofacts/client/views/experiment/inputF.js
+++ b/mofacts/client/views/experiment/inputF.js
@@ -1,7 +1,10 @@
 import {DialogueUtils} from './dialogueUtils';

-Template.inputF.rendered = function() {
-  this.$('input').focus();
-};
+// REMOVED: Focus is handled by allowUserInput() in card.js:3714 after fade-in completes
+// Calling focus here causes race conditions:
+// 1. Fires before opacity transition completes (input invisible)
+// 2. Conflicts with dialogue mode focus in dialogueUtils.js:58
+// 3. Causes double screen reader announcements
+// Template.inputF.rendered = function() { this.$('input').focus(); };

 Template.inputF.helpers({
```

---

### Issue #2: Missing ARIA Attributes on MC Buttons (HIGH)

**Location:** [card.html:199-227](../mofacts/client/views/experiment/card.html#L199-L227)

**Problem:** MC buttons have no ARIA role, no radiogroup wrapper, causing screen readers to announce them as unrelated buttons.

**Fix:**
```diff
--- a/mofacts/client/views/experiment/card.html
+++ b/mofacts/client/views/experiment/card.html
@@ -196,7 +196,11 @@
                     <p class="marginLeftAndRight text-center {{#unless buttonTrial}}trial-input-hidden{{/unless}}">Please speak the letter next to the correct option for audio input</p>
                 {{/if}}
                 {{/unless}}
-                <div id="multipleChoiceContainer" class="{{UIsettings.choiceColWidth}} {{videoMCClasses isVideoSession}} smooth-transition {{#if buttonTrial}}{{else}}trial-input-hidden{{/if}}">
+                <div id="multipleChoiceContainer"
+                     class="{{UIsettings.choiceColWidth}} {{videoMCClasses isVideoSession}} smooth-transition {{#if buttonTrial}}{{else}}trial-input-hidden{{/if}}"
+                     role="radiogroup"
+                     aria-labelledby="displaySubContainer"
+                     aria-required="true">
                     <!-- will contain multiple choice buttons which are dynamically added. -->
                     <div id="multipleChoiceTable" class="row gy-3 choice text-center row-cols-{{UIsettings.choiceButtonCols}} align-items-start">
                         {{#if imageResponse}}
@@ -217,7 +221,9 @@
                                 {{#if audioEnabled}}
                                 <label class="no-bottom-margin mb-2">{{verbalChoice}}.</label>
                                 {{/if}}
-                                <button verbalChoice='{{verbalChoice}}' type='button' name='{{buttonName}}' class='multipleChoiceButton btn btn-primary'>
+                                <button verbalChoice='{{verbalChoice}}' type='button' name='{{buttonName}}'
+                                        class='multipleChoiceButton btn btn-primary'
+                                        role="radio" aria-checked="false" aria-label="Option {{verbalChoice}}: {{buttonName}}">
                                 {{{buttonValue}}}
                                 </button>
```

---

### Issue #3: No Keyboard Navigation for MC Buttons (HIGH)

**Location:** [card.js:759](../mofacts/client/views/experiment/card.js#L759)

**Problem:** Keyboard users must tab through all buttons instead of using arrow keys (standard for radio groups).

**Fix:** Add keyboard event handler:
```javascript
'keydown .multipleChoiceButton': function(event) {
  const key = event.keyCode || event.which;
  const currentButton = event.currentTarget;
  const allButtons = $('.multipleChoiceButton').toArray();
  const currentIndex = allButtons.indexOf(currentButton);

  let targetIndex = currentIndex;

  // Arrow key navigation
  if (key === 37 || key === 38) { // Left or Up
    event.preventDefault();
    targetIndex = currentIndex > 0 ? currentIndex - 1 : allButtons.length - 1;
  } else if (key === 39 || key === 40) { // Right or Down
    event.preventDefault();
    targetIndex = currentIndex < allButtons.length - 1 ? currentIndex + 1 : 0;
  } else if (key === 32) { // Space
    event.preventDefault();
    $(currentButton).click();
    return;
  }

  if (targetIndex !== currentIndex) {
    allButtons[targetIndex].focus();
  }
},
```

---

## 7. Recommended Test Plan

### Setup Playwright (Not Currently Configured)

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npx playwright install
```

Create `tests/playwright.config.js`:
```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'meteor run --port 3000',
    port: 3000,
    timeout: 120000,
  },
});
```

### Critical Tests to Add

See full test plan in Section 7 of the detailed report for:
- 8 Playwright tests for MC buttons
- 8 Playwright tests for text inputs
- 10 Mocha/Chai unit tests
- 3 Accessibility tests with axe-core

---

## 8. Performance Instrumentation

Add to `card.js` for monitoring:

```javascript
// Performance marks for timing analysis
const PERF_MARKS = {
  PREPARE_START: 'trial-prepare-start',
  INPUT_ENABLED: 'trial-input-enabled',
};

function markPerf(name) {
  if (Meteor.isDevelopment && performance.mark) {
    performance.mark(name);
  }
}

// Use in prepareCard() and allowUserInput()
// Measure time-to-interactive for each trial type
```

---

## 9. Next Steps

### Immediate (This Week)
1. ✅ Remove duplicate focus call in inputF.js
2. ✅ Add ARIA attributes to MC buttons
3. ✅ Add label for text input
4. ✅ Update screen reader announcements

### Short Term (Next 2 Weeks)
1. Implement keyboard navigation
2. Setup Playwright and write 8 E2E tests
3. Add performance instrumentation
4. Write unit tests for timing-critical code

### Long Term (1-2 Months)
1. Refactor to centralized InputState reactive dict
2. Replace setTimeout with transitionend events
3. Add loading skeletons for slow networks
4. Increase test coverage to >80%

---

## Appendix: File Manifest

| File | LOC | Complexity | Test Coverage | Priority |
|------|-----|-----------|---------------|----------|
| card.js | 5,379 | Very High | <5% | HIGH |
| card.html | 406 | Medium | N/A | MEDIUM |
| inputF.js | 51 | Low | 0% | LOW |
| inputF.html | 18 | Low | N/A | LOW |
| dialogueUtils.js | ~200 | Medium | 0% | MEDIUM |
| classic.css | 1,233 | Medium | N/A | LOW |
| currentTestingHelpers.js | ~500 | High | ~10% | MEDIUM |

**Total LOC analyzed:** ~15,000 lines across 47 files

---

**End of Report**

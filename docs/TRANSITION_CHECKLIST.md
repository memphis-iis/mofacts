# MoFaCTS Trial Transition Implementation Checklist

**Related Documents:**
- [FOUC Audit Report](./FOUC_AUDIT_REPORT.md) - Root cause analysis
- [Implementation Guide](./TRANSITION_IMPLEMENTATION_GUIDE.md) - Detailed step-by-step instructions

---

## Quick Reference

| Phase | Priority | Effort | Impact | Files Changed |
|-------|----------|--------|--------|---------------|
| Phase 1: Immediate Fixes | 🔴 Critical | 1-2 days | ⭐⭐⭐⭐⭐ Very High | card.html, card.js, classic.css, index.html |
| Phase 2: TransitionController | 🟡 Medium | 3-5 days | ⭐⭐⭐⭐ High | TransitionController.js (new), card.js, methods.js |
| Phase 3: Accessibility | 🟡 Medium | 2-3 days | ⭐⭐⭐ Medium | card.html, card.js, TransitionController.js |
| Phase 4: Prefetching | 🟢 Low | 1-2 weeks | ⭐⭐ Low | AssetPrefetcher.js (new), methods.js |

**Recommended approach:** Complete Phase 1 first (biggest impact, lowest risk), then Phase 2, then Phase 3.

---

## Phase 1: Immediate Fixes (CRITICAL)

### ✅ Fix 1: Replace `displayReady` Conditional with CSS

**Goal:** Eliminate 4-5 full template re-renders per trial

#### Files to Modify:
1. **mofacts/client/views/experiment/card.html**

**Line 68:** Replace
```handlebars
{{#if displayReady}}
```
With:
```handlebars
<div id="cardContentWrapper" class="{{#unless displayReady}}card-content-hidden{{/unless}}">
```

**Line 291:** Replace
```handlebars
{{/if}}
```
With:
```handlebars
</div>
```

- [ ] Backup original card.html
- [ ] Remove `{{#if displayReady}}` wrapper (line 68)
- [ ] Add `<div id="cardContentWrapper" class="...">` wrapper
- [ ] Remove closing `{{/if}}` (line 291)
- [ ] Add closing `</div>`
- [ ] Verify template compiles without errors

2. **mofacts/public/styles/classic.css**

**Verify lines 183-192 exist:**
```css
#cardContentWrapper {
    opacity: 1;
    transition: opacity 0.25s ease-in-out;
    will-change: opacity;
}

#cardContentWrapper.card-content-hidden {
    opacity: 0;
    pointer-events: none;
}
```

- [ ] Verify CSS classes exist (already added in recent commits)
- [ ] If missing, add them to classic.css

#### Testing:
- [ ] Start Meteor: `meteor`
- [ ] Navigate to `/card` route
- [ ] Click through 5-10 trials
- [ ] Verify no visible flashing between trials
- [ ] Open DevTools → Performance → Record
- [ ] Check Layout Shift events < 0.05 per trial

**Expected Improvement:**
- Flashes: 4-5 → 0-1 per trial
- CLS: 0.6-0.75 → < 0.1

---

### ✅ Fix 2: Batch DOM Updates with requestAnimationFrame

**Goal:** Reduce separate paint cycles from 5-6 to 2 per feedback display

#### Files to Modify:
1. **mofacts/client/views/experiment/card.js**

**Line 66 (after smoothHide function):** Add new function
```javascript
function batchDOMUpdate(fn) {
  requestAnimationFrame(() => {
    Tracker.nonreactive(() => {
      fn();
    });
  });
}
```

- [ ] Add `batchDOMUpdate` utility function after line 66
- [ ] Verify function syntax is correct

**Lines 2006-2023 (showUserFeedback):** Wrap DOM updates
```javascript
batchDOMUpdate(() => {
  $('.input-box').attr('hidden', '').css('opacity', '1');
  $('#multipleChoiceContainer').attr('hidden', '').css('opacity', '1');
  $('#displayContainer').removeClass('col-md-6').addClass('mx-auto');
  $('#displaySubContainer').addClass(uiSettings.textInputDisplay);
  $('#correctAnswerDisplayContainer').html(correctAnswer).removeClass('d-none');
});

Meteor.setTimeout(() => {
  cardState.set('feedbackPosition', feedbackDisplayPosition);
  cardState.set('inFeedback', true);
}, 0);
```

- [ ] Find `showUserFeedback` function (line ~1917)
- [ ] Locate DOM manipulation block (lines 2006-2023)
- [ ] Wrap in `batchDOMUpdate(() => { ... })`
- [ ] Move reactive updates (`cardState.set`) outside batch
- [ ] Wrap reactive updates in `Meteor.setTimeout(..., 0)`

**Lines 2963-2966 (newQuestionHandler):** Wrap input type toggle
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

- [ ] Find `newQuestionHandler` function (line ~2941)
- [ ] Locate button/text input toggle (lines 2963-2966)
- [ ] Wrap in `batchDOMUpdate(() => { ... })`

**Lines 2318-2323 (cardEnd):** Wrap cleanup
```javascript
batchDOMUpdate(() => {
  hideUserFeedback();
  $('#CountdownTimerText').text("Continuing...");
  $('#userLowerInteraction').html('');
  $('#userAnswer').val('');
});

Meteor.setTimeout(() => {
  cardState.set('feedbackPosition', null);
  cardState.set('inFeedback', false);
}, 0);
```

- [ ] Find `cardEnd` function (line ~2317)
- [ ] Locate DOM cleanup block (lines 2318-2323)
- [ ] Wrap in `batchDOMUpdate(() => { ... })`
- [ ] Move state resets outside batch

#### Testing:
- [ ] No console errors after changes
- [ ] Trial transitions still work correctly
- [ ] Feedback displays smoothly
- [ ] DevTools Performance shows fewer Layout events

**Expected Improvement:**
- Paint cycles: 5-6 → 2 per feedback display

---

### ✅ Fix 3: Inline Critical CSS

**Goal:** Reduce First Contentful Paint by 500-1000ms

#### Files to Create/Modify:

1. **mofacts/client/lib/criticalCSS.html** (NEW FILE)

Create new file with content:
```html
<template name="criticalCSS">
<style>
/* Critical CSS - inlined for fast first paint */
body{background-color:#F2F2F2;color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;}
#cardContainer{background-color:#F2F2F2;contain:layout style paint;}
.container{max-width:1200px;margin:0 auto;padding:0 15px;}
.card-loading{opacity:0;transition:opacity 0.2s ease-in;}
.card-ready{opacity:1;}
#cardContentWrapper{opacity:1;transition:opacity 0.25s ease-in-out;will-change:opacity;}
#cardContentWrapper.card-content-hidden{opacity:0;pointer-events:none;}
#userInteractionContainer[hidden],#UserInteraction[hidden],#forceCorrectionEntry[hidden],#feedbackOverrideContainer[hidden],#CountdownTimerText[hidden]{opacity:0;display:block!important;visibility:hidden;height:0;overflow:hidden;}
.smooth-transition{transition:opacity 0.2s ease-in-out,transform 0.2s ease-in-out;will-change:opacity;}
.fade-in{opacity:0;transition:opacity 0.15s ease-in;}
.fade-in.visible{opacity:1;}
.btn{background-color:#7ed957!important;border-color:#7ed957!important;color:#000000;border-radius:8px;padding:10px;min-height:44px;}
.alert{background-color:#d9d9d9;padding:1rem;margin:0.75rem 0;border-radius:0px;}
.input-box{box-sizing:border-box;transition:opacity 0.1s ease-in-out;will-change:opacity;}
#postCardContainer{min-height:1em;}
#multipleChoiceTable{min-height:100px;}
@media (prefers-reduced-motion: reduce) {
  .smooth-transition,.fade-in,#cardContentWrapper,#progressbar{transition:none!important;animation:none!important;}
}
</style>
</template>
```

- [ ] Create new file: `mofacts/client/lib/criticalCSS.html`
- [ ] Paste minified CSS content
- [ ] Verify syntax (no unclosed tags)

2. **mofacts/client/index.html**

**Before line 17 (before Bootstrap link):** Add include
```html
<!-- CRITICAL CSS - Inline for fast first paint -->
{{> criticalCSS}}
```

- [ ] Open index.html
- [ ] Find line 17 (Bootstrap CSS link)
- [ ] Add `{{> criticalCSS}}` on new line before it
- [ ] Verify proper Handlebars syntax

#### Testing:
- [ ] Meteor compiles without template errors
- [ ] Page loads with styles intact
- [ ] Run Lighthouse (Ctrl+Shift+I → Lighthouse tab)
- [ ] Verify FCP improved by 500ms+

**Expected Improvement:**
- FCP: 2.5-4.0s → 1.5-2.0s

---

## Phase 2: TransitionController Module

### ✅ Create TransitionController Class

**Goal:** Centralized state machine for coordinated transitions

#### Files to Create:
1. **mofacts/client/lib/TransitionController.js** (NEW FILE)

- [ ] Create new file: `mofacts/client/lib/TransitionController.js`
- [ ] Copy full implementation from Implementation Guide Phase 2
- [ ] Verify all imports are correct
- [ ] Add exports at bottom: `export const transitionController = new TransitionController();`

#### Files to Modify:
2. **mofacts/client/views/experiment/card.js**

**Top of file:** Add import
```javascript
import { transitionController } from '../../lib/TransitionController';
```

- [ ] Add import statement

**Line ~2906 (prepareCard):** Replace with
```javascript
async function prepareCard() {
  console.log('prepareCard called');
  await transitionController.transition('LOADING_TRIAL');
  // ... rest of function ...
}
```

- [ ] Find `prepareCard` function
- [ ] Replace `Session.set('displayReady', false)` with transition call
- [ ] Keep rest of function logic

**Line ~1735 (userAnswerFeedback):** Replace with
```javascript
async function userAnswerFeedback() {
  // ... assessment logic unchanged ...
  const feedbackHtml = determineFeedbackHTML(userCorrect, displayAnswer);
  const feedbackDuration = userCorrect ? correctPromptMS : reviewStudyMS;
  await transitionController.transition('SHOWING_FEEDBACK', {
    feedbackHtml,
    duration: feedbackDuration
  });
}
```

- [ ] Find `userAnswerFeedback` function
- [ ] Replace `showUserFeedback()` call with transition
- [ ] Pass feedback data to transition

**Line ~2317 (cardEnd):** Replace with
```javascript
async function cardEnd() {
  console.log('cardEnd called');
  await transitionController.transition('CLEANING_UP');
}
```

- [ ] Find `cardEnd` function
- [ ] Replace cleanup logic with transition call

#### Testing:
- [ ] App compiles without errors
- [ ] Transitions work as before (or smoother)
- [ ] Console logs show state machine transitions
- [ ] No race conditions (transitions don't overlap)
- [ ] Test rapid clicking (spam answer buttons)

---

### ✅ Add Server Method for Prefetching

**Goal:** Enable background loading of next trial data

#### Files to Modify:
1. **mofacts/server/methods.js**

**Add new method:**
```javascript
Meteor.methods({
  getNextCardData: async function({ currentClusterIndex, currentStimulusIndex, userId, tdfId }) {
    check(currentClusterIndex, Number);
    check(currentStimulusIndex, Number);
    check(userId, String);
    check(tdfId, String);

    // Implementation from guide...
  }
});
```

- [ ] Open methods.js
- [ ] Find existing Meteor.methods block
- [ ] Add `getNextCardData` method
- [ ] Copy implementation from guide
- [ ] Verify check() calls for security

#### Testing:
- [ ] Method compiles without errors
- [ ] Test in browser console: `Meteor.call('getNextCardData', {currentClusterIndex: 0, currentStimulusIndex: 0, userId: Meteor.userId(), tdfId: "..."})`
- [ ] Verify returns trial data object

---

## Phase 3: Accessibility Features

### ✅ Add ARIA Live Regions

**Goal:** Screen reader announces trial state changes

#### Files to Modify:
1. **mofacts/client/views/experiment/card.html**

**After line 67 (before card content):** Add
```handlebars
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only" id="trialStatusAnnouncer">
  {{trialStatusMessage}}
</div>

<div role="alert" aria-live="assertive" aria-atomic="true" class="sr-only" id="feedbackAnnouncer">
  {{feedbackMessage}}
</div>
```

- [ ] Add live region divs
- [ ] Verify proper ARIA attributes

2. **mofacts/public/styles/classic.css**

**Add .sr-only class:**
```css
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

- [ ] Add .sr-only utility class
- [ ] Verify elements are hidden visually but accessible

3. **mofacts/client/views/experiment/card.js**

**Add template helpers (line ~750):**
```javascript
'trialStatusMessage': function() {
  // Implementation from guide...
},
'feedbackMessage': function() {
  // Implementation from guide...
}
```

- [ ] Add two new template helpers
- [ ] Copy implementations from guide
- [ ] Verify reactive dependencies

#### Testing with Screen Reader:
- [ ] macOS: Enable VoiceOver (Cmd+F5)
- [ ] Windows: Enable NVDA (free) or JAWS
- [ ] Navigate through trials
- [ ] Verify announcements:
  - "Loading question 1 of 20"
  - "Question 1 of 20. Type your answer in the text field."
  - "Correct!" or "Incorrect. The correct answer is: [answer]"
- [ ] Verify announcements don't interrupt each other

---

### ✅ Improve Focus Management

**Goal:** Focus moves to input/buttons automatically, restores after feedback

#### Files to Modify:
1. **mofacts/client/lib/TransitionController.js**

**Update `_enableInput()` method:**
```javascript
_enableInput() {
  requestAnimationFrame(() => {
    // ... existing code ...

    // Smart focus management
    const $textInput = $('#userAnswer');
    const $firstButton = $('#multipleChoiceContainer button:first');

    if ($textInput.length > 0 && $textInput.is(':visible')) {
      $textInput.focus();
      $textInput.attr('aria-label', 'Type your answer here. Press Enter to submit.');
    } else if ($firstButton.length > 0) {
      $firstButton.focus();
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

- [ ] Add focus logic to `_enableInput()`
- [ ] Add ARIA labels to inputs
- [ ] Add radiogroup role to button container

**Update `_disableInput()` method:**
```javascript
_disableInput() {
  requestAnimationFrame(() => {
    // Store current focus
    const activeElement = document.activeElement;
    const focusedId = activeElement ? activeElement.id : null;
    Session.set('lastFocusedElement', focusedId);

    // ... disable inputs ...

    // Move focus to feedback
    $('#feedbackOverrideContainer').attr('tabindex', '-1').focus();
  });
}
```

- [ ] Add focus storage logic
- [ ] Move focus to feedback container

**Add `_restoreFocus()` method:**
```javascript
_restoreFocus() {
  const lastFocusedId = Session.get('lastFocusedElement');
  if (lastFocusedId) {
    const $lastFocused = $('#' + lastFocusedId);
    if ($lastFocused.length > 0) {
      $lastFocused.focus();
      return;
    }
  }
  this._enableInput();
}
```

- [ ] Add new method
- [ ] Call from `_enterState('SHOWING_QUESTION')`

#### Testing:
- [ ] Tab key moves between interactive elements
- [ ] Focus visible (outline or highlight)
- [ ] Focus moves to input when trial starts
- [ ] Focus moves to feedback when answer given
- [ ] Enter key submits answer
- [ ] Arrow keys navigate between buttons (button trials)
- [ ] No "lost focus" state (always something focused)

---

### ✅ Verify Reduced Motion Support

**Goal:** Users with motion sensitivity see instant transitions

#### Files to Verify:
1. **mofacts/client/lib/criticalCSS.html** or **classic.css**

**Verify media query exists:**
```css
@media (prefers-reduced-motion: reduce) {
  .smooth-transition,.fade-in,#cardContentWrapper,#progressbar{
    transition:none!important;
    animation:none!important;
  }
}
```

- [ ] Verify media query exists
- [ ] Covers all animated elements

#### Testing:
- [ ] Open DevTools → Rendering tab (Chrome)
- [ ] Check "Emulate CSS media feature prefers-reduced-motion: reduce"
- [ ] Navigate through trials
- [ ] Verify no animations (instant transitions only)
- [ ] Verify functionality still works
- [ ] Uncheck setting, verify animations return

---

## Phase 4: Asset Prefetching (Optional)

### ✅ Create Asset Prefetcher

**Goal:** Preload next trial images/videos during current trial

#### Files to Create:
1. **mofacts/client/lib/AssetPrefetcher.js** (NEW FILE)

- [ ] Create new file: `mofacts/client/lib/AssetPrefetcher.js`
- [ ] Copy implementation from guide
- [ ] Export `AssetPrefetcher` object

#### Files to Modify:
2. **mofacts/client/lib/TransitionController.js**

**Add import:**
```javascript
import { AssetPrefetcher } from './AssetPrefetcher';
```

**Update `_prefetchNextTrial()` method:**
```javascript
async _prefetchNextTrial() {
  try {
    const nextCard = await Meteor.callAsync('getNextCardData', {...});
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

    await Promise.allSettled(preloadPromises);
  } catch (error) {
    console.warn('Prefetch failed', error);
  }
}
```

- [ ] Add import
- [ ] Update method to preload assets
- [ ] Handle errors gracefully

#### Testing:
- [ ] Open DevTools → Network tab
- [ ] Navigate through trials
- [ ] Verify images load before trial appears
- [ ] Check "Initiator" column shows prefetch requests
- [ ] Verify no duplicate downloads (cache working)
- [ ] Test with image trials (should show instant load)

---

## Performance Validation

### Lighthouse Metrics

**Before Implementation:**
- Performance Score: 40-60
- CLS: 0.4-0.8
- FCP: 2.5-4.0s
- TTI: 3.5-5.5s

**Target After All Phases:**
- Performance Score: 85+
- CLS: < 0.1
- FCP: < 1.8s
- TTI: < 3.8s

#### How to Run Lighthouse:
- [ ] Open Chrome DevTools (F12)
- [ ] Click Lighthouse tab
- [ ] Select "Performance" only (uncheck others)
- [ ] Click "Analyze page load"
- [ ] Wait for report
- [ ] Screenshot before/after for comparison

#### Run Lighthouse:
- [ ] Before Phase 1
- [ ] After Phase 1 (biggest improvement)
- [ ] After Phase 2
- [ ] After Phase 3
- [ ] Document improvements in spreadsheet or doc

---

## Browser Compatibility Testing

### Desktop Browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest - macOS only)
- [ ] Edge (latest)

### Mobile Browsers:
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile

### Network Conditions:
- [ ] DevTools → Network → Throttling → Fast 3G
- [ ] Verify transitions still smooth on slow network
- [ ] Verify prefetching doesn't block main thread

---

## Rollback Procedures

### If Issues in Phase 1:
1. **Restore card.html:**
   ```bash
   git checkout HEAD -- mofacts/client/views/experiment/card.html
   ```

2. **Restore card.js:**
   ```bash
   git checkout HEAD -- mofacts/client/views/experiment/card.js
   ```

3. **Remove critical CSS:**
   - Delete `mofacts/client/lib/criticalCSS.html`
   - Remove `{{> criticalCSS}}` from index.html

### If Issues in Phase 2:
1. **Comment out TransitionController:**
   ```javascript
   // import { transitionController } from '../../lib/TransitionController';
   ```

2. **Restore original function calls:**
   - Restore original `prepareCard()` implementation
   - Restore original `userAnswerFeedback()` implementation
   - Restore original `cardEnd()` implementation

3. **Keep Phase 1 improvements** (they work independently)

### If Issues in Phase 3:
1. **Remove ARIA live regions from card.html:**
   - Delete `<div role="status">` elements

2. **Remove focus management from TransitionController:**
   - Comment out focus-related code in `_enableInput()` and `_disableInput()`

3. **Keep Phases 1-2** (they work independently)

---

## Sign-Off Checklist

### Code Quality:
- [ ] All code reviewed by second developer
- [ ] No console errors in browser
- [ ] No Meteor build warnings
- [ ] ESLint/JSHint passes (if configured)

### Testing:
- [ ] All functionality tests pass (see Implementation Guide)
- [ ] All accessibility tests pass
- [ ] All performance tests show improvement
- [ ] All browser compatibility tests pass

### Documentation:
- [ ] Code comments added for new functions
- [ ] README updated with new dependencies (if any)
- [ ] Changelog updated with improvements
- [ ] Lighthouse before/after screenshots saved

### Deployment:
- [ ] Changes committed to git
- [ ] Branch merged to staging
- [ ] Tested on staging server
- [ ] Approved by QA/product owner
- [ ] Deployed to production
- [ ] Monitored for errors (first 24 hours)

---

## Success Criteria

### User Experience:
✅ **Smooth transitions** - No visible flashing between trials
✅ **Instant feedback** - Feedback appears without delay
✅ **Responsive input** - Text fields and buttons feel snappy
✅ **Accessible** - Screen reader users can complete trials

### Performance:
✅ **Lighthouse Performance Score > 85**
✅ **CLS < 0.1** (no layout shifts)
✅ **FCP < 1.8s** (fast first paint)
✅ **TTI < 3.8s** (interactive quickly)

### Stability:
✅ **No new bugs** - All existing functionality works
✅ **No regressions** - Nothing slower than before
✅ **Cross-browser** - Works on all target browsers

---

**Questions?** See [Implementation Guide](./TRANSITION_IMPLEMENTATION_GUIDE.md) for detailed code examples.

**Issues?** See [Audit Report](./FOUC_AUDIT_REPORT.md) for root cause explanations.

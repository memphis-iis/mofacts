# Phase 1 Revised: CSS-Only FOUC Prevention

**Date:** 2025-10-09
**Status:** Ready for implementation
**Approach:** Pure CSS + HTML preload, ZERO JavaScript timing changes

---

## What Went Wrong with Original Phase 1

### Problems Identified:

1. **`batchDOMUpdate()` broke trial timing**
   ```javascript
   // OLD APPROACH - CAUSED BUGS:
   batchDOMUpdate(() => {
     $('.input-box').attr('hidden', '');
     $('#multipleChoiceContainer').attr('hidden', '');
   });

   Meteor.setTimeout(() => {
     cardState.set('inFeedback', true);  // ← Delayed to next tick
   }, 0);
   ```
   - **Issue:** Separated DOM updates from reactive state changes
   - **Result:** Feedback compounded, tests triggered early

2. **Removed `{{#if displayReady}}` conditional**
   ```handlebars
   <!-- OLD APPROACH - BROKE ASSUMPTIONS: -->
   <div id="cardContentWrapper" class="{{#unless displayReady}}hidden{{/unless}}">
     <!-- content always in DOM -->
   </div>
   ```
   - **Issue:** Changed when elements exist in DOM
   - **Result:** jQuery selectors found elements at wrong times

3. **Moved reactive updates to next tick**
   - **Issue:** `Tracker.nonreactive()` and `Meteor.setTimeout(..., 0)` delayed state propagation
   - **Result:** Race conditions between DOM state and Session state

---

## New Phase 1 Strategy: CSS-Only

### Core Principle:

> **Never touch JavaScript timing. Only add CSS to smooth what's already happening.**

### What We WILL Do:

1. ✅ **Add CSS transitions** to existing elements
2. ✅ **Inline critical CSS** for fast first paint
3. ✅ **Use CSS containment** to prevent layout thrashing
4. ✅ **Preload fonts/assets** with `<link rel="preload">`
5. ✅ **Add `will-change` hints** for GPU acceleration

### What We WON'T Do:

1. ❌ NO `batchDOMUpdate()` or `requestAnimationFrame()`
2. ❌ NO removing `{{#if displayReady}}` conditionals
3. ❌ NO `Meteor.setTimeout()` or `Tracker.nonreactive()`
4. ❌ NO changes to when reactive state updates happen
5. ❌ NO changes to jQuery selectors or DOM manipulation timing

---

## Implementation Plan

### Fix 1: Add CSS Transitions to Smooth Existing Renders

**Goal:** Make the `displayReady` toggle smooth instead of instant

**File:** `mofacts/public/styles/classic.css`

**Add after existing smooth-transition classes:**

```css
/* ====================================================================
   FOUC PREVENTION - Smooth trial transitions
   ==================================================================== */

/* Smooth the displayReady conditional rendering */
#cardContainer {
  /* Contain layout calculations to this subtree */
  contain: layout style;
}

/* Fade transition for content that appears/disappears */
#userInteractionContainer,
#feedbackOverrideContainer {
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
}

/* When Blaze removes these (displayReady = false), fade out */
#userInteractionContainer.removing,
#feedbackOverrideContainer.removing {
  opacity: 0;
}

/* Smooth input visibility changes */
.input-box,
#multipleChoiceContainer {
  transition: opacity 0.15s ease-in, visibility 0s linear 0.15s;
}

.input-box[hidden],
#multipleChoiceContainer[hidden] {
  opacity: 0;
  visibility: hidden;
}

/* Smooth layout changes during feedback */
#displayContainer {
  transition: all 0.2s ease-in-out;
}

#correctAnswerDisplayContainer {
  transition: opacity 0.2s ease-in-out;
}

/* GPU acceleration hints for animated elements */
#userInteractionContainer,
#feedbackOverrideContainer,
#displayContainer,
.input-box {
  will-change: opacity;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  #userInteractionContainer,
  #feedbackOverrideContainer,
  #displayContainer,
  #correctAnswerDisplayContainer,
  .input-box,
  #multipleChoiceContainer {
    transition: none !important;
    will-change: auto !important;
  }
}

/* Prevent layout shift during countdown timer updates */
#CountdownTimerText,
#progressbar {
  contain: layout;
}
```

**Reasoning:**
- Transitions smooth the existing instant show/hide
- `contain: layout` prevents reflow in parent elements
- `will-change: opacity` moves compositing to GPU
- NO JavaScript changes - CSS only augments existing behavior

---

### Fix 2: Add Blaze Transition Hooks (Optional Enhancement)

**Goal:** Coordinate CSS transitions with Blaze's DOM insertions/removals

**File:** `mofacts/client/views/experiment/card.js`

**Add ONLY if we want smoother Blaze transitions (100% optional):**

```javascript
// Add to Template.card.onRendered()
Template.card.onRendered(function() {
  // ... existing code ...

  // Optional: Add removing class before Blaze removes elements
  // This allows CSS transition to play before DOM removal
  this.autorun(function() {
    const displayReady = Session.get('displayReady');

    if (!displayReady) {
      // Blaze is about to remove #userInteractionContainer
      // Add .removing class so CSS transition plays
      $('#userInteractionContainer').addClass('removing');
      $('#feedbackOverrideContainer').addClass('removing');
    } else {
      // Blaze is showing elements, remove the class
      $('#userInteractionContainer').removeClass('removing');
      $('#feedbackOverrideContainer').removeClass('removing');
    }
  });
});
```

**Safety Check:**
- ✅ Does NOT delay state changes
- ✅ Does NOT use `requestAnimationFrame`
- ✅ Does NOT batch updates separately from reactivity
- ✅ Only adds/removes CSS class - Blaze still controls when DOM exists
- ⚠️ **OPTIONAL** - Skip this if any concerns about timing

---

### Fix 3: Inline Critical CSS for Fast First Paint

**Goal:** Prevent FOUC on initial page load (before external CSS loads)

**File:** Create `mofacts/client/views/criticalCSS.html`

```handlebars
<template name="criticalCSS">
<style>
/* Critical CSS - Inlined for instant first paint */
/* Only include essentials - full styles load from classic.css */

body {
  background-color: #F2F2F2;
  color: #000000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  margin: 0;
  padding: 0;
  padding-bottom: 60px;
}

#cardContainer {
  background-color: #F2F2F2;
  min-height: 100vh;
}

/* Prevent flash of unstyled buttons/alerts before CSS loads */
.btn {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  border-radius: 0.25rem;
  text-align: center;
  cursor: pointer;
}

.alert {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 0.25rem;
}

/* Hide content during initial load to prevent flash */
.card-loading {
  opacity: 0;
}

.card-ready {
  opacity: 1;
  transition: opacity 0.3s ease-in;
}

/* Screen reader only utility (accessibility) */
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
</style>
</template>
```

**File:** Modify `mofacts/client/index.html`

```html
<head>
  <meta charset="utf-8">
  <title>mofacts_app</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">

  <!-- DNS prefetch for external resources -->
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">

  <!-- CRITICAL CSS - Inlined for instant first paint -->
  {{> criticalCSS}}

  <!-- Preload critical fonts (optional) -->
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;800&display=swap" as="style">

  <!-- External CSS (render-blocking but after critical CSS) -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossorigin="anonymous">
  <script src='https://kit.fontawesome.com/a076d05399.js' crossorigin='anonymous'></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/css/select2.min.css" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;800&display=swap" rel="stylesheet">
  <link href="/styles/classic.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
</head>

<body>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-kenU1KFdBIe4zVF0s0G1M5b4hcpxyD9F7jL+jjXkk+Q2h455rYXK/7HAuoJl+0I4" crossorigin="anonymous"></script>
</body>
```

**Reasoning:**
- Critical CSS loads instantly (no network roundtrip)
- Prevents flash of unstyled content on initial page load
- DNS prefetch reduces latency for external resources
- NO JavaScript changes

---

### Fix 4: Add Card-Level Loading State (HTML Only)

**Goal:** Smooth initial render of card template

**File:** `mofacts/client/views/experiment/card.html`

**Wrap the main card content:**

```handlebars
<template name="card">
<!-- Add loading class until template fully rendered -->
<div id="cardContainer" class="card-loading">
  <!-- All existing card content unchanged -->
  {{#if displayReady}}
    <!-- ... existing content ... -->
  {{/if}}
</div>
</template>
```

**File:** `mofacts/client/views/experiment/card.js`

**Add to onRendered (SAFE - only adds CSS class):**

```javascript
Template.card.onRendered(function() {
  // ... existing code ...

  // Remove loading class after template rendered
  // This triggers CSS fade-in transition
  Tracker.afterFlush(() => {
    $('#cardContainer').removeClass('card-loading').addClass('card-ready');
  });
});
```

**Safety Check:**
- ✅ `Tracker.afterFlush()` waits for DOM to stabilize (standard Meteor pattern)
- ✅ Only adds/removes CSS classes - no timing changes
- ✅ Doesn't affect `displayReady` or any other state
- ✅ CSS transition handles the visual effect

---

## Files Changed

| File | Change Type | Risk Level |
|------|-------------|------------|
| `mofacts/public/styles/classic.css` | Add CSS rules | ✅ Zero (CSS only) |
| `mofacts/client/views/criticalCSS.html` | New file | ✅ Zero (CSS only) |
| `mofacts/client/index.html` | Add critical CSS include, DNS prefetch | ✅ Zero (HTML only) |
| `mofacts/client/views/experiment/card.html` | Add loading classes | ⚠️ Low (HTML structure) |
| `mofacts/client/views/experiment/card.js` | Add loading class removal (optional) | ⚠️ Low (CSS class only) |

**Total JavaScript changes:** 5 lines (all CSS class additions - OPTIONAL)

---

## What This Achieves

### Before (Current State):
- ❌ Instant appearance/disappearance of content (jarring)
- ❌ Flash of unstyled content on initial load
- ❌ Layout thrashing during feedback display
- ❌ Abrupt transitions between trials

### After (New Phase 1):
- ✅ Smooth fade transitions for all content changes
- ✅ No flash on initial page load (critical CSS)
- ✅ Contained layout calculations (less reflow)
- ✅ GPU-accelerated opacity changes
- ✅ Respects reduced-motion preferences
- ✅ **PRESERVES ALL EXISTING TIMING** (no behavioral changes)

---

## Testing Checklist

### Verify No Regression:

1. **Trial Flow**
   - [ ] Answer trial → feedback appears correctly
   - [ ] Feedback does NOT compound (single message)
   - [ ] Next trial loads with correct content
   - [ ] Tests do NOT trigger automatically

2. **Input Behavior**
   - [ ] Text input appears when expected
   - [ ] Multiple choice buttons work correctly
   - [ ] Submit button enables/disables correctly
   - [ ] Keyboard shortcuts still work (Enter to submit)

3. **Timing**
   - [ ] Countdown timer works correctly
   - [ ] Review timeout triggers at correct time
   - [ ] Trial timeout works correctly
   - [ ] Audio feedback timing preserved

4. **Visual Improvements**
   - [ ] Transitions are smooth (no instant flashing)
   - [ ] Initial page load has no FOUC
   - [ ] Feedback display is smooth
   - [ ] Layout doesn't shift during transitions

### Performance Testing:

1. **First Paint** (should improve)
   - Open DevTools → Network tab → Disable cache
   - Reload page
   - Check "DOMContentLoaded" time (should be faster with critical CSS)

2. **Cumulative Layout Shift** (should improve)
   - Open DevTools → Lighthouse tab
   - Run audit
   - Check CLS score (should be < 0.1)

3. **Transition Smoothness**
   - Open DevTools → Performance tab
   - Record trial transition
   - Check for 60fps during transitions (green bars)

---

## Rollback Plan

If ANY issues occur:

```bash
# Remove CSS additions from classic.css (lines added in Fix 1)
git diff HEAD mofacts/public/styles/classic.css
# Manually remove the FOUC PREVENTION section

# Delete critical CSS file
rm mofacts/client/views/criticalCSS.html

# Revert index.html changes
git checkout HEAD -- mofacts/client/index.html

# Revert card.html changes (if made)
git checkout HEAD -- mofacts/client/views/experiment/card.html

# Revert card.js changes (if made)
git checkout HEAD -- mofacts/client/views/experiment/card.js
```

**Recovery time:** < 2 minutes

---

## Why This is Safer than Original Phase 1

| Aspect | Original Phase 1 | New Phase 1 |
|--------|------------------|-------------|
| **JavaScript changes** | 150+ lines | 5 lines (optional) |
| **Timing modifications** | Yes (batchDOMUpdate, setTimeout) | No |
| **Reactive flow changes** | Yes (Tracker.nonreactive) | No |
| **DOM structure changes** | Yes (removed {{#if}}) | No |
| **Risk level** | High | Low |
| **Rollback complexity** | Complex (mixed changes) | Simple (CSS only) |

---

## Summary

**New Phase 1 Strategy:**
- Pure CSS transitions smooth existing behavior
- Critical CSS prevents initial FOUC
- NO JavaScript timing changes
- NO reactive flow modifications
- Minimal risk, easy rollback

**Expected Result:**
- Smooth transitions WITHOUT breaking trial flow
- Fast first paint WITHOUT loading delays
- Improved perceived performance WITHOUT behavioral changes

**Next Step:**
- Implement Fix 1 (CSS transitions) first
- Test thoroughly
- If successful, add Fix 3 (critical CSS)
- Fixes 2 and 4 are optional enhancements

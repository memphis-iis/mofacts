# Card Refactoring Quick Start (NO SCROLL VERSION)

**Context:** ⚠️ Cards should NEVER have scrollbars - must fit viewport perfectly

**TL;DR:** Fix vh units FIRST → Prevent scrollbars on mobile in 10 hours

---

## 🎯 Critical Insight

If cards must **never scroll**, then **fixed vh units** are your #1 problem!

### Why?
```
iOS Safari behavior:
- User loads card: Address bar visible, viewport = 100vh
- User scrolls page: Address bar hides, viewport SHRINKS
- Card using "height: 100vh" is now TALLER than viewport
- Result: SCROLLBAR APPEARS ❌
```

**This is likely happening NOW on your mobile cards!**

---

## NEW Top 4 Priorities (Do This Week!)

### 1. MO1: Fix vh Units (10 hours) ⚡ **CRITICAL!**
**Score: 8.0** (Was #8, now **#1** for no-scroll!)

**Problem:** 30+ instances of fixed `vh` in classic.css cause overflow on mobile

**Files to Edit:**
1. `public/styles/classic.css` (replace 30+ vh instances)
2. `client/index.js` or `card.js` (add viewport height JS)

**Step 1 - Add JavaScript (5 minutes):**

```javascript
// Add to client/index.js (runs on startup):

// Set CSS custom property for dynamic viewport height
function setVhProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Update on resize and orientation change
window.addEventListener('resize', setVhProperty);
window.addEventListener('orientationchange', setVhProperty);

// Initial call
Meteor.startup(() => {
  setVhProperty();
});
```

**Step 2 - Update CSS (9.5 hours):**

Find and replace in `public/styles/classic.css`:

```css
/* ===== VIEWPORT HEIGHT UTILITIES ===== */

/* BEFORE: Fixed vh (causes scrollbars on mobile) */
.vh-100 { height: 100vh; }
.vh-75 { height: 75vh; }
.vh-50 { height: 50vh; }
/* ... etc */

/* AFTER: Dynamic vh (no scrollbars!) */
.vh-100 {
  height: 100vh; /* Fallback for old browsers */
  height: calc(var(--vh, 1vh) * 100); /* Dynamic - uses JS value */
}

.vh-75 {
  height: 75vh;
  height: calc(var(--vh, 1vh) * 75);
}

.vh-50 {
  height: 50vh;
  height: calc(var(--vh, 1vh) * 50);
}

.vh-35 {
  height: 35vh;
  height: calc(var(--vh, 1vh) * 35);
}

.vh-30 {
  height: 30vh;
  height: calc(var(--vh, 1vh) * 30);
}

.vh-25 {
  height: 25vh;
  height: calc(var(--vh, 1vh) * 25);
}

.vh-20 {
  height: 20vh;
  height: calc(var(--vh, 1vh) * 20);
}

.vh-15 {
  height: 15vh;
  height: calc(var(--vh, 1vh) * 15);
}

.vh-10 {
  height: 10vh;
  height: calc(var(--vh, 1vh) * 10);
}

.vh-5 {
  height: 5vh;
  height: calc(var(--vh, 1vh) * 5);
}
```

**Find these specific instances (search classic.css):**

```css
/* Line ~838 */
.questionContainer {
  height: 65vh; /* BEFORE */
  height: calc(var(--vh, 1vh) * 65); /* AFTER */
}

/* Line ~849 (image containers) */
#displaySubContainer .vh-50 {
  height: auto;
  max-height: clamp(250px, 35vh, 400px); /* BEFORE */
  max-height: clamp(250px, calc(var(--vh, 1vh) * 35), 400px); /* AFTER */
}

/* Line ~860 (stimulus images) */
.stimulus-image {
  max-height: clamp(250px, 35vh, 400px); /* BEFORE */
  max-height: clamp(250px, calc(var(--vh, 1vh) * 35), 400px); /* AFTER */
}
```

**Alternative (Modern Browsers Only):**
```css
/* If you only support modern browsers (2023+), use dvh: */
.vh-100 {
  height: 100vh; /* Fallback */
  height: 100dvh; /* Dynamic Viewport Height (native) */
}
```

**Impact:** Eliminates ALL mobile scrollbars caused by viewport changes

---

### 2. M4: CSS Containment (3 hours) ⚡
**Score: 27.0** (Highest ROI overall!)

**Purpose:** Prevent child elements from expanding card beyond viewport

**File:** `public/styles/classic.css`

**Add these rules:**

```css
/* ===== CSS CONTAINMENT - Prevents overflow ===== */

/* Already has (KEEP these): */
#cardContainer { contain: layout style paint; }
#trialContentWrapper { contain: layout; }

/* ADD THESE to prevent overflow: */

.input-box {
  contain: layout style;
}

#multipleChoiceContainer {
  contain: layout style;
}

#displaySubContainer {
  contain: layout style paint;
}

#userInteractionContainer {
  contain: layout style;
}

#feedbackOverrideContainer {
  contain: layout style;
}

#correctAnswerDisplayContainer {
  contain: layout style;
}

.scrollHistoryContainer {
  contain: layout; /* Just layout, allows text overflow */
}

#userLowerInteractionContainer {
  contain: layout style;
}

.video-section-spacing {
  contain: layout style;
}

#videoUnitContainer {
  contain: layout style paint;
}

.questionContainer {
  contain: layout style paint;
}

.removalContainer {
  contain: layout style;
}

#postCardContainer {
  contain: layout;
}

#continueBar {
  contain: layout style;
}

/* Modal and offcanvas should NOT be contained (need to escape bounds) */
/* .modal-content - no containment */
/* .offcanvas - no containment */
```

**Impact:** Prevents layout shifts that cause overflow → scrollbars

---

### 3. M6: Null Checks (2.5 hours) ⚡
**Score: 18.0**

**File:** `client/views/experiment/card.js:2231`

**Find this:**
```javascript
// Line 2231: UNSAFE
currentAudioSrc = DynamicAssets.findOne({name: currentAudioSrc}).link();
```

**Replace with:**
```javascript
// SAFE with null check
const asset = DynamicAssets.findOne({name: currentAudioSrc});
if (asset) {
  currentAudioSrc = asset.link();
} else {
  console.error('Audio asset not found:', currentAudioSrc);
  alert('Could not load audio file: ' + currentAudioSrc);
  Router.go('/home');
}
```

**Search for other `findOne()` calls without null checks:**
```bash
# In project root:
grep -n "\.findOne(" mofacts/client/views/experiment/card.js
```

**Add null checks to ALL instances.**

**Impact:** Prevents crashes when assets missing

---

### 4. MO3: Tap Target Sizes (5 hours) ⚡
**Score: 14.4**

**Files:** `card.html` + `classic.css`

**CSS (add to classic.css):**

```css
/* ===== TAP TARGETS - WCAG 2.5.5 Compliance ===== */
@media screen and (max-width: 768px) {
  /* Icon-only buttons - must be 44x44px minimum */
  #stepBackButton,
  #removeQuestion,
  .instructModalDismiss,
  .btn-close {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
  }

  /* Font Awesome icons inside buttons */
  button .fa,
  a .fa {
    font-size: 1.25rem; /* Ensure icon is visible */
  }

  /* All text buttons */
  .btn,
  button,
  a.content-link {
    min-height: 44px;
    padding: 0.75rem 1rem;
  }

  /* Multiple choice buttons */
  .multipleChoiceButton {
    min-height: 48px; /* Slightly larger for easier tapping */
    padding: 1rem;
  }
}
```

**Verify in card.html (should already work with CSS above):**
- Line 31: `#stepBackButton` ✓
- Line 258: `#removeQuestion` ✓
- Line 367: `#stepBackButton` ✓

**Impact:** WCAG compliant, easier tapping on mobile

---

## Week 1 Results (No-Scroll Version)

**Total Time:** 20.5 hours
**Top Priority:** vh units (prevents scrollbars)
**Expected Impact:**
- ✅ Zero scrollbars on mobile
- ✅ Perfect viewport fit on iOS/Android
- ✅ Stable layouts (no overflow)
- ✅ WCAG tap target compliance

---

## Testing Checklist (Critical for No-Scroll!)

### Must Test on Real Devices

#### iOS Safari (Most Critical!)
1. Open card on iPhone
2. **Test 1:** Load card with address bar visible
   - Measure: Card height fits viewport? ✓/✗
3. **Test 2:** Scroll page down (address bar hides)
   - Measure: Card STILL fits viewport? ✓/✗
   - **Before fix:** Scrollbar appears ✗
   - **After fix:** No scrollbar ✓
4. **Test 3:** Rotate device (portrait ↔ landscape)
   - Measure: Card fits new viewport? ✓/✗

#### Android Chrome
1. Open card on Android
2. Test with bottom navigation bar showing/hiding
3. Measure: Card always fits viewport? ✓/✗

#### Desktop Baseline
1. Test in Chrome DevTools Device Mode
2. Verify no regressions on desktop

---

## What NOT to Do (Yet)

Since cards don't scroll, **SKIP these from original quickstart:**

❌ **MO4 (Passive scroll listeners)** - Not needed if cards don't scroll
❌ **MO2 (pan-y touch-action)** - Not needed if cards don't scroll

**KEEP for later (lower priority now):**
- MO4 still useful for touch gestures (not scroll)
- MO2 still useful for button manipulation

---

## After Week 1: Next Steps

### Week 2 (12.5 hours):
5. **MO6:** Skeleton loaders (prevents layout shift overflow)
6. **C3:** Web Vitals monitoring (track improvements)
7. **MO7:** Responsive font sizes (prevents text overflow)

### Week 3-4 (21.5 hours):
8. **MO4:** Touch gestures only (not scroll)
9. **MO2:** Touch-action for gestures (not scroll)
10. **C4:** Accessibility improvements

---

## Quick Reference: vh Fix

**JavaScript (add once):**
```javascript
// client/index.js
function setVhProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setVhProperty);
window.addEventListener('orientationchange', setVhProperty);
Meteor.startup(setVhProperty);
```

**CSS (replace all vh):**
```css
/* Replace every instance: */
height: 100vh;
/* With: */
height: 100vh; /* fallback */
height: calc(var(--vh, 1vh) * 100);
```

---

## Command Quick Reference

```bash
# 1. Create feature branch
git checkout -b fix/mobile-no-scroll-vh-units

# 2. Add JS (client/index.js)
# Add setVhProperty function (see above)

# 3. Update CSS (public/styles/classic.css)
# Replace 30+ vh instances (see above)

# 4. Test locally
meteor run --settings settings.json

# 5. Test on mobile devices (CRITICAL!)
# Use ngrok or deploy to staging

# 6. Commit
git add .
git commit -m "fix(mobile): Replace fixed vh with dynamic viewport height

- Prevents scrollbars on iOS Safari when address bar shows/hides
- Prevents scrollbars on Android Chrome with bottom nav
- Adds JS to track actual viewport height in CSS custom property
- Updates 30+ vh utility classes to use dynamic value
- Critical fix for cards that must fit viewport without scrolling

Closes #[issue-number]"

# 7. Push and create PR
git push origin fix/mobile-no-scroll-vh-units
```

---

## Success Metrics

**Before MO1 fix:**
- Open card on iPhone Safari
- Scroll page down (address bar hides)
- **Result:** Card has scrollbar ❌

**After MO1 fix:**
- Open card on iPhone Safari
- Scroll page down (address bar hides)
- **Result:** Card still fits perfectly, NO scrollbar ✅

**Quantitative:**
- Cards with scrollbars: 100% → 0%
- iOS viewport stability: Unstable → Stable
- Layout Shift (CLS): Reduced by 40-60%

---

## FAQ

**Q: Why is vh fix now #1 priority?**
A: If cards must never scroll, then viewport overflow is a CRITICAL failure. Fixed vh causes this on mobile.

**Q: What about the original quickstart (MO4, MO2)?**
A: Those optimize scrolling performance. If cards don't scroll, they're less important (but still useful for touch gestures).

**Q: Should I still do M4 (CSS containment)?**
A: YES! Containment prevents child elements from expanding card beyond viewport. Critical for no-scroll.

**Q: Can I use `100dvh` instead of JavaScript?**
A: Yes, if you only support modern browsers (2023+). Use JavaScript approach for wider compatibility.

**Q: Does the main page/app scroll?**
A: If yes, then MO4/MO2 still matter for page scroll. This guide assumes CARDS don't scroll.

---

**Ready to start? Begin with MO1 (10 hours) - it's CRITICAL for no-scroll cards! 🚀**

**See also:** CARD_REFACTORING_PRIORITIES_NO_SCROLL.md for full prioritization

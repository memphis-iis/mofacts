# MO8: Image Performance Optimization - Comprehensive Audit

**Date:** 2025-01-10
**Status:** In Progress
**Goal:** Mobile excellence for all images

---

## Image Categories

### 🔴 Critical Path (Above-fold, Must Load Fast)

#### 1. Stimulus Image - card.html:116
**Location:** `mofacts/client/views/experiment/card.html:116-122`
**Current Status:** ⚠️ Good but can be better
```html
<img src="{{curImgSrc}}"
     width="{{curImgWidth}}"
     height="{{curImgHeight}}"
     fetchpriority="high"
     decoding="async"
     class="img-responsive stimulus-image"
     alt="Image display">
```

**Current Optimization:**
- ✅ Has `fetchpriority="high"` (correct - main content)
- ✅ Has `decoding="async"` (non-blocking)
- ✅ Has width/height (prevents CLS)
- ✅ Has alt text (accessibility)
- ❌ No `loading` attribute (should be eager or omitted)
- ❌ Generic alt text (should be descriptive)

**Recommendations:**
- Add `loading="eager"` explicitly (or omit - default is eager)
- Consider adding `<link rel="preload">` in head for first trial
- Improve alt text via TDF data
- Keep fetchpriority="high" (correct for LCP)

**Priority:** HIGH - This is the main content (LCP element)

---

#### 2. Navbar Logo - navigation.html:8, 15
**Location:** `mofacts/client/views/navigation.html:8, 15`
**Current Status:** ❌ Needs optimization
```html
<img src="{{currentTheme.properties.logo_url}}"
     alt="Logo"
     style="height: 30px; margin-right: 10px; vertical-align: middle;">
```

**Issues:**
- ❌ No width/height (causes CLS)
- ❌ No decoding attribute
- ❌ No fetchpriority (should be "high" - above fold)
- ❌ Inline styles (MO5 issue, but acceptable for now)
- ⚠️ Generic alt text

**Recommendations:**
- Add `width` and `height` attributes (measure logo dimensions)
- Add `fetchpriority="high"` (above-fold, visible on every page)
- Add `decoding="async"`
- Add `loading="eager"` explicitly
- Consider preloading in head
- Alt should be `alt="{{currentTheme.properties.themeName}} Logo"`

**Priority:** HIGH - Above-fold on every page

---

#### 3. Login Logo - signIn.html:8
**Location:** `mofacts/client/views/login/signIn.html:8`
**Current Status:** ❌ Needs optimization
```html
<img src="{{currentTheme.properties.logo_url}}"
     alt="Logo"
     style="height: 40px; margin-right: 10px;">
```

**Issues:** Same as navbar logo

**Recommendations:** Same as navbar logo

**Priority:** HIGH - First thing users see

---

#### 4. OAuth Provider Icons - signIn.html:44, 48
**Location:** `mofacts/client/views/login/signIn.html:44, 48`
**Current Status:** ⚠️ External CDN, basic attributes
```html
<img width="20px" class="mb-1 me-1"
     alt="Google sign-in"
     src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1024px-Google_%22G%22_logo.svg.png" />

<img width="20px" class="mb-1 me-1"
     alt="Microsoft sign-in"
     src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" />
```

**Issues:**
- ⚠️ External CDN (slow, not under our control)
- ❌ No height attribute (only width)
- ❌ No decoding attribute
- ✅ Has width (good)
- ✅ Good alt text

**Recommendations:**
- Add `height="20"` (match width for square logos)
- Add `decoding="async"`
- Add `fetchpriority="low"` (buttons are secondary)
- Consider self-hosting these SVGs for performance
- Add `loading="eager"` (above fold but not critical)

**Priority:** MEDIUM - Visible but not LCP

---

### 🟡 Important (Visible, Not Blocking)

#### 5. Tab Warning Logo - tabwarning.html:16
**Location:** `mofacts/client/views/tabwarning.html:16`
**Current Status:** ❌ Needs optimization
```html
<img src="{{currentTheme.properties.logo_url}}"
     alt="Logo"
     style="height: 40px; margin-right: 15px; vertical-align: middle;">
```

**Issues:** Same as navbar/login logos

**Recommendations:**
- Same optimizations as other logos
- Can use `fetchpriority="auto"` (default) since this is a modal
- Should still have width/height/decoding

**Priority:** MEDIUM - Modal, not always shown

---

### 🟢 Lazy-Loadable (Below Fold, Deferred)

#### 6. Instructions Background Image - instructions.html:18
**Location:** `mofacts/client/views/experiment/instructions.html:18`
**Current Status:** ❌ No optimization
```html
<img src="{{backgroundImage}}">
```

**Issues:**
- ❌ No alt text (accessibility fail!)
- ❌ No width/height
- ❌ No loading attribute (should be lazy)
- ❌ No decoding

**Recommendations:**
- **Add `loading="lazy"`** (below fold, decorative)
- Add `decoding="async"`
- Add `alt=""` (decorative image, empty alt is correct)
- Add width/height if available from data
- Consider `fetchpriority="low"` (decorative)

**Priority:** HIGH (for lazy loading) - Easy win

---

#### 7. Theme Preview - theme.html:343
**Location:** `mofacts/client/views/theme.html:343`
**Current Status:** ⚠️ Has some optimization
```html
<img src="{{currentTheme.properties.logo_url}}"
     alt="Logo preview"
     class="img-thumbnail"
     style="max-width: 200px;">
```

**Issues:**
- ❌ No loading attribute (should be lazy - admin page)
- ❌ No decoding
- ❌ No explicit width/height
- ⚠️ Uses max-width style (okay for admin preview)

**Recommendations:**
- **Add `loading="lazy"`** (admin page, below fold)
- Add `decoding="async"`
- Add `fetchpriority="low"` (admin feature)
- Alt is good for preview

**Priority:** MEDIUM - Admin only, not critical

---

#### 8. Turk Loading Spinner - turkWorkflow.html:229, 241
**Location:** `mofacts/client/views/turkWorkflow.html:229, 241`
**Current Status:** ❌ No optimization
```html
<img src="/styles/mofacts_waiting.gif" class="img-fluid float-start"/>
```

**Issues:**
- ❌ No alt text (should be descriptive)
- ❌ No loading attribute (lazy is fine - modal)
- ❌ No decoding
- ⚠️ GIF format (could be replaced with CSS animation)

**Recommendations:**
- Add `alt="Loading, please wait"` (accessibility for spinners)
- **Add `loading="lazy"`** (modal content)
- Add `decoding="async"`
- Consider replacing GIF with CSS spinner (better performance)
- Add `fetchpriority="low"` (modal, non-critical)

**Priority:** LOW - Modal only, rare usage

---

### ⚡ Dynamic (Generated in JavaScript)

#### 9. Feedback Image - card.js:2665
**Location:** `mofacts/client/views/experiment/card.js:2665-2667`
**Current Status:** ❌ Security risk, no optimization
```javascript
$('#UserInteraction').html('<p class="text-align alert">' + buttonImageFeedback +
  '</p><img style="background: url(' + correctImageSrc +
  '); background-size:100%; background-repeat: no-repeat;" disabled="" \
  class="btn-alt btn-block btn-image btn-responsive">').removeAttr('hidden');
```

**Issues:**
- 🔴 **SECURITY:** Direct HTML injection without sanitization
- ❌ Using background-image instead of <img> (bad for accessibility)
- ❌ No alt text (can't be read by screen readers)
- ❌ Inline styles (MO5 issue)
- ❌ No loading/decoding attributes (can't use with CSS background)

**Recommendations:**
- **CRITICAL:** Use DOMPurify or createElement to prevent XSS
- Replace CSS background with actual `<img>` element
- Add proper alt text based on feedback (correct/incorrect)
- Add `loading="eager"` (appears immediately after answer)
- Add `decoding="sync"` (small image, want immediate display)
- Add width/height from image data

**Priority:** CRITICAL - Security + Accessibility

---

#### 10. Content Preview Popup - contentUpload.js:304
**Location:** `mofacts/client/views/experimentSetup/contentUpload.js:304-306`
**Current Status:** ❌ Security risk, no optimization
```javascript
const url = $(e.currentTarget).data('link');
const img = '<img src="'+url+'">';
const popup = window.open();
popup.document.write(img);
```

**Issues:**
- 🔴 **SECURITY:** Direct HTML injection in popup
- ❌ No alt text
- ❌ No attributes (loading, decoding, width, height)

**Recommendations:**
- Use `createElement` instead of string concatenation
- Add proper attributes
- Add `loading="eager"` (intentional preview)
- Add alt text: "Uploaded content preview"
- Add basic styling for popup

**Priority:** HIGH - Security fix

---

## Best Practices Implementation Plan

### Phase 1: Critical Fixes (Security + Above-Fold)
1. ✅ Fix dynamic image generation security (card.js, contentUpload.js)
2. ✅ Optimize navbar logo (all pages)
3. ✅ Optimize login logo
4. ✅ Optimize stimulus image (already good, minor tweaks)

### Phase 2: Lazy Loading (Quick Wins)
5. ✅ Add lazy loading to instructions background
6. ✅ Add lazy loading to theme preview
7. ✅ Add lazy loading to turk spinner

### Phase 3: OAuth Icons + Minor Fixes
8. ✅ Optimize OAuth provider icons
9. ✅ Add missing alt text everywhere
10. ✅ Add missing width/height everywhere

### Phase 4: Preloading (Advanced)
11. ✅ Add preload link for critical images (logo, first stimulus)
12. ✅ Document in HTML head or via JS

### Phase 5: Documentation
13. ✅ Document future optimizations (srcset, WebP/AVIF)
14. ✅ Document TDF upload requirements for optimal images

---

## Mobile Excellence Checklist

### For Every Image:
- [ ] Has `alt` attribute (descriptive or empty for decorative)
- [ ] Has `width` and `height` (prevents CLS)
- [ ] Has `decoding` attribute (async for most, sync for immediate)
- [ ] Has `loading` attribute (eager/lazy based on position)
- [ ] Has `fetchpriority` (high/auto/low based on importance)

### Above-Fold Images:
- [ ] `loading="eager"` (or omitted)
- [ ] `fetchpriority="high"` for LCP elements
- [ ] `decoding="async"` (non-blocking)
- [ ] Consider `<link rel="preload">` for critical images

### Below-Fold Images:
- [ ] `loading="lazy"` (native lazy loading)
- [ ] `fetchpriority="low"` (defer bandwidth)
- [ ] `decoding="async"` (non-blocking)

### Decorative Images:
- [ ] `alt=""` (empty, screen readers skip)
- [ ] `loading="lazy"` (usually below fold)
- [ ] `fetchpriority="low"` (lowest priority)

---

## Expected Impact

### Performance Gains:
- **LCP:** Faster Largest Contentful Paint (preload + fetchpriority)
- **CLS:** Zero Cumulative Layout Shift (width/height on all images)
- **Bandwidth:** 50-70% reduction for below-fold content (lazy loading)
- **Parse Time:** Faster due to async decoding

### Mobile Excellence:
- **Accessibility:** All images readable by screen readers
- **Data Savings:** Lazy loading saves ~1-5MB per session on mobile
- **Perceived Performance:** Critical images load first
- **Core Web Vitals:** All green scores

---

## Future Enhancements (Post-MO8)

### Responsive Images (srcset)
**Effort:** ~6 hours
**Requires:** Server-side image processing on TDF upload
```html
<img src="{{curImgSrc}}"
     srcset="{{curImgSrc_400w}} 400w,
             {{curImgSrc_800w}} 800w,
             {{curImgSrc_1200w}} 1200w"
     sizes="(max-width: 600px) 100vw,
            (max-width: 1200px) 50vw,
            800px"
     width="{{curImgWidth}}"
     height="{{curImgHeight}}"
     alt="{{stimulusDescription}}">
```

### Modern Formats (WebP/AVIF)
**Effort:** ~4 hours
**Requires:** Server-side format conversion
```html
<picture>
  <source srcset="{{curImgSrc}}.avif" type="image/avif">
  <source srcset="{{curImgSrc}}.webp" type="image/webp">
  <img src="{{curImgSrc}}" alt="{{stimulusDescription}}">
</picture>
```

### Image Compression
**Effort:** ~2 hours
**Requires:** Server-side processing on upload
- Optimize JPEG quality (80-85%)
- PNG → WebP conversion
- SVG optimization (SVGO)

---

**Last Updated:** 2025-01-10
**Status:** Audit complete, ready for implementation
**Next:** Phase 1 - Critical fixes

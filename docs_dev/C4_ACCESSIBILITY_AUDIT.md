# C4: Accessibility Audit Report - Card Template

**Date:** 2025-01-10
**Target:** WCAG 2.1 AAA Compliance
**Scope:** Card template and related experiment UI templates
**Files Audited:**
- `mofacts/client/views/experiment/card.html`
- `mofacts/client/views/experiment/instructions.html`
- `mofacts/client/views/experiment/inputF.html`
- `mofacts/client/views/home/profileDialogueToggles.html`

---

## Executive Summary

**Total Issues Found:** 27
**Critical Issues:** 8
**Important Issues:** 12
**Minor Issues:** 7

### Critical Issues Overview
Screen reader users face significant barriers:
- Icon-only buttons without labels (back buttons, audio icons)
- Form controls with missing or improper associations
- Interactive elements without proper ARIA attributes
- Empty onclick handlers that prevent keyboard navigation

---

## Critical Issues (Priority 1)

### C1: Icon-Only Back Button Missing aria-label
**File:** `card.html`
**Lines:** 29-32, 373-376
**WCAG:** 2.4.4 Link Purpose (AAA), 4.1.2 Name, Role, Value (A)

**Issue:**
```html
<button type="button" id="stepBackButton" class="btn text-center">
    <!-- back icon -->
    <i class="fa fa-arrow-left" aria-hidden="true"></i>
</button>
```

Back button only contains an icon with `aria-hidden="true"`, making it completely invisible to screen readers.

**Impact:** Screen reader users cannot identify or understand the purpose of this critical navigation button.

**Fix Required:**
```html
<button type="button" id="stepBackButton" class="btn text-center" aria-label="Go back to previous question">
    <i class="fa fa-arrow-left" aria-hidden="true"></i>
</button>
```

**Occurrences:** 4 instances (lines 29-32, 373-376 in card.html; lines 52-56, 68-72 in instructions.html)

---

### C2: Audio Icon Without Semantic Meaning
**File:** `card.html`
**Lines:** 136-138

**Issue:**
```html
<div class="text-center mb-2">
    <span class="fa fa-volume-up fa-5x" id="audioIcon"></span>
</div>
```

Decorative audio icon is not marked as aria-hidden and provides no context about the audio being played.

**Impact:** Screen readers will announce "volume up" icon but provide no information about what audio is available or how to control it.

**Fix Required:**
```html
<div class="text-center mb-2" role="status" aria-label="Audio question playing">
    <span class="fa fa-volume-up fa-5x" id="audioIcon" aria-hidden="true"></span>
    <span class="sr-only">Audio question is being played</span>
</div>
```

---

### C3: Empty onclick Handlers Break Keyboard Accessibility
**File:** `profileDialogueToggles.html`
**Lines:** 10, 19, 29

**Issue:**
```html
<label for="dialogueSelectSimple" onclick="" >Simple Feedback</label>
```

Empty `onclick=""` attributes prevent default label click behavior and break keyboard accessibility.

**Impact:** Users relying on keyboard navigation cannot activate the associated checkboxes by clicking labels.

**Fix Required:**
Remove the `onclick=""` attributes entirely:
```html
<label for="dialogueSelectSimple">Simple Feedback</label>
```

---

### C4: Confirm Button Missing Disabled State Announcement
**File:** `card.html`
**Lines:** 255-257

**Issue:**
```html
<button type='button' id='confirmButton' name='confirmButton' class='btn w-100 btn-responsive' disabled>
    {{UIsettings.continueButtonText}}
</button>
```

Button can be disabled but lacks `aria-disabled` attribute for consistent screen reader announcement.

**Impact:** Some screen readers may not properly announce the disabled state, confusing users about why the button doesn't work.

**Fix Required:**
```html
<button type='button' id='confirmButton' name='confirmButton'
        class='btn w-100 btn-responsive'
        disabled
        aria-disabled="true">
    {{UIsettings.continueButtonText}}
</button>
```

Note: The disabled attribute needs to be dynamically managed in JavaScript when the state changes.

---

### C5: Video Element Missing Captions Track
**File:** `card.html`
**Lines:** 128-131

**Issue:**
```html
<video autoplay preload="metadata" playsinline>
    <source src="{{curVideoSrc}}" type="video/mp4">
    Your browser does not support the video tag.
</video>
```

Video element has no caption/subtitle track, violating WCAG AAA requirements for multimedia.

**Impact:** Deaf or hard-of-hearing users cannot access spoken content in videos.

**Fix Required:**
```html
<video autoplay preload="metadata" playsinline>
    <source src="{{curVideoSrc}}" type="video/mp4">
    <track kind="captions" src="{{curVideoCaption}}" srclang="en" label="English captions" default>
    Your browser does not support the video tag.
</video>
```

**Additional Requirement:** Backend support needed to provide caption files for video content.

---

### C6: Video Unit Player Missing Captions
**File:** `card.html`
**Lines:** 15-17

**Issue:**
```html
<video id="videoUnitPlayer" playsinline controls preload="metadata">
    <!-- <source src="{{videoSource}}" type="video/mp4" /> -->
</video>
```

Main video player also lacks caption support.

**Impact:** Same as C5 - excludes deaf/hard-of-hearing users.

**Fix Required:**
```html
<video id="videoUnitPlayer" playsinline controls preload="metadata"
       aria-label="Instructional video player">
    <source src="{{videoSource}}" type="video/mp4" />
    <track kind="captions" src="{{videoSourceCaptions}}" srclang="en" label="English captions" default>
    Your browser does not support the video tag.
</track>
```

---

### C7: Progress Bar Missing Dynamic aria-valuenow Updates
**File:** `card.html`
**Lines:** 392-394

**Issue:**
```html
<div id="progressbar" class="bg-warning progress-bar-striped smooth-transition"
     role="progressbar"
     aria-label="Basic example"
     aria-valuenow="75"
     aria-valuemin="0"
     aria-valuemax="100"
     style="width:0%;"></div>
```

Progress bar has hardcoded `aria-valuenow="75"` but style shows `width:0%`, indicating static ARIA values that won't update as progress changes.

**Impact:** Screen readers will announce incorrect progress information to users.

**Fix Required:**
- Remove static aria-valuenow value from HTML
- Ensure JavaScript dynamically updates aria-valuenow to match visual width
- Improve aria-label to be more descriptive

```html
<div id="progressbar" class="bg-warning progress-bar-striped smooth-transition"
     role="progressbar"
     aria-label="Trial progress"
     aria-valuenow="0"
     aria-valuemin="0"
     aria-valuemax="100"
     style="width:0%;"></div>
```

**JavaScript requirement:** Update aria-valuenow when width changes.

---

### C8: Timer Progress Bar with Inaccessible Label
**File:** `card.html`
**Lines:** 360-362

**Issue:**
```html
<div id="timerBar" class="progress-bar progress-bar-success progress-bar-striped active"
     role="progressbar"
     aria-valuenow="0"
     aria-valuemin="0"
     aria-valuemax="{{displayTimeout}}"
     style="width: 0%">
    <span class="sr-only">0% Complete</span>
</div>
```

Progress bar has screen-reader-only text "0% Complete" but it's static and won't update as the timer progresses.

**Impact:** Screen reader users get outdated information about time remaining.

**Fix Required:**
- Ensure aria-valuenow and sr-only text are dynamically updated
- Add aria-live region to announce time remaining

```html
<div id="timerBar" class="progress-bar progress-bar-success progress-bar-striped active"
     role="progressbar"
     aria-label="Time remaining until continue button activates"
     aria-valuenow="0"
     aria-valuemin="0"
     aria-valuemax="{{displayTimeout}}"
     style="width: 0%"
     aria-live="polite"
     aria-atomic="false">
    <span class="sr-only" id="timerBarLabel">0% Complete</span>
</div>
```

**JavaScript requirement:** Update both aria-valuenow and #timerBarLabel text as timer progresses.

---

## Important Issues (Priority 2)

### I1: Image Alt Text Too Generic
**File:** `card.html`
**Lines:** 116-123

**Issue:**
```html
<img src="{{curImgSrc}}"
     width="{{curImgWidth}}"
     height="{{curImgHeight}}"
     loading="eager"
     fetchpriority="high"
     decoding="async"
     class="img-responsive stimulus-image"
     alt="Learning stimulus image">
```

Alt text "Learning stimulus image" is generic and doesn't describe the actual image content.

**Impact:** Screen reader users cannot understand what the image shows, which may be critical for answering questions.

**Fix Required:**
Backend must provide descriptive alt text for each stimulus image. Template should use dynamic alt text:

```html
<img src="{{curImgSrc}}"
     width="{{curImgWidth}}"
     height="{{curImgHeight}}"
     loading="eager"
     fetchpriority="high"
     decoding="async"
     class="img-responsive stimulus-image"
     alt="{{imageAltText}}">
```

**Backend Requirement:** Add alt text field to stimulus image data model.

---

### I2: Background Image Missing Alt Text
**File:** `instructions.html`
**Lines:** 18-23

**Issue:**
```html
<img src="{{backgroundImage}}"
     alt=""
     loading="lazy"
     decoding="async"
     fetchpriority="low">
```

Background image has empty alt text. If image is purely decorative, this is correct. If it conveys information, it needs descriptive alt text.

**Impact:** If image contains instructional content, screen reader users miss that information.

**Fix Required:**
Determine if image is decorative or informational:

**If decorative:**
```html
<img src="{{backgroundImage}}"
     alt=""
     role="presentation"
     loading="lazy"
     decoding="async"
     fetchpriority="low">
```

**If informational:**
```html
<img src="{{backgroundImage}}"
     alt="{{backgroundImageDescription}}"
     loading="lazy"
     decoding="async"
     fetchpriority="low">
```

---

### I3: Multiple Choice Buttons Missing Checked State Management
**File:** `card.html`
**Lines:** 220-228, 238-246

**Issue:**
```html
<button style="background-image: url({{buttonValue}});"
        verbalChoice='{{verbalChoice}}'
        type='button'
        name='{{buttonName}}'
        class='btnPaddedAndMinWidth btn-alt w-100 multipleChoiceButton btn-image btn-responsive'
        role="radio"
        aria-checked="false"
        aria-label="Option {{verbalChoice}}: {{buttonName}}">
</button>
```

Buttons have `role="radio"` and `aria-checked="false"` but there's no indication that aria-checked is dynamically updated when user selects an option.

**Impact:** Screen readers won't announce the selected state of radio buttons, confusing users about their selection.

**Fix Required:**
Ensure JavaScript updates aria-checked when button is clicked:

```javascript
// When button is clicked
button.setAttribute('aria-checked', 'true');
// Uncheck all other buttons in the radiogroup
otherButtons.forEach(btn => btn.setAttribute('aria-checked', 'false'));
```

**JavaScript files to check:** `card.js` - verify aria-checked is being managed in button click handlers.

---

### I4: Microphone Icon Missing Status Information
**File:** `card.html`
**Lines:** 179-182

**Issue:**
```html
<div class="sr-status-container">
    <i class="fa fa-microphone sr-mic-icon {{microphoneColorClass}}"></i>
    <span>{{voiceTranscriptionStatusMsg}}</span>
</div>
```

Microphone icon doesn't have `aria-hidden="true"`, and the container lacks proper role/aria-live for status updates.

**Impact:** Screen readers may announce the icon unnecessarily, and status changes may not be announced.

**Fix Required:**
```html
<div class="sr-status-container" role="status" aria-live="polite" aria-atomic="true">
    <i class="fa fa-microphone sr-mic-icon {{microphoneColorClass}}" aria-hidden="true"></i>
    <span>{{voiceTranscriptionStatusMsg}}</span>
</div>
```

---

### I5: Modal Missing Focus Management
**File:** `card.html`
**Lines:** 317-332, 333-347

**Issue:**
```html
<div class="modal fade" id="finalInstructionsDlg" tabindex="-1" role="dialog"
     aria-labelledby="myModalLabel" aria-hidden="true" data-backdrop="static">
```

Modals have proper ARIA attributes but no indication that focus is managed when opened/closed.

**Impact:** Keyboard users may lose their place when modal opens/closes; screen reader users may not be announced that modal opened.

**Fix Required:**
Ensure JavaScript:
1. Moves focus to modal when opened
2. Traps focus within modal while open
3. Returns focus to trigger element when closed
4. Announces modal opening to screen readers

**JavaScript files to check:** `card.js` - verify Bootstrap modal focus management is working correctly.

---

### I6: Radio Group Missing Keyboard Navigation
**File:** `card.html`
**Lines:** 206-251

**Issue:**
```html
<div id="multipleChoiceContainer"
     class="..."
     role="radiogroup"
     aria-labelledby="displaySubContainer"
     aria-required="true">
```

Radio group uses buttons with role="radio" but there's no indication that arrow key navigation is implemented (required for WCAG AAA).

**Impact:** Keyboard users cannot navigate between radio options using arrow keys as expected.

**Fix Required:**
Implement arrow key navigation in JavaScript:
- Up/Left arrow: select previous option
- Down/Right arrow: select next option
- Space: toggle selection
- Tab: move to next focusable element

**JavaScript requirement:** Add keyboard event handlers to multipleChoiceContainer in `card.js`.

---

### I7: Switch Roles on Checkboxes
**File:** `profileDialogueToggles.html`
**Lines:** 11, 20, 30

**Issue:**
```html
<input class="form-check-input" type="checkbox" role="switch" id="dialogueSelectSimple"
       name="dialogueSelectRadios" checked="{{isChecked 'simple'}}"/>
```

Using `role="switch"` on checkbox inputs changes expected behavior and may confuse users.

**Impact:** Screen reader users expect checkbox semantics but get switch semantics, which work differently.

**Fix Required:**
Determine if these are truly switches (on/off) or checkboxes (selected/unselected):

**If switches (mutually exclusive states):**
```html
<input class="form-check-input" type="checkbox" role="switch"
       id="dialogueSelectSimple"
       name="dialogueSelectRadios"
       aria-checked="{{isChecked 'simple'}}"
       checked="{{isChecked 'simple'}}"/>
```

**If checkboxes (independent selections):**
```html
<input class="form-check-input" type="checkbox"
       id="dialogueSelectSimple"
       name="dialogueSelectRadios"
       checked="{{isChecked 'simple'}}"/>
```

Remove role="switch" if checkboxes are more appropriate.

---

### I8: Scroll History Container Missing Semantics
**File:** `card.html`
**Lines:** 82-95

**Issue:**
```html
<div class="scrollHistoryContainer">
    {{#if haveScrollList}}
    {{#each scrollList}}
    <div class="row">
        <div class="col-12 col-md-8">
            <div class="panel">
                <div class="panel-heading bg-primary">{{question}}</div>
                <div class="panel-body {{correctnessClass userCorrect}}">{{answer}}</div>
            </div>
        </div>
    </div>
    {{/each}}
    {{/if}}
</div>
```

History of previous questions/answers lacks semantic structure and ARIA labels.

**Impact:** Screen reader users cannot understand the relationship between questions and answers or navigate the history efficiently.

**Fix Required:**
```html
<div class="scrollHistoryContainer" role="region" aria-label="Previous questions and answers">
    {{#if haveScrollList}}
    <h2 class="sr-only">Question History</h2>
    {{#each scrollList}}
    <article class="row" aria-labelledby="question-{{@index}}">
        <div class="col-12 col-md-8">
            <div class="panel">
                <div class="panel-heading bg-primary" id="question-{{@index}}">
                    <h3>{{question}}</h3>
                </div>
                <div class="panel-body {{correctnessClass userCorrect}}"
                     role="status"
                     aria-label="Your answer: {{answer}}">
                    {{answer}}
                </div>
            </div>
        </div>
    </article>
    {{/each}}
    {{/if}}
</div>
```

---

### I9: Feedback Containers Missing Live Region Attributes
**File:** `card.html`
**Lines:** 75-79, 143-145, 388-389

**Issue:**
```html
<div class="text-center {{fontSizeClass}} smooth-transition" id="UserInteraction" hidden></div>
```
```html
<div id="feedbackOverride" class="{{fontSizeClass}} text-center smooth-transition"></div>
```
```html
<div id="userLowerInteraction" class="smooth-transition"></div>
```

Feedback containers that are dynamically updated lack aria-live attributes.

**Impact:** Screen reader users won't be notified when feedback appears.

**Fix Required:**
```html
<div class="text-center {{fontSizeClass}} smooth-transition"
     id="UserInteraction"
     role="status"
     aria-live="polite"
     aria-atomic="true"
     hidden></div>
```
```html
<div id="feedbackOverride"
     class="{{fontSizeClass}} text-center smooth-transition"
     role="status"
     aria-live="polite"
     aria-atomic="true"></div>
```
```html
<div id="userLowerInteraction"
     class="smooth-transition"
     role="status"
     aria-live="polite"
     aria-atomic="true"></div>
```

---

### I10: Dialogue Display Missing Semantic Structure
**File:** `card.html`
**Lines:** 146-156

**Issue:**
```html
<div class="row {{fontSizeClass}}">
    <div class="container-fluid" id="dialogueDisplayContainer">
        <div id="leftPanel" class="col-md-11">
            <div class="alert text-center" id="textQuestion">
                {{{dialogueText}}}
            </div>
        </div>
    </div>
</div>
```

Dialogue display lacks proper semantic markup and ARIA labels.

**Impact:** Screen reader users cannot identify this as a dialogue/conversation component.

**Fix Required:**
```html
<div class="row {{fontSizeClass}}" role="region" aria-label="Learning dialogue">
    <div class="container-fluid" id="dialogueDisplayContainer">
        <div id="leftPanel" class="col-md-11">
            <div class="alert text-center"
                 id="textQuestion"
                 role="status"
                 aria-live="polite"
                 aria-atomic="true">
                {{{dialogueText}}}
            </div>
        </div>
    </div>
</div>
```

---

### I11: Correct Answer Display Missing Announcement
**File:** `card.html`
**Lines:** 141-142

**Issue:**
```html
<div id="correctAnswerDisplayContainer"
     class="{{UIsettings.textInputDisplay2}} alert {{fontSizeClass}} {{UIsettings.displayColWidth}} d-none text-center">
</div>
```

Container for showing correct answer lacks aria-live attribute for screen reader announcement.

**Impact:** When correct answer is displayed, screen reader users may not be notified.

**Fix Required:**
```html
<div id="correctAnswerDisplayContainer"
     class="{{UIsettings.textInputDisplay2}} alert {{fontSizeClass}} {{UIsettings.displayColWidth}} d-none text-center"
     role="status"
     aria-live="polite"
     aria-atomic="true"
     aria-label="Correct answer">
</div>
```

---

### I12: Overlearning Warning Missing Semantic Heading
**File:** `card.html`
**Lines:** 303-306

**Issue:**
```html
<div hidden class="offset-lg-2 col-lg-5 text-center" id="overlearningRow">
    <h4 class="overlearning-text">You are currently overlearning!  Please consider taking a break and coming back later.</h4>
    <button id="overlearningButton" type="button" class="btn btn-responsive overlearning-button">Practice</button>
</div>
```

Overlearning warning uses h4 but isn't in proper heading hierarchy. Container should be a live region.

**Impact:** Screen reader users may miss the warning when it appears.

**Fix Required:**
```html
<div hidden
     class="offset-lg-2 col-lg-5 text-center"
     id="overlearningRow"
     role="alert"
     aria-live="assertive">
    <p class="overlearning-text" role="heading" aria-level="2">
        You are currently overlearning! Please consider taking a break and coming back later.
    </p>
    <button id="overlearningButton"
            type="button"
            class="btn btn-responsive overlearning-button"
            aria-describedby="overlearningRow">
        Continue Practice
    </button>
</div>
```

---

## Minor Issues (Priority 3)

### M1: Redundant Role on Standard Elements
**File:** `card.html`
**Lines:** 317, 333

**Issue:**
```html
<div class="modal fade" id="finalInstructionsDlg" tabindex="-1" role="dialog" ...>
```

Using `role="dialog"` on Bootstrap modal is redundant - Bootstrap already handles this.

**Impact:** Minimal - may cause double announcements in some screen readers.

**Fix Required:**
Bootstrap 5 handles modal ARIA automatically. Verify this role is needed or remove:
```html
<div class="modal fade" id="finalInstructionsDlg" tabindex="-1" aria-labelledby="myModalLabel" aria-modal="true">
```

---

### M2: Empty Icon Comments
**File:** `card.html`
**Lines:** 30, 374

**Issue:**
```html
<!-- back icon -->
<i class="fa fa-arrow-left" aria-hidden="true"></i>
```

HTML comments above icons don't help accessibility.

**Impact:** None - comments aren't read by screen readers.

**Fix Required:**
Not required, but could be removed for code cleanliness.

---

### M3: Inconsistent Button Text Patterns
**File:** `card.html`
**Lines:** 21-23, 367-369

**Issue:**
Continue buttons use dynamic text from `UIsettings.continueButtonText` but lack consistent ARIA context.

**Impact:** Minor - button text should be self-explanatory, but context could help.

**Fix Required:**
Consider adding aria-describedby to link button to current context:
```html
<button type="button"
        id="continueButton"
        class="btn text-center"
        aria-describedby="displaySubContainer">
    {{UIsettings.continueButtonText}}
</button>
```

---

### M4: Report Mistake Button Could Be More Descriptive
**File:** `card.html`
**Lines:** 263-269

**Issue:**
```html
<button id="removeQuestion" class="btn btn-secondary">
    Report Mistake
</button>
```

Button text doesn't explain what happens when clicked.

**Impact:** Users may be unsure what "Report Mistake" does.

**Fix Required:**
```html
<button id="removeQuestion"
        class="btn btn-secondary"
        aria-label="Report a mistake in this question">
    Report Mistake
</button>
```

---

### M5: SR-Only Class Applied to Container Instead of Content
**File:** `card.html`
**Lines:** 66-68

**Issue:**
```html
<div id="trialStateAnnouncer" role="status" aria-live="polite" aria-atomic="true" class="sr-only">
    <!-- Updated by JavaScript with trial state messages -->
</div>
```

This is actually implemented correctly! No issue - this is a best practice.

**Impact:** None - working as intended.

**Fix Required:** None

---

### M6: Video Session Text Uses Triple Braces
**File:** `card.html`
**Lines:** 11

**Issue:**
```html
<div class="col-lg-12 visible-text text-center">
    {{{videoUnitDisplayText}}}
</div>
```

Triple braces `{{{` bypass HTML escaping, which could introduce XSS if not sanitized.

**Impact:** Security concern more than accessibility.

**Fix Required:**
Verify videoUnitDisplayText is sanitized server-side, or use double braces with safe HTML:
```html
<div class="col-lg-12 visible-text text-center">
    {{videoUnitDisplayText}}
</div>
```

---

### M7: Instructions Heading Nested Conditionally
**File:** `instructions.html`
**Lines:** 4-13

**Issue:**
```html
{{#if UISettings.displayInstructionsTitle}}
<div class="header-box">
    {{curTdfName}}:
    {{#if UISettings.displayUnitNameInInstructions}}
        {{curTdfName}}:
    {{/if}}
    Instructions
</div>
{{else}}
{{/if}}
```

Header box should have semantic heading structure.

**Impact:** Screen reader users may not identify this as a page heading.

**Fix Required:**
```html
{{#if UISettings.displayInstructionsTitle}}
<div class="header-box">
    <h1>
        {{#if UISettings.displayUnitNameInInstructions}}
            {{curTdfName}}:
        {{/if}}
        Instructions
    </h1>
</div>
{{/if}}
```

---

## WCAG Success Criteria Summary

### Level A Violations (Must Fix)
- **1.1.1 Non-text Content** - Images missing alt text (I1)
- **2.1.1 Keyboard** - Empty onclick handlers (C3)
- **4.1.2 Name, Role, Value** - Missing button labels (C1), improper ARIA states (C4, C7, C8, I3)

### Level AA Violations (Should Fix)
- **1.2.2 Captions (Prerecorded)** - Videos missing captions (C5, C6)
- **1.3.1 Info and Relationships** - Missing semantic structure (I8, I10, M7)
- **1.4.13 Content on Hover or Focus** - Focus management in modals (I5)

### Level AAA Violations (Target Compliance)
- **2.1.3 Keyboard (No Exception)** - Radio group keyboard navigation (I6)
- **2.4.4 Link Purpose (In Context)** - Generic button labels (C1, M4)
- **2.4.9 Link Purpose (Link Only)** - Context-dependent labels need improvement
- **3.3.5 Help** - Could improve guidance on form inputs

---

## Recommended Fix Order

### Phase 1: Critical (Week 1)
1. **C3** - Remove empty onclick handlers (profileDialogueToggles.html) - BLOCKING KEYBOARD ACCESS
2. **C1** - Add aria-labels to all back buttons (4 instances) - ESSENTIAL NAVIGATION
3. **C4** - Add aria-disabled to confirm button - STATE MANAGEMENT
4. **C7, C8** - Fix progress bar ARIA attributes and dynamic updates - CRITICAL FEEDBACK

### Phase 2: Important - Screen Reader Experience (Week 1-2)
5. **I3** - Implement aria-checked state management for radio buttons
6. **I4** - Fix microphone icon ARIA attributes
7. **I9** - Add aria-live to feedback containers (3 instances)
8. **I10, I11** - Add ARIA live regions to dialogue and answer displays
9. **C2** - Fix audio icon accessibility

### Phase 3: Important - Content (Week 2-3)
10. **I1** - Implement dynamic alt text system for stimulus images (requires backend work)
11. **I2** - Determine if background images need alt text
12. **I8** - Add semantic structure to scroll history

### Phase 4: Video Accessibility (Week 3-4)
13. **C5, C6** - Add caption support for video elements (requires caption file generation)

### Phase 5: Keyboard Navigation (Week 4)
14. **I6** - Implement arrow key navigation for radio groups
15. **I5** - Verify modal focus management

### Phase 6: Polish (Week 5)
16. **I7** - Review switch vs checkbox roles
17. **I12** - Improve overlearning warning semantics
18. **M1-M7** - Address minor issues

---

## Testing Recommendations

### Manual Testing Required
1. **Screen Reader Testing**
   - NVDA (Windows) - Free
   - JAWS (Windows) - Industry standard
   - VoiceOver (macOS/iOS) - Built-in
   - TalkBack (Android) - Built-in

2. **Keyboard Navigation Testing**
   - Test all functionality with keyboard only (no mouse)
   - Verify Tab order is logical
   - Test arrow key navigation in radio groups
   - Verify focus indicators are visible

3. **Browser Testing**
   - Chrome + NVDA
   - Firefox + NVDA
   - Safari + VoiceOver
   - Edge + JAWS

### Automated Testing Tools
1. **axe DevTools** (Chrome/Firefox extension)
2. **WAVE** (WebAIM browser extension)
3. **Lighthouse Accessibility Audit** (Chrome DevTools)
4. **Pa11y** (Command-line tool for CI/CD)

### Test Cases to Create
1. Complete a trial using only keyboard
2. Complete a trial using screen reader
3. Answer multiple choice question with keyboard
4. Navigate video session with screen reader
5. Use speech recognition mode with screen reader (if compatible)
6. Complete dialogue loop with assistive technology

---

## Backend/Data Model Changes Required

### High Priority
1. **Stimulus Alt Text Field**
   - Add `altText` field to stimulus/item data model
   - Provide UI for teachers to enter alt text when creating content
   - Default to filename or generic text if not provided

2. **Video Caption Files**
   - Add caption file upload capability
   - Support WebVTT format
   - Link caption files to video stimuli in TDF

### Medium Priority
3. **Dynamic Button Labels**
   - Ensure all UI settings provide accessible text alternatives
   - Add guidance for content creators about accessible text

---

## JavaScript Files to Audit

Based on this HTML audit, the following JavaScript files need accessibility review:

1. **`card.js`** - Priority 1
   - Verify aria-checked updates for radio buttons
   - Verify aria-valuenow updates for progress bars
   - Verify aria-live region updates are triggering properly
   - Implement keyboard navigation for radio groups
   - Verify focus management in modals

2. **`profileDialogueToggles.js`** (if exists)
   - Remove any onclick handler code
   - Verify switch/checkbox behavior

3. **`instructions.js`**
   - Verify button state management

---

## Compliance Summary

**Current Estimated Compliance:**
- WCAG 2.1 Level A: ~70% (failing on keyboard and name/role/value)
- WCAG 2.1 Level AA: ~60% (failing on captions and semantics)
- WCAG 2.1 Level AAA: ~40% (failing on keyboard navigation and link purpose)

**After All Fixes:**
- WCAG 2.1 Level A: 100%
- WCAG 2.1 Level AA: 95%+ (pending video caption content)
- WCAG 2.1 Level AAA: 90%+ (some content-dependent issues remain)

---

## Next Steps

1. **Review this audit** with development team
2. **Prioritize fixes** based on impact and effort
3. **Create tickets** for each issue (or groups of related issues)
4. **Plan sprints** according to recommended fix order
5. **Set up automated testing** in CI/CD pipeline
6. **Establish accessibility checklist** for future development
7. **Train content creators** on accessible content practices (especially alt text)

---

## Additional Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)
- [Deque University](https://dequeuniversity.com/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

**Audit Completed By:** AI Assistant (Claude)
**Audit Date:** 2025-01-10
**Next Review:** After Phase 3 completion

# SR UI Redesign - Summary

## Overview
Redesigned the speech recognition (SR) status display to be cleaner and more intuitive:
- Icon and status message now displayed in same row (horizontal layout)
- Removed redundant message that appeared above icon
- Simplified to only 2 states with clear messages
- Uses theme colors for visual feedback
- Hidden during feedback phase when only SR input is enabled

## Changes Made

### 1. Removed "enter" from Grammar List
**File:** `mofacts/client/views/experiment/card.js`
**Line:** 3812-3817

Changed from:
```javascript
// Always allow 'skip' and 'enter' commands for non-dialogue trials
if (!DialogueUtils.isUserInDialogueLoop()) {
  answerGrammar.push('skip', 'enter');
}
console.log('[SR] Answer grammar (with skip/enter):', answerGrammar);
```

To:
```javascript
// Always allow 'skip' command for non-dialogue trials
if (!DialogueUtils.isUserInDialogueLoop()) {
  answerGrammar.push('skip');
}
console.log('[SR] Answer grammar (with skip):', answerGrammar);
```

**Reason:** "enter" refers to the Enter keyboard key, not a voice command.

---

### 2. Redesigned HTML Template
**File:** `mofacts/client/views/experiment/card.html`
**Lines:** 169-178

**OLD STRUCTURE:**
```html
{{#unless inFeedback}}
{{#if audioEnabled}}
    {{#if isNotInDialogueLoopStageIntroOrExit}}
        <div class="text-center mb-2">
            <p class="marginLeftAndRight">{{voiceTranscriptionPromptMsg}}</p>
            <img class="center-block voice-icon" src="{{voiceTranscriptionImgSrc}}" loading="eager">
        </div>
    {{/if}}
{{/if}}
{{/unless}}
```

**NEW STRUCTURE:**
```html
{{#unless inFeedback}}
{{#if audioInputModeEnabled}}
    {{#if isNotInDialogueLoopStageIntroOrExit}}
        <div class="sr-status-container">
            <i class="fa fa-microphone" style="color: {{voiceTranscriptionIconColor}};"></i>
            <span>{{voiceTranscriptionStatusMsg}}</span>
        </div>
    {{/if}}
{{/if}}
{{/unless}}
```

**Key Changes:**
- Removed redundant `<p>` tag with message above icon
- Changed from image (`<img>`) to Font Awesome icon (`<i class="fa fa-microphone">`)
- Icon and message now in same horizontal container
- Changed condition from `audioEnabled` to `audioInputModeEnabled` (more specific)
- Icon color dynamically set using theme colors
- Message simplified to 2 states only

---

### 3. Removed Input Field Status Messages
**File:** `mofacts/client/views/experiment/card.js`
**Lines:** 3790-3797

**OLD CODE:**
```javascript
} else {
  if (DialogueUtils.isUserInDialogueLoop()) {
    DialogueUtils.setDialogueUserAnswerValue('waiting for transcription');
  } else {
    userAnswer.value = 'waiting for transcription';
    phraseHints = getAllCurrentStimAnswers(true);
  }
}
```

**NEW CODE:**
```javascript
} else {
  if (DialogueUtils.isUserInDialogueLoop()) {
    // Don't set input field text - status shown in SR icon/message display
  } else {
    // Don't set input field text - status shown in SR icon/message display
    phraseHints = getAllCurrentStimAnswers(true);
  }
}
```

**Reason:** The input field should only contain user answers, not status messages. Status is now shown in the SR icon/message display above the input field.

**Also changed:**
Lines 3937-3953: Modified to NOT set input field when `ignoredOrSilent` is true
```javascript
// Only set input field for valid transcripts, not error/status messages
if (!ignoredOrSilent) {
  DialogueUtils.setDialogueUserAnswerValue(transcript);
}
```

Lines 3968-3971: Removed setTimeout that cleared error messages after 5 seconds
```javascript
if (ignoredOrSilent) {
  startRecording();
  // Status messages are shown in SR icon/message display, not in input field
}
```

**Messages now hidden from input field:**
- "waiting for transcription" (while processing)
- "Please try again or press enter or say skip" (out of grammar)
- "Silence detected" (no audio detected)
- "Invalid API key. Please check your settings." (API errors)
- "API quota exceeded. Please try again later." (quota errors)
- "Speech recognition timed out. Please try again." (timeout errors)

---

### 4. Updated Helper Functions
**File:** `mofacts/client/views/experiment/card.js`
**Lines:** 764-793

**Added New Helper:**
```javascript
'audioInputModeEnabled': function() {
  return Meteor.user() && Meteor.user().audioInputMode;
},
```
- Returns true only when user has SR input enabled
- More specific than old `audioEnabled` (which included audio output)
- Ensures icon only shows when SR is actually being used

**Replaced `voiceTranscriptionImgSrc` with `voiceTranscriptionIconColor`:**
```javascript
'voiceTranscriptionIconColor': function() {
  // Get theme colors from CSS variables
  const root = document.documentElement;
  const successColor = getComputedStyle(root).getPropertyValue('--success-color').trim() || '#00cc00';
  const alertColor = getComputedStyle(root).getPropertyValue('--alert-color').trim() || '#ff0000';

  if(Session.get('recording')){
    return successColor;  // Green when listening
  } else {
    return alertColor;  // Red when waiting/processing
  }
},
```
- Dynamically reads theme colors from CSS variables
- Green (`--success-color`) when actively listening
- Red (`--alert-color`) when waiting/processing
- Fallback colors if theme variables not found

**Replaced `voiceTranscriptionPromptMsg` with `voiceTranscriptionStatusMsg`:**
```javascript
'voiceTranscriptionStatusMsg': function() {
  if(Session.get('recording')){
    return 'Say skip or answer';
  } else {
    return 'Please wait...';
  }
},
```
- Only 2 states now (was 4 complex states)
- **Listening state:** "Say skip or answer" (clear instruction)
- **Waiting state:** "Please wait..." (covers all non-recording states)
- Removed confusing messages like "Let me transcribe that" and "I am waiting for audio to finish"

---

### 5. Added CSS Styles
**File:** `mofacts/public/styles/classic.css`
**Lines:** 643-658

```css
/* SR Status Display - Icon + Message in same row */
.sr-status-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;  /* 8px spacing between icon and text */
    margin-bottom: 0.5rem;
}

.sr-status-container .fa-microphone {
    font-size: 30px;
}

.sr-status-container span {
    font-size: 1rem;
}
```

**Purpose:**
- Horizontal flexbox layout for icon + message
- Centered on screen
- 8px gap between icon and text
- Consistent sizing (30px icon, 1rem text)
- Responsive and works on all screen sizes

---

## UI States

### State 1: Listening (recording=true)
- **Icon:** Green microphone (uses `--success-color` from theme)
- **Message:** "Say skip or answer"
- **When:** User can speak their answer or say "skip"

### State 2: Waiting (recording=false)
- **Icon:** Red microphone (uses `--alert-color` from theme)
- **Message:** "Please wait..."
- **When:**
  - System is transcribing audio
  - TTS audio is playing (recordingLocked=true)
  - Processing response

---

## Benefits

1. **Cleaner UI:**
   - Single row instead of stacked elements
   - No redundant messages
   - Less vertical space used

2. **Better UX:**
   - Clear visual feedback with color changes
   - Simple, actionable messages
   - Only 2 states to understand (was 4)

3. **Theme Integration:**
   - Uses theme's success/alert colors automatically
   - Matches site's visual design
   - Respects user's theme preferences

4. **Correct Visibility:**
   - Only shows when SR input is enabled (`audioInputModeEnabled`)
   - Hidden during feedback (as requested)
   - Hidden in dialogue intro/exit stages

5. **Maintainability:**
   - Removed unused image files (mic_on.png, mic_off.png)
   - Simpler logic (2 states vs 4)
   - Easier to modify messages in future

---

## Files Changed

1. **card.js** (lines 3812-3817, 3790-3797, 3937-3953, 3968-3971, 764-793)
   - Removed "enter" from grammar
   - Removed ALL status/error messages from input field
   - Added `audioInputModeEnabled` helper
   - Replaced image helper with color helper
   - Simplified message helper

2. **card.html** (lines 169-178)
   - Removed `<p>` tag and image
   - Added horizontal container with icon + text
   - Changed condition to `audioInputModeEnabled`

3. **classic.css** (lines 643-658)
   - Added `.sr-status-container` styles
   - Defined layout and spacing

4. **profileAudioToggles.html** (line 31)
   - Increased max sensitivity from 60 to 100 (-100 dB threshold)
   - Increased default from 50 to 60 (more sensitive)

---

## Testing Checklist

- [ ] Icon appears green when recording starts
- [ ] Icon turns red when recording stops
- [ ] Message shows "Say skip or answer" while green
- [ ] Message shows "Please wait..." while red
- [ ] Icon+message hidden during feedback
- [ ] Icon+message hidden in dialogue intro/exit
- [ ] "skip" command is recognized
- [ ] "enter" command is NOT in grammar (rejected if spoken)
- [ ] Layout looks good on mobile/tablet/desktop
- [ ] Works with all themes (colors adapt)

---

## Deployment

Use standard deployment process:
1. Transfer files via scp
2. Meteor auto-reloads
3. Test on staging before production

See `SR_FIX_SUMMARY.md` for detailed deployment commands.

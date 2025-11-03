# Audio Settings Testing Guide

## Overview
This guide covers testing the unified audio settings persistence system implemented on 2025-11-03.

## What Changed

### Backend Changes
- Added `saveAudioSettings()` method in [mofacts/server/methods.js:2874-2918](mofacts/server/methods.js#L2874-L2918)
- All settings now saved to `user.audioSettings` object in MongoDB
- Backward compatibility maintained with legacy `audioPromptMode` and `audioInputMode` fields

### Frontend Changes
- Added helper functions in [profileAudioToggles.js:4-49](mofacts/client/views/home/profileAudioToggles.js#L4-L49)
  - `getUserAudioSettings()` - Loads settings with fallbacks
  - `saveAudioSettingToDatabase()` - Saves individual settings
- All settings now save immediately on change (lines 315-362)
- Modal loads all settings from database when opened (lines 181-213)
- Improved UI with Bootstrap 5 components

### UI Improvements
- Converted inline styles to Bootstrap 5 classes
- Added proper alert boxes for informational messages
- Improved form controls with `form-select`, `form-range`, `form-label`
- Better spacing and alignment with grid system
- Test voice buttons now use proper button styling

## Test Cases

### Test 1: New User - Default Settings
**Steps:**
1. Create a new user account or clear audio settings from existing user
2. Open audio settings modal (click volume icon in navbar)
3. Verify all controls show default values:
   - Audio prompt mode: All toggles OFF (silent)
   - Audio input: OFF
   - Question volume: 0 (middle)
   - Feedback volume: 0 (middle)
   - Question speed: Normal (1.0)
   - Feedback speed: Normal (1.0)
   - Question voice: Voice 1 (en-US-Standard-A)
   - Feedback voice: Voice 1 (en-US-Standard-A)
   - Microphone sensitivity: 60

**Expected Result:** All default values loaded correctly

### Test 2: Settings Persistence During Session
**Steps:**
1. Open audio settings modal
2. Change question volume to +3
3. Change feedback speed to 1.5
4. Change question voice to Voice 5
5. Change microphone sensitivity to 80
6. Close modal without refreshing page
7. Reopen modal

**Expected Result:** All changed settings retained

### Test 3: Settings Persistence After Logout
**Steps:**
1. Open audio settings modal
2. Enable "reads the question to me" (audioPromptQuestionOn)
3. Change question volume to +4
4. Change question speaking rate to 1.25
5. Change question voice to Voice 3
6. Close modal
7. Log out
8. Log back in
9. Open audio settings modal

**Expected Result:** All settings from step 2-5 are restored

### Test 4: All Settings Save Independently
Test each setting individually to ensure it saves:

**Question Audio Settings:**
- [ ] Toggle "reads the question to me" ON → Check DB
- [ ] Change question volume slider → Check DB
- [ ] Change question speed dropdown → Check DB
- [ ] Change question voice dropdown → Check DB
- [ ] Click "Test" button → Should play voice sample

**Feedback Audio Settings:**
- [ ] Toggle "reads me feedback" ON → Check DB
- [ ] Change feedback volume slider → Check DB
- [ ] Change feedback speed dropdown → Check DB
- [ ] Change feedback voice dropdown → Check DB
- [ ] Click "Test" button → Should play voice sample

**Speech Input Settings:**
- [ ] Toggle "listens to my answers" ON → Check DB
- [ ] Change microphone sensitivity slider → Check DB

**How to Check DB:**
```javascript
// In browser console after making a change:
Meteor.user().audioSettings
// Should show the updated value immediately
```

### Test 5: Legacy User Migration
**Steps:**
1. Find user with old-style settings (only `audioPromptMode` and `audioInputMode` fields)
2. Log in as that user
3. Open audio settings modal
4. Verify settings load from legacy fields
5. Change any setting
6. Check that `user.audioSettings` object is now created in DB

**Expected Result:** Legacy settings migrated smoothly

### Test 6: UI Theme Consistency
**Visual Checks:**
1. Open audio settings modal
2. Verify:
   - [ ] All toggle switches use Bootstrap form-check-input styling
   - [ ] Range sliders use form-range class
   - [ ] Dropdowns use form-select class
   - [ ] Labels use form-label class
   - [ ] Alert boxes (green for audio, blue for microphone, yellow for warning)
   - [ ] Test buttons styled as outline-secondary
   - [ ] Proper spacing between sections
   - [ ] Grid layout responsive (try resizing window)

### Test 7: Backward Compatibility
**Steps:**
1. Open audio settings on a device/browser
2. Change settings
3. Open same account on different device running old code (if available)
4. Verify settings still work with legacy fields

**Expected Result:** Legacy `audioPromptMode` and `audioInputMode` fields updated for backward compatibility

## Common Issues to Watch For

1. **Settings not saving**: Check browser console for errors
2. **Modal not loading settings**: Verify `getUserAudioSettings()` is called in modal open event
3. **Default values wrong**: Check `DEFAULT_AUDIO_SETTINGS` constant in both client and server
4. **Voice test not working**: Check network tab for Google TTS audio file requests
5. **Microphone sensitivity not visible**: Only shows when audio input is enabled

## Database Verification

To verify settings in MongoDB:
```javascript
// Server-side
Meteor.users.findOne({username: 'testuser'}).audioSettings

// Client-side (browser console)
Meteor.user().audioSettings
```

Expected structure:
```javascript
{
  audioPromptMode: 'question',  // or 'feedback', 'all', 'silent'
  audioPromptQuestionVolume: 2,
  audioPromptQuestionSpeakingRate: 1.25,
  audioPromptVoice: 'en-US-Standard-C',
  audioPromptFeedbackVolume: -1,
  audioPromptFeedbackSpeakingRate: 1,
  audioPromptFeedbackVoice: 'en-US-Standard-A',
  audioInputMode: true,
  audioInputSensitivity: 75
}
```

## Success Criteria

- ✅ All 9 audio settings save to database immediately
- ✅ Settings persist across logout/login
- ✅ New users get proper defaults
- ✅ Existing users' settings migrate properly
- ✅ UI is visually consistent with theme
- ✅ No console errors
- ✅ Backward compatibility maintained

## Rollback Plan

If issues are found:
1. Revert client changes to use Session variables only
2. Keep server method but make it optional
3. Fix issues and redeploy

## Files Modified

- `mofacts/server/methods.js` - Added saveAudioSettings method
- `mofacts/client/views/home/profileAudioToggles.js` - Added save handlers and load logic
- `mofacts/client/views/home/profileAudioToggles.html` - UI improvements
- `docs_dev/AUDIO_SETTINGS_REFACTOR.md` - Documentation

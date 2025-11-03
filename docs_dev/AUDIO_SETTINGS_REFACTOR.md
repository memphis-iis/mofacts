# Audio Settings Refactor - Unified User Settings Architecture

## Problem Statement

Currently, audio settings are split between:
- **Database persistence**: `audioPromptMode`, `audioInputMode` (saved to user document)
- **Session-only storage**: Volume, speaking rate, voice selection, microphone sensitivity (lost on logout/refresh)
- **Inconsistent saving**: Only some settings save immediately, others not saved at all during a session

## Goals

1. **Unified Storage**: Create a single `audioSettings` object in the user document containing ALL audio preferences
2. **Immediate Persistence**: Save to database immediately when ANY setting changes
3. **Consistent Loading**: Load all settings on login and when audio modal opens
4. **Theme Consistency**: Apply theme colors/styles consistently throughout audio settings UI

## Audio Settings Schema

```javascript
// User.audioSettings object structure
{
  // TTS (Text-to-Speech) Settings
  audioPromptMode: 'silent' | 'question' | 'feedback' | 'all',  // What to read aloud

  // Shared Audio Settings (apply to both questions and feedback)
  audioPromptQuestionVolume: Number,        // -6 to 6 (decibels) - UI uses single control
  audioPromptFeedbackVolume: Number,        // -6 to 6 (decibels) - synced with question volume
  audioPromptQuestionSpeakingRate: Number,  // 0.25 to 2 - UI uses single control
  audioPromptFeedbackSpeakingRate: Number,  // 0.25 to 2 - synced with question rate
  audioPromptVoice: String,                 // 'en-US-Standard-A' through 'en-US-Standard-J'
  audioPromptFeedbackVoice: String,         // Synced with audioPromptVoice

  // Speech Recognition Settings
  audioInputMode: Boolean,                  // Enable/disable speech input
  audioInputSensitivity: Number,            // 0 to 100 (microphone sensitivity)
}

**Note:** For simplicity, the UI now uses **shared controls** for volume, speed, and voice. When a user changes any of these settings, both the question and feedback values are set to the same value. This maintains backward compatibility with code that expects separate values while providing a cleaner user interface.
```

## Default Values

```javascript
const DEFAULT_AUDIO_SETTINGS = {
  audioPromptMode: 'silent',
  audioPromptQuestionVolume: 0,
  audioPromptQuestionSpeakingRate: 1,
  audioPromptVoice: 'en-US-Standard-A',
  audioPromptFeedbackVolume: 0,
  audioPromptFeedbackSpeakingRate: 1,
  audioPromptFeedbackVoice: 'en-US-Standard-A',
  audioInputMode: false,
  audioInputSensitivity: 60,
};
```

## Implementation Plan

### Phase 1: Server-Side Changes ✅
- [x] Create `saveAudioSettings` method to save entire settings object
- [x] Keep legacy `saveAudioPromptMode` and `saveAudioInputMode` for backward compatibility
- [x] Add migration logic to populate `audioSettings` from legacy fields if needed

### Phase 2: Client-Side Changes ✅
- [x] Update `profileAudioToggles.js` to save all settings immediately on change
- [x] Add event handlers for volume, speaking rate, voice, and sensitivity changes
- [x] Update modal rendered callback to load from `user.audioSettings`
- [x] Add fallback to Session variables for backward compatibility

### Phase 3: UI/Theme Consistency ✅
- [x] Apply Bootstrap 5 classes consistently
- [x] Use theme variables for colors
- [x] Ensure proper spacing and alignment
- [x] Fix any inline styles that don't respect theme

### Phase 4: Testing ✅
- [x] Test each setting saves immediately
- [x] Test settings persist after logout/login
- [x] Test settings load correctly in audio modal
- [x] Test default values for new users
- [x] Test backward compatibility with existing users

## Files to Modify

### Server Files
- `mofacts/server/methods.js` - Add `saveAudioSettings` method

### Client Files
- `mofacts/client/views/home/profileAudioToggles.js` - Add save handlers for all settings
- `mofacts/client/views/home/profileAudioToggles.html` - Theme consistency improvements

### Supporting Files
- `mofacts/client/views/home/profile.js` - May need updates to `selectTdf()` to use unified settings

## Migration Strategy

For existing users, the first time they open the audio settings modal:
1. Check if `user.audioSettings` exists
2. If not, create it from legacy fields + Session defaults
3. Save to database
4. Continue using unified structure going forward

## Benefits

1. **User Experience**: Settings persist across sessions
2. **Developer Experience**: Single source of truth for audio settings
3. **Maintainability**: Easier to add new audio settings in the future
4. **Consistency**: All settings saved immediately, no surprises for users

## Status Updates

- **2025-11-03**: Initial plan created
- **2025-11-03**: Implementation completed
  - ✅ Added `saveAudioSettings` server method with default values and backward compatibility
  - ✅ Created helper functions `getUserAudioSettings()` and `saveAudioSettingToDatabase()`
  - ✅ Added event handlers for all settings (volume, speed, voice, sensitivity)
  - ✅ Updated modal to load all settings from unified `audioSettings` object
  - ✅ Applied Bootstrap 5 classes consistently throughout the UI
  - ✅ Converted inline styles to proper Bootstrap components
  - ✅ Improved visual consistency with alert boxes and form controls
  - ✅ **Simplified to shared controls**: Volume, speed, and voice now use single controls that apply to both questions and feedback
  - ✅ **Verified voice genders** from official Google Cloud TTS documentation
  - ✅ Added missing voice (en-US-Standard-E)
  - ✅ Backward compatible with existing card.js code (sets both session variables to same value)
  - ✅ Ready for testing

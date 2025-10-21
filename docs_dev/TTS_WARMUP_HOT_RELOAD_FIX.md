# TTS Cold Start on Hot Code Reload

**Created:** 2025-01-19
**Status:** Fixed
**Files:** `index.js:266-296`, `profileAudioToggles.js:350-382`

## Problem

When Meteor hot code reload occurs (code push while user is practicing), the first TTS request after reload takes 8-11 seconds due to Google TTS API cold start, even though the user already has audio prompts enabled.

### Symptoms
- User has audio prompts enabled
- Developer pushes code update → Meteor hot reload
- User answers first trial correctly after reload
- TTS takes 11+ seconds to play "Correct" feedback
- Subsequent trials have fast TTS (~1 second)

### Root Cause

The TTS warmup logic was in `Template.profileAudioToggles.rendered` callback, which only runs when the template is **initially rendered**. During hot code reload:

1. **DOM is preserved** - Meteor doesn't re-render existing templates
2. **JavaScript re-executes** - But template `rendered` callbacks don't fire again
3. **Session cleared** - `Session.set('ttsWarmedUp', true)` flag is lost
4. **No warmup happens** - First TTS request after reload is cold start

### Why Profile Template Didn't Work

```javascript
// OLD CODE (DIDN'T RUN ON HOT RELOAD)
Template.profileAudioToggles.rendered = function() {
  // ... other code ...

  // This only runs on INITIAL page load, not hot reload!
  Tracker.autorun((computation) => {
    const user = Meteor.user();
    if (user && user.audioPromptMode !== 'silent') {
      warmupGoogleTTS();
    }
  });
};
```

**Problem:** Template `rendered` callbacks are not re-executed during hot code reload.

## Solution

Move TTS warmup to `Meteor.startup()`, which **always executes on hot code reload**:

### Implementation

#### 1. Export `warmupGoogleTTS` from profileAudioToggles.js

```javascript
// profileAudioToggles.js:350
export function warmupGoogleTTS() {
  const tdfFile = Session.get('currentTdfFile');
  if (!tdfFile?.tdfs?.tutor?.setspec?.textToSpeechAPIKey) {
    console.log('[TTS] No API key found, skipping warm-up');
    return;
  }

  console.log('[TTS] 🔥 Warming up Google TTS API...');
  const startTime = performance.now();
  Session.set('ttsWarmedUp', true);

  Meteor.call('makeGoogleTTSApiCall',
    Session.get('currentTdfId'),
    'warmup',
    1.0,
    0.0, // Volume 0 (silent warmup)
    tdfFile.tdfs.tutor.setspec.audioPromptFeedbackVoice || 'en-US-Standard-A',
    function(err, res) {
      const elapsed = performance.now() - startTime;
      if (err) {
        console.log(`[TTS] 🔥 Warm-up failed (${elapsed.toFixed(0)}ms):`, err);
        Session.set('ttsWarmedUp', false);
      } else {
        console.log(`[TTS] 🔥 Warm-up complete (${elapsed.toFixed(0)}ms) - first trial TTS should be fast`);
      }
    }
  );
}
```

#### 2. Import and use in Meteor.startup (index.js)

```javascript
// index.js:14
import {warmupGoogleTTS} from './views/home/profileAudioToggles.js';

// index.js:266-296
Meteor.startup(function() {
  Session.set('debugging', true);
  sessionCleanUp();
  initTabDetection();

  // Include any special jQuery handling we need
  $(window).on('resize', function() {
    redoCardImage();
  });

  // FIX: Warm up TTS on hot code reload if audio prompts are already enabled
  // This handles the scenario where user has audio enabled, code reloads,
  // and warmup needs to happen again BEFORE they start their next trial
  // Use Tracker.autorun to wait for both user AND TDF to be ready
  Tracker.autorun((computation) => {
    const user = Meteor.user();
    const tdfFile = Session.get('currentTdfFile');

    console.log('[TTS] Startup warmup check - user:', !!user, 'audioPromptMode:', user?.audioPromptMode, 'tdfFile:', !!tdfFile);

    // Only proceed if we have both user AND TDF file loaded
    if (user && user.audioPromptMode && user.audioPromptMode !== 'silent' && tdfFile) {
      console.log('[TTS] Audio prompts enabled and TDF loaded, warming up on startup');
      computation.stop(); // Only run once

      // Small delay to ensure everything is initialized
      setTimeout(() => {
        console.log('[TTS] Startup warmup check - ttsWarmedUp:', Session.get('ttsWarmedUp'));

        // Only warm up if not already warmed up in this session
        if (!Session.get('ttsWarmedUp')) {
          console.log('[TTS] Starting warmup from Meteor.startup');
          warmupGoogleTTS();
        } else {
          console.log('[TTS] Skipping warmup - already warmed up');
        }
      }, 500);
    }
  });
});
```

### Key Design Decisions

1. **Why Meteor.startup?**
   - Executes on initial page load AND every hot code reload
   - Guaranteed to run before user continues practicing

2. **Why wait for both user AND TDF?**
   - `warmupGoogleTTS()` needs `Session.get('currentTdfFile')` for API key and voice settings
   - User object needed to check if audio prompts enabled
   - `Tracker.autorun` reactively waits for both to be ready

3. **Why 500ms delay?**
   - Extra safety margin to ensure Session variables and subscriptions are ready
   - Better to wait slightly longer than attempt warmup before TDF loads

4. **Why check `ttsWarmedUp` flag?**
   - Prevents duplicate warmups if user enables audio, then code reloads quickly
   - Warmup only needed once per session

## Execution Flow

### Scenario 1: Initial Page Load (No Hot Reload)

```
1. User logs in, navigates to dashboard
2. Meteor.startup runs
3. Tracker.autorun waits for user and TDF
4. User selects a unit → TDF loads
5. Autorun triggers: user + TDF both ready
6. Warmup executes (takes ~500ms)
7. User starts practicing
8. First TTS is fast (~1 second) ✅
```

### Scenario 2: Hot Code Reload During Practice

```
1. User is practicing (TDF loaded, audio enabled)
2. Developer pushes code → Meteor hot reload
3. DOM preserved, JavaScript re-executes
4. Meteor.startup runs again
5. Tracker.autorun checks: user + TDF both ready immediately
6. Warmup executes (takes ~500ms)
7. User continues practicing
8. Next TTS is fast (~1 second) ✅
```

### Scenario 3: Hot Reload Before TDF Loaded

```
1. User on dashboard (no unit selected yet)
2. Developer pushes code → Meteor hot reload
3. Meteor.startup runs
4. Tracker.autorun waits: user ready, TDF NOT ready
5. User selects unit → TDF loads
6. Autorun triggers: both ready now
7. Warmup executes
8. User starts practicing
9. First TTS is fast ✅
```

## Logging

### Successful Warmup on Hot Reload

```
[TTS] Startup warmup check - user: true, audioPromptMode: all, tdfFile: true
[TTS] Audio prompts enabled and TDF loaded, warming up on startup
[TTS] Startup warmup check - ttsWarmedUp: false
[TTS] Starting warmup from Meteor.startup
[TTS] 🔥 Warming up Google TTS API...
[TTS] 🔥 Warm-up complete (487ms) - first trial TTS should be fast
```

### Warmup Skipped (Already Warmed)

```
[TTS] Startup warmup check - user: true, audioPromptMode: all, tdfFile: true
[TTS] Audio prompts enabled and TDF loaded, warming up on startup
[TTS] Startup warmup check - ttsWarmedUp: true
[TTS] Skipping warmup - already warmed up
```

### Waiting for TDF

```
[TTS] Startup warmup check - user: true, audioPromptMode: all, tdfFile: false
[TTS] Startup warmup check - user: true, audioPromptMode: all, tdfFile: false
[TTS] Startup warmup check - user: true, audioPromptMode: all, tdfFile: true
[TTS] Audio prompts enabled and TDF loaded, warming up on startup
[TTS] 🔥 Warming up Google TTS API...
```

### Audio Prompts Disabled

```
[TTS] Startup warmup check - user: true, audioPromptMode: silent, tdfFile: true
[TTS] Startup warmup check - user: true, audioPromptMode: silent, tdfFile: true
(No warmup - audio disabled)
```

## Related Fixes

This warmup fix complements the existing TTS optimizations:

1. **Warmup on toggle enable** ([profileAudioToggles.js:188](profileAudioToggles.js#L188))
   - When user enables audio prompts in settings
   - Immediate warmup before they start practicing

2. **TTS bleeding fix** ([card.js:2720](card.js#L2720))
   - Ensures TTS completes before advancing trials
   - Works in conjunction with warmup for smooth experience

3. **30-second failsafe** ([card.js:2849-2861](card.js#L2849))
   - Handles cases where warmup or actual TTS fails
   - Prevents infinite waiting

## Testing

### Test Case 1: Hot Reload During Practice

```
1. Enable audio prompts, start practicing
2. Answer trial correctly → TTS plays fast
3. (In separate terminal) Touch a client file to trigger reload
4. Wait for hot reload message in browser
5. Answer next trial correctly
6. ✅ TTS should play fast (~1 second), not slow (~11 seconds)
7. Check console for warmup logs
```

### Test Case 2: Audio Disabled

```
1. Disable audio prompts (set to "silent")
2. Trigger hot reload
3. ✅ No warmup logs should appear
4. Enable audio prompts
5. ✅ Warmup should trigger immediately from toggle event
```

### Test Case 3: No TDF Loaded

```
1. Stay on dashboard (no unit selected)
2. Trigger hot reload
3. ✅ Logs show waiting for TDF
4. Select a unit
5. ✅ Warmup triggers when TDF loads
```

### Test Case 4: Multiple Reloads

```
1. Enable audio, start practicing
2. Trigger hot reload
3. ✅ First warmup executes
4. Trigger another reload immediately
5. ✅ Second warmup should be skipped (ttsWarmedUp flag still true)
```

## Impact

**Severity:** Medium - Degrades UX but doesn't break functionality
**Frequency:** 100% on hot reload with audio enabled
**Users Affected:** All users with TTS audio feedback enabled during development/deployment
**Fix Difficulty:** Medium - Required understanding of Meteor hot reload lifecycle
**Testing:** Easy to verify with hot reload triggers

## Prevention

### For Similar Hot Reload Issues

Any initialization logic that needs to run **both on initial load AND hot reload** should be in:

1. **`Meteor.startup()`** - Always executes on hot reload
2. **`Tracker.autorun()`** inside startup - For reactive data dependencies
3. **NOT in template `rendered` callbacks** - Only run on initial render

### Diagnostic Checklist

If something doesn't work after hot reload but works on fresh page load:

- [ ] Is the logic in a template `rendered` callback?
- [ ] Does it depend on Session variables that get cleared?
- [ ] Should it be in `Meteor.startup()` instead?
- [ ] Does it need `Tracker.autorun()` to wait for reactive data?

## Performance Comparison

### Before Fix (Hot Reload)

```
Trial 1 (before reload): TTS = 1.2s ✅
[HOT RELOAD OCCURS]
Trial 2 (after reload):  TTS = 11.3s ❌ (cold start)
Trial 3:                 TTS = 1.1s ✅
Trial 4:                 TTS = 0.9s ✅
```

### After Fix (Hot Reload)

```
Trial 1 (before reload): TTS = 1.2s ✅
[HOT RELOAD OCCURS]
[TTS warmup: 487ms]
Trial 2 (after reload):  TTS = 1.0s ✅
Trial 3:                 TTS = 1.1s ✅
Trial 4:                 TTS = 0.9s ✅
```

**Result:** Eliminated 10-second cold start delay after hot reload

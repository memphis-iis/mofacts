# Audio Warmup and Login Bugs - Detailed Audit

**Date:** 2025-10-21
**Status:** Critical Issues Identified

## Executive Summary

Three bugs were identified in the audio warmup system and login flow:

1. **SR (Speech Recognition) warmup does NOT auto-detect settings on hot reload** (unlike TTS)
2. **SR warmup fails with "no-api-key" error** when manually triggered
3. **Login callback crashes** with `Cannot read properties of undefined (reading 'profile')`

**Note:** The `profile.js:706` error about `audioPromptMode` is **expected behavior** - hot reload during active practice session correctly fails to resume mid-practice and redirects to dashboard instead.

---

## Bug #1: SR Warmup Missing Auto-Detection on Hot Code Reload

### Issue
**TTS warmup works automatically after hot code reload**, but **SR warmup does not**. This creates an asymmetric user experience:

**Your Scenario:**
- You were already logged in with TTS enabled (`audioPromptMode: feedback`)
- You had SR enabled (`audioInputMode: true`)
- TDF was already loaded
- Server code changed → hot code reload

**What Happened:**
- ✅ TTS: Auto-detected your `audioPromptMode: feedback` setting and warmed up automatically
- ❌ SR: Did NOT auto-detect your `audioInputMode: true` setting (no warmup)
- ❌ You manually toggled SR off/on → warmup triggered → **FAILED** with "no-api-key" error

### Root Cause Analysis

#### TTS Auto-Detection (WORKING)
Location: [index.js:271-295](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/index.js#L271-L295)

```javascript
Tracker.autorun((computation) => {
  const user = Meteor.user();
  const tdfFile = Session.get('currentTdfFile');

  console.log('[TTS] Startup warmup check - user:', !!user, 'audioPromptMode:', user?.audioPromptMode, 'tdfFile:', !!tdfFile);

  // Only proceed if we have both user AND TDF file loaded
  if (user && user.audioPromptMode && user.audioPromptMode !== 'silent' && tdfFile) {
    console.log('[TTS] Audio prompts enabled and TDF loaded, warming up on startup');
    computation.stop(); // Only run once

    setTimeout(() => {
      console.log('[TTS] Startup warmup check - ttsWarmedUp:', Session.get('ttsWarmedUp'));

      if (!Session.get('ttsWarmedUp')) {
        console.log('[TTS] Starting warmup from Meteor.startup');
        warmupGoogleTTS();
      } else {
        console.log('[TTS] Skipping warmup - already warmed up');
      }
    }, 500);
  }
});
```

**Key Success Factors:**
1. ✅ Uses `Tracker.autorun` to wait for both `Meteor.user()` AND `Session.get('currentTdfFile')`
2. ✅ Checks `user.audioPromptMode` from database (persisted setting)
3. ✅ Automatically triggers warmup when conditions are met
4. ✅ Prevents duplicate warmups with `ttsWarmedUp` session flag

#### SR Auto-Detection (MISSING)
Location: **DOES NOT EXIST**

There is **NO equivalent code** for SR warmup auto-detection in `index.js` or anywhere else.

SR warmup ONLY occurs in one scenario:
1. **Manual toggle**: When user clicks "Enable Audio Input" in audio modal
   Location: [profileAudioToggles.js:204-208](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js#L204-L208)
   ```javascript
   if (audioInputEnabled) {
     warmupGoogleSpeechRecognition();
   }
   ```

2. **That's it.** No hot reload detection, no startup detection.

### Expected Behavior
SR warmup should mirror TTS warmup behavior:
- After hot code reload, check if `user.audioInputMode` is enabled
- If TDF is loaded and SR is enabled, automatically warm up SR API
- Use `srWarmedUp` session flag to prevent duplicates

### Current Behavior (From Your Logs)
```
index.js:275 [TTS] Startup warmup check - user: true audioPromptMode: feedback tdfFile: true
index.js:279 [TTS] Audio prompts enabled and TDF loaded, warming up on startup
index.js:288 [TTS] Starting warmup from Meteor.startup
profileAudioToggles.js:346 [TTS] 🔥 Warming up Google TTS API...
profileAudioToggles.js:366 [TTS] 🔥 Warm-up complete (5402ms) - first trial TTS should be fast
```

**Notice:** NO SR warmup logs, even though you had SR enabled before hot reload.

Then when you manually toggled SR:
```
profileAudioToggles.js:195 audio input mode: audioInputOn
profileAudioToggles.js:389 [SR] 🔥 Warming up Google Speech Recognition API...
profileAudioToggles.js:430 [SR] 🔥 Warm-up failed (82ms):
  errorClass {error: 'no-api-key', reason: 'No speech API key available'}
```

---

## Bug #2: SR Warmup Fails with "no-api-key" Error

### Issue
When SR warmup is manually triggered (by toggling audio input on), it immediately fails:

```
profileAudioToggles.js:389 [SR] 🔥 Warming up Google Speech Recognition API...
profileAudioToggles.js:430 [SR] 🔥 Warm-up failed (82ms):
  errorClass {isClientSafe: true, error: 'no-api-key', reason: 'No speech API key available', ...}
```

### Root Cause Analysis

#### SR Warmup Implementation
Location: [profileAudioToggles.js:372-437](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js#L372-L437)

```javascript
export function warmupGoogleSpeechRecognition() {
  // Check if we have a speech API key (either TDF or user-provided)
  const tdfFile = Session.get('currentTdfFile');
  const hasTdfKey = tdfFile?.tdfs?.tutor?.setspec?.speechAPIKey;
  const hasUserKey = Session.get('speechAPIKeyIsSetup');

  if (!hasTdfKey && !hasUserKey) {
    console.log('[SR] No API key found, skipping warm-up');
    return;
  }

  // ... warmup logic ...

  // Make warmup call
  Meteor.call('makeGoogleSpeechAPICall',
    Session.get('currentTdfId'),
    '', // Empty key - server will fetch TDF or user key ⚠️ THIS IS THE PROBLEM
    request,
    ['warmup'],
    function(err, res) {
      // Error handling
    }
  );
}
```

#### Server-Side API Key Resolution
Location: [methods.js:4010-4032](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js#L4010-L4032)

```javascript
makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey, request, answerGrammar){
  this.unblock();

  serverConsole('makeGoogleSpeechAPICall for TDFId:', TDFId);

  // Try to get TDF API key if user is logged in (but don't require it)
  if (this.userId) {
    try {
      const TDFAPIKey = await methods.getTdfSpeechAPIKey.call(this, TDFId);
      if (TDFAPIKey) {
        speechAPIKey = TDFAPIKey;
      }
    } catch(err) {
      // User not authorized to access TDF key, use provided key instead
      serverConsole('Could not access TDF key, using provided key:', err.message);
    }
  }

  // If we still don't have a key, error out ⚠️ THIS THROWS THE ERROR
  if (!speechAPIKey) {
    throw new Meteor.Error('no-api-key', 'No speech API key available');
  }
  // ...
}
```

#### getTdfSpeechAPIKey Access Control
Location: [methods.js:3576-3601](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js#L3576-L3601)

```javascript
getTdfSpeechAPIKey: function(tdfId){
  // Security: Users practicing a TDF can access its speech API key
  if (!this.userId) {
    throw new Meteor.Error(401, 'Must be logged in');
  }

  const tdf = Tdfs.findOne({_id: tdfId});
  if(!tdf){
    return '';
  }

  // Allow access if:
  // 1. User owns this TDF
  // 2. User is admin/teacher
  // 3. TDF is accessible to this user (has userselect=true or user has history with it)
  const isOwner = tdf.ownerId === this.userId;
  const isAdminOrTeacher = Roles.userIsInRole(this.userId, ['admin', 'teacher']);
  const isUserSelectTdf = tdf.content?.tdfs?.tutor?.setspec?.userselect === 'true';
  const hasHistory = Histories.findOne({ userId: this.userId, TDFId: tdfId }); ⚠️ PROBLEM

  if (!isOwner && !isAdminOrTeacher && !isUserSelectTdf && !hasHistory) {
    throw new Meteor.Error(403, 'Access denied to TDF API keys');
  }

  return decryptData(tdf.content.tdfs.tutor.setspec.speechAPIKey);
}
```

### The Problem: Access Control Race Condition + Missing Fallback Logic

**Critical Context:** TDFs often have embedded API keys (`tdf.content.tdfs.tutor.setspec.speechAPIKey`), so warmup should work WITHOUT requiring users to configure personal API keys.

**Sequence of Events:**
1. User logs in successfully
2. User selects TDF (Session.get('currentTdfFile') and Session.get('currentTdfId') are set)
3. TTS warmup auto-triggers (works because TDF is loaded)
4. User manually clicks "Enable Audio Input" on audio modal
5. SR warmup triggers immediately
6. SR warmup calls `makeGoogleSpeechAPICall` with empty `speechAPIKey` parameter
7. Server tries to fetch TDF API key via `getTdfSpeechAPIKey`
8. **FAILS:** `hasHistory` check fails because:
   - User just selected TDF but hasn't started any trials yet
   - No History document exists yet (created on first trial)
   - BUT: TDF is `userselect='true'` so SHOULD be accessible
9. Server throws `403: Access denied to TDF API keys`
10. Server does NOT try to fetch user's personal API key as fallback
11. Server throws `no-api-key: No speech API key available`

**Why TTS Works:**
- TTS warmup happens AFTER user selects TDF and navigates to /card route
- By the time TTS warmup runs, either:
  - User has history (started trials), OR
  - TTS warmup is triggered from Meteor.startup which happens AFTER TDF is selected
- Access control check passes

**Why SR Fails:**
The issue is TWO-FOLD:

1. **Access Control Too Strict:** The `hasHistory` check in `getTdfSpeechAPIKey` is too strict
   - It should allow access if TDF is `userselect='true'` (which most are)
   - Currently requires BOTH `userselect='true'` AND history
   - This prevents warmup before first trial

2. **Missing Fallback:** Server does NOT try user's personal API key as fallback
   - Production SR code in card.js handles both TDF key and user key
   - Warmup code ONLY tries TDF key
   - Should fall back to user key if TDF key is inaccessible

### Additional Issues

#### Issue 2A: User Speech API Key Not Checked on Server
The server code at [methods.js:4017-4027](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js#L4017-L4027) tries to get TDF API key but does NOT try to get user's personal speech API key:

```javascript
if (this.userId) {
  try {
    const TDFAPIKey = await methods.getTdfSpeechAPIKey.call(this, TDFId);
    if (TDFAPIKey) {
      speechAPIKey = TDFAPIKey;
    }
  } catch(err) {
    serverConsole('Could not access TDF key, using provided key:', err.message);
  }
}
// ⚠️ Should also try: methods.getUserSpeechAPIKey.call(this)
```

Compare this to the production SR code in card.js which handles both:
- TDF API key (preferred)
- User personal API key (fallback)

#### Issue 2B: Client-Side Check is Insufficient
The client checks `Session.get('speechAPIKeyIsSetup')` but this session variable may not be populated yet if:
- User just logged in
- `checkAndSetSpeechAPIKeyIsSetup()` hasn't completed yet
- Race condition between login and warmup

Location: [profileAudioToggles.js:301-309](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js#L301-L309)

```javascript
function checkAndSetSpeechAPIKeyIsSetup() {
  Meteor.call('isUserSpeechAPIKeySetup', function(err, data) {
    if (err) {
      console.log('Error getting whether speech api key is setup');
    } else {
      Session.set('speechAPIKeyIsSetup', data);
    }
  });
}
```

This is called at [profileAudioToggles.js:147](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js#L147) during template rendering, but may not complete before warmup is triggered.

---

## Bug #3: Login Callback Crashes - Cannot Read 'profile'

### Issue
Error during login callback:
```
debug.js:43 Exception in onLogin callback TypeError: Cannot read properties of undefined (reading 'profile')
    at index.js:230:27
```

### Root Cause Analysis

Location: [index.js:228-239](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/index.js#L228-L239)

```javascript
Accounts.onLogin(function() {
  //check if the user has a profile with an email, first name, and last name
  if (Meteor.userId() && !Meteor.user().profile.username) { // ⚠️ CRASH HERE
    Meteor.call('populateSSOProfile', Meteor.userId(), function(error, result) {
      if (error) {
        clientConsole(1, 'populateSSOProfile error:', error);
      } else {
        clientConsole(2, 'populateSSOProfile result:', result);
      }
    });
  }
});
```

### The Problem: Race Condition During Login

**Sequence of Events:**
1. `Accounts.onLogin` callback fires
2. `Meteor.userId()` is available (user ID is set)
3. `Meteor.user()` returns user object
4. **PROBLEM:** `Meteor.user().profile` is `undefined`
5. Trying to access `.username` on `undefined` throws error

**Why This Happens:**
Meteor's `Accounts.onLogin` callback can fire BEFORE the user document is fully populated in the client-side cache. This is a known Meteor race condition.

From the logs, we see:
```
debug.js:43 Exception in onLogin callback TypeError: Cannot read properties of undefined (reading 'profile')
    at index.js:230:27
```

This happens during the login sequence, but the user eventually logs in successfully (as evidenced by later logs showing user data).

### Expected Behavior
The code should defensively check for `profile` existence before accessing properties.

### Additional Context
The error is logged but doesn't prevent login from succeeding. However, it may prevent SSO profile population from working correctly, which could have downstream effects.

---

## Recommended Fixes

### Fix #1: Add SR Auto-Detection on Startup

Add to [index.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/index.js) in `Meteor.startup`:

```javascript
// Add after TTS warmup Tracker.autorun (around line 296)
// SR warmup auto-detection (mirrors TTS behavior)
Tracker.autorun((computation) => {
  const user = Meteor.user();
  const tdfFile = Session.get('currentTdfFile');

  console.log('[SR] Startup warmup check - user:', !!user, 'audioInputMode:', user?.audioInputMode, 'tdfFile:', !!tdfFile);

  // Only proceed if we have both user AND TDF file loaded
  if (user && user.audioInputMode && tdfFile) {
    console.log('[SR] Audio input enabled and TDF loaded, warming up on startup');
    computation.stop(); // Only run once

    setTimeout(() => {
      console.log('[SR] Startup warmup check - srWarmedUp:', Session.get('srWarmedUp'));

      if (!Session.get('srWarmedUp')) {
        console.log('[SR] Starting warmup from Meteor.startup');
        warmupGoogleSpeechRecognition();
      } else {
        console.log('[SR] Skipping warmup - already warmed up');
      }
    }, 500);
  }
});
```

**Import Required:**
```javascript
import {warmupGoogleTTS, warmupGoogleSpeechRecognition} from './views/home/profileAudioToggles.js';
```

### Fix #2: Fix SR Warmup API Key Resolution

#### Fix 2A: Update Server-Side makeGoogleSpeechAPICall

Location: [methods.js:4010-4032](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js#L4010-L4032)

```javascript
makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey, request, answerGrammar){
  this.unblock();

  serverConsole('makeGoogleSpeechAPICall for TDFId:', TDFId);

  // Try to get API key from multiple sources
  if (this.userId) {
    // 1. Try TDF API key first (preferred)
    if (!speechAPIKey) {
      try {
        const TDFAPIKey = await methods.getTdfSpeechAPIKey.call(this, TDFId);
        if (TDFAPIKey) {
          speechAPIKey = TDFAPIKey;
          serverConsole('Using TDF API key');
        }
      } catch(err) {
        serverConsole('Could not access TDF key:', err.message);
      }
    }

    // 2. Fallback to user's personal API key
    if (!speechAPIKey) {
      try {
        const userAPIKey = await methods.getUserSpeechAPIKey.call(this);
        if (userAPIKey) {
          speechAPIKey = userAPIKey;
          serverConsole('Using user personal API key');
        }
      } catch(err) {
        serverConsole('Could not access user API key:', err.message);
      }
    }
  }

  // If we still don't have a key, error out
  if (!speechAPIKey) {
    throw new Meteor.Error('no-api-key', 'No speech API key available');
  }

  // ... rest of method
}
```

#### Fix 2B: Update getTdfSpeechAPIKey Access Control

Location: [methods.js:3576-3601](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js#L3576-L3601)

**Option 1: Allow warmup without history (Less secure)**
```javascript
getTdfSpeechAPIKey: function(tdfId, allowWarmup = false){
  if (!this.userId) {
    throw new Meteor.Error(401, 'Must be logged in');
  }

  const tdf = Tdfs.findOne({_id: tdfId});
  if(!tdf){
    return '';
  }

  const isOwner = tdf.ownerId === this.userId;
  const isAdminOrTeacher = Roles.userIsInRole(this.userId, ['admin', 'teacher']);
  const isUserSelectTdf = tdf.content?.tdfs?.tutor?.setspec?.userselect === 'true';
  const hasHistory = Histories.findOne({ userId: this.userId, TDFId: tdfId });

  // Allow warmup for user-select TDFs even without history
  if (allowWarmup && isUserSelectTdf) {
    return decryptData(tdf.content.tdfs.tutor.setspec.speechAPIKey);
  }

  if (!isOwner && !isAdminOrTeacher && !isUserSelectTdf && !hasHistory) {
    throw new Meteor.Error(403, 'Access denied to TDF API keys');
  }

  return decryptData(tdf.content.tdfs.tutor.setspec.speechAPIKey);
}
```

**Option 2: Require user personal API key for warmup (More secure - RECOMMENDED)**
Keep current security model, but fix the server-side fallback (Fix 2A).

Users who want SR warmup before starting TDF must configure personal API key.

#### Fix 2C: Improve Client-Side Error Handling

Location: [profileAudioToggles.js:422-436](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js#L422-L436)

```javascript
// Make warmup call
Meteor.call('makeGoogleSpeechAPICall',
  Session.get('currentTdfId'),
  '', // Empty key - server will fetch TDF or user key
  request,
  ['warmup'],
  function(err, res) {
    const elapsed = performance.now() - startTime;
    if (err) {
      console.log(`[SR] 🔥 Warm-up failed (${elapsed.toFixed(0)}ms):`, err);
      Session.set('srWarmedUp', false); // Allow retry on failure

      // Show helpful error message to user
      if (err.error === 'no-api-key') {
        console.warn('[SR] ⚠️ No API key available. To enable speech recognition warmup:');
        console.warn('[SR]   1. Start a TDF session first (to use TDF API key), OR');
        console.warn('[SR]   2. Configure your personal Speech API key in audio settings');
      }
    } else {
      console.log(`[SR] 🔥 Warm-up complete (${elapsed.toFixed(0)}ms) - first trial SR should be fast`);
    }
  }
);
```

### Fix #3: Fix Login Callback Crash

Location: [index.js:228-239](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/index.js#L228-L239)

```javascript
Accounts.onLogin(function() {
  // Use Tracker to wait for user data to be fully loaded
  Tracker.autorun((computation) => {
    const user = Meteor.user();

    // Wait for user AND profile to be loaded
    if (user && user.profile) {
      computation.stop(); // Only run once

      // Check if the user has a profile with an email, first name, and last name
      if (!user.profile.username) {
        Meteor.call('populateSSOProfile', Meteor.userId(), function(error, result) {
          if (error) {
            clientConsole(1, 'populateSSOProfile error:', error);
          } else {
            clientConsole(2, 'populateSSOProfile result:', result);
          }
        });
      }
    }
  });
});
```

### Fix #4: Fix selectTdf Crash

#### Fix 4A: Add Null Check for Meteor.user()

Location: [profile.js:705-719](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profile.js#L705-L719)

```javascript
else {
  // Ensure user is loaded before accessing properties
  const user = Meteor.user();
  if (!user) {
    throw new Error('User not loaded - cannot select TDF');
  }

  audioPromptMode = user.audioPromptMode || 'silent';
  audioInputEnabled = user.audioInputMode || false;

  // Ensure DOM elements exist before accessing them
  const feedbackSpeakingRateEl = document.getElementById('audioPromptFeedbackSpeakingRate');
  const questionSpeakingRateEl = document.getElementById('audioPromptQuestionSpeakingRate');
  const voiceEl = document.getElementById('audioPromptVoice');
  const sensitivityEl = document.getElementById('audioInputSensitivity');
  const questionVolumeEl = document.getElementById('audioPromptQuestionVolume');
  const feedbackVolumeEl = document.getElementById('audioPromptFeedbackVolume');
  const feedbackVoiceEl = document.getElementById('audioPromptFeedbackVoice');

  // Use defaults if elements don't exist (e.g., during page load)
  audioPromptFeedbackSpeakingRate = feedbackSpeakingRateEl ? feedbackSpeakingRateEl.value : 1.0;
  audioPromptQuestionSpeakingRate = questionSpeakingRateEl ? questionSpeakingRateEl.value : 1.0;
  audioPromptVoice = voiceEl ? voiceEl.value : 'en-US-Standard-A';
  audioInputSensitivity = sensitivityEl ? sensitivityEl.value : 20;
  audioPromptQuestionVolume = questionVolumeEl ? questionVolumeEl.value : 0;
  audioPromptFeedbackVolume = feedbackVolumeEl ? feedbackVolumeEl.value : 0;
  audioPromptFeedbackVoice = feedbackVoiceEl ? feedbackVoiceEl.value : 'en-US-Standard-A';

  feedbackType = GlobalExperimentStates.findOne({userId: Meteor.userId(), TDFId: currentTdfId})?.experimentState?.feedbackType || null;

  if(feedbackType)
    Session.set('feedbackTypeFromHistory', feedbackType)
  else
    Session.set('feedbackTypeFromHistory', null);
}
```

#### Fix 4B: Fix Router to Wait for User Subscription

Location: [router.js:641-679](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/lib/router.js#L641-L679)

```javascript
Router.route('/card', {
  name: 'client.card',
  waitOn: function() {
    // Wait for user subscription if no currentTdfId
    if (!Session.get('currentTdfId')) {
      return [Meteor.subscribe('userData')]; // Assuming this subscription exists
    }
    return [];
  },
  action: async function() {
    if(!Session.get('currentTdfId')){
      const userId = Meteor.userId();

      // Ensure user is loaded
      if (!Meteor.user()) {
        console.error('User not loaded, redirecting to signin');
        this.redirect('/');
        return;
      }

      const tdfId = await meteorCallAsync('getLastTDFAccessed', userId);
      const tdf = await meteorCallAsync('getTdfById', tdfId);
      if(tdf) {
        const setspec = tdf.content.tdfs.tutor.setspec ? tdf.content.tdfs.tutor.setspec : null;
        const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
        setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
        const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
        setspec.speechOutOfGrammarFeedback : 'Response not in answer set';
        await selectTdf(
          tdfId,
          setspec.lessonname,
          tdf.stimuliSetId,
          ignoreOutOfGrammarResponses,
          speechOutOfGrammarFeedback,
          'User button click',
          tdf.content.isMultiTdf,
          false,
          setspec,
          false,
          true);
      }
    } else {
      this.subscribe('files.assets.all').wait();
      this.subscribe('userComponentStates', Session.get('currentTdfId')).wait();
      this.subscribe('currentTdf', Session.get('currentTdfId')).wait();
      this.subscribe('tdfByExperimentTarget', Session.get('experimentTarget'), Session.get('experimentConditions')).wait();
      if(this.ready()){
        if (Meteor.user()) {
          Session.set('curModule', 'card');
          this.render('card');
        } else {
          this.redirect('/');
        }
      }
    }
  },
});
```

---

## Testing Recommendations

### Test Scenario 1: SR Auto-Warmup on Login
1. Configure user with `audioInputMode: true`
2. Clear browser cache
3. Log in
4. Load TDF
5. **Expected:** SR warmup should auto-trigger (like TTS does)
6. **Verify:** Console shows `[SR] Starting warmup from Meteor.startup`

### Test Scenario 2: SR Warmup with Personal API Key
1. Configure personal Speech API key
2. Enable audio input BEFORE starting TDF
3. **Expected:** SR warmup succeeds using personal API key
4. **Verify:** Console shows `[SR] Warm-up complete`

### Test Scenario 3: SR Warmup with TDF API Key
1. Start TDF session (creates history)
2. Enable audio input
3. **Expected:** SR warmup succeeds using TDF API key
4. **Verify:** Console shows `[SR] Warm-up complete`

### Test Scenario 4: Login Without Profile Crash
1. Clear browser cache
2. Log in with new user (no profile)
3. **Expected:** No crash in console
4. **Verify:** `populateSSOProfile` called successfully

---

## Priority

1. **HIGH:** Fix #2 (SR warmup failure) - Degrades UX for speech recognition
2. **MEDIUM:** Fix #1 (SR auto-detection) - Feature parity with TTS
3. **LOW:** Fix #3 (Login callback crash) - Non-blocking, SSO profile population only

---

## Related Files

- [index.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/index.js) - TTS auto-warmup, login callback
- [profileAudioToggles.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profileAudioToggles.js) - SR warmup implementation
- [profile.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/views/home/profile.js) - selectTdf function
- [router.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/client/lib/router.js) - Route handling
- [methods.js](c:/Users/ppavl/OneDrive/Active projects/mofacts/mofacts/server/methods.js) - Server-side API key resolution

---

## Notes

Key findings:
- **Bug #1:** TTS warmup works on hot reload because it uses `Tracker.autorun` to wait for dependencies; SR lacks this
- **Bug #2:** SR warmup fails due to overly strict access control (requires history) AND missing fallback to user personal API key
- **Bug #3:** Login callback crashes because it doesn't wait for profile to load (non-blocking error)
- **Not a bug:** The `profile.js:706` error is expected behavior when hot reload occurs during active practice - system correctly fails to resume and redirects to dashboard

**Pattern:** Asymmetry between TTS and SR warmup implementations causes UX inconsistency.

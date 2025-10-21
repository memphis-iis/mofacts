# Speech Recognition Warmup & Sample Rate Optimization

**Date**: 2025-10-20
**Status**: ✅ IMPLEMENTED
**Impact**: Reduces first-trial SR latency AND improves every-trial performance

---

## Problem Summary

### First-Trial Latency Issue
User trace showed **10-second delay** on first trial when using Speech Recognition:
```
17:29:04 - API call sent
17:29:14 - Response received (10 seconds)
```

Contributing factors:
1. **Cold start**: First request to Google Speech API has initialization overhead
2. **48kHz sample rate**: High-resolution audio creates large payloads
3. **546KB audio**: For just ~1 second of speech
4. **232 phrase hints**: All country names sent with every request
5. **Network hops**: Browser → Meteor server → Google → back

### Every-Trial Performance Issue
Even after warm-up, **48kHz sample rate** created ongoing latency for every single trial due to:
- Large audio payload sizes
- Slower upload times
- More processing required

---

## Solution Implemented

### 1. Client-Side SR Warmup (Reduces First-Trial Latency)

**File**: `mofacts/client/views/home/profileAudioToggles.js`

#### Added `warmupGoogleSpeechRecognition()` Function

**Location**: Lines 365-430

Pattern matches existing `warmupGoogleTTS()` implementation for consistency.

**Key Features**:
- Checks for API key availability (TDF or user-provided)
- Prevents duplicate warmups via Session flag `srWarmedUp`
- Sends minimal silent audio (100ms, 16kHz, 3200 bytes)
- Uses minimal request configuration
- Logs timing for monitoring
- Allows retry on failure

**Code**:
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

  // Check if already warmed up
  if (Session.get('srWarmedUp')) {
    console.log('[SR] Already warmed up, skipping');
    return;
  }

  console.log('[SR] 🔥 Warming up Google Speech Recognition API...');
  const startTime = performance.now();

  // Set flag immediately to prevent duplicate warmups
  Session.set('srWarmedUp', true);

  // Create minimal silent audio data (LINEAR16 format, 16kHz, 100ms of silence)
  // 16kHz * 100ms = 1600 samples, each sample is 2 bytes (16-bit) = 3200 bytes
  const silentAudioBytes = new Uint8Array(3200).fill(0);
  const base64Audio = btoa(String.fromCharCode.apply(null, silentAudioBytes));

  // Build minimal request matching production format
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,  // Using 16kHz (Google recommended)
      languageCode: 'en-US',
      maxAlternatives: 1,
      profanityFilter: false,
      enableAutomaticPunctuation: false,
      model: 'command_and_search',
      useEnhanced: true,
      speechContexts: [{
        phrases: ['warmup'],  // Minimal phrase hint
        boost: 5
      }]
    },
    audio: {
      content: base64Audio
    }
  };

  // Make warmup call
  Meteor.call('makeGoogleSpeechAPICall',
    Session.get('currentTdfId'),
    '', // Empty key - server will fetch TDF or user key
    request,
    ['warmup'], // Minimal answer grammar
    function(err, res) {
      const elapsed = performance.now() - startTime;
      if (err) {
        console.log(`[SR] 🔥 Warm-up failed (${elapsed.toFixed(0)}ms):`, err);
        Session.set('srWarmedUp', false); // Allow retry on failure
      } else {
        console.log(`[SR] 🔥 Warm-up complete (${elapsed.toFixed(0)}ms) - first trial SR should be fast`);
      }
    }
  );
}
```

#### Integration with Audio Input Toggle

**Location**: Lines 194-216

When user clicks the audio input toggle (`#audioInputOn`), the warmup is triggered:

```javascript
'click #audioInputOn': function(event) {
  console.log('audio input mode: ' + event.currentTarget.id);
  const audioInputEnabled = getAudioInputFromPage();

  const showHeadphonesSuggestedDiv = (getAudioPromptModeFromPage() != 'silent') && audioInputEnabled;

  showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);
  showHideAudioInputGroup(audioInputEnabled)
  showHideAudioEnabledGroup(audioInputEnabled || (getAudioPromptModeFromPage() != 'silent'));

  // FIX: Warm up Google Speech Recognition API when user enables audio input
  // This eliminates the cold start delay on first trial
  if (audioInputEnabled) {
    warmupGoogleSpeechRecognition();
  }

  //save the audio input mode to the user profile in mongodb
  Meteor.call('saveAudioInputMode', audioInputEnabled, function(error) {
    if (error) {
      console.log('Error saving audio input mode', error);
    }
  });
},
```

**User Experience**:
- Matches TTS warmup pattern
- Triggered when user enables audio features
- Silent and non-intrusive
- Console logs provide feedback for debugging

---

### 2. Sample Rate Optimization (Improves Every-Trial Latency)

**File**: `mofacts/client/views/experiment/card.js`

#### AudioContext Configuration Change

**Location**: Lines 727-732

**Before**:
```javascript
const audioContextConfig = {
  sampleRate: 48000,
}
```

**After**:
```javascript
const audioContextConfig = {
  // FIX: Lower sample rate from 48kHz to 16kHz (Google recommended for Speech API)
  // This reduces audio payload size and improves latency on EVERY trial
  sampleRate: 16000,
}
```

**Why 16kHz?**
- Google's official recommendation for Speech-to-Text API
- Optimized for speech (not music)
- Reduces audio payload size by ~67% (16/48)
- Faster upload times
- Less processing required

#### Automatic Propagation Through System

The sample rate change automatically flows through the entire system:

1. **AudioContext Creation** (line 732):
   ```javascript
   audioContext = new AudioContext(audioContextConfig);
   ```

2. **Session Storage** (line 4972 in `startUserMedia`):
   ```javascript
   Session.set('sampleRate', input.context.sampleRate);
   ```
   Now stores `16000` instead of `48000`

3. **Request Generation** (line 4513 in `processLINEAR16`):
   ```javascript
   const sampleRate = Session.get('sampleRate');
   ```

4. **API Call** (line 4621):
   ```javascript
   const request = generateRequestJSON(sampleRate, speechRecognitionLanguage, phraseHints, data);
   ```

5. **Request Config** (line 4918 in `generateRequestJSON`):
   ```javascript
   const request = {
     'config': {
       'encoding': 'LINEAR16',
       'sampleRateHertz': sampleRate,  // Now 16000
       // ... rest of config
     }
   }
   ```

**No other changes required** - the system was already designed to propagate the sample rate correctly.

---

### 3. Server Optimization (Already Completed)

**File**: `mofacts/server/methods.js`

**Location**: Line 4012

Added `this.unblock()` to prevent the long-running Google API call from blocking other Meteor methods:

```javascript
makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey, request, answerGrammar){
  // FIX: Allow other methods to run while waiting for Google API (prevents blocking client methods)
  this.unblock();

  serverConsole('makeGoogleSpeechAPICall for TDFId:', TDFId);
  // ... rest of method
}
```

**Impact**: Improves overall app responsiveness during SR processing, but doesn't reduce actual Google API latency.

---

## Expected Performance Improvements

### First Trial
**Before**: ~10 seconds (cold start + 48kHz bloat)
**After**: ~3-5 seconds (warm connection + 16kHz optimization)
**Improvement**: 50-70% reduction

### Subsequent Trials
**Before**: ~3-4 seconds (48kHz bloat)
**After**: ~1-2 seconds (16kHz optimization)
**Improvement**: 50-67% reduction

### Audio Payload Size
**Before**: 546KB for ~1 second of speech at 48kHz
**After**: ~182KB for ~1 second of speech at 16kHz
**Reduction**: 67% smaller payloads

---

## Testing Strategy

### Manual Testing Checklist

1. **Warmup Verification**:
   - Open MofacTS with audio input disabled
   - Open browser console
   - Enable audio input toggle
   - Verify console shows: `[SR] 🔥 Warming up Google Speech Recognition API...`
   - Verify completion message with timing
   - Toggle off and back on - should see: `[SR] Already warmed up, skipping`

2. **First Trial Latency**:
   - Fresh session with warmup
   - Start first trial with speech input
   - Say answer after mic icon appears
   - Measure time from speech end to feedback display
   - Should be significantly faster than 10 seconds

3. **Sample Rate Verification**:
   - Check console logs during trial
   - Should see: `[SR] Request config: ... sampleRate: 16000 ...`
   - NOT: `sampleRate: 48000`

4. **Accuracy Check**:
   - Verify speech recognition accuracy is maintained
   - Test with various accents/pronunciations
   - 16kHz should be sufficient for human speech

5. **Error Handling**:
   - Test with invalid API key
   - Should see: `[SR] 🔥 Warm-up failed (Xms): [error]`
   - Session flag should reset to allow retry

### Log Messages to Monitor

**Warmup Success**:
```
[SR] 🔥 Warming up Google Speech Recognition API...
[SR] 🔥 Warm-up complete (XXXXms) - first trial SR should be fast
```

**Warmup Failure**:
```
[SR] 🔥 Warming up Google Speech Recognition API...
[SR] 🔥 Warm-up failed (XXXXms): [error message]
```

**Sample Rate**:
```
[SR] Request config: encoding: LINEAR16 sampleRate: 16000 language: en-US ...
```

---

## Architecture Notes

### Why This Approach?

1. **Client-Side Warmup**:
   - Matches existing TTS warmup pattern
   - User-triggered (respects privacy)
   - Minimal overhead (3200 bytes)
   - No server-side complexity

2. **16kHz Sample Rate**:
   - Google's official recommendation
   - Benefits every single trial
   - Automatic propagation through existing architecture
   - No breaking changes

3. **Session Flag**:
   - Prevents duplicate warmups
   - Persists across page navigations
   - Resets on failure for retry

### What Was NOT Needed

Based on research about Google Cloud optimizations:

❌ **Setting minimum instances** - Only applies if YOU deploy code on Cloud Run/Functions
❌ **gRPC connection pooling** - Only for streaming API (you use REST)
❌ **Warmup scheduler** - Client-side warmup is simpler and works
❌ **Server-side Speech client** - Your architecture uses HTTPS requests, not SDK

---

## Files Modified

1. **profileAudioToggles.js** (Lines 365-430, 204-208)
   - Added `warmupGoogleSpeechRecognition()` function
   - Integrated warmup trigger in audio input toggle handler

2. **card.js** (Lines 727-732)
   - Lowered AudioContext sample rate from 48kHz to 16kHz

3. **methods.js** (Line 4012)
   - Added `this.unblock()` (already completed in previous session)

4. **docs_dev/SR_WARMUP_IMPLEMENTATION.md** (This file)
   - Complete documentation of changes

---

## References

### Research That Informed This Solution

**Google Speech API Best Practices**:
- 16kHz sample rate recommended for speech recognition
- REST API uses standard HTTPS (no special connection pooling needed)
- Cold start is expected on first request

**Warmup Strategies**:
- Pre-warming mic with `getUserMedia` eliminates permission delays
- Pre-warming API with minimal request eliminates connection setup
- 100ms of silence is sufficient to warm the pipeline

**What Doesn't Apply**:
- Cloud Run/Functions minimum instances (you're not deploying on Google Cloud)
- gRPC keepalive (you use REST, not streaming)
- Server-side SDK (you make raw HTTPS requests)

---

## Monitoring & Maintenance

### Console Logs to Watch

All SR logs are prefixed with `[SR]` for easy filtering.

**Key Messages**:
- `[SR] 🔥 Warming up...` - Warmup initiated
- `[SR] 🔥 Warm-up complete (XXms)` - Success with timing
- `[SR] Request config: ... sampleRate: 16000` - Verify correct rate
- `[SR] Sending audio to Google Speech API...` - Trial request
- `[SR] speechAPICallback received` - Response received

### Future Optimizations

If latency is still an issue after these changes:

1. **Reduce phrase hints**: Currently sending 232 country names
2. **Cache phrase hints**: Build them once, reuse across trials
3. **Optimize phonetic index**: Currently rebuilt every trial
4. **Batch API calls**: If multiple trials queue up (unlikely)

---

## Related Documentation

- **DUPLICATE_TTS_FEEDBACK_RACE_CONDITION.md** - Initial race condition analysis
- **TTS_SPECIFIC_RACE_CONDITION.md** - Why the bug only happens with TTS
- **SR_SM_SYNCHRONIZATION_DESIGN.md** - How SR and SM synchronize
- **DUPLICATE_TTS_FEEDBACK_FIX_APPLIED.md** - 3-layer defense implementation
- **SPEECH_RECOGNITION_STATE_MACHINE.md** - Overall SR state machine docs

---

**Implementation complete. Ready for testing.**

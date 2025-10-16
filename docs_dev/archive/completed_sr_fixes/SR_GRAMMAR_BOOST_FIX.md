# SR Grammar Boost Fix - Google Speech API Phrase Bias

## Problem

**Issue:** When saying "Mali", Google Speech API returns "Molly" instead of the correct grammar word "Mali".

**Root Cause:** Google Speech API does NOT support strict grammar-based recognition. The implementation was using `speechContexts.phrases` as soft hints, but Google still searches the entire English dictionary and can return any word.

### How It Was Working (Incorrectly):

1. **Client sends phrase hints** to Google Speech API without boost parameter
2. **Google recognizes from full dictionary** - "Molly" is a more common English word than "Mali"
3. **Client filters response** using `answerGrammar` array to reject out-of-grammar words
4. **User sees error message** and has to retry

**Problem:** Even with `ignoreOutOfGrammarResponses: true`, the filtering happens AFTER Google returns the wrong word, causing poor UX.

---

## Solution

Added `boost: 20` parameter to `speechContexts` to maximize bias toward grammar words.

### What Changed

**File:** `mofacts/client/views/experiment/card.js`
**Lines:** 4002-4025

**Before:**
```javascript
'speechContexts': [
  {
    'phrases': phraseHints,
  },
],
```

**After:**
```javascript
'speechContexts': [
  {
    'phrases': phraseHints,
    'boost': 20  // Maximum bias toward grammar words (range 0-20)
  },
],
```

### How Boost Works

**Google Speech API boost parameter:**
- **Range:** 0-20
- **Default:** 0 (no bias)
- **Value 20:** Maximum bias toward grammar words
- **Effect:** Dramatically increases likelihood of recognizing grammar words over similar-sounding dictionary words

**Example:**
- Without boost: "Mali" → "Molly" (common English name wins)
- With boost=20: "Mali" → "Mali" (grammar word strongly preferred)

---

## Additional Improvements

**Added logging to show phrase hints being sent:**

Line 3799:
```javascript
console.log('[SR] Phrase hints (with boost=20):', phraseHints);
```

Line 4022:
```javascript
console.log('[SR] Request config with boost:', JSON.stringify(request.config, null, 2));
```

**Benefits:**
- Easier debugging
- Verify grammar words are being sent correctly
- See exact API request configuration

---

## Limitations

**Important:** `boost` is NOT a strict grammar constraint!

Google Speech API will still:
- Use the full English dictionary
- Return out-of-grammar words if acoustic match is very poor
- Be influenced by speaker accent, background noise, etc.

**The client-side filter (`ignoreOutOfGrammarResponses`) is still needed** as a safety net.

### When Boost Might Not Be Enough:

1. **Very poor audio quality** - Google can't match even with boost
2. **Strong accent** - Pronunciation differs significantly from expected
3. **Background noise** - Interferes with recognition
4. **Rare words** - Very uncommon words that sound like common ones
5. **Similar-sounding words** - Even with boost, acoustically identical words may cause confusion

---

## Alternative Solutions Considered

### 1. Use Model Adaptation (Complex, requires training)
- Upload custom vocabulary to Google Cloud
- Train custom speech model
- **Pros:** Most accurate
- **Cons:** Complex setup, costs money, requires model training time

### 2. Increase maxAlternatives and pick best match (Good compromise)
Current: `maxAlternatives: 1`
Could change to: `maxAlternatives: 3`

Then check all alternatives against grammar:
```javascript
for (let alt of response.results[0].alternatives) {
  if (answerGrammar.includes(alt.transcript)) {
    return alt.transcript;  // Found grammar match
  }
}
// Fall back to first alternative if no grammar match
```

**Pros:** Better chance of finding correct grammar word
**Cons:** Slightly slower, more API data transfer

### 3. Use alternative speech recognition API
- Mozilla DeepSpeech (open source, grammar support)
- CMU Sphinx (strict grammar mode)
- **Pros:** True grammar-based recognition
- **Cons:** Requires hosting inference server, less accurate than Google

---

## Testing Recommendations

Test with confusing word pairs:
- Mali / Molly
- Palau / pull out
- Niger / trigger
- Chad / chat
- Mali / valley
- Belize / police

**Expected behavior:**
- With `boost=20`, grammar words should be recognized correctly most of the time
- Out-of-grammar responses should still be filtered by `ignoreOutOfGrammarResponses`
- Logs should show phrase hints being sent with boost parameter

---

## Future Enhancements

If `boost=20` is still not enough, consider:

1. **Increase maxAlternatives to 3** and check all alternatives
2. **Add phonetic matching** on client side (Levenshtein distance)
3. **Use custom vocabulary** with Google Speech Adaptation
4. **Switch to strict grammar-based SR** (different API)

---

## Files Changed

1. **card.js** (lines 3799-3800, 4002-4025)
   - Added `boost: 20` to speechContexts
   - Added logging for phrase hints and request config

---

## Deployment

File is already in scp deployment script:
- ✅ `mofacts/client/views/experiment/card.js`

Test thoroughly with confusing word pairs before deploying to production.

---

## References

- [Google Speech-to-Text API Documentation](https://cloud.google.com/speech-to-text/docs/reference/rest/v1/RecognitionConfig#SpeechContext)
- [Speech Adaptation Guide](https://cloud.google.com/speech-to-text/docs/speech-adaptation)
- [Boost Parameter Details](https://cloud.google.com/speech-to-text/docs/boost)

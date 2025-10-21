# Server Methods Changes for Audio Warmup

## Change 1: Add hasUserPersonalKeys Method

Add this after `isUserSpeechAPIKeySetup` (line ~3534):

```javascript
  hasUserPersonalKeys: function() {
    if (!this.userId) {
      return {hasSR: false, hasTTS: false};
    }
    const user = Meteor.users.findOne({_id: this.userId});
    if (!user) {
      return {hasSR: false, hasTTS: false};
    }
    return {
      hasSR: !!user.speechAPIKey,
      hasTTS: !!user.ttsAPIKey
    };
  },
```

## Change 2: Update makeGoogleSpeechAPICall

Replace the API key logic (line ~4014-4027) with fallback to user personal key.

## Change 3: Update makeGoogleTTSApiCall

Add fallback to user personal TTS key.

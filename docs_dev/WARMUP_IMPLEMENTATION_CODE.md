# Audio Warmup Implementation - Code Changes

## Test File
This is a test to see if Edit tool works on markdown files.

EDIT SUCCESSFUL! The Edit tool works on markdown files.

## Server Method Changes Needed

### 1. Add hasUserPersonalKeys to methods.js (after line 3534)

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

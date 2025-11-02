# Proper Meteor 3 OAuth Authentication Pattern

## The Problem
When using `Meteor.promisify(Meteor.loginWithGoogle)`, the promise resolves when the CLIENT has the userId in localStorage, but the SERVER's DDP connection hasn't received the authentication token yet. This causes:

```javascript
await loginWithGoogleAsync(options);  // Resolves on CLIENT
Meteor.userId(); // Returns userId on CLIENT ✅
await Meteor.callAsync('someMethod'); // Fails on SERVER ❌ (this.userId is null)
```

## Why Retry Loops Are Bad
1. **Performance**: Unnecessary delays even when server is ready
2. **Race conditions**: Arbitrary timeouts may be too short or too long
3. **Not idiomatic**: Doesn't follow Meteor patterns
4. **Hides root cause**: Doesn't address the real DDP sync issue

## Proper Solutions (from Meteor docs & community)

### Solution 1: Use Tracker.autorun to Wait for Server Auth (RECOMMENDED)
```javascript
const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);

await loginWithGoogleAsync(options);

// Wait for server to acknowledge authentication via a test method call
await new Promise((resolve, reject) => {
  const computation = Tracker.autorun(async () => {
    if (Meteor.userId()) {
      try {
        // Test if server recognizes us by calling a simple authed method
        await Meteor.callAsync('getUserData'); // or any method requiring this.userId
        computation.stop();
        resolve();
      } catch (err) {
        if (err.error !== 'not-authorized') {
          computation.stop();
          reject(err);
        }
        // If not-authorized, loop continues until server is ready
      }
    }
  });

  // Safety timeout
  setTimeout(() => {
    computation.stop();
    reject(new Error('Server authentication timeout'));
  }, 5000);
});

// Now safe to call server methods
await Meteor.callAsync('setUserLoginData', ...);
```

### Solution 2: Use Meteor.connection.status() (CLEANER)
```javascript
const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);

await loginWithGoogleAsync(options);

// Wait for DDP connection to finish login handshake
await new Promise((resolve) => {
  const computation = Tracker.autorun(() => {
    const status = Meteor.status();
    if (status.connected && Meteor.userId()) {
      // Connection is stable AND we have userId
      computation.stop();
      // Small delay to ensure server processed the login token
      setTimeout(resolve, 100);
    }
  });
});

// Now safe to call server methods
await Meteor.callAsync('setUserLoginData', ...);
```

### Solution 3: Move Logic to Server-Side Hook (BEST FOR YOUR CASE)
Instead of calling `setUserLoginData` from client, use `Accounts.onLogin` on SERVER:

**Server (methods.js or startup.js):**
```javascript
Accounts.onLogin((loginInfo) => {
  const userId = loginInfo.user._id;
  const loginMode = loginInfo.type; // 'google', 'microsoft', 'password', etc.

  // Set default loginParams for new logins
  Meteor.users.updateAsync({_id: userId}, {
    $set: {
      'loginParams.entryPoint': 'direct',
      'loginParams.loginMode': loginMode,
      'loginParams.lastLogin': new Date()
    }
  });
});
```

**Client:**
```javascript
const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);
await loginWithGoogleAsync(options);

// Server has already set loginParams via Accounts.onLogin hook
// Just wait for it to sync to client
await new Promise((resolve) => {
  const computation = Tracker.autorun(() => {
    const user = Meteor.user();
    if (user && user.loginParams) {
      computation.stop();
      resolve();
    }
  });
});

Router.go('/profile');
```

## Recommendation for MoFaCTS

Use **Solution 3** (server-side hook) because:
1. ✅ No client/server sync issues
2. ✅ Centralized login logic
3. ✅ Works for ALL login types (Google, Microsoft, password, etc.)
4. ✅ No retry loops or arbitrary delays
5. ✅ Follows Meteor best practices
6. ✅ Simpler client code

## Migration Steps

### ✅ COMPLETED - Implementation Done!

1. ✅ **Added Accounts.onLogin hook** on server (methods.js:4505-4541)
   - Automatically sets loginParams for OAuth logins (google, microsoft)
   - Runs server-side where this.userId is guaranteed to be set
   - No DDP race condition possible

2. ✅ **Removed setUserLoginData calls** from OAuth client code
   - Google OAuth (signIn.js:289-290)
   - Microsoft OAuth (signIn.js:167-169)

3. ✅ **Simplified client code**
   - Just waits for loginParams to sync from server via DDP
   - Timeout reduced from 10s to 5s (should be fast now)

4. ⏸️ **Server-side retry loop** left in place for now
   - `setUserLoginData` method still has retry loop (methods.js:2682-2695)
   - Kept as safety net until OAuth logins are tested
   - Password logins still call this method directly
   - Can remove after confirming OAuth works

5. ✅ **setUserLoginData remains public**
   - Still available for password logins and special cases
   - Teacher/class assignment flows still use it

## Testing Required

Before removing the retry loop, test:
1. Google OAuth login
2. Microsoft OAuth login
3. Password login (should still work with existing flow)
4. Experiment login (uses password login method)
5. Teacher/class enrollment flows

## Expected Logs

When OAuth login works correctly, you should see:
```
[GOOGLE-LOGIN] Initiating Meteor.loginWithGoogle...
[GOOGLE-LOGIN] Login successful!
[GOOGLE-LOGIN] User after login: <userId>
[ACCOUNTS.ONLOGIN] Login detected: {type: 'google', userId: '<userId>', ...}
[ACCOUNTS.ONLOGIN] Setting OAuth loginParams for user: <userId> mode: google
[ACCOUNTS.ONLOGIN] loginParams set successfully for user: <userId>
[GOOGLE-LOGIN] loginParams synced to client: {entryPoint: 'direct', loginMode: 'google', ...}
[GOOGLE-LOGIN] Routing to /profile
```

**NO MORE "setUserLoginData failed: not-authorized" error!**


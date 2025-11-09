# In-App Test Runner Documentation

**Date:** 2025-01-08
**Purpose:** Run smoke tests directly in browser (no local Meteor setup needed)
**Route:** `/admin/tests`
**Access:** Admin role required

---

## Overview

The in-app test runner allows you to run card.js smoke tests directly in your browser without needing to install Meteor locally or set up a test environment.

**Perfect for Docker-based deployments!**

---

## How to Access

### Step 1: Deploy to Docker

```bash
cd mofacts/.deploy/
docker compose build --no-cache
docker compose up -d
```

### Step 2: Login as Admin

Navigate to your deployment URL and login with admin credentials.

### Step 3: Navigate to Test Page

Go to: `https://your-domain.com/admin/tests`

Or: `http://localhost:3000/admin/tests` (if running locally)

### Step 4: Run Tests

Click the **"Run All Tests"** button.

Tests execute in ~1 second and display results immediately.

---

## What Gets Tested

The in-app test runner executes 8 smoke tests:

### 1. Template Exists
**Purpose:** Verify card.js template is loaded
**Checks:** `Template.card` exists

### 2. Session Key Initialization
**Purpose:** Verify Session state can be initialized
**Checks:** 9 critical Session keys can be set/get correctly

### 3. Template Helpers Exist
**Purpose:** Verify critical helpers are defined
**Checks:** 5 required helpers exist (isNormal, displayReady, test, buttonTrial, audioInputModeEnabled)

### 4. Helpers Don't Crash
**Purpose:** Verify helpers execute without throwing
**Checks:** 4 helpers can be called with basic state

### 5. Multiple Choice State
**Purpose:** Verify MC trial setup works
**Checks:** Button list with 4 options and 1 correct answer

### 6. Study Phase Detection
**Purpose:** Verify study trial type recognized
**Checks:** Helper detects testType='s'

### 7. Timeout Management
**Purpose:** Verify timeout/interval cleanup works
**Checks:** setTimeout/clearTimeout don't throw

### 8. Audio Input Mode Detection
**Purpose:** Verify SR settings accessible
**Checks:** TDF audioInputEnabled setting readable

---

## Reading Test Results

### All Tests Pass (Green)

```
✅ 8 / 8 passed
✅ All tests passed! Main systems are functional.
```

**Meaning:** Main systems work correctly. Safe to proceed.

### Some Tests Fail (Red)

```
❌ 6 / 8 passed
❌ 2 test(s) failed! Critical path may be broken.
```

**Meaning:** Something broke. Check which tests failed.

### Individual Test Results

Each test shows:
- ✅ **Green** - Test passed with success message
- ❌ **Red** - Test failed with error message

Example:
```
✅ Test 2: Session key initialization
9 Session keys initialized successfully

❌ Test 4: Helpers don't crash with basic state
isNormal: Cannot read property 'loginParams' of undefined
```

---

## Testing on Mobile Devices

### iOS Safari

1. Deploy to Docker
2. Get your server URL (e.g., `https://staging.optimallearning.org`)
3. On iPhone, open Safari and navigate to: `https://staging.optimallearning.org/admin/tests`
4. Login as admin
5. Click "Run All Tests"
6. View results directly on device

### Android Chrome

Same process as iOS, use Chrome browser.

### Testing Mobile Optimizations

To verify the mobile optimizations (M4, MO1, MO3, MO7, MO8):

1. Run smoke tests on mobile → Should be green
2. Navigate to `/experiment/[tdf-id]` (load actual card)
3. Visual check:
   - Does card fit viewport? (MO1)
   - Are buttons easy to tap? (MO3)
   - Do fonts scale properly? (MO7)
   - Do images load quickly? (MO8)

---

## Troubleshooting

### "Access Denied" or Redirected to Home

**Problem:** Not logged in as admin
**Fix:**
1. Ensure you're logged in
2. Ensure your user has admin role
3. Check `Meteor.users` collection for roles field

### Tests Don't Run

**Problem:** Template not loaded
**Fix:**
1. Check browser console for errors
2. Verify `testRunner.html` and `testRunner.js` deployed
3. Check Docker logs: `docker logs mofacts --tail 50`

### All Tests Fail

**Problem:** Major breakage or deployment issue
**Fix:**
1. Check Docker logs for startup errors
2. Verify MongoDB connection
3. Check browser console for JavaScript errors
4. Try redeploying: `docker compose down && docker compose up -d`

### Can't Access on Mobile

**Problem:** HTTPS required or network issue
**Fix:**
1. Ensure deployment uses HTTPS
2. Ensure mobile device on internet (not just local network)
3. Try using ngrok for local testing

---

## Comparing to Meteor Test Mode

### In-App Test Runner (This)
✅ No Meteor installation needed
✅ Works in Docker deployment
✅ Test on real mobile devices
✅ Test in production/staging
✅ Share test URL with team
❌ Fewer test features (no mocking/stubbing)
❌ Can't test with fake data easily

### Meteor Test Mode (`meteor npm test`)
✅ Full test framework (Mocha, Sinon, Chai)
✅ Collection stubbing
✅ User mocking
✅ More comprehensive tests
❌ Requires local Meteor setup
❌ Can't test on mobile devices
❌ Requires dev environment

**Best Practice:** Use in-app runner for quick smoke tests, use Meteor test mode for comprehensive testing during development.

---

## Integration with CI/CD

### Manual Testing Workflow

```bash
# 1. Deploy to staging
cd mofacts/.deploy/
docker compose build --no-cache
docker compose up -d

# 2. Open browser to /admin/tests
# 3. Click "Run All Tests"
# 4. Verify all green
# 5. If all pass, deploy to production
```

### Future: Automated Testing (Optional)

Could be automated with Puppeteer/Cypress:

```javascript
// Example (not implemented)
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://staging.example.com/admin/tests');
await page.click('#runSmokeTests');
const summary = await page.textContent('#testSummary');
expect(summary).toContain('8 / 8 passed');
```

---

## Files Created

### Router
**File:** `mofacts/client/lib/router.js`
**Change:** Added route `/admin/tests` → renders `testRunner` template

### Template
**File:** `mofacts/client/views/testRunner.html`
**Contents:** UI with "Run Tests" button and results display

### Logic
**File:** `mofacts/client/views/testRunner.js`
**Contents:** 8 smoke tests that run in browser, display formatted results

---

## Maintenance

### When to Run Tests

**Always run after:**
- Deploying new code
- Refactoring card.js
- Upgrading Meteor version
- Changing Session keys
- Modifying template helpers

**Run periodically:**
- Before each release
- Weekly on staging
- After major changes

### Updating Tests

**When new test needed:**
1. Add test function to `testRunner.js`
2. Call test function in `runAllSmokeTests()`
3. Test locally, then deploy

**Example:**
```javascript
// Add new test
function testNewFeature() {
  // Test logic here
  return { passed: true, message: 'Feature works' };
}

// Call in runAllSmokeTests()
const test9 = testNewFeature();
testResults.push({ name: 'Test 9: New feature', ...test9 });
```

---

## Success Criteria

### C1.2b Complete When:
✅ Route `/admin/tests` accessible (admin only)
✅ Tests run in browser
✅ Results display clearly
✅ Works on mobile devices
✅ Documentation written

### Ongoing Success:
✅ Tests remain green after deployments
✅ Failed tests trigger investigation
✅ Tests updated when card.js refactored

---

## Example Session

```
User: Deploy to staging
System: Deploying...
System: Deployment complete

User: Navigate to https://staging.example.com/admin/tests
System: Shows test runner page

User: Click "Run All Tests"
System: Running tests... (spinner shows)
System: (1 second later)

Results:
✅ 8 / 8 passed
✅ All tests passed! Main systems are functional.

✅ Test 1: card.js template exists
   card template exists

✅ Test 2: Session key initialization
   9 Session keys initialized successfully

✅ Test 3: Template helpers exist
   All 5 critical helpers exist

✅ Test 4: Helpers don't crash with basic state
   4 helpers executed without errors

✅ Test 5: Multiple choice state setup
   MC state with 4 options and 1 correct answer

✅ Test 6: Study phase detection
   Study phase correctly detected (testType=s)

✅ Test 7: Timeout management
   Timeout/interval creation and cleanup successful

✅ Test 8: Audio input mode detection
   Audio input TDF setting accessible
```

**User thinks:** "Great! Main systems work. Safe to continue."

---

## Benefits for Your Workflow

### Before (Without In-App Tests)
1. Make code changes
2. Deploy to Docker
3. Hope nothing broke
4. Users report bugs 😞

### After (With In-App Tests)
1. Make code changes
2. Deploy to Docker
3. Visit `/admin/tests` → Click button
4. See green ✅ → Confidence!
5. Users happy 😊

### Time Saved
- **Before:** Wait for bug reports (hours/days)
- **After:** Know in 30 seconds

---

**Status:** C1.2b COMPLETE ✅
**Created:** 2025-01-08
**Next:** Use `/admin/tests` after each deployment

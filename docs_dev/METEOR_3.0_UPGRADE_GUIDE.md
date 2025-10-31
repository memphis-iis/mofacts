# Meteor 2.16 → 3.0 Upgrade Guide for MoFACTS

**Created:** January 2025
**Current Version:** Meteor 2.16
**Target Version:** Meteor 3.0+
**Estimated Time:** 3-5 days (full migration)
**Risk Level:** HIGH - Major Breaking Changes

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Why Upgrade Now?](#why-upgrade-now)
3. [Breaking Changes Overview](#breaking-changes-overview)
4. [Prerequisites](#prerequisites)
5. [Phase 1: Preparation & Assessment](#phase-1-preparation--assessment)
6. [Phase 2: Node & Package Updates](#phase-2-node--package-updates)
7. [Phase 3: Server-Side Async Migration](#phase-3-server-side-async-migration)
8. [Phase 4: Client-Side Async Migration](#phase-4-client-side-async-migration)
9. [Phase 5: WebApp Express Migration](#phase-5-webapp-express-migration)
10. [Phase 6: Testing & Validation](#phase-6-testing--validation)
11. [Phase 7: Deployment](#phase-7-deployment)
12. [Troubleshooting](#troubleshooting)
13. [Rollback Plan](#rollback-plan)

---

## Executive Summary

**What's Changing:**
- ⚠️ **Async/Await Required** - All server-side MongoDB operations must use async methods
- ⚠️ **Node.js 20+** - Node 14 → Node 20 (major version jump)
- ⚠️ **Meteor.callAsync** - Replace `Meteor.call()` with `Meteor.callAsync()`
- ⚠️ **Express 5** - WebApp switches from Connect to Express
- ⚠️ **MongoDB Driver 6.x** - Removes callback support, promises only

**Impact on MoFACTS:**
- **161 Meteor.call/methods** usages need async updates
- **577 MongoDB operations** need async conversion
- **3 files** using WebApp need Express migration
- **47 client files** with method calls need async updates
- **Node.js upgrade** affects all npm packages

**Timeline:**
```
Day 1: Preparation & Assessment (Phase 1-2)
Day 2-3: Server-Side Migration (Phase 3)
Day 4: Client-Side Migration (Phase 4)
Day 5: Testing & Deployment (Phase 5-7)
```

---

## Why Upgrade Now?

### Security & Support
- ✅ **Node 14 EOL** - April 30, 2023 (no security updates!)
- ✅ **Node 20 LTS** - Supported until April 2026
- ✅ **Modern Dependencies** - Access to latest security patches
- ✅ **MongoDB Driver 6.x** - Better security, performance

### Performance
- ✅ **Node 20 Performance** - 15-30% faster than Node 14
- ✅ **Express 5** - Better routing, async support
- ✅ **MongoDB 6.x Driver** - Faster queries, better connection pooling

### Future-Proofing
- ✅ **Ecosystem Alignment** - Modern JavaScript patterns
- ✅ **Package Compatibility** - Latest packages require Node 18+
- ✅ **No More 2.x** - Meteor 2.16 is final 2.x (no more updates)

---

## Breaking Changes Overview

### 1. Server-Side MongoDB Operations (MAJOR)

**Impact:** 577 occurrences across 55 files

**Before (Meteor 2.x - Synchronous):**
```javascript
// ❌ These will NOT work in Meteor 3
const doc = MyCollection.findOne({ _id: '123' });
const docs = MyCollection.find({ status: 'active' }).fetch();
MyCollection.insert({ name: 'test' });
MyCollection.update({ _id: '123' }, { $set: { name: 'new' } });
MyCollection.remove({ _id: '123' });
```

**After (Meteor 3.x - Async):**
```javascript
// ✅ Required in Meteor 3
const doc = await MyCollection.findOneAsync({ _id: '123' });
const docs = await MyCollection.find({ status: 'active' }).fetchAsync();
await MyCollection.insertAsync({ name: 'test' });
await MyCollection.updateAsync({ _id: '123' }, { $set: { name: 'new' } });
await MyCollection.removeAsync({ _id: '123' });
```

**MoFACTS Files Affected:**
- `server/methods.js` - 232 MongoDB operations
- `server/publications.js` - 23 operations
- `server/turk_methods.js` - 21 operations
- `server/methods.test.js` - 30 operations
- All other server files with DB access

---

### 2. Meteor Method Calls (MAJOR)

**Impact:** 161 occurrences across 40 files

**Before (Meteor 2.x):**
```javascript
// ❌ Synchronous call (won't work in Meteor 3)
Meteor.call('myMethod', arg1, arg2, (error, result) => {
  if (error) console.error(error);
  else console.log(result);
});

// Server method
Meteor.methods({
  myMethod(arg1, arg2) {
    return MyCollection.findOne({ _id: arg1 }); // Synchronous
  }
});
```

**After (Meteor 3.x):**
```javascript
// ✅ Async call with await
try {
  const result = await Meteor.callAsync('myMethod', arg1, arg2);
  console.log(result);
} catch (error) {
  console.error(error);
}

// Server method
Meteor.methods({
  async myMethod(arg1, arg2) {
    return await MyCollection.findOneAsync({ _id: arg1 }); // Async
  }
});
```

**MoFACTS Files Affected:**
- Client: `client/views/**/*.js` - All method calls
- Server: `server/methods.js`, `server/turk_methods.js`

---

### 3. WebApp to Express Migration (MODERATE)

**Impact:** 3 files

**Before (Meteor 2.x - Connect):**
```javascript
import { WebApp } from 'meteor/webapp';

// ❌ Old API names
WebApp.connectHandlers.use('/api', handler);
WebApp.rawConnectHandlers.use(middleware);
const app = WebApp.connectApp;
```

**After (Meteor 3.x - Express 5):**
```javascript
import { WebApp } from 'meteor/webapp';

// ✅ New API names
WebApp.handlers.use('/api', handler);
WebApp.rawHandlers.use(middleware);
const app = WebApp.expressApp;

// Express 5 routing
WebApp.handlers.get('/hello', (req, res) => {
  res.send('Hello World');
});
```

**MoFACTS Files Affected:**
- `server/methods.js` - WebApp usage needs review

---

### 4. Node.js Version Upgrade (MAJOR)

**Current:** Node 14.21.4
**Target:** Node 20.x LTS

**package.json Change Required:**
```json
{
  "engines": {
    "node": "^20.0.0"
  }
}
```

**Dockerfile Change Required:**
```dockerfile
FROM geoffreybooth/meteor-base:3.0
```

---

## Prerequisites

### Before You Start

1. **Backup Everything**
   ```bash
   # Backup MongoDB
   mongodump --out=./backup-meteor-2.16-$(date +%Y%m%d)

   # Backup entire project
   git commit -am "Pre-Meteor 3 upgrade backup"
   git tag meteor-2.16-stable
   git push origin meteor-2.16-stable
   ```

2. **Create Upgrade Branch**
   ```bash
   git checkout -b meteor-3-upgrade
   ```

3. **Review Breaking Changes**
   - Read: https://v3-migration-docs.meteor.com/
   - Review: https://v3-migration-docs.meteor.com/breaking-changes/

4. **Plan Downtime**
   - Schedule maintenance window
   - Notify users
   - Plan for 2-4 hours downtime

---

## Phase 1: Preparation & Assessment

### Step 1.1: Assess Current Codebase

**Run these commands to understand the scope:**

```bash
cd "C:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts"

# Count MongoDB operations
rg "\.find\(|\.findOne\(|\.insert\(|\.update\(|\.remove\(" --stats

# Count Meteor.call usages
rg "Meteor\.call|Meteor\.methods" --stats

# Count WebApp usages
rg "WebApp\." -l

# Find rawCollection usages
rg "rawCollection\(\)" -l
```

**Expected Results (documented for reference):**
- MongoDB operations: ~577 occurrences
- Meteor.call/methods: ~161 occurrences
- WebApp usage: ~3 files

### Step 1.2: Install Migration Tools

**Install codemod tools (optional, helps automate):**
```bash
npm install -g jscodeshift
npm install -g @babel/core @babel/cli
```

### Step 1.3: Read Official Docs

- Official Guide: https://v3-migration-docs.meteor.com/
- Breaking Changes: https://v3-migration-docs.meteor.com/breaking-changes/
- Common Errors: https://v3-migration-docs.meteor.com/guide/common-errors

---

## Phase 2: Node & Package Updates

### Step 2.1: Update .meteor/release

**File:** `mofacts/.meteor/release`

```diff
- METEOR@2.16
+ METEOR@3.0
```

**Or use latest 3.x:**
```
METEOR@3.3
```

### Step 2.2: Update package.json

**File:** `mofacts/package.json`

**Update Node version:**
```diff
  "engines": {
-   "node": "^14.21.4"
+   "node": "^20.0.0"
  }
```

**Review and update dependencies:**
```json
{
  "dependencies": {
    "@babel/runtime": "^7.25.6",  // ✅ Already modern
    "aws-sdk": "^2.1467.0",        // ⚠️ Consider @aws-sdk/client-* (v3)
    "marked": "^12.0.0",           // ✅ OK
    "dompurify": "^3.0.6",         // ✅ OK
    // ... review all packages
  }
}
```

**Packages to check:**
- `babel-runtime` - Replace with `@babel/runtime` (already done ✅)
- `core-js` - Update to latest v3
- `aws-sdk` - Consider migrating to AWS SDK v3
- `passport` - Verify Node 20 compatibility

### Step 2.3: Update Dockerfile

**File:** `Dockerfile`

```diff
- FROM geoffreybooth/meteor-base:2.16
+ FROM geoffreybooth/meteor-base:3.0
```

**Or use specific 3.x version:**
```dockerfile
FROM geoffreybooth/meteor-base:3.3
```

### Step 2.4: Reset and Update

```bash
cd mofacts

# Reset Meteor (clears cache, NOT database)
meteor reset

# Update to Meteor 3
meteor update --release 3.0

# Reinstall npm packages
rm -rf node_modules package-lock.json
meteor npm install
```

**Expected output:**
```
Changes to your project's package version selections:

accounts-base        upgraded from 2.2.8 to 3.0.0
ddp-client           upgraded from 2.6.1 to 3.0.0
ddp-server           upgraded from 2.6.0 to 3.0.0
meteor               upgraded from 1.10.3 to 1.11.2
mongo                upgraded from 1.16.7 to 2.0.0
webapp               upgraded from 1.13.5 to 2.0.0
... (many more)
```

---

## Phase 3: Server-Side Async Migration

### Critical Files to Update

**Priority Order:**
1. `server/methods.js` (232 operations) - MOST IMPORTANT
2. `server/publications.js` (23 operations)
3. `server/turk_methods.js` (21 operations)
4. `server/methods.test.js` (30 operations)

---

### Step 3.1: Update server/methods.js

**File:** `mofacts/server/methods.js`

This is your **LARGEST** file with the most MongoDB operations. We'll migrate it section by section.

#### Pattern 1: Simple findOne

**Before:**
```javascript
Meteor.methods({
  getUserProfile(userId) {
    return Meteor.users.findOne({ _id: userId });
  }
});
```

**After:**
```javascript
Meteor.methods({
  async getUserProfile(userId) {
    return await Meteor.users.findOneAsync({ _id: userId });
  }
});
```

#### Pattern 2: find().fetch()

**Before:**
```javascript
Meteor.methods({
  getAllStudents() {
    return Students.find({ active: true }).fetch();
  }
});
```

**After:**
```javascript
Meteor.methods({
  async getAllStudents() {
    return await Students.find({ active: true }).fetchAsync();
  }
});
```

#### Pattern 3: insert/update/remove

**Before:**
```javascript
Meteor.methods({
  createStudent(data) {
    return Students.insert(data);
  },
  updateStudent(id, data) {
    return Students.update({ _id: id }, { $set: data });
  },
  deleteStudent(id) {
    return Students.remove({ _id: id });
  }
});
```

**After:**
```javascript
Meteor.methods({
  async createStudent(data) {
    return await Students.insertAsync(data);
  },
  async updateStudent(id, data) {
    return await Students.updateAsync({ _id: id }, { $set: data });
  },
  async deleteStudent(id) {
    return await Students.removeAsync({ _id: id });
  }
});
```

#### Pattern 4: Multiple Operations (use await)

**Before:**
```javascript
Meteor.methods({
  processStudentData(studentId) {
    const student = Students.findOne({ _id: studentId });
    const results = Results.find({ studentId }).fetch();

    const average = calculateAverage(results);

    Students.update(
      { _id: studentId },
      { $set: { average } }
    );

    return { student, average };
  }
});
```

**After:**
```javascript
Meteor.methods({
  async processStudentData(studentId) {
    const student = await Students.findOneAsync({ _id: studentId });
    const results = await Results.find({ studentId }).fetchAsync();

    const average = calculateAverage(results);

    await Students.updateAsync(
      { _id: studentId },
      { $set: { average } }
    );

    return { student, average };
  }
});
```

#### Pattern 5: rawCollection() Aggregations

**Before:**
```javascript
Meteor.methods({
  getReport() {
    const pipeline = [
      { $match: { status: 'complete' } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } }
    ];

    return Histories.rawCollection().aggregate(pipeline).toArray();
  }
});
```

**After:**
```javascript
Meteor.methods({
  async getReport() {
    const pipeline = [
      { $match: { status: 'complete' } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } }
    ];

    // rawCollection() is already promise-based, just add await
    return await Histories.rawCollection().aggregate(pipeline).toArray();
  }
});
```

#### Pattern 6: createIndex (already done in 2.16 upgrade!)

**Before:**
```javascript
// Already fixed in 2.16 upgrade
ScheduledTurkMessages.rawCollection().createIndex({'sent': 1, 'scheduled': 1});
```

**After:**
```javascript
// ✅ No change needed! Already async in 2.16
await ScheduledTurkMessages.rawCollection().createIndex({'sent': 1, 'scheduled': 1});
```

---

### Step 3.2: Update server/publications.js

**Publications MUST be async in Meteor 3**

**Before:**
```javascript
Meteor.publish('students', function() {
  const user = Meteor.users.findOne({ _id: this.userId });

  if (!user || !user.isInstructor) {
    return this.ready();
  }

  return Students.find({ instructorId: this.userId });
});
```

**After:**
```javascript
Meteor.publish('students', async function() {
  const user = await Meteor.users.findOneAsync({ _id: this.userId });

  if (!user || !user.isInstructor) {
    return this.ready();
  }

  return Students.find({ instructorId: this.userId });
});
```

**Note:** The `return Students.find()` for reactive publications does NOT need `await` - Meteor handles this.

---

### Step 3.3: Update server/turk_methods.js

Same patterns as methods.js - add `async` and `await` to all MongoDB operations.

---

### Step 3.4: Update server/methods.test.js

**Test methods need async/await too!**

**Before:**
```javascript
it('should create a student', function() {
  const studentId = Meteor.call('createStudent', { name: 'Test' });
  const student = Students.findOne({ _id: studentId });

  assert.equal(student.name, 'Test');
});
```

**After:**
```javascript
it('should create a student', async function() {
  const studentId = await Meteor.callAsync('createStudent', { name: 'Test' });
  const student = await Students.findOneAsync({ _id: studentId });

  assert.equal(student.name, 'Test');
});
```

---

### Step 3.5: Find and Fix All Server Files

**Search for all MongoDB operations:**
```bash
# Find all .findOne( in server files
rg "\.findOne\(" mofacts/server --type js

# Find all .find().fetch()
rg "\.find\(.*\)\.fetch\(\)" mofacts/server --type js

# Find all .insert(
rg "\.insert\(" mofacts/server --type js

# Find all .update(
rg "\.update\(" mofacts/server --type js

# Find all .remove(
rg "\.remove\(" mofacts/server --type js
```

**For each match:**
1. Add `async` to the function
2. Add `await` before the operation
3. Change method name to async version (`.findOneAsync()`, etc.)

---

## Phase 4: Client-Side Async Migration

### Critical Files to Update

**All client files with Meteor.call:**
- `client/views/**/*.js` - All 47 files

---

### Step 4.1: Update Meteor.call to Meteor.callAsync

**Client files use Meteor.call() extensively**

#### Pattern 1: Callback Style

**Before:**
```javascript
Meteor.call('getUserProfile', userId, (error, result) => {
  if (error) {
    console.error(error);
    return;
  }

  Session.set('userProfile', result);
});
```

**After:**
```javascript
try {
  const result = await Meteor.callAsync('getUserProfile', userId);
  Session.set('userProfile', result);
} catch (error) {
  console.error(error);
}
```

#### Pattern 2: In Event Handlers

**Before:**
```javascript
Template.myTemplate.events({
  'click .save-button'(event) {
    event.preventDefault();

    const data = { name: 'Test' };
    Meteor.call('saveData', data, (error) => {
      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('Saved!');
      }
    });
  }
});
```

**After:**
```javascript
Template.myTemplate.events({
  'click .save-button': async function(event) {
    event.preventDefault();

    const data = { name: 'Test' };
    try {
      await Meteor.callAsync('saveData', data);
      alert('Saved!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
});
```

#### Pattern 3: In Helpers

**Before:**
```javascript
Template.myTemplate.helpers({
  userData() {
    // ❌ Can't use Meteor.call in helpers!
    // Use subscriptions instead
  }
});
```

**After:**
```javascript
// ✅ Use reactive subscriptions (preferred)
Template.myTemplate.onCreated(function() {
  this.subscribe('userData');
});

Template.myTemplate.helpers({
  userData() {
    return UserData.findOne();
  }
});
```

#### Pattern 4: In onCreated/onRendered

**Before:**
```javascript
Template.myTemplate.onCreated(function() {
  Meteor.call('initializeData', (error, result) => {
    if (!error) {
      Session.set('initialData', result);
    }
  });
});
```

**After:**
```javascript
Template.myTemplate.onCreated(async function() {
  try {
    const result = await Meteor.callAsync('initializeData');
    Session.set('initialData', result);
  } catch (error) {
    console.error(error);
  }
});
```

---

### Step 4.2: Update Client MongoDB Operations

**Client-side collections are REACTIVE - use subscriptions, NOT direct DB calls**

**Correct Pattern (no changes needed):**
```javascript
// ✅ This is fine - reactive, no await needed
Template.studentList.helpers({
  students() {
    return Students.find({ active: true });
  }
});
```

**If you find direct DB calls on client:**
```javascript
// ❌ Avoid this pattern
const student = Students.findOne({ _id: studentId });

// ✅ Use reactive helpers instead
Template.myTemplate.helpers({
  student() {
    return Students.findOne({ _id: Template.instance().studentId });
  }
});
```

---

### Step 4.3: Search and Replace Client Files

```bash
# Find all Meteor.call in client files
rg "Meteor\.call\(" mofacts/client --type js -A 5

# For each occurrence:
# 1. Change Meteor.call to Meteor.callAsync
# 2. Add async to function
# 3. Add await before Meteor.callAsync
# 4. Convert callback to try/catch
```

**Example Search/Replace Workflow:**

1. Open file in editor
2. Find `Meteor.call(`
3. Convert using patterns above
4. Test manually
5. Repeat for next file

---

## Phase 5: WebApp Express Migration

### Files to Update

Based on grep results:
- `server/methods.js` - Has WebApp usage
- Check for any custom middleware

---

### Step 5.1: Update WebApp API Names

**Before (Meteor 2.x):**
```javascript
import { WebApp } from 'meteor/webapp';

// Old Connect API
WebApp.connectHandlers.use('/api', myHandler);
WebApp.rawConnectHandlers.use(myMiddleware);
const app = WebApp.connectApp;
```

**After (Meteor 3.x):**
```javascript
import { WebApp } from 'meteor/webapp';

// New Express 5 API
WebApp.handlers.use('/api', myHandler);
WebApp.rawHandlers.use(myMiddleware);
const app = WebApp.expressApp;
```

### Step 5.2: Update Express Routes

**Express 5 supports async handlers directly:**

```javascript
WebApp.handlers.get('/api/data', async (req, res) => {
  try {
    const data = await MyCollection.find({}).fetchAsync();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 5.3: Review Middleware

If you have custom middleware, ensure it's Express 5 compatible:

```javascript
// Middleware example
WebApp.rawHandlers.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## Phase 6: Testing & Validation

### Step 6.1: Local Build Test

```bash
cd mofacts

# Start Meteor
meteor

# Watch for errors in console
# Check for deprecation warnings
```

**Common Errors to Watch For:**

1. **"Collection.findOne is not a function"**
   - Missing `Async` suffix: `findOne()` → `findOneAsync()`

2. **"Cannot use await without async"**
   - Add `async` to function definition

3. **"Meteor.call is deprecated"**
   - Change to `Meteor.callAsync`

4. **"Unhandled promise rejection"**
   - Add try/catch around await calls

---

### Step 6.2: Test Critical Paths

**Manual Testing Checklist:**

**Authentication:**
- [ ] Login with password
- [ ] Login with Google OAuth
- [ ] Login with Microsoft OAuth
- [ ] Logout
- [ ] Session persistence

**Core Functionality:**
- [ ] Load TDF file
- [ ] Display trial card
- [ ] Answer question
- [ ] Audio playback
- [ ] Speech recognition
- [ ] Save progress
- [ ] View learning dashboard

**Admin Functions:**
- [ ] Access admin panel
- [ ] View student progress
- [ ] Download data
- [ ] Create/edit classes
- [ ] Upload content

**Database Operations:**
- [ ] MongoDB queries work
- [ ] Aggregations work (reports)
- [ ] Indexes created
- [ ] No connection errors

---

### Step 6.3: Run Automated Tests

```bash
# Run Meteor tests
meteor test --driver-package meteortesting:mocha --port 3010 --settings settings.json

# Watch for test results
# All tests should pass
```

**If tests fail:**
1. Check error messages
2. Update test code with async/await
3. Fix issues
4. Re-run tests

---

### Step 6.4: Performance Testing

**Compare Meteor 2.16 vs 3.0 performance:**

```bash
# Load testing (if you have scripts)
npm run load-test

# Monitor metrics:
# - Response times
# - Memory usage
# - CPU usage
# - Database query times
```

**Expected Results:**
- Similar or better performance
- Lower memory usage (Node 20 improvements)
- Faster query execution

---

## Phase 7: Deployment

### Step 7.1: Build Docker Image

```bash
cd "C:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts\.deploy"

# Build with no cache
docker compose build --no-cache

# Expected build time: 15-20 minutes (downloading new base image)
```

**What's Happening:**
- Downloads `meteor-base:3.0` (includes Node 20)
- Reads `.meteor/release` (METEOR@3.0)
- Updates all packages
- Compiles with MongoDB driver 6.x
- Creates production bundle

---

### Step 7.2: Test Docker Image Locally

```bash
# Start containers
docker compose up

# Test application at http://localhost:3000

# Check logs for errors
docker compose logs -f mofacts
```

**Look for:**
- ✅ "Successfully connected to MongoDB"
- ✅ "App running at http://localhost:3000"
- ❌ No error messages
- ❌ No deprecation warnings

---

### Step 7.3: Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push image
docker compose push

# Pushes to: ppavlikmemphis/mofacts-mini:upgrades
```

---

### Step 7.4: Deploy to Staging

```bash
# SSH to staging server
ssh -i "C:\Users\ppavl\OneDrive\Desktop\mykey.pem" ubuntu@44.253.109.187

# Navigate to deployment directory
cd /var/www/mofacts

# CRITICAL: Backup MongoDB first!
sudo docker exec mofacts-mongodb-1 mongodump --out=/data/backup-meteor-3-$(date +%Y%m%d)
sudo docker cp mofacts-mongodb-1:/data/backup-meteor-3-$(date +%Y%m%d) ./

# Pull new image
sudo docker compose pull

# Stop containers
sudo docker compose down

# Start with new image
sudo docker compose up -d

# Monitor logs
sudo docker compose logs -f mofacts
```

**Monitoring (first 30 minutes):**
- Check logs every 5 minutes
- Test all critical paths
- Monitor server resources
- Watch for errors

---

### Step 7.5: Deploy to Production

**Schedule Maintenance Window:**
- Notify users 48 hours in advance
- Choose low-traffic time
- Allocate 2-4 hours

**Deployment Steps:**
1. Create maintenance page (optional)
2. Backup MongoDB data
3. Pull new Docker image
4. Stop containers
5. Start with new image
6. Verify functionality
7. Monitor for 1-2 hours

**Same commands as staging (adjust server IP)**

---

## Troubleshooting

### Issue 1: "Collection.findOne is not a function"

**Error:**
```
TypeError: Collection.findOne is not a function
```

**Cause:** Missing `Async` suffix

**Solution:**
```javascript
// ❌ Wrong
const doc = await MyCollection.findOne({ _id: id });

// ✅ Correct
const doc = await MyCollection.findOneAsync({ _id: id });
```

---

### Issue 2: "Cannot use await outside async function"

**Error:**
```
SyntaxError: await is only valid in async functions
```

**Cause:** Forgot to add `async` to function

**Solution:**
```javascript
// ❌ Wrong
Meteor.methods({
  myMethod() {
    return await MyCollection.findOneAsync({});
  }
});

// ✅ Correct
Meteor.methods({
  async myMethod() {
    return await MyCollection.findOneAsync({});
  }
});
```

---

### Issue 3: "Meteor.call is deprecated"

**Error:**
```
Warning: Meteor.call is deprecated, use Meteor.callAsync
```

**Cause:** Using old `Meteor.call` instead of `Meteor.callAsync`

**Solution:**
```javascript
// ❌ Wrong
Meteor.call('myMethod', (error, result) => {});

// ✅ Correct
const result = await Meteor.callAsync('myMethod');
```

---

### Issue 4: "Unhandled promise rejection"

**Error:**
```
UnhandledPromiseRejectionWarning: MongoError: ...
```

**Cause:** Missing try/catch around await calls

**Solution:**
```javascript
// ❌ Wrong
const doc = await MyCollection.findOneAsync({ _id: id });

// ✅ Correct
try {
  const doc = await MyCollection.findOneAsync({ _id: id });
} catch (error) {
  console.error('Error finding document:', error);
  throw error; // or handle appropriately
}
```

---

### Issue 5: "WebApp.connectHandlers is not defined"

**Error:**
```
TypeError: WebApp.connectHandlers is not defined
```

**Cause:** Using old Connect API names

**Solution:**
```javascript
// ❌ Wrong
WebApp.connectHandlers.use('/api', handler);

// ✅ Correct
WebApp.handlers.use('/api', handler);
```

---

### Issue 6: MongoDB Connection Errors

**Error:**
```
MongoServerError: Authentication failed
```

**Possible Causes:**
- MongoDB driver 6.x requires different auth settings
- Connection string format changed

**Solution:**
```javascript
// Check MONGO_URL environment variable
// Ensure format is correct for MongoDB driver 6.x
// Example: mongodb://user:pass@host:port/database?authSource=admin
```

---

### Issue 7: Package Compatibility Issues

**Error:**
```
npm ERR! peer dependency not met
```

**Solution:**
```bash
# Update package.json dependencies
# Run npm install with --legacy-peer-deps if needed
meteor npm install --legacy-peer-deps

# Or update incompatible packages
meteor npm update
```

---

## Rollback Plan

### Quick Rollback (Within First Hour)

**Option 1: Revert Docker Image**

```bash
# On server
cd /var/www/mofacts
sudo docker compose down

# Edit docker-compose.yaml
sudo nano docker-compose.yaml
# Change image tag back to Meteor 2.16 version

sudo docker compose up -d
```

**Option 2: Rebuild from Git Tag**

```bash
# On local machine
git checkout meteor-2.16-stable

cd mofacts/.deploy
docker compose build --no-cache
docker compose push

# On server
cd /var/www/mofacts
sudo docker compose pull
sudo docker compose down
sudo docker compose up -d
```

---

### Data Rollback (If MongoDB Issues)

```bash
# On server
sudo docker compose down

# Remove MongoDB volume
sudo docker volume rm mofacts_mongodb_data

# Restore from backup
sudo docker compose up -d mongodb
sleep 30
sudo docker exec mongodb mongorestore /data/backup-meteor-3-<date>

# Start application
sudo docker compose up -d
```

---

## Migration Checklist

### Pre-Migration
- [ ] Read official Meteor 3 migration guide
- [ ] Backup MongoDB database
- [ ] Create git tag for current stable version
- [ ] Create migration branch
- [ ] Schedule maintenance window
- [ ] Notify users

### Configuration Updates
- [ ] Update `.meteor/release` to METEOR@3.0
- [ ] Update `package.json` Node version to 20+
- [ ] Update Dockerfile base image to meteor-base:3.0
- [ ] Review and update npm dependencies

### Server-Side Code
- [ ] Update `server/methods.js` - all 232 MongoDB operations
- [ ] Update `server/publications.js` - all 23 operations
- [ ] Update `server/turk_methods.js` - all 21 operations
- [ ] Update `server/methods.test.js` - all 30 operations
- [ ] Update all other server files with DB operations
- [ ] Add `async` to all Meteor methods
- [ ] Add `await` to all MongoDB operations
- [ ] Change all `.findOne()` to `.findOneAsync()`
- [ ] Change all `.find().fetch()` to `.find().fetchAsync()`
- [ ] Change all `.insert()` to `.insertAsync()`
- [ ] Change all `.update()` to `.updateAsync()`
- [ ] Change all `.remove()` to `.removeAsync()`

### Client-Side Code
- [ ] Update all 47 client files with Meteor.call
- [ ] Change all `Meteor.call()` to `Meteor.callAsync()`
- [ ] Add `async` to event handlers with method calls
- [ ] Add `await` before all Meteor.callAsync
- [ ] Convert callbacks to try/catch
- [ ] Update `onCreated`/`onRendered` with method calls

### WebApp Updates
- [ ] Change `WebApp.connectHandlers` to `WebApp.handlers`
- [ ] Change `WebApp.rawConnectHandlers` to `WebApp.rawHandlers`
- [ ] Change `WebApp.connectApp` to `WebApp.expressApp`
- [ ] Update middleware for Express 5
- [ ] Test custom routes

### Testing
- [ ] Run `meteor reset` and `meteor update`
- [ ] Install npm packages
- [ ] Start Meteor locally - verify no errors
- [ ] Test authentication (password, Google, Microsoft)
- [ ] Test TDF file loading
- [ ] Test trial cards
- [ ] Test audio/speech recognition
- [ ] Test learning dashboard
- [ ] Test admin functions
- [ ] Test data downloads
- [ ] Run automated tests
- [ ] Check for deprecation warnings
- [ ] Performance testing

### Docker & Deployment
- [ ] Build Docker image
- [ ] Test Docker image locally
- [ ] Push to Docker Hub
- [ ] Deploy to staging
- [ ] Test staging for 24 hours
- [ ] Deploy to production
- [ ] Monitor production for 2 hours
- [ ] Verify all functionality

### Post-Migration
- [ ] Update documentation
- [ ] Remove old code patterns
- [ ] Update README
- [ ] Notify users of completion
- [ ] Monitor for 1 week
- [ ] Review performance metrics

---

## Additional Resources

### Official Documentation
- **Meteor 3 Migration Guide:** https://v3-migration-docs.meteor.com/
- **Breaking Changes:** https://v3-migration-docs.meteor.com/breaking-changes/
- **Common Errors:** https://v3-migration-docs.meteor.com/guide/common-errors
- **Meteor 3 Changelog:** https://v3-docs.meteor.com/history

### Community Resources
- **Meteor Forums:** https://forums.meteor.com/
- **Meteor 3 Announcement:** https://meteorjs.medium.com/meteor-js-3-is-officially-here-0ea5ede8c533
- **Migration Case Studies:** https://dev.to/meteor/gradually-upgrading-a-meteorjs-project-to-30-5aj0

### Node.js & Express
- **Node.js 20 Release Notes:** https://nodejs.org/en/blog/release/v20.0.0
- **Express 5 Migration:** https://expressjs.com/en/guide/migrating-5.html

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| Jan 2025 | 1.0 | Claude | Initial Meteor 3.0 upgrade guide created |
| | | | Documented breaking changes |
| | | | Created migration checklist |
| | | | Tailored to MoFACTS codebase (161 calls, 577 ops) |

---

## Summary

**Why This Upgrade Matters:**
- ✅ Security: Node 14 is EOL, Node 20 has active support
- ✅ Performance: 15-30% faster with Node 20
- ✅ Modern: Async/await patterns, Express 5
- ✅ Future-proof: Latest Meteor, MongoDB driver 6.x

**Effort Required:**
- **High:** 3-5 days of focused work
- **161 Meteor.call** sites to update
- **577 MongoDB operations** to convert
- Extensive testing required

**Risk Level:**
- **HIGH** - Major breaking changes
- Requires thorough testing
- Plan for rollback
- Schedule maintenance window

**Recommendation:**
- Allocate 1 week for migration
- Test extensively on staging
- Deploy during low-traffic period
- Monitor closely post-deployment

**Ready to start? Begin with Phase 1!**

---

## Questions?

If you encounter issues not covered in this guide:

1. Check official docs: https://v3-migration-docs.meteor.com/
2. Search Meteor forums: https://forums.meteor.com/
3. Review common errors: https://v3-migration-docs.meteor.com/guide/common-errors
4. Ask for help: Post on Meteor forums with code examples

Good luck with the migration! 🚀

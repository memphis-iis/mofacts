# Meteor 2.14 Upgrade Guide for MoFaCTS

**Created:** January 2025
**Current Version:** Meteor 2.0
**Target Version:** Meteor 2.14
**Estimated Time:** 1-2 hours
**Risk Level:** Very Low

---

## Quick Summary - Files to Change

**Only 2 files need editing in VS Code:**

1. **mofacts/mofacts/.meteor/release** - Line 1
   - Change: `METEOR@2.0` → `METEOR@2.14`

2. **Dockerfile** - Line 2
   - Change: `meteor-base:2.0` → `meteor-base:2.14`

**Then:** Build Docker image → Push to Hub → Deploy to server

---

## Table of Contents
1. [Overview](#overview)
2. [What's New in 2.1 through 2.14](#whats-new-in-21-through-214)
3. [Breaking Changes](#breaking-changes)
4. [Pre-Upgrade Checklist](#pre-upgrade-checklist)
5. [Step-by-Step Upgrade Process](#step-by-step-upgrade-process)
6. [Testing Checklist](#testing-checklist)
7. [Deployment](#deployment)
8. [Rollback Plan](#rollback-plan)

---

## Overview

This guide covers upgrading MoFaCTS from Meteor 2.0 to Meteor 2.14 (the latest 2.x version). This is a **very low-risk upgrade** with minimal breaking changes.

### Why Upgrade to 2.14?

**Key Benefits:**
- ✅ Latest Meteor 2.x release before 3.0
- ✅ Node.js 14.21.4 (security patches)
- ✅ MongoDB driver 4.17.2 (latest for 2.x)
- ✅ TypeScript 4.9.5
- ✅ MongoDB 6.x support
- ✅ Better async/await support (preparation for 3.0)
- ✅ CLI improvements
- ✅ Foundation for eventual 3.0 upgrade

### Docker-Based Workflow

**Your workflow (same as 2.0 upgrade):**
1. ✅ Edit files in VS Code on Windows
2. ✅ Change 2 configuration files
3. ✅ Build Docker image locally
4. ✅ Push to Docker Hub
5. ✅ Server pulls and runs new image

**Docker handles everything:**
- Downloads correct Meteor version
- Runs `meteor update` automatically
- Builds the application
- No need to install Meteor on your machine!

---

## What's New in 2.1 through 2.14

### Version-by-Version Highlights

#### Meteor 2.14 (December 2023)
- **MongoDB driver:** 4.17.2
- **TypeScript:** 4.9.5
- **Cordova:** v12.0.1 (Android), v7.0.1 (iOS)
- **New Features:**
  - Interactive `meteor create` command
  - `--open` flag to auto-launch browser
  - `Tracker.autorun().firstRunPromise` for async tracking
  - `Accounts.createUserAsync` on client
  - New DDP merge strategy: `NO_MERGE_MULTI`

#### Meteor 2.13 (July 2023)
- **Node.js:** Updated to 14.21.4 (security patch)
- Improved oplog handling
- Better TypeScript definitions
- `Meteor.applyAsync` types

#### Meteor 2.12 (April 2023)
- **MongoDB driver:** 4.16
- Custom DDP rate-limit messages
- Enhanced async wrapper error handling
- Better TypeScript support

#### Meteor 2.11 (March 2023)
- **MongoDB 6.x support:** Embedded Mongo uses 6.0.3
- **Breaking:** `meteor mongo` command removed (use `mongosh`)
- **Node.js:** Updated to 14.21.3
- **TypeScript:** 4.9.4
- Performance optimizations

#### Meteor 2.10 (January 2023)
- React 18 in skeleton templates
- MongoDB types integration
- Async Tracker improvements
- **TypeScript:** 4.7.4

#### Meteor 2.1-2.9 (2021-2022)
- Gradual improvements to async/await support
- Performance enhancements
- Security updates
- TypeScript improvements

---

## Breaking Changes

### Critical Breaking Changes

#### 1. `meteor mongo` Command Removed (2.11+)
**Impact:** If you use `meteor mongo` to access the database

**Old:**
```bash
meteor mongo
```

**New:**
```bash
mongosh mongodb://localhost:27017/MoFACT
```

**For MoFaCTS:** You likely don't use this command in production (MongoDB is in Docker), but if you use it for debugging, switch to `mongosh`.

#### 2. Cordova Updates (2.14)
**Impact:** Only if you have a Cordova mobile app

**Changes:**
- Cordova Android: v12.0.1
- Cordova iOS: v7.0.1
- Splash screen plugin removed from package

**For MoFaCTS:** No impact - you don't use Cordova mobile apps.

---

### Minor Changes (Non-Breaking)

#### 1. HTTP Package Uses Fetch (2.3)
**Impact:** Minimal - `npmRequestOptions` parameter removed

**For MoFaCTS:** You use `HTTP` package but probably don't use `npmRequestOptions`.

#### 2. MongoDB Driver Updates
**Impact:** Improved performance, better async support

**For MoFaCTS:** Transparent upgrade - no code changes needed.

---

## Pre-Upgrade Checklist

### 1. Current State Verification

```bash
# Check current version
cd mofacts/mofacts
cat .meteor/release
# Should show: METEOR@2.0
```

### 2. Commit Current Work

```bash
# Make sure meteor-2.14-upgrade branch is clean
git status

# If you have uncommitted changes, commit them first
git add .
git commit -m "Prepare for 2.14 upgrade"
```

### 3. Backup (Optional - Already on Git)
Since you're on a dedicated branch, no additional backup needed. Git is your backup!

---

## Step-by-Step Upgrade Process

### Phase 1: Update Configuration Files (5 minutes)

#### Step 1: Update .meteor/release

**File:** `mofacts/mofacts/.meteor/release`

**In VS Code:**
1. Open `mofacts/mofacts/.meteor/release`
2. Change `METEOR@2.0` to `METEOR@2.14`
3. Save file

**Before:**
```
METEOR@2.0
```

**After:**
```
METEOR@2.14
```

#### Step 2: Update Dockerfile

**File:** `Dockerfile` (root of project)

**Line 2 - In VS Code:**
1. Open `Dockerfile`
2. Change line 2: `meteor-base:2.0` → `meteor-base:2.14`
3. Save file

**Before:**
```dockerfile
FROM geoffreybooth/meteor-base:2.0
```

**After:**
```dockerfile
FROM geoffreybooth/meteor-base:2.14
```

**Note:** Node.js versions stay the same (14-alpine) - no change needed!

---

### Phase 2: Commit Changes (2 minutes)

```bash
git add .
git commit -m "feat: Upgrade to Meteor 2.14

- Updated .meteor/release: METEOR@2.0 -> METEOR@2.14
- Updated Dockerfile base image: meteor-base:2.0 -> meteor-base:2.14
- Node.js remains at 14-alpine (14.21.4)
- Ready for Docker build and testing
"

git push origin meteor-2.14-upgrade
```

---

### Phase 3: Build Docker Image (5-10 minutes)

```bash
cd "C:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts\.deploy"

# Build the Docker image
docker compose build --no-cache
```

**What happens during build:**
- Downloads `meteor-base:2.14` image (if not cached)
- Reads `.meteor/release` file (now says METEOR@2.14)
- **Automatically upgrades all packages** through 2.1, 2.2... to 2.14
- Updates `.meteor/versions` file automatically
- Builds the Meteor bundle
- Creates production-ready Docker image

**Expected output:**
- Package version updates will be shown
- MongoDB driver upgraded to 4.17.2
- Various core packages upgraded
- Build should complete successfully

---

### Phase 4: Test Locally (Optional - 30 minutes)

```bash
# Start containers locally
docker compose up

# Application should start on http://localhost:3000
```

**Quick Test Checklist:**
- [ ] Application starts without errors
- [ ] Login page displays
- [ ] Can log in with test account
- [ ] Check browser console (should be clean)
- [ ] Check Docker logs: `docker compose logs -f mofacts`

**Stop when done:**
```bash
docker compose down
```

---

## Testing Checklist

### Critical Path Tests

**Authentication:**
- [ ] Password login works
- [ ] Google OAuth login works
- [ ] Microsoft/Office365 login works

**Core Functionality:**
- [ ] TDF files load correctly
- [ ] Trial cards display properly
- [ ] Student can answer questions
- [ ] Audio playback works
- [ ] Speech recognition works

**Admin Functions:**
- [ ] Admin panel accessible
- [ ] Can view student progress
- [ ] Data export works

**Database:**
- [ ] MongoDB queries work
- [ ] Collections accessible
- [ ] No connection errors

---

## Deployment

### Push Docker Image to Hub

```bash
cd "C:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts\.deploy"

# Login to Docker Hub
docker login

# Push the image
docker compose push

# This pushes to: ppavlikmemphis/mofacts-mini:upgrades
```

### Deploy to Staging

```bash
# SSH to staging server
ssh user@staging.optimallearning.org

# Navigate to deployment directory
cd /var/www/mofacts

# Pull the new image
sudo docker compose pull

# Stop current containers
sudo docker compose down

# Start with new image
sudo docker compose up -d

# Monitor logs
sudo docker compose logs -f mofacts
```

### Deploy to Production

**Same process as staging - schedule maintenance window if needed.**

**Post-Deployment Verification:**
- [ ] Application starts successfully
- [ ] No errors in logs
- [ ] Login works
- [ ] Core functionality intact
- [ ] Monitor for 30 minutes

---

## Rollback Plan

### Quick Rollback

**Option 1: Rebuild from 2.0 branch**
```bash
# On local machine
git checkout meteor-2.0-upgrade

cd mofacts/.deploy
docker compose build --no-cache
docker compose push

# On server
sudo docker compose pull
sudo docker compose down
sudo docker compose up -d
```

**Option 2: Revert commits**
```bash
# If already pushed to meteor-2.14-upgrade
git revert HEAD
git push origin meteor-2.14-upgrade

# Rebuild and redeploy
docker compose build --no-cache
docker compose push
```

---

## Key Differences from 2.0 Upgrade

### What's Easier This Time

✅ **No package.json changes needed** - Node version already correct
✅ **No npm package issues** - Already fixed in 2.0
✅ **Only 2 files to change** (vs 3 in 2.0 upgrade)
✅ **Faster build** - Base images already cached
✅ **More confidence** - 2.0 upgrade succeeded

### What's the Same

✅ Docker handles everything automatically
✅ No manual `meteor update` commands
✅ Low-risk backwards compatible upgrade
✅ Same deployment workflow

---

## Expected Upgrade Results

### Package Upgrades You'll See

During the Docker build, you'll see messages like:

```
Changes to your project's package version selections:

accounts-base          upgraded from 1.8.0 to 1.9.x
autoupdate             upgraded from 1.7.0 to 1.8.x
babel-compiler         upgraded from 7.6.0 to 7.10.x
ddp-client             upgraded from 2.4.0 to 2.6.x
ecmascript             upgraded from 0.15.0 to 0.16.x
mongo                  upgraded from 1.x to 1.16.x
webapp                 upgraded from 1.10.0 to 1.13.x
... (and many more)
```

### New Features Available (Optional to Use)

After upgrade, you can optionally use:

**Async Tracker:**
```javascript
const computation = Tracker.autorun(async () => {
  // async code
});
await computation.firstRunPromise; // Wait for first run
```

**Accounts Async:**
```javascript
await Accounts.createUserAsync({...});
```

**CLI Features (if running Meteor locally):**
```bash
meteor run --open  # Auto-opens browser
meteor create      # Interactive project creation
```

---

## Post-Upgrade Recommendations

### Immediate (After Successful Deployment)

1. ✅ Monitor application for 1-2 hours
2. ✅ Check for any unexpected errors in logs
3. ✅ Verify user reports (if any)
4. ✅ Merge to main branch (if desired)

### Short-term (1-2 weeks)

1. ✅ Update documentation to reflect 2.14
2. ✅ Consider testing new async features
3. ✅ Review any deprecation warnings

### Long-term (3-6 months)

1. ✅ Start planning Meteor 3.0 upgrade
2. ✅ Begin converting code to async/await patterns
3. ✅ Test compatibility with Meteor 3.0-rc

---

## Additional Resources

- **Meteor 2.14 Changelog:** https://v2-docs.meteor.com/changelog
- **Migration Guide:** https://guide.meteor.com/2.14-migration.html
- **Meteor 2.x Docs:** https://v2-docs.meteor.com/
- **Meteor Forums:** https://forums.meteor.com/

---

## Troubleshooting

### Issue: Build fails with package errors

**Solution:**
```bash
# Clear Docker cache and rebuild
docker system prune -a
docker compose build --no-cache
```

### Issue: MongoDB connection errors

**Solution:**
- Check MongoDB container is running: `docker compose ps`
- Check MongoDB logs: `docker compose logs mongodb`
- Verify MongoDB 6.x compatibility

### Issue: "meteor mongo" doesn't work

**Solution:**
This command was removed in 2.11+. Use:
```bash
mongosh mongodb://localhost:27017/MoFACT
```

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| Jan 2025 | 1.0 | Claude | Initial 2.14 upgrade guide created |

---

## Notes

- Meteor 2.14 is the **last 2.x release** before 3.0
- All MongoDB operations remain **synchronous** (async not required)
- **Very safe upgrade** - highly backwards compatible
- **Total effort: 1-2 hours** including testing
- **Risk level: Very Low** - incremental improvements

---

**Ready to proceed with Phase 3? Let's update those config files!**

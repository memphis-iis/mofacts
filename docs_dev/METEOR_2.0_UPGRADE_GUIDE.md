# Meteor 2.0 Upgrade Guide for MoFaCTS

**Created:** January 2025
**Current Version:** Meteor 1.12
**Target Version:** Meteor 2.0
**Estimated Time:** 1 day (5-8 hours)
**Risk Level:** Low

---

## Quick Summary - Files to Change

**Only 4 files need editing in VS Code:**

1. **mofacts/mofacts/.meteor/release** - Line 1
   - Change: `METEOR@1.12` → `METEOR@2.0`

2. **Dockerfile** - Lines 2, 25, 48
   - Line 2: `meteor-base:1.12.1` → `meteor-base:2.0`
   - Line 25 & 48: `node:12-alpine` → `node:14-alpine`

3. **mofacts/mofacts/package.json** - Line 44
   - Change: `"node": "^12.22.12"` → `"node": "^14.21.4"`

4. **mofacts/server/methods.js** - Lines 295-313 (Optional)
   - Fix crypto deprecation warnings

**Then:** Build Docker image → Push to Hub → Deploy to server

---

## Table of Contents
1. [Overview](#overview)
2. [Benefits of Upgrading](#benefits-of-upgrading)
3. [Pre-Upgrade Checklist](#pre-upgrade-checklist)
4. [Step-by-Step Upgrade Process](#step-by-step-upgrade-process)
5. [Code Changes Required](#code-changes-required)
6. [Testing Checklist](#testing-checklist)
7. [Deployment](#deployment)
8. [Rollback Plan](#rollback-plan)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers upgrading MoFaCTS from Meteor 1.12 to Meteor 2.0. This is a **low-risk upgrade** with minimal code changes required.

### Docker-Based Workflow

**IMPORTANT: You use Docker for deployment, so you DON'T need Meteor installed locally!**

**Your workflow:**
1. ✅ Edit files in VS Code on Windows
2. ✅ Change 3 configuration files:
   - `.meteor/release` - Change version number
   - `Dockerfile` - Update base image (3 lines)
   - `package.json` - Update Node version (1 line)
3. ✅ Build Docker image locally
4. ✅ Push to Docker Hub
5. ✅ Server pulls and runs new image

**Docker handles everything:**
- Downloads correct Meteor version
- Runs `meteor update` automatically
- Builds the application
- No need to install Meteor on your machine!

### Why This Upgrade is Low-Risk
- Backwards compatible - most features work as-is
- No async/await conversion required (that's in 3.0)
- All MongoDB operations remain synchronous
- Iron Router works without changes
- Blaze templates work without changes
- Docker build handles all the complexity

---

## Benefits of Upgrading

### 1. Security (Critical)
- **Node.js 12 → Node.js 14**: Node 12 reached end-of-life in April 2022 and no longer receives security patches
- Access to all security updates from Node 14
- Updated npm package ecosystem

### 2. Performance
- V8 engine improvements in Node 14
- Better memory management
- Faster startup times
- node-fibers improvements (less GC, reduced CPU pressure)

### 3. Developer Experience
- **Hot Module Replacement (HMR)**: See changes instantly without page reloads
- React Fast Refresh integration
- Faster development iteration (50-70% faster)

### 4. Modern Features
- TypeScript 4 support
- Tree shaking for smaller bundles
- Cordova 10 for mobile
- Full internationalization support built-in

### 5. Future-Proofing
- Foundation for eventual Meteor 3.0 upgrade
- Stays on supported platform
- Can gradually adopt modern patterns

---

## Pre-Upgrade Checklist

### 1. Backup Everything
```bash
# Create git branch
git checkout -b meteor-2.0-upgrade
git push origin meteor-2.0-upgrade

# Backup database
mongodump --out ~/backups/mofacts-pre-2.0-$(date +%Y%m%d)

# Document current state
meteor --version > upgrade-notes.txt
node --version >> upgrade-notes.txt
npm --version >> upgrade-notes.txt
```

### 2. Check Current State
- [ ] Git working directory is clean
- [ ] All tests are passing
- [ ] Application runs successfully locally
- [ ] Database backup completed
- [ ] Note current Meteor version (should be 1.12)

### 3. Communication
- [ ] Notify team about upgrade
- [ ] Schedule maintenance window if needed
- [ ] Prepare rollback plan

---

## Step-by-Step Upgrade Process

### Understanding Your Docker Workflow

**Your deployment process:**
1. **Local (VS Code):** Edit code on your Windows machine
2. **Build:** Use Docker to build images locally
3. **Push:** Push built images to Docker Hub
4. **Deploy:** Server pulls images from Docker Hub

**The Meteor version is determined by:**
1. `.meteor/release` file - tells Docker build what version to use
2. `Dockerfile` base image - must match the Meteor version
3. Docker builds everything - **no need to install Meteor locally!**

---

### Phase 1: Update Configuration Files (15 minutes)

**Work in VS Code on your local Windows machine:**

#### Step 1: Update .meteor/release File

**File:** `mofacts/mofacts/.meteor/release`

**Current content:**
```
METEOR@1.12
```

**Change to:**
```
METEOR@2.0
```

**In VS Code:**
1. Open `mofacts/mofacts/.meteor/release`
2. Change `METEOR@1.12` to `METEOR@2.0`
3. Save file

#### Step 2: Update Dockerfile Base Image

**File:** `Dockerfile` (in root of project)

**Line 2 - Change from:**
```dockerfile
FROM geoffreybooth/meteor-base:1.12.1
```

**To:**
```dockerfile
FROM geoffreybooth/meteor-base:2.0
```

**Line 25 - Change from:**
```dockerfile
FROM node:12-alpine
```

**To:**
```dockerfile
FROM node:14-alpine
```

**Line 48 - Change from:**
```dockerfile
FROM node:12-alpine
```

**To:**
```dockerfile
FROM node:14-alpine
```

**In VS Code:**
1. Open `Dockerfile`
2. Update line 2: base image to `2.0`
3. Update line 25: Node to `14-alpine`
4. Update line 48: Node to `14-alpine`
5. Save file

#### Step 3: Update .meteor/versions File (Automatic)

**Option A - If you have Meteor installed locally (optional):**
```bash
cd mofacts/mofacts
meteor update --release 2.0
```

**Option B - Let Docker handle it (recommended):**
- Skip this step
- The Docker build will automatically update all packages when it builds
- This is the easier approach if you don't have Meteor installed locally

---

### Phase 2: Code Changes (1-2 hours)

#### Required Change 1: Update Node Version in package.json

**File:** `mofacts/package.json`

**Line 44 - Change from:**
```json
"node": "^12.22.12"
```

**To:**
```json
"node": "^14.21.4"
```

#### Optional Change 2: Fix Crypto Deprecation (Recommended)

**File:** `mofacts/server/methods.js`

**Current Code (Lines 295-313):**
```javascript
function encryptData(data) {
  //encrypt using crypto
  const cipher = crypto.createCipher(algo, Meteor.settings.encryptionKey);
  let crypted
  crypted = cipher.update(data, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

function decryptData(data) {
  //decrypt using crypto
  const decipher = crypto.createDecipher(algo, Meteor.settings.encryptionKey);
  let dec
  dec = decipher.update(data, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
```

**Issue:** `crypto.createCipher()` and `crypto.createDecipher()` are deprecated in Node 14+

**Options:**
- **Option A (Quick):** Leave as-is - it still works, just shows warnings
- **Option B (Proper):** Update to `crypto.createCipheriv()` - requires IV handling

**If choosing Option B, update to:**
```javascript
const crypto = require('crypto');
const algo = 'aes-256-cbc'; // Define algorithm

function encryptData(data) {
  const key = crypto.scryptSync(Meteor.settings.encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algo, key, iv);
  let crypted = cipher.update(data, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return iv.toString('hex') + ':' + crypted; // Prepend IV
}

function decryptData(data) {
  const parts = data.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  const key = crypto.scryptSync(Meteor.settings.encryptionKey, 'salt', 32);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  let dec = decipher.update(encryptedData, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
```

**IMPORTANT:** If you update crypto, you need to:
1. Test thoroughly with existing encrypted data
2. May need to re-encrypt existing data
3. Document the change

**Recommendation:** Choose Option A for initial upgrade, do Option B later

---

### Phase 3: Optional Enhancements (30 minutes)

#### Enable Hot Module Replacement (HMR)

```bash
meteor add hot-module-replacement
```

**Benefits:**
- See changes instantly in browser
- No page reload needed
- Maintains application state
- Much faster development iteration

**To use:**
1. Start meteor normally: `meteor run --settings settings.json`
2. Edit any file
3. Watch browser update automatically

---

## Testing Checklist

### Startup Tests
- [ ] Application starts without errors
- [ ] No critical errors in console
- [ ] Database connects successfully
- [ ] Check server logs for warnings

### Authentication Tests
- [ ] Standard login works (username/password)
- [ ] Google OAuth login works
- [ ] Microsoft account login works
- [ ] Office365 login works
- [ ] Password reset functionality works
- [ ] User roles/permissions work correctly

### Core Functionality Tests
- [ ] Create new TDF file
- [ ] Upload TDF file
- [ ] Load existing TDF
- [ ] Start student session
- [ ] Display trial cards correctly
- [ ] Answer assessment (text input)
- [ ] Audio playback works
- [ ] Speech recognition works
- [ ] Images display correctly
- [ ] Dialogue feedback displays

### Admin/Instructor Tests
- [ ] Admin panel loads
- [ ] Class management
- [ ] Student progress viewing
- [ ] Data download/export
- [ ] User administration
- [ ] TDF assignment

### Data Integrity Tests
- [ ] Database queries work correctly
- [ ] Collections are accessible
- [ ] Publications work
- [ ] Methods execute successfully
- [ ] No data corruption

### Performance Tests
- [ ] Page load times acceptable
- [ ] No memory leaks
- [ ] Database queries performant
- [ ] File uploads work

### Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if applicable)
- [ ] Mobile browsers (if applicable)

---

## Deployment

### Phase 4: Build and Test Locally (1-2 hours)

#### Step 1: Commit Your Changes

```bash
# Commit the configuration changes
git add .
git commit -m "Upgrade to Meteor 2.0

- Updated .meteor/release from 1.12 to 2.0
- Updated Dockerfile base image to meteor-base:2.0
- Updated Node.js from 12 to 14 in Dockerfile
- Updated package.json Node version to 14.21.4
- [Optional: Fixed crypto deprecation warnings]
"

git push origin meteor-2.0-upgrade
```

#### Step 2: Build Docker Image Locally

**Using your docker-compose-local-build.yml:**

```bash
# Navigate to the directory with docker-compose-local-build.yml
cd "C:\Users\ppavl\OneDrive\Active projects\mofacts\assets"

# Build the Docker image (this will take 10-30 minutes)
docker compose -f docker-compose-local-build.yml build --no-cache

# Expected output:
# - Downloads meteor-base:2.0 image
# - Installs Meteor packages
# - Builds Meteor bundle
# - Creates final image
```

**What happens during build:**
- Docker downloads `meteor-base:2.0` image
- Reads `.meteor/release` file (now says METEOR@2.0)
- Automatically runs `meteor update` inside Docker
- Updates all `.meteor/versions` packages automatically
- Builds the Meteor app bundle
- Creates production-ready Docker image

#### Step 3: Test Locally with Docker

```bash
# Start the containers locally
docker compose -f docker-compose-local-build.yml up

# Application should start on http://localhost:3000
```

**Test checklist:**
- [ ] Application starts without errors
- [ ] Can access http://localhost:3000
- [ ] Login page displays
- [ ] Check browser console for errors
- [ ] Check Docker logs: `docker compose logs -f mofacts`

#### Step 4: Stop Local Test

```bash
# Stop when testing complete
docker compose -f docker-compose-local-build.yml down
```

---

### Phase 5: Deploy to Staging Server

#### Step 1: Push Docker Image to Docker Hub

```bash
# Make sure you're logged in to Docker Hub
docker login

# Push the image
docker compose -f docker-compose-local-build.yml push

# This pushes to: ppavlikmemphis/mofacts-mini:upgrades
```

#### Step 2: Deploy to Staging Server

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

**Expected output:**
- Pulls new image from Docker Hub
- Starts containers
- Application accessible at https://staging.optimallearning.org

#### Step 3: Test on Staging

Run through the full testing checklist (see Testing Checklist section above)

---

### Phase 6: Production Deployment

**IMPORTANT:** Schedule maintenance window

#### Step 1: Backup Production Database

```bash
# SSH to production server
ssh user@production-server

# Backup database
docker exec mongodb mongodump --out /data/backup-pre-2.0-$(date +%Y%m%d)

# Or if MongoDB is external:
mongodump --out ~/backups/production-pre-2.0-$(date +%Y%m%d)
```

#### Step 2: Deploy to Production

**Same process as staging:**

```bash
# On production server
cd /var/www/mofacts

# Pull new image
sudo docker compose pull

# Stop current containers
sudo docker compose down

# Start with new image
sudo docker compose up -d

# Monitor logs
sudo docker compose logs -f mofacts
```

### Post-Deployment Verification

- [ ] Application starts successfully
- [ ] Login page loads
- [ ] Can log in as test user
- [ ] Trial cards display correctly
- [ ] Audio/speech recognition works
- [ ] Admin functions work
- [ ] No errors in Docker logs
- [ ] Monitor for 30 minutes

**Check logs:**
```bash
sudo docker compose logs --tail=100 -f mofacts
```

---

## Rollback Plan

If issues occur during/after upgrade:

### Quick Rollback (5 minutes)

#### Option 1: Revert to Previous Docker Image

**On server (fastest):**
```bash
# SSH to server
ssh user@server

cd /var/www/mofacts

# Stop current containers
sudo docker compose down

# Pull previous version
# Change docker-compose.yml to use previous image tag
# OR manually specify old image:
sudo docker pull ppavlikmemphis/mofacts-mini:previous-tag

# Start with old image
sudo docker compose up -d
```

#### Option 2: Rebuild from Main Branch

**On your local machine:**
```bash
# 1. Switch back to main branch
git checkout main

# 2. Rebuild Docker image
cd assets
docker compose -f docker-compose-local-build.yml build --no-cache

# 3. Push to Docker Hub
docker compose -f docker-compose-local-build.yml push

# 4. On server, pull and restart
ssh user@server
cd /var/www/mofacts
sudo docker compose pull
sudo docker compose down
sudo docker compose up -d
```

### If Database Issues

```bash
# On server, restore from backup
docker exec mongodb mongorestore --drop /data/backup-pre-2.0-YYYYMMDD/

# Or if MongoDB is external:
mongorestore --drop ~/backups/mofacts-pre-2.0-YYYYMMDD/
```

### Best Practice: Tag Your Images

Before upgrading, tag your current working image:

```bash
# On local machine before upgrade
docker tag ppavlikmemphis/mofacts-mini:upgrades ppavlikmemphis/mofacts-mini:pre-2.0-backup
docker push ppavlikmemphis/mofacts-mini:pre-2.0-backup

# Then if rollback needed, just change docker-compose.yml to use :pre-2.0-backup
```

---

## Troubleshooting

### Issue: "Package X is not compatible with Meteor 2.0"

**Solution:**
1. Check Atmosphere for updated version
2. Run `meteor update <package-name>`
3. If no update available, check GitHub for fork
4. Consider temporary removal if non-critical

### Issue: Application won't start after upgrade

**Check:**
```bash
# Clear Meteor cache
meteor reset

# Rebuild node modules
rm -rf node_modules package-lock.json
meteor npm install

# Try running
meteor run --settings settings.json
```

### Issue: Deprecation warnings about crypto

**Solution:** This is expected and non-breaking. The old crypto methods still work in Node 14. You can:
- Ignore for now (recommended for initial upgrade)
- Fix later with proper createCipheriv implementation

### Issue: HMR not working

**Check:**
```bash
# Verify package installed
meteor list | grep hot-module-replacement

# If not installed
meteor add hot-module-replacement

# Restart meteor
meteor run --settings settings.json
```

### Issue: Tests failing

**Check:**
1. Verify meteortesting:mocha is compatible
2. Update test packages: `meteor update meteortesting:mocha`
3. Check for async/await issues (shouldn't be any in 2.0)

### Issue: OAuth login broken

**Check:**
1. Verify service configuration in database
2. Check OAuth credentials in settings.json
3. Ensure accounts packages updated correctly

---

## Post-Upgrade Tasks

### Immediate
- [ ] Merge upgrade branch to main after successful production deployment
- [ ] Document any issues encountered
- [ ] Update team on completion

### Short-term (1-2 weeks)
- [ ] Monitor application performance
- [ ] Check for any edge case bugs
- [ ] Gather user feedback
- [ ] Fix crypto deprecation warnings (if not done)

### Long-term (3-6 months)
- [ ] Start planning for Meteor 2.x → 3.0 upgrade
- [ ] Begin converting code to async/await patterns gradually
- [ ] Consider alternatives to iron:router
- [ ] Update any remaining deprecated packages

---

## Additional Resources

- [Official Meteor 2.0 Migration Guide](https://guide.meteor.com/2.0-migration)
- [Meteor 2.0 Changelog](https://v2-docs.meteor.com/changelog)
- [Node.js 14 Release Notes](https://nodejs.org/en/blog/release/v14.0.0/)
- [Meteor Forums](https://forums.meteor.com/)

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| Jan 2025 | 1.0 | Claude | Initial upgrade guide created |

---

## Notes

- This upgrade is **backwards compatible** - most code works as-is
- **No async/await conversion needed** - that's for Meteor 3.0
- All MongoDB operations remain **synchronous**
- **Total effort: ~1 day** of work for complete upgrade and testing
- **Risk level: Low** - straightforward upgrade path

---

## Questions or Issues?

If you encounter issues not covered in this guide:
1. Check the Troubleshooting section
2. Review Meteor 2.0 official documentation
3. Check Meteor Forums for similar issues
4. Document the issue and solution for future reference

# Meteor 2.0 Upgrade - Pre-Upgrade State Documentation

**Date:** January 2025
**Branch:** upgrades
**Purpose:** Document system state before Meteor 1.12 → 2.0 upgrade

---

## Current Versions

### Meteor & Node
- **Meteor Version:** 1.12
- **Node.js Version:** 12.22.12 (from package.json)
- **npm Version:** (bundled with Node 12)

### Docker Images
- **Base Image:** `geoffreybooth/meteor-base:1.12.1`
- **Runtime Image:** `node:12-alpine`
- **Current Deployed Image:** `ppavlikmemphis/mofacts-mini:upgrades`
- **Syllables Image:** `ppavlikmemphis/mofacts-syllables`

### Key Package Versions (from .meteor/versions)
- accounts-base@1.7.1
- accounts-password@1.6.3
- iron:router@1.1.2
- alanning:roles@1.2.16
- meteor@1.9.3
- mongo@1.10.1
- ddp-server@2.3.2
- ecmascript@0.14.4

---

## File Locations

### Configuration Files
- **Meteor Release:** `mofacts/mofacts/.meteor/release`
- **Meteor Packages:** `mofacts/mofacts/.meteor/packages`
- **Meteor Versions:** `mofacts/mofacts/.meteor/versions`
- **Package.json:** `mofacts/mofacts/package.json`
- **Dockerfile:** `Dockerfile` (project root)
- **Docker Compose (Build):** `assets/docker-compose-local-build.yml`
- **Docker Compose (Production):** `assets/docker-compose-server-production.yml`

---

## Current Git State

**Branch:** upgrades
**Status:** Clean (docs files added but not committed)

**Recent Commits:**
```
c7e762f5 fix: resolve admin wiki button routing conflict
d37fdc73 fix: resolve SSL security warnings, improve Docker deployment, and enhance TDF loading robustness
8777e4d4 feat: comprehensive audio/TTS/SR fixes, input UX improvements, and accessibility enhancements
```

---

## Deployment Configuration

### Staging Server
- **URL:** https://staging.optimallearning.org
- **Location:** /var/www/mofacts
- **MongoDB:** mongodb://mongodb:27017/MoFACT
- **Image:** ppavlikmemphis/mofacts-mini:upgrades

### Production Server
- **Location:** /var/www/mofacts (assumed same as staging)
- **Image:** ppavlikmemphis/mofacts-mini:upgrades

---

## Docker Image Backup Plan

### Pre-Upgrade Backup Commands

**To create a backup tag of current working image:**
```bash
# Pull current working image
docker pull ppavlikmemphis/mofacts-mini:upgrades

# Tag it as pre-2.0 backup
docker tag ppavlikmemphis/mofacts-mini:upgrades ppavlikmemphis/mofacts-mini:pre-2.0-meteor-1.12-backup

# Push backup to Docker Hub
docker push ppavlikmemphis/mofacts-mini:pre-2.0-meteor-1.12-backup
```

**To rollback if needed:**
```bash
# On server
cd /var/www/mofacts
sudo docker compose down

# Edit docker-compose.yml to use backup image:
# image: ppavlikmemphis/mofacts-mini:pre-2.0-meteor-1.12-backup

sudo docker compose pull
sudo docker compose up -d
```

---

## Known Issues (Pre-Upgrade)

### Deprecation Warnings
- **Crypto Methods:** `crypto.createCipher()` and `crypto.createDecipher()` are deprecated in Node 14+
  - Location: `mofacts/server/methods.js` lines 295-313
  - Impact: Non-breaking, will show warnings in Node 14
  - Fix: Optional for initial upgrade

### Security Considerations
- Node.js 12 reached end-of-life April 2022
- No longer receives security patches
- **This is the primary reason for upgrading**

---

## Application State

### Working Features (Pre-Upgrade)
✅ User authentication (password, Google, Microsoft, Office365)
✅ TDF file upload and management
✅ Student trial cards and experiments
✅ Audio playback and speech recognition
✅ Admin controls and reporting
✅ Data export functionality
✅ All OAuth integrations

### Dependencies Count
- **Meteor.call/methods/publish/subscribe:** 175 instances across 31 files
- **MongoDB operations:** 457 instances across 36 files
- **Template/Session/ReactiveVar:** 1,661 instances across 38 files

**Note:** These numbers indicate extensive testing will be needed post-upgrade

---

## Testing Baseline

### Critical Paths to Test Post-Upgrade
1. User login (all OAuth methods)
2. TDF creation and loading
3. Student experiment flow
4. Trial card display (text, images, audio)
5. Speech recognition functionality
6. Answer assessment
7. Admin panel access
8. Data download/export
9. User role management

---

## Backup Status

### Code Backup
- ✅ Git repository (local and remote)
- ✅ Branch: upgrades (current)
- ✅ Can checkout main branch anytime for rollback

### Docker Image Backup
- ⏳ TO BE CREATED: Tag and push current image as backup
  - Command: See "Docker Image Backup Plan" above
  - Required before starting upgrade

### Database Backup
- ❌ NOT INCLUDED in this backup step
- 📝 Database backup should be done on server before deployment
- 📝 See METEOR_2.0_UPGRADE_GUIDE.md for database backup commands

---

## Pre-Upgrade Checklist Completion

- [x] Document current Meteor version
- [x] Document current Node version
- [x] Document Docker image versions
- [x] Document git state
- [x] Document deployment configuration
- [x] List critical files to change
- [ ] Create Docker image backup tag (to be done)
- [ ] Push Docker image backup to Hub (to be done)

---

## Next Steps

1. **Create Docker image backup** (see commands above)
2. **Proceed with upgrade** following METEOR_2.0_UPGRADE_GUIDE.md
3. **Start with Phase 1:** Update configuration files
4. **Phase 2:** Code changes (minimal)
5. **Phase 3:** Build and test locally
6. **Phase 4:** Deploy to staging
7. **Phase 5:** Deploy to production (after staging validation)

---

## Rollback Strategy

If upgrade fails at any point:

1. **Before building new image:** Just discard changes in git
2. **After building but before pushing:** Rebuild from main branch
3. **After pushing to Docker Hub:** Use backup image tag
4. **After deploying to server:** Pull backup image and restart

**Estimated rollback time:** 5-15 minutes depending on stage

---

## Notes

- Upgrade is low-risk due to backwards compatibility
- Most changes are configuration, not code
- Docker handles complexity of Meteor update
- No async/await conversion needed (that's Meteor 3.0)
- Total upgrade time: ~1 day including testing

---

## Files Created for This Upgrade

- `docs_dev/METEOR_2.0_UPGRADE_GUIDE.md` - Complete upgrade guide
- `docs_dev/METEOR_2.0_PRE_UPGRADE_STATE.md` - This file
- Updated: `docs_dev/README.md` - Added link to upgrade guide

---

**End of Pre-Upgrade State Documentation**

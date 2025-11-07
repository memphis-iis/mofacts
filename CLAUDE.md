# MoFaCTS Project Context

**Last Updated:** 2025-01-06
**Purpose:** AI Assistant Context Document
**Meteor Version:** 3.3.2
**Node Version:** 22.x

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Key Features](#key-features)
5. [Directory Structure](#directory-structure)
6. [Collections (Data Model)](#collections-data-model)
7. [Current State & Recent Work](#current-state--recent-work)
8. [Development Conventions](#development-conventions)
9. [Important Files & Entry Points](#important-files--entry-points)
10. [Common Tasks & Workflows](#common-tasks--workflows)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Known Issues & Gotchas](#known-issues--gotchas)

---

## Project Overview

**MoFaCTS** (Mobile Factual Cognition Training System) is a web-based adaptive learning platform that uses spaced repetition and cognitive science principles to optimize learning and retention. Originally the FaCT System, it was redesigned as a responsive Meteor.js application for mobile devices.

**Primary Use Cases:**
- Educational research on learning and memory
- Adaptive flashcard-style training
- Speech recognition-based learning exercises
- Text-to-speech (TTS) enabled tutorials
- MTurk (Mechanical Turk) experiment workflows
- Learning analytics and performance tracking

**Target Users:**
- Students (learners)
- Teachers/Instructors (content creators, class managers)
- Researchers (experiment designers)
- Administrators (system managers)

---

## Tech Stack

### Core Framework
- **Meteor.js 3.3.2** - Full-stack JavaScript framework (recently upgraded from 1.12)
- **Node.js 22.x** - Runtime environment
- **MongoDB** - Database (via Meteor's native support)
- **Blaze** - Meteor's reactive templating engine (HTML + JS pattern)

### Key Dependencies
- **alanning:meteor-roles** - Role-based authorization (admin, teacher, student)
- **ostrio:files** - File uploads (TDF packages, assets)
- **accounts-password** - User authentication
- **accounts-microsoft** - Microsoft OAuth integration
- **google-cloud/speech** - Speech recognition API
- **aws-sdk/client-mturk** - Mechanical Turk integration

### Client-Side Libraries
- **jQuery** - DOM manipulation (legacy, pervasive throughout)
- **Plyr** - Audio/video player (loaded via CDN)
- **Hark** - Voice activity detection (speech recognition)
- **DOMPurify** - XSS sanitization
- **marked** - Markdown parsing
- **double-metaphone** - Phonetic matching for speech recognition

### Server-Side Tools
- **node-symspell** - Spell checking and correction
- **hypher** - Text hyphenation
- **transliteration** - Text normalization

### Build & Deployment
- **Docker** - Containerization (multi-stage build)
- **Apache** - Reverse proxy (production)
- **docker-compose** - Container orchestration

---

## Architecture

### Application Structure
```
mofacts/
├── client/          # Client-side code (runs in browser)
│   ├── index.html   # Main HTML shell
│   ├── index.js     # Client entry point, routing
│   ├── lib/         # Client-side utilities
│   └── views/       # Blaze templates (.html + .js pairs)
├── server/          # Server-side code (runs on Node.js)
│   ├── methods.js   # Meteor methods (RPC endpoints)
│   ├── publications.js # Data subscriptions
│   ├── lib/         # Server utilities
│   └── migrations/  # Database migration scripts
├── common/          # Shared code (client + server)
│   ├── Collections.js      # MongoDB collection definitions
│   ├── Definitions.js      # Shared constants
│   ├── DynamicTdfGenerator.js # TDF generation
│   └── globalHelpers.js    # Shared utilities
├── packages/        # Custom Meteor packages
│   ├── mofacts-accounts-microsoft/
│   └── mofacts-microsoft-oauth/
└── public/          # Static assets (served as-is)
```

### Meteor Patterns Used

**Blaze Templates:**
Each UI component is typically two files:
- `viewName.html` - Blaze template markup
- `viewName.js` - Template helpers, events, lifecycle

**Example:**
```javascript
// card.html
<template name="card">
  <div class="card">{{question}}</div>
</template>

// card.js
Template.card.helpers({
  question() {
    return Session.get('currentQuestion');
  }
});

Template.card.events({
  'click .submit'(event) {
    Meteor.call('submitAnswer', ...);
  }
});
```

**Meteor Methods (RPC):**
- Server: `Meteor.methods({ methodName() {...} })`
- Client: `Meteor.call('methodName', args, callback)`
- **Meteor 3.x:** Prefer `Meteor.callAsync()` for async/await

**Publications/Subscriptions:**
- Server: `Meteor.publish('pubName', function() { return Collection.find(...); })`
- Client: `Meteor.subscribe('pubName')`
- Reactive data - updates automatically when DB changes

**Reactivity:**
- `Session.get/set` - Reactive session variables
- `ReactiveVar` - Component-scoped reactive variables
- `Tracker.autorun()` - Auto-rerun code when dependencies change

---

## Key Features

### 1. **Adaptive Learning Engine** (`client/views/experiment/unitEngine.js`)
- Spaced repetition algorithms
- Performance-based item scheduling
- Adaptive difficulty adjustment
- Learning curve analysis

### 2. **Speech Recognition** (`client/views/experiment/card.js`)
- **State Machine:** Complex SR sub-state machine for voice input
- **Google Speech API:** Real-time transcription
- **Phonetic Matching:** Double-metaphone algorithm for fuzzy matching
- **Voice Activity Detection:** Hark.js for detecting speech start/stop
- **Features:** Answer validation, retry logic, timeout handling
- **Status:** Stable (see `docs_dev/SPEECH_RECOGNITION_STATE_MACHINE.md`)

### 3. **Text-to-Speech (TTS)** (`client/views/experiment/card.js`, `client/lib/plyrHelper.js`)
- Browser-based TTS for questions/feedback
- Pre-recorded audio playback via Plyr
- Session warmup for audio initialization
- Auto-advance trials after TTS completes

### 4. **TDF System (Training Definition Files)**
- XML-based experiment/lesson definitions
- Upload via ZIP packages (`server/methods.js:processPackageUpload`)
- Dynamic generation for cloze tests (`common/DynamicTdfGenerator.js`)
- Supports: questions, answers, stimuli, images, audio

### 5. **Learning Dashboard** (`client/views/home/learningDashboard.js`)
- Student performance visualization
- Progress tracking across units
- Assignment completion status
- Mobile-responsive design (recent update)

### 6. **Teacher/Admin Tools**
- Class management (`client/views/experimentSetup/`)
- Student performance reports (`client/views/experimentReporting/`)
- TDF/package management
- User administration (`client/views/userAdmin.js`)

### 7. **MTurk Integration** (`server/turk.js`, `server/turk_methods.js`)
- Mechanical Turk experiment workflows
- HIT creation and management
- Worker qualification tracking
- Scheduled messaging

### 8. **Theming System** (`client/views/theme.js`, `server/publications.js`)
- Custom branding (logo, colors, fonts)
- Per-instance customization
- Dynamic asset uploads
- Favicon generation (Docker build)

### 9. **Authentication**
- Username/password (accounts-password)
- Microsoft OAuth (custom packages)
- Role-based access control (admin, teacher, student)
- Session management

---

## Directory Structure

### Client Code (`mofacts/client/`)
```
client/
├── index.html              # Main HTML shell (head, body wrapper)
├── index.js                # Client startup, routing, global helpers
├── lib/                    # Client utilities (loaded first)
│   ├── router.js           # FlowRouter routes
│   ├── currentTestingHelpers.js  # Experiment session management
│   ├── plyrHelper.js       # Audio player utilities
│   ├── audioRecorder.js    # Speech recording
│   ├── hark.js             # Voice activity detection
│   └── sessionUtils.js     # Session state management
└── views/                  # Blaze templates
    ├── experiment/         # Core learning experience
    │   ├── card.js         # MAIN: Trial card state machine (8K+ LOC!)
    │   ├── card.html       # Trial card template
    │   ├── unitEngine.js   # Adaptive learning algorithm
    │   ├── instructions.js # Pre-experiment instructions
    │   └── answerAssess.js # Answer validation logic
    ├── experimentSetup/    # Teacher experiment/class setup
    ├── experimentReporting/ # Performance reports
    ├── home/               # Dashboard, landing pages
    │   └── learningDashboard.js  # Student progress dashboard
    ├── login/              # Login/signup forms
    ├── theme.js            # Theme customization UI
    ├── audioSettings.js    # Audio/speech settings
    └── adminControls.js    # Admin panel
```

### Server Code (`mofacts/server/`)
```
server/
├── methods.js              # MAIN: All Meteor methods (6K+ LOC!)
├── publications.js         # Data publications for client
├── lib/                    # Server utilities
│   ├── accounts.js         # User account hooks
│   ├── protection.js       # Method security layer
│   ├── serverSession.js    # Server-side session state
│   └── userMetrics.js      # Performance tracking
├── turk.js                 # MTurk API wrapper
├── turk_methods.js         # MTurk-specific methods
├── migrations/             # Database migration scripts
├── conversions/            # Data format converters
└── orm.js                  # Database helper methods
```

### Common Code (`mofacts/common/`)
```
common/
├── Collections.js          # MongoDB collection definitions (ALL collections)
├── Definitions.js          # Shared constants/enums
├── DynamicTdfGenerator.js  # TDF generation logic
└── globalHelpers.js        # Shared utility functions
```

### Documentation (`docs_dev/`)
```
docs_dev/
├── README.md               # Documentation index
├── SPEECH_RECOGNITION_STATE_MACHINE.md  # SR system design
├── METEOR_3.0_UPGRADE_GUIDE.md          # Meteor 3 migration
├── SECURITY_AUDIT_REPORT.md             # Security findings
├── SERVER_OPTIMIZATION_PHASE1.md        # Performance work
└── [50+ other docs...]     # Implementation guides, fixes
```

---

## Collections (Data Model)

All collections defined in `common/Collections.js`:

### Core Learning Data
- **`Tdfs`** - Training Definition Files (experiment configs)
- **`Items`** (`stimuli`) - Individual learning items (questions)
- **`Histories`** (`history`) - Trial-by-trial performance logs
- **`Assignments`** (`assessments`) - Student assignments
- **`Courses`** (`course`) - Course/class definitions
- **`Sections`** (`section`) - Course sections
- **`SectionUserMap`** - Student-section associations

### Experiment State
- **`ComponentStates`** (`component_state`) - UI component state (per user)
- **`GlobalExperimentStates`** (`global_experiment_state`) - Experiment session state
- **`ProbabilityEstimates`** - Learning curve data

### User & Performance
- **`Meteor.users`** - User accounts (built-in)
- **`UserTimesLog`** - Session timing data
- **`UserMetrics`** - Aggregated performance metrics

### Assets & Content
- **`Stims`** (`stim_files`) - Uploaded stimulus files
- **`DynamicAssets`** - Theme assets (logos, images)
- **`StimSyllables`** (`stimuli_syllables`) - Syllable counts for TTS
- **`itemSourceSentences`** - Source sentences for cloze generation

### Caching & Utilities
- **`ElaboratedFeedbackCache`** - Cached feedback content
- **`DynamicSettings`** - Runtime configuration
- **`DynamicConfig`** - System configuration
- **`ErrorReports`** - Client error logs
- **`AuditLog`** - Security audit trail

### MTurk
- **`ScheduledTurkMessages`** - Scheduled worker notifications
- **`PasswordResetTokens`** - Password reset tokens (custom)

### Advanced
- **`ClozeEditHistory`** - Edit history for cloze items

---

## Current State & Recent Work

### Recent Upgrades (2024-2025)
1. **Meteor 1.12 → 3.3.2** - Massive upgrade (see `docs_dev/METEOR_3.0_UPGRADE_GUIDE.md`)
   - Node 12 → Node 22
   - Async/await migration (500+ MongoDB operations)
   - Express 5 (from Connect)
   - MongoDB driver 6.x (promises only)

2. **Security Hardening** (see `docs_dev/SECURITY_AUDIT_REPORT.md`)
   - XSS prevention (DOMPurify)
   - Method protection layer
   - Input validation
   - Audit logging

3. **Performance Optimization** (see `docs_dev/SERVER_OPTIMIZATION_PHASE1.md`)
   - Database indexing (in progress)
   - Server-side caching
   - Publication optimization

### Current Branch
- **Branch:** `meteor-3.3.2-upgrade`
- **Base:** `main`
- **Status:** Active development

### Recent Commits
```
3372a2d2 fix: Replace getTheme method calls with reactive publication pattern
2def1b6d fix: Restore theme name to MoFaCTS when resetting to default
36d0f5a1 fix: Eliminate login screen flash during OAuth authentication
2841b48a refactor: Consolidate logo and favicon uploads into single control
f1bff742 fix: Resolve theme settings reactivity and navbar alignment issues
```

### Known Issues & Active Work
1. **Performance Regression** - Feedback autorun removal caused delays (pending fix)
2. **Dashboard Fix** - Learning dashboard mobile responsiveness (recent fix)
3. **Theme Reactivity** - getTheme publication pattern (recent fix)
4. **Database Indexes** - Phase 1 optimization (in progress)

### Documentation Coverage
The `docs_dev/` directory contains **50+ detailed documentation files** covering:
- Implementation guides
- Security audits
- Bug fix reports
- Upgrade guides
- State machine designs
- Testing procedures

**Always check `docs_dev/` for context before making changes!**

---

## Development Conventions

### Code Style
- **Indentation:** 2 spaces (JavaScript), tabs in some older files
- **Quotes:** Single quotes preferred (`'string'`)
- **Semicolons:** Used inconsistently (some files yes, some no)
- **Line Length:** No strict limit (some lines 120+)
- **Comments:** Minimal inline, some block comments for complex logic

### Naming Conventions
- **Collections:** PascalCase, plural (`Tdfs`, `Histories`)
- **Methods:** camelCase (`getTdfContent`, `submitAnswer`)
- **Templates:** camelCase (`card`, `learningDashboard`)
- **Files:** camelCase matching template name (`card.js`, `learningDashboard.js`)
- **Session Keys:** camelCase with context prefix (`currentTdfId`, `isRecording`)

### Meteor-Specific Patterns

**Session Variables (avoid in new code):**
```javascript
// Legacy pattern (still used extensively)
Session.set('currentTdfId', tdfId);
const tdfId = Session.get('currentTdfId');
```

**ReactiveVar (prefer for new code):**
```javascript
Template.myTemplate.onCreated(function() {
  this.myVar = new ReactiveVar(initialValue);
});

Template.myTemplate.helpers({
  myValue() {
    return Template.instance().myVar.get();
  }
});
```

**Async Methods (Meteor 3.x):**
```javascript
// Server
Meteor.methods({
  async myMethod() {
    const result = await MyCollection.findOneAsync({...});
    return result;
  }
});

// Client
const result = await Meteor.callAsync('myMethod');
```

### Security Patterns

**Always validate user input:**
```javascript
// Check for XSS
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);

// Check authorization
if (!Roles.userIsInRole(this.userId, ['admin', 'teacher'])) {
  throw new Meteor.Error('not-authorized');
}

// Validate data
check(arg, String); // using check package
```

**Use method protection layer:**
```javascript
// In server/lib/protection.js
registerProtection('methodName', (userId, args) => {
  // Custom authorization logic
});
```

### Database Query Patterns

**Meteor 3.x Async:**
```javascript
// Find one
const doc = await MyCollection.findOneAsync({_id: id});

// Find many
const docs = await MyCollection.find({...}).fetchAsync();

// Count
const count = await MyCollection.find({...}).countAsync();

// Insert
const newId = await MyCollection.insertAsync({...});

// Update
await MyCollection.updateAsync({_id: id}, {$set: {...}});

// Remove
await MyCollection.removeAsync({_id: id});
```

**Client-side (still synchronous):**
```javascript
// Client-side collections are still synchronous
const doc = MyCollection.findOne({_id: id});
const docs = MyCollection.find({...}).fetch();
```

---

## Important Files & Entry Points

### Absolutely Critical Files
1. **`client/views/experiment/card.js`** (8,700+ LOC)
   - **THE** core file for learning trials
   - State machine for trial lifecycle
   - Speech recognition logic
   - TTS integration
   - Answer validation
   - **Warning:** Extremely complex, modify with caution!

2. **`server/methods.js`** (6,000+ LOC)
   - All server-side RPC methods
   - Data operations
   - TDF processing
   - Performance queries
   - **Warning:** Large file, consider splitting in future

3. **`common/Collections.js`** (103 LOC)
   - All MongoDB collection definitions
   - Collection-level security rules
   - File upload configuration

4. **`client/lib/currentTestingHelpers.js`** (24K LOC)
   - Experiment session state management
   - Trial initialization
   - Session data helpers

5. **`client/lib/router.js`** (900 LOC)
   - FlowRouter route definitions
   - Navigation logic
   - Route-level authorization

### Key Entry Points

**Client Startup:**
```
client/index.js
  → client/lib/router.js (routes)
  → client/views/[route-specific-template].js
```

**Server Startup:**
```
server/[auto-loaded-files]
  → server/lib/accounts.js (user hooks)
  → server/publications.js (data publishing)
  → server/methods.js (method registration)
```

**Experiment Flow:**
```
router.js (route: /experiment/:tdfId)
  → client/views/experiment/instructions.js
  → client/views/experiment/card.js (main trial loop)
  → client/views/experiment/unitEngine.js (scheduling)
  → server/methods.js (submitAnswer, updateHistory)
```

### Configuration Files
- **`mofacts/settings.json`** - Runtime config (NOT in repo, see `example.settings.json`)
- **`mofacts/.meteor/release`** - Meteor version
- **`mofacts/.meteor/packages`** - Meteor packages
- **`mofacts/package.json`** - npm dependencies
- **`Dockerfile`** - Multi-stage Docker build
- **`mofacts/.deploy/docker-compose.yml`** - Container orchestration

---

## Common Tasks & Workflows

### Development Setup
```bash
# Clone repo
git clone https://github.com/memphis-iis/mofacts.git
cd mofacts/mofacts/

# Use correct Node version
nvm install 22
nvm use 22

# Install Meteor (if needed)
curl https://install.meteor.com/\?release\=3.3.2 | sh

# Create settings
cp example.settings.json settings.json
# Edit settings.json with your config

# Install dependencies
meteor npm install

# Run dev server
meteor run --settings settings.json
```

### Running Tests
```bash
cd mofacts/
meteor npm test
# Runs Mocha tests on port 3010
```

### Adding a New Collection
1. Define in `common/Collections.js`:
   ```javascript
   MyCollection = new Meteor.Collection('my_collection');
   ```

2. Add security rules (if needed):
   ```javascript
   MyCollection.allow({
     insert: (userId, doc) => { /* ... */ },
     update: (userId, doc) => { /* ... */ }
   });
   ```

3. Create publication in `server/publications.js`:
   ```javascript
   Meteor.publish('myData', function() {
     return MyCollection.find({userId: this.userId});
   });
   ```

4. Subscribe in client code:
   ```javascript
   Template.myTemplate.onCreated(function() {
     this.subscribe('myData');
   });
   ```

### Adding a New Meteor Method
1. Define in `server/methods.js`:
   ```javascript
   Meteor.methods({
     async myNewMethod(arg1, arg2) {
       check(arg1, String);
       check(arg2, Number);

       if (!this.userId) {
         throw new Meteor.Error('not-authorized');
       }

       // Your logic
       const result = await MyCollection.findOneAsync({...});
       return result;
     }
   });
   ```

2. Add protection (optional) in `server/lib/protection.js`:
   ```javascript
   registerProtection('myNewMethod', (userId, args) => {
     return Roles.userIsInRole(userId, ['admin']);
   });
   ```

3. Call from client:
   ```javascript
   const result = await Meteor.callAsync('myNewMethod', arg1, arg2);
   ```

### Adding a New Route
In `client/lib/router.js`:
```javascript
FlowRouter.route('/my-new-page', {
  name: 'myNewPage',
  action() {
    BlazeLayout.render('mainLayout', {
      content: 'myNewTemplate'
    });
  }
});
```

### Debugging Tips
1. **Client-side console:**
   - `Meteor.userId()` - Current user ID
   - `Session.keys` - All session keys
   - `Meteor.status()` - Connection status
   - `MyCollection.find().fetch()` - View local collection data

2. **Server logs:**
   - `console.log()` output visible in terminal
   - Check `meteor run` output for errors

3. **Meteor DevTools (Chrome extension):**
   - View DDP messages
   - Monitor subscriptions
   - Inspect collection data

4. **State machine debugging:**
   - `card.js` has extensive logging
   - Check browser console for `[SR]` prefixed logs
   - See `docs_dev/STATE_MACHINE_TRACING_GUIDE.md`

---

## Testing

### Test Framework
- **Mocha** - Test runner
- **Chai** - Assertions
- **Sinon** - Mocking/stubbing
- **meteortesting:mocha** - Meteor integration

### Running Tests
```bash
# Terminal 1: Start test server
cd mofacts/
meteor npm test

# Terminal 2: Open browser
open http://localhost:3010
```

### Test Files
- `server/methods.test.js` - Server method tests
- Other test files use `.test.js` extension

### Test Coverage
- **Limited coverage** (mostly server methods)
- Manual testing for UI/UX
- No CI/CD pipeline currently

---

## Deployment

### Docker Build (Local)
```bash
cd mofacts/.deploy/
docker compose build --no-cache
docker compose up -d
```

### Docker Deployment (Production)
See `README.md` section "Production Deployment to AWS/Remote Server"

**Key steps:**
1. Build images locally:
   ```bash
   cd mofacts/.deploy/
   docker compose build --no-cache
   docker compose push
   ```

2. On server:
   ```bash
   cd /var/www/mofacts/
   sudo docker compose pull
   sudo docker compose down
   sudo docker compose up -d
   ```

3. Verify:
   ```bash
   sudo docker ps
   sudo docker logs mofacts --tail 50
   ```

### Environment Variables
- `ROOT_URL` - App URL (e.g., https://staging.optimallearning.org)
- `MONGO_URL` - MongoDB connection string
- `PORT` - App port (default: 3000)
- `METEOR_SETTINGS_WORKAROUND` - Path to settings.json

### Server Setup
- **OS:** Ubuntu 18.04+ (24.04 recommended, see `docs_dev/UBUNTU-24.04-UPGRADE-GUIDE.md`)
- **Reverse Proxy:** Apache with SSL (Let's Encrypt)
- **Database:** MongoDB in Docker container
- **Assets:** `/mofactsAssets/` directory

---

## Known Issues & Gotchas

### Meteor 3.x Migration
- **Async Everywhere:** All server DB operations must use `async/await`
- **Client Still Sync:** Client-side collections still use synchronous API
- **Old Code:** Some files still use old synchronous patterns (tech debt)

### Performance
- **card.js Size:** 8,700+ lines - slow to load/parse
- **methods.js Size:** 6,000+ lines - consider splitting
- **No Indexing:** Database indexes not yet implemented (Phase 1 in progress)
- **Caching:** Minimal server-side caching (Phase 1 adding some)

### Security
- **XSS Risk:** Many places use `.html()` - audit ongoing (see `docs_dev/INNERHTML_AUDIT_REPORT.md`)
- **Method Protection:** Not all methods have protection registered
- **Input Validation:** Inconsistent use of `check()` package

### Speech Recognition
- **Complex State Machine:** See `docs_dev/SPEECH_RECOGNITION_STATE_MACHINE.md`
- **Race Conditions:** Several fixed, may be more lurking
- **Browser Compatibility:** Chrome/Edge best, Firefox limited, Safari issues

### TTS (Text-to-Speech)
- **Session Warmup Required:** Must initialize audio before use
- **Browser APIs:** Different behavior across browsers
- **Race Conditions:** Fixed in recent updates

### Authentication
- **OAuth Flash:** Login screen flash fixed (recent)
- **Session Issues:** Some edge cases with session invalidation

### Theming
- **Reactivity:** Recently fixed to use publication pattern (was method-based)
- **Asset Uploads:** Logo/favicon consolidated (recent refactor)

### Mobile
- **Responsive Design:** Learning dashboard recently made responsive
- **Touch Events:** Some UI elements may not work perfectly on mobile

### Data Model
- **Collection Names:** MongoDB names differ from JS names (e.g., `Tdfs` → `tdfs`)
- **Typo in Code:** `DynamicSettings` collection name has typo (`dynaminc_settings`)

### Browser Compatibility
- **Target:** Modern Chrome/Edge/Firefox
- **Best:** Chrome (most testing done here)
- **Limited:** Safari (some features may not work)

### Docker
- **Memory Limits:** Don't set too low (512MB causes OOM)
- **Cache Issues:** Use `--no-cache` for clean builds
- **Image Size:** Large (~1GB+) due to Meteor bundle

### Development
- **Hot Reload:** Sometimes requires full restart
- **Settings File:** Must create `settings.json` from example
- **Node Version:** Must use Node 22.x (managed via nvm)

---

## Quick Reference

### Most Modified Files (Recent Work)
1. `client/views/home/learningDashboard.js` - Dashboard responsiveness
2. `client/views/theme.js` - Theme reactivity fixes
3. `server/publications.js` - getTheme publication
4. `server/methods.js` - Various fixes
5. `client/lib/currentTestingHelpers.js` - Session helpers

### Files to Be Careful With
1. `client/views/experiment/card.js` - **HUGE** (8,700 LOC), critical path
2. `server/methods.js` - **LARGE** (6,000 LOC), all RPC methods
3. `client/views/experiment/unitEngine.js` - Complex scheduling logic
4. `common/Collections.js` - All collection definitions (breaking changes!)

### Common Error Messages
- **"Method not found"** - Check method name, server/methods.js
- **"not-authorized"** - Check user role, authentication
- **"Cannot find module"** - Check npm install, package.json
- **"No route definitions found"** - Docker cache issue, rebuild with `--no-cache`
- **502 Bad Gateway** - Apache not running or not proxying to port 3000

### Useful Commands
```bash
# Check Meteor version
cat mofacts/.meteor/release

# Check Node version
node --version

# List running Docker containers
docker ps

# View Docker logs
docker logs mofacts --tail 100 -f

# MongoDB shell (in Docker)
docker exec -it mongodb mongosh MoFACT

# Clear Meteor build cache
rm -rf mofacts/.meteor/local

# Reset to clean state
meteor reset  # WARNING: Destroys local DB!
```

---

## Documentation Index

See `docs_dev/README.md` for full documentation index. Key docs:

### Design & Architecture
- `SPEECH_RECOGNITION_STATE_MACHINE.md` - SR system design
- `STATE_MACHINE_IMPLEMENTATION_PLAN.md` - SR implementation details
- `PHONETIC_MATCHING_DESIGN.md` - Fuzzy answer matching

### Security
- `SECURITY_AUDIT_REPORT.md` - Comprehensive security audit
- `SECURITY_STATUS_SUMMARY.md` - Current security state
- `INNERHTML_AUDIT_REPORT.md` - XSS prevention audit

### Upgrade Guides
- `METEOR_2.0_UPGRADE_GUIDE.md` - Meteor 1.12 → 2.0
- `METEOR_2.14_UPGRADE_GUIDE.md` - Meteor 2.0 → 2.14
- `METEOR_2.16_UPGRADE_GUIDE.md` - Meteor 2.14 → 2.16
- `METEOR_3.0_UPGRADE_GUIDE.md` - Meteor 2.16 → 3.0
- `UBUNTU-24.04-UPGRADE-GUIDE.md` - Ubuntu 18.04 → 24.04

### Operations
- `DEPLOYING.md` - Deployment procedures
- `DOCKER_DEPLOYMENT_TROUBLESHOOTING.md` - Docker issues
- `database_recovery_commands.md` - DB backup/restore

### Performance
- `SERVER_OPTIMIZATION_PHASE1.md` - Phase 1 optimizations (in progress)
- `PHASE2_OPTIMIZATION_ANALYSIS.md` - Phase 2 planning

### Bug Fixes
- `TTS_FIXES_SUMMARY.md` - TTS bug fixes
- `DUPLICATE_TTS_FEEDBACK_FIX_APPLIED.md` - Race condition fix
- `PHASE1_5_GETTHEME_FIX.md` - Theme reactivity fix
- `PHASE1_7_DASHBOARD_FIX.md` - Dashboard responsiveness

---

## When to Consult This Document

**Always check CLAUDE.md when:**
- Starting work on MoFaCTS for the first time
- Need to understand project structure
- Looking for specific files/code
- Debugging common issues
- Need to understand data model
- Making architectural changes
- Onboarding new developers/AI assistants

**Also check `docs_dev/` for:**
- Specific feature documentation
- Detailed implementation guides
- Security considerations
- Known bugs and fixes
- Upgrade procedures

---

## Contributing

### Before Making Changes
1. Check `docs_dev/` for relevant documentation
2. Read security considerations (especially for methods/publications)
3. Test thoroughly (manual testing required for UI)
4. Follow existing code patterns
5. Update documentation if needed

### Git Workflow
- **Main branch:** `main`
- **Current work:** `meteor-3.3.2-upgrade`
- **Commit messages:** Descriptive, use conventional commits preferred
  - `fix:` - Bug fixes
  - `feat:` - New features
  - `refactor:` - Code refactoring
  - `docs:` - Documentation changes

### Code Review Checklist
- [ ] No security vulnerabilities (XSS, injection, auth bypass)
- [ ] Proper error handling
- [ ] User input validated
- [ ] Authorization checked
- [ ] Database queries optimized
- [ ] No breaking changes (or documented)
- [ ] Works on mobile (responsive)
- [ ] Browser compatibility tested

---

**End of Document**

For questions or updates, contact project maintainers or consult the GitHub wiki: https://github.com/memphis-iis/mofacts/wiki

# Card Refactoring Status Tracker

**Last Updated:** 2025-01-10
**Purpose:** Track remaining card refactoring work
**Context:** No-scroll cards (must fit viewport perfectly)

---

## 📊 Overall Progress

| Category | Total | Completed | In Progress | Remaining | % Done |
|----------|-------|-----------|-------------|-----------|--------|
| **⚡ DO FIRST** | 4 items | 4 | 0 | 0 | 100% |
| **🟢 Quick Wins** | 3 items | 3 | 0 | 0 | 100% |
| **🟡 Medium** | 4 items | 4 | 0 | 0 | 100% |
| **🟠 Complex** | 3 items | 0 | 0 | 3 | 0% |
| **🔴 High Value/High Risk** | 3 items | 1 | 0 | 2 | 33% |
| **⚫ Blaze Limitation** | 1 item | N/A | N/A | N/A | N/A |
| **⚫ Removed/Not Needed** | 3 items | N/A | N/A | N/A | N/A |
| **TOTAL** | **20 items** | **12** | **0** | **6** | **75%** |

---

## 📋 TODO: Remaining Work (6 items)

### 🟠 Complex Projects (3 items, 100 hours)

#### TODO: M5: Split Template Helpers (Score: 1.7)
**Priority:** 🟠 COMPLEX
**Time:** 25 hours
**Safety:** MEDIUM (6/10)
**Why:** 80+ helpers in monolithic template
**Approach:**
```javascript
// Split into sub-templates:
{{> cardDisplay}}      // Display helpers
{{> cardInput}}        // Input helpers
{{> cardFeedback}}     // Feedback helpers
{{> cardButtons}}      // Button helpers
```
**Expected Impact:** 20-30% fewer reactive computations

---

#### TODO: C2: PWA Features (Score: 0.80)
**Priority:** 🟠 COMPLEX
**Time:** 50 hours
**Safety:** MEDIUM (5/10)
**Features:**
- Service worker for offline caching
- Web app manifest
- "Add to Home Screen"
- Offline trial practice
**Expected Impact:** App-like experience, instant load

---

#### TODO: MO9: Prefetch/Preload (Score: 1.2)
**Priority:** 🟠 COMPLEX
**Time:** 25 hours
**Safety:** MEDIUM (5/10)
**Why:** Instant trial transitions on slow networks
**Approach:** Predict next trial, preload assets
**Risk:** Could waste bandwidth if prediction wrong

---

### 🔴 High Value, High Risk (2 items, 225 hours)

#### TODO: C1: Split card.js File (Score: 0.16)
**Priority:** 🔴 HIGH VALUE, HIGH RISK
**Time:** 125 hours
**Safety:** LOW (2/10)
**Why:** 8,700 lines → 8-10 modules
**Status:** REQUIRES PLANNING PHASE FIRST

**Proposed Split:**
```
card.js (8700 lines) → Split into:
  - cardHelpers.js       (~800 lines)
  - cardEvents.js        (~500 lines)
  - cardStateMachine.js  (~2000 lines)
  - cardAudio.js         (~1500 lines - TTS/SR)
  - cardFeedback.js      (~1000 lines)
  - cardTimeout.js       (~500 lines)
  - cardButtons.js       (~400 lines)
  - cardVideo.js         (~500 lines)
  - cardUtils.js         (~1500 lines)
```

**Prerequisites:**
1. Complete M3 (Tracker.autoruns) for proper reactivity
2. Comprehensive testing strategy
3. Incremental rollout plan
4. Rollback procedures

**Expected Impact:** 60% faster load, maintainable codebase

**Do NOT start without:**
- Architecture design document
- Test coverage established (Phase 1-2)
- Team review and approval

---

#### TODO: M2: Reduce jQuery DOM Manipulation (Score: 0.20)
**Priority:** 🔴 HIGH VALUE, HIGH RISK
**Time:** 100 hours (incremental over 6+ months)
**Safety:** LOW (2/10)
**Why:** 178 jQuery calls → reactive templates

**Status:** NOT AUTOMATABLE - Requires rewriting logic

**Approach:**
```javascript
// BEFORE (imperative):
$('#timer').show();
$('#timer').text('10 seconds');
$('#timer').css('color', 'red');

// AFTER (declarative):
Template.card.helpers({
  timerVisible() { return cardState.get('showTimer'); },
  timerText() { return cardState.get('timerSeconds') + ' seconds'; },
  timerColor() { return cardState.get('urgent') ? 'red' : 'black'; }
});
// Template: {{#if timerVisible}}<div style="color: {{timerColor}}">{{timerText}}</div>{{/if}}
```

**Must be done incrementally:**
1. One subsystem at a time (TTS, then recording, then feedback)
2. 10-15 hrs/month
3. Coordinate with feature work
4. Extensive testing after each migration

**Expected Impact:** 60% faster renders, better mobile responsiveness

---

## ⚫ Limitations & Known Items (4 items)

### Blaze Limitation

#### CANNOT DO: C5: Error Boundaries
**Status:** ⚫ BLAZE LIMITATION
**Why:** Blaze doesn't support React-style error boundaries
**Workaround:** Try-catch in helpers (already done in some places)

---

### Removed/Not Needed Items (for reference)

#### REMOVED: C3: Web Vitals Monitoring
**Status:** ⚫ NOT NEEDED
**Reason:** Monitoring overhead not justified for current needs
**Alternative:** Manual testing and user feedback sufficient

#### REMOVED: MO6: Skeleton Loaders
**Status:** ⚫ NOT NEEDED
**Reason:** Trial content loads too fast (<100ms) for skeleton loaders to be useful
**Analysis:**
- Skeleton loaders designed for 500ms-2s loads
- At <100ms, they just flash and create distraction
- Testing context requires minimal visual changes (breaks concentration)
- Current `displayReady` approach is ideal (show nothing until ready)
**Alternative:** Keep current behavior (no loading indicators needed)

#### SKIPPED: M6: Null Checks
**Status:** ⚫ SKIP - ANTI-PATTERN
**Reason:** Null checks hide logic errors (fail-fast is better)
**Alternative:** Proper asset validation on TDF upload

---

## 📅 Recommended Roadmap

### NEXT: Phase 4 - Architecture (250+ hours)
**Requires:** Phase 1-2 complete, comprehensive planning

4. **C1: Split card.js** (125 hrs)
5. **M2: Reduce jQuery** (100 hrs, incremental)
6. **M5: Split helpers** (25 hrs)

---

## 📊 Effort vs Impact Matrix

### High Impact, High Effort (Plan Carefully)
- **→ C1: Split card.js** (125 hrs) - REQUIRES PLANNING
- **→ M2: Reduce jQuery** (100 hrs) - INCREMENTAL

### Low Impact, High Effort (Lower Priority)
- C2: PWA (50 hrs)
- MO9: Prefetch (25 hrs)

---

## 🎯 Next Action Items

### Short-term (Next 2 Weeks)
1. Plan architecture for C1 (card.js split)

### Medium-term (Next Month)
2. Begin incremental jQuery reduction (M2)

### Long-term (Next Quarter)
3. Consider PWA features (C2)
4. Consider prefetching optimization (MO9)

---

## 📝 Key Principles for Future Work

### Critical Principles
- **Incremental approach** - Never big-bang migrations
- **Test coverage first** - Especially for C1/M2
- **Cross-file analysis** - Check dependencies before changes
- **Fail-fast design** - No simple null checks that hide errors

### Architecture Constraints
- Avoid migrating global/shared state to local scope
- Use Blaze helpers over jQuery autoruns when possible
- DOM-managing code must be bidirectional

---

## 📚 Related Documentation

### Planning & Status
- [CARD_REFACTORING_AUDIT_2025.md](CARD_REFACTORING_AUDIT_2025.md) - Full audit details
- [CARD_REFACTORING_PRIORITIES_NO_SCROLL.md](CARD_REFACTORING_PRIORITIES_NO_SCROLL.md) - Prioritization analysis
- [CARD_REFACTORING_QUICKSTART_NO_SCROLL.md](CARD_REFACTORING_QUICKSTART_NO_SCROLL.md) - Quick start guide

### Implementation Guides
- [M3_TRACKER_AUTORUNS_IMPLEMENTATION.md](M3_TRACKER_AUTORUNS_IMPLEMENTATION.md) - Autorun patterns reference
- [M3_BEST_PRACTICES_AUDIT.md](M3_BEST_PRACTICES_AUDIT.md) - Best practices reference
- [scripts/migration_report_FINAL.md](../scripts/migration_report_FINAL.md) - Migration patterns reference
- [MO8_IMAGE_OPTIMIZATION_IMPLEMENTATION.md](MO8_IMAGE_OPTIMIZATION_IMPLEMENTATION.md) - Image optimization reference
- [C4_ACCESSIBILITY_AUDIT.md](C4_ACCESSIBILITY_AUDIT.md) - Accessibility patterns reference
- [C4_MO5_IMPLEMENTATION_SUMMARY.md](C4_MO5_IMPLEMENTATION_SUMMARY.md) - CSS variables pattern reference

### State Machine Documentation
- [STATE_MACHINE_IMPLEMENTATION_PLAN.md](STATE_MACHINE_IMPLEMENTATION_PLAN.md) - Trial FSM design
- [STATE_MACHINE_SAFETY_ASSESSMENT.md](STATE_MACHINE_SAFETY_ASSESSMENT.md) - SR/SM safety analysis
- [STATE_MACHINE_TRACING_GUIDE.md](STATE_MACHINE_TRACING_GUIDE.md) - Debugging guide

---

**Last Updated:** 2025-01-10
**Next Review:** Before starting C1 (card.js split)
**Status:** 75% complete (6 items remaining - 3 Complex, 2 High Risk, 1 Blaze Limitation)

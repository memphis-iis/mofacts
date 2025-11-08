# Card Refactoring Documentation Index (UPDATED)

**Created:** 2025-01-08
**Updated:** 2025-01-08 (added no-scroll version)
**Purpose:** Guide for refactoring card.html, card.js, and classic.css for mobile and Meteor 3.x

---

## ⚠️ IMPORTANT: Two Versions Available

### Scenario 1: Cards Can Scroll (Original)
**Use if:** Cards may have scrollbars for long content

**Priorities:**
1. **MO4** (Passive scroll listeners) - Score: 42.0
2. **MO2** (Touch-action with pan-y) - Score: 25.2
3. **M4** (CSS containment) - Score: 24.0

**Read:**
- [CARD_REFACTORING_QUICKSTART.md](CARD_REFACTORING_QUICKSTART.md)
- [CARD_REFACTORING_PRIORITIES.md](CARD_REFACTORING_PRIORITIES.md)

---

### Scenario 2: Cards NEVER Scroll (No-Scroll) ⚡ NEW!
**Use if:** Cards must ALWAYS fit viewport perfectly without scrollbars

**Priorities:**
1. **MO1** (Fix vh units) - Score: 8.0 ⬆️ **CRITICAL!**
2. **M4** (CSS containment) - Score: 27.0 ⬆️ **Increased**
3. **M6** (Null checks) - Score: 18.0

**Read:**
- [CARD_REFACTORING_QUICKSTART_NO_SCROLL.md](CARD_REFACTORING_QUICKSTART_NO_SCROLL.md) ⭐ **START HERE!**
- [CARD_REFACTORING_PRIORITIES_NO_SCROLL.md](CARD_REFACTORING_PRIORITIES_NO_SCROLL.md)

---

## 🎯 Which Version Should I Use?

### Choose **No-Scroll Version** if:
✅ Cards should fit viewport perfectly
✅ User should never see scrollbars on cards
✅ Content always designed to fit (not variable length)
✅ iOS Safari shows scrollbars when address bar changes (current bug)

### Choose **Original Version** if:
✅ Cards may have long content requiring scroll
✅ Scrollbars are acceptable/expected
✅ Content length varies significantly

### Not Sure?
→ **Test on iPhone Safari:**
1. Open a card
2. Scroll page down (address bar hides)
3. Does card show scrollbar?
   - **YES** → Use no-scroll version (fix critical bug)
   - **NO** → Use original version (optimize scroll)

---

## 📚 Documentation Files

### Core Technical Docs (Both Versions)
1. **[CARD_REFACTORING_AUDIT_2025.md](CARD_REFACTORING_AUDIT_2025.md)**
   - Detailed descriptions of all 21 anti-patterns
   - Code evidence and examples
   - Impact analysis
   - **Use:** Deep technical details on specific issues

---

### For Cards That Can Scroll

2. **[CARD_REFACTORING_QUICKSTART.md](CARD_REFACTORING_QUICKSTART.md)**
   - Top 4 priorities for scrolling optimization
   - 12 hours → 40-50% scroll performance improvement
   - Copy-paste code examples

3. **[CARD_REFACTORING_PRIORITIES.md](CARD_REFACTORING_PRIORITIES.md)**
   - All 21 issues prioritized for scroll scenario
   - 5-phase roadmap
   - Strategic recommendations

---

### For Cards That NEVER Scroll (Recommended!)

4. **[CARD_REFACTORING_QUICKSTART_NO_SCROLL.md](CARD_REFACTORING_QUICKSTART_NO_SCROLL.md)** ⭐
   - **START HERE for no-scroll!**
   - Top 4 priorities to prevent scrollbars
   - 20.5 hours → Zero scrollbars on mobile
   - Fix iOS Safari viewport bug

5. **[CARD_REFACTORING_PRIORITIES_NO_SCROLL.md](CARD_REFACTORING_PRIORITIES_NO_SCROLL.md)**
   - All 21 issues re-prioritized for no-scroll
   - Detailed comparison with original priorities
   - Strategic roadmap for viewport stability

---

## 🏆 Top Priority Comparison

### Original (Scrolling)
| Rank | ID | Issue | Score | Time |
|------|----|-------|-------|------|
| 1 | MO4 | Passive scroll listeners | 42.0 | 1.5h |
| 2 | MO2 | Touch-action (pan-y) | 25.2 | 2.5h |
| 3 | M4 | CSS containment | 24.0 | 3h |
| 4 | MO3 | Tap targets | 14.4 | 5h |
| 5 | M6 | Null checks | 18.0 | 2.5h |

**Focus:** Scroll performance optimization

---

### No-Scroll (Viewport Stability)
| Rank | ID | Issue | Score | Time | Change |
|------|----|-------|-------|------|--------|
| 1 | **MO1** | Fix vh units | 8.0 | 10h | ⬆️ Was #8! |
| 2 | **M4** | CSS containment | 27.0 | 3h | ⬆️ Increased |
| 3 | M6 | Null checks | 18.0 | 2.5h | ✓ Same |
| 4 | MO3 | Tap targets | 14.4 | 5h | ✓ Same |
| 5 | C3 | Web Vitals | 10.8 | 5h | ⬆️ Was #6 |

**Focus:** Prevent viewport overflow

---

## 📊 Key Differences

### Major Changes for No-Scroll

**INCREASED Priority:**
- **MO1 (vh units):** #8 → **#1** (⬆️ 7 places)
  - Why: Fixed vh causes scrollbars on mobile
  - Gain: 9 → **10** (CRITICAL)

- **M4 (Containment):** Still #2, but gain increased
  - Why: Prevents overflow causing scrollbars
  - Gain: 8 → **9**

- **MO6 (Skeleton loaders):** #9 → #7 (⬆️ 2 places)
  - Why: Prevents layout shift causing overflow
  - Gain: 7 → **8**

**DECREASED Priority:**
- **MO4 (Passive listeners):** #1 → #8 (⬇️ 7 places)
  - Why: Scroll optimization less relevant
  - Gain: 7 → **4**
  - Note: Still useful for touch gestures!

- **MO2 (Touch-action):** #3 → #9 (⬇️ 6 places)
  - Why: pan-y optimization less relevant
  - Gain: 7 → **5**
  - Note: Still useful for gesture recognition!

**UNCHANGED:**
- M6, MO3, C3, MO7 (not scroll-related)
- C1, M1, M2 (architecture/state)

---

## 📝 Quick Decision Guide

### "I just want to get started!"
→ Test if cards scroll on iPhone Safari first
→ If yes: [CARD_REFACTORING_QUICKSTART_NO_SCROLL.md](CARD_REFACTORING_QUICKSTART_NO_SCROLL.md) ⭐
→ If no: [CARD_REFACTORING_QUICKSTART.md](CARD_REFACTORING_QUICKSTART.md)

### "What's the full scope?"
→ For no-scroll: [CARD_REFACTORING_PRIORITIES_NO_SCROLL.md](CARD_REFACTORING_PRIORITIES_NO_SCROLL.md)
→ For scrolling: [CARD_REFACTORING_PRIORITIES.md](CARD_REFACTORING_PRIORITIES.md)

### "Why is X an anti-pattern?"
→ [CARD_REFACTORING_AUDIT_2025.md](CARD_REFACTORING_AUDIT_2025.md) (same for both versions)

### "How do I prioritize?"
→ Depends on scroll vs no-scroll scenario (see above)

---

## 🎓 Key Takeaway

**The single biggest difference:**

**If cards CAN scroll:**
- Focus on **scroll performance** (passive listeners, touch-action)
- vh units are medium priority (#8)

**If cards NEVER scroll:**
- Focus on **viewport stability** (vh units, containment)
- Scroll optimization is lower priority
- **Fixed vh units = CRITICAL BUG** (causes scrollbars on mobile)

---

## 🔍 Research Summary

### Total Issues Found: 21
- Meteor 3 anti-patterns: 7 (M1-M7)
- Mobile anti-patterns: 9 (MO1-MO9)
- Cross-cutting issues: 5 (C1-C5)

### Key Mobile Finding
**iOS Safari viewport behavior:**
- Address bar shows/hides → viewport height changes
- Fixed `100vh` doesn't update → content overflows
- Result: Scrollbars appear when address bar hides
- **Solution:** Dynamic vh via CSS custom properties + JS

### Meteor 3 Findings
- 552 Session.set/get calls (should be ReactiveDict)
- 178 jQuery DOM manipulations (should be reactive)
- 8,700-line monolithic file (should split)
- Only 2 Tracker.autorun uses (should have 20-30)

---

## 📅 Recommended Approach

### Week 1: Determine Scenario
1. Test cards on real mobile devices
2. Check if scrollbars appear on iOS Safari
3. Choose appropriate version of docs
4. Follow quickstart guide for your scenario

### Week 2-4: Implementation
- **No-scroll:** Focus on MO1, M4, M6 (viewport stability)
- **Scrolling:** Focus on MO4, MO2, M4 (scroll performance)

### Month 2-3: Polish
- Complete Phase 1-2 from priorities doc
- Add Web Vitals monitoring
- Accessibility improvements

### Month 4-6: Architecture
- Split 8,700-line card.js (C1)
- Migrate Session → ReactiveDict (M1)
- Begin incremental jQuery reduction (M2)

---

## 🛠️ Files Analyzed

### Source Files (Same for Both Versions)
- `client/views/experiment/card.html` (423 lines)
- `client/views/experiment/card.js` (8,700 lines ⚠️)
- `public/styles/classic.css` (1,538 lines)

### Key Problem Areas
- **vh units:** 30+ instances in classic.css
- **Session:** 552+ instances in card.js
- **jQuery:** 178+ instances in card.js
- **Monolith:** 8,700 lines in single file

---

## 📞 Questions?

**"Which version should I use?"**
→ Test on iPhone Safari. If cards show scrollbars when address bar hides, use no-scroll version.

**"Can I implement both?"**
→ No need! Pick the scenario that matches your requirements.

**"What if I'm not sure?"**
→ Start with no-scroll version (more conservative, prevents bugs)

**"Does the main page scroll?"**
→ These priorities are specifically for CARD scrolling. Page-level scrolling is separate.

**"How long will this take?"**
→ No-scroll Week 1: 20.5 hours → zero scrollbars
→ Scrolling Week 1: 12 hours → 40-50% faster scroll

---

## 🚀 Next Step

1. **Test your cards on iPhone Safari** (scroll page, watch for scrollbars)
2. **Choose version** (scroll vs no-scroll)
3. **Read quickstart** for your chosen version
4. **Start with top priority** (MO1 for no-scroll, MO4 for scrolling)

---

**Last Updated:** 2025-01-08
**Related Docs:** See docs_dev/ directory for all guides

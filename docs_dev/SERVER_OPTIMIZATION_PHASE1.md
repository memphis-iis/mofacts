# MoFaCTS Server Optimization - Phase 1 Implementation

**Phase**: 1 - Zero-Risk Optimizations
**Date Started**: 2025-01-06
**Status**: ✅ IN PROGRESS
**Risk Level**: NONE
**Estimated Timeline**: 6-9 hours

---

## Overview

Phase 1 implements database indexes and server-side caching to improve server performance without any security risk. These optimizations do not touch authentication, authorization, or data access patterns.

---

## Implementation Checklist

### Part 1: Database Indexes

- [ ] Create migration file `server/migrations/add_performance_indexes.js`
- [ ] Add indexes for Histories collection (3 indexes)
- [ ] Add indexes for course/assignment collections (4 indexes)
- [ ] Add indexes for experiment state collections (2 indexes)
- [ ] Add indexes for TDF lookups (5 indexes)
- [ ] Add index for user lookups (1 index)
- [ ] Run migration on development database
- [ ] Verify indexes created with `db.collection.getIndexes()`
- [ ] Test queries use indexes with `explain()`

### Part 2: Server-Side Caching

- [ ] Add cache variables at top of `server/methods.js`
- [ ] Implement caching logic in `getResponseKCMap` function
- [ ] Add `invalidateResponseKCMapCache()` helper function
- [ ] Add invalidation call in `upsertTDFFile`
- [ ] Add invalidation call in `processPackageUpload`
- [ ] Add invalidation call in `deletePackageFile`

### Part 3: Testing

- [ ] Baseline performance measurements taken
- [ ] Post-implementation performance measurements
- [ ] Index usage verified with MongoDB explain()
- [ ] Cache invalidation tested
- [ ] Cache TTL verified (1 hour expiration)
- [ ] Memory usage monitored
- [ ] No regressions found

### Part 4: Documentation

- [x] Security plan document created
- [x] Phase 1 tracking document created
- [ ] Performance metrics documented
- [ ] Deployment notes added

---

## Performance Metrics

### Baseline Measurements (Before)

**Teacher Dashboard (`getStudentPerformanceForClassAndTdfId`):**
- Load time: _____ seconds
- Database queries: _____
- Query time: _____ ms

**Package Upload (`processPackageUpload`):**
- Upload time: _____ seconds
- `getResponseKCMap` calls: _____
- Memory usage: _____ MB

**Theme Loading (`getTheme`):**
- Calls per page load: 1
- Database queries per call: 5+
- Total time: _____ ms

### Post-Implementation Measurements (After)

**Teacher Dashboard:**
- Load time: _____ seconds (_____ % improvement)
- Database queries: _____
- Query time: _____ ms (_____ % improvement)

**Package Upload:**
- Upload time: _____ seconds (_____ % improvement)
- `getResponseKCMap` cache hits: _____
- Memory savings: _____ MB

**General:**
- Slow queries eliminated: _____
- Index usage confirmed: ✅/❌
- Cache hit rate: _____ %

---

## Implementation Details

### Database Indexes Created

```javascript
// Histories collection - Performance queries
db.histories.createIndex(
  {userId: 1, TDFId: 1, levelUnitType: 1, recordedServerTime: -1},
  {name: "userId_TDFId_type_time"}
);
db.histories.createIndex(
  {TDFId: 1, levelUnitType: 1, recordedServerTime: -1},
  {name: "TDFId_type_time"}
);
db.histories.createIndex(
  {userId: 1, recordedServerTime: -1},
  {name: "userId_time"}
);

// Course/Assignment collections
db.assessments.createIndex({courseId: 1, TDFId: 1}, {name: "course_tdf"});
db.section_user_map.createIndex({sectionId: 1, userId: 1}, {name: "section_user"});
db.section.createIndex({courseId: 1}, {name: "courseId"});
db.course.createIndex({teacherUserId: 1, semester: 1}, {name: "teacher_semester"});

// Experiment state collections
db.globalExperimentStates.createIndex({userId: 1, TDFId: 1}, {name: "user_tdf"});
db.componentStates.createIndex({userId: 1, TDFId: 1}, {name: "user_tdf"});

// TDF lookups
db.tdfs.createIndex({"content.fileName": 1}, {name: "fileName"});
db.tdfs.createIndex(
  {"content.tdfs.tutor.setspec.experimentTarget": 1},
  {name: "experimentTarget"}
);
db.tdfs.createIndex({stimuliSetId: 1}, {name: "stimuliSetId"});
db.tdfs.createIndex({ownerId: 1}, {name: "ownerId"});
db.tdfs.createIndex({accessors: 1}, {name: "accessors"});

// User lookups
db.users.createIndex({username: 1}, {name: "username"});
```

**Index Verification:**
```javascript
// Run in MongoDB shell to verify
db.histories.getIndexes()
db.assessments.getIndexes()
// ... etc
```

**Query Plan Verification:**
```javascript
// Run explain() on critical queries
db.histories.find({userId: "xxx", TDFId: "yyy", levelUnitType: "model"})
  .sort({recordedServerTime: -1})
  .explain("executionStats")
// Should show: "stage": "IXSCAN" (index scan, not COLLSCAN)
```

### Caching Implementation

**Cache Variables Added** (top of `server/methods.js`):
```javascript
let responseKCMapCache = null;
let responseKCMapTimestamp = null;
const RESPONSE_KC_MAP_CACHE_TTL = 3600000; // 1 hour in milliseconds
```

**Modified `getResponseKCMap` Function:**
- Added cache check at start
- Return cached value if valid (< 1 hour old)
- Build fresh cache if expired or missing
- Update cache after building

**Invalidation Function Added:**
```javascript
function invalidateResponseKCMapCache() {
  responseKCMapCache = null;
  responseKCMapTimestamp = null;
  serverConsole('getResponseKCMap cache invalidated');
}
```

**Invalidation Points:**
1. After `upsertTDFFile` completes (line ~2485)
2. After `processPackageUpload` completes (line ~TBD)
3. After `deletePackageFile` completes (line ~3938)

---

## Testing Results

### Index Usage Tests

**Test 1: Teacher Dashboard Query**
```javascript
// Query: Find histories for teacher's students
// Expected: Use userId_TDFId_type_time index
// Actual: [ ] IXSCAN [ ] COLLSCAN
// Notes: _________________________________
```

**Test 2: Component State Lookup**
```javascript
// Query: Find component state for user and TDF
// Expected: Use user_tdf index
// Actual: [ ] IXSCAN [ ] COLLSCAN
// Notes: _________________________________
```

**Test 3: Course Assignments**
```javascript
// Query: Find assignments by courseId and TDFId
// Expected: Use course_tdf index
// Actual: [ ] IXSCAN [ ] COLLSCAN
// Notes: _________________________________
```

### Caching Tests

**Test 1: Cache Hit**
- [ ] First call builds cache
- [ ] Second call returns cached value
- [ ] Logged: "using cache"
- [ ] No database query on second call

**Test 2: Cache Invalidation**
- [ ] Cache populated
- [ ] TDF uploaded (triggers invalidation)
- [ ] Next call rebuilds cache
- [ ] Logged: "cache invalidated" + "building fresh cache"

**Test 3: Cache TTL**
- [ ] Cache populated
- [ ] Wait 61 minutes
- [ ] Next call rebuilds cache (expired)
- [ ] Logged: "building fresh cache"

**Test 4: Memory Usage**
- Cache size: _____ MB
- Memory before caching: _____ MB
- Memory after caching: _____ MB
- Memory with cache hits: _____ MB (should be stable)

---

## Issues Encountered

### Issue #1: [Title]
- **Date**: _____
- **Description**: _____
- **Impact**: _____
- **Resolution**: _____
- **Status**: [ ] Open [ ] Resolved

### Issue #2: [Title]
- **Date**: _____
- **Description**: _____
- **Impact**: _____
- **Resolution**: _____
- **Status**: [ ] Open [ ] Resolved

---

## Rollback Procedure

If issues are encountered, follow these steps to rollback:

### Rollback Database Indexes
```javascript
// Connect to MongoDB and run:
db.histories.dropIndex("userId_TDFId_type_time");
db.histories.dropIndex("TDFId_type_time");
db.histories.dropIndex("userId_time");
db.assessments.dropIndex("course_tdf");
db.section_user_map.dropIndex("section_user");
db.section.dropIndex("courseId");
db.course.dropIndex("teacher_semester");
db.globalExperimentStates.dropIndex("user_tdf");
db.componentStates.dropIndex("user_tdf");
db.tdfs.dropIndex("fileName");
db.tdfs.dropIndex("experimentTarget");
db.tdfs.dropIndex("stimuliSetId");
db.tdfs.dropIndex("ownerId");
db.tdfs.dropIndex("accessors");
db.users.dropIndex("username");
```

### Rollback Caching Code
```bash
# Revert methods.js to previous commit
git checkout HEAD~1 -- mofacts/server/methods.js
# Or manually remove:
# - Cache variables
# - Caching logic in getResponseKCMap
# - invalidateResponseKCMapCache function
# - Invalidation calls
```

### Verification After Rollback
- [ ] Server starts without errors
- [ ] Indexes removed (verify with `getIndexes()`)
- [ ] Queries still work (may be slower)
- [ ] No cache-related errors in logs

---

## Deployment Notes

### Development Deployment
- **Date**: _____
- **Database**: Development
- **Status**: [ ] Successful [ ] Issues
- **Notes**: _____

### Staging Deployment
- **Date**: _____
- **Database**: Staging
- **Status**: [ ] Successful [ ] Issues
- **Notes**: _____

### Production Deployment
- **Date**: _____
- **Database**: Production
- **Status**: [ ] Successful [ ] Issues
- **Rollback Needed**: [ ] Yes [ ] No
- **Notes**: _____

---

## Success Criteria

- [x] Zero security vulnerabilities introduced
- [ ] All indexes created successfully
- [ ] MongoDB confirms indexes in use (explain() shows IXSCAN)
- [ ] Teacher dashboard loads 50%+ faster
- [ ] Package uploads complete 50%+ faster
- [ ] Cache hit rate > 80% after warmup
- [ ] Cache invalidation works correctly
- [ ] No errors or regressions
- [ ] No increase in memory usage
- [ ] Rollback procedure tested and documented

---

## Next Steps

After Phase 1 completion:
1. Document final performance metrics
2. Review with team
3. Evaluate success criteria
4. Decide whether to proceed to Phase 2
5. If proceeding, review Phase 2 security requirements

---

## Sign-Off

**Implementation Lead**: _____________________  Date: _____
**Security Reviewer**: _____________________  Date: _____
**Project Manager**: _____________________  Date: _____

---

**Document Version**: 1.0
**Last Updated**: 2025-01-06
**Status**: In Progress

# Database Recovery Commands

Use these commands in the browser console to inspect and fix database corruption issues.

## Inspection Commands

### Check TDFs collection
```javascript
// Count total TDFs
Tdfs.find().count()

// List all TDFs with basic info
Tdfs.find().fetch().map(t => ({
  _id: t._id,
  lessonName: t.content?.tdfs?.tutor?.setspec?.lessonname,
  fileName: t.content?.fileName,
  hasContent: !!t.content,
  hasTdfs: !!t.content?.tdfs,
  hasTutor: !!t.content?.tdfs?.tutor,
  hasSetspec: !!t.content?.tdfs?.tutor?.setspec
}))

// Find TDFs with corrupt/missing structure
Tdfs.find().fetch().filter(t => !t.content || !t.content.tdfs || !t.content.tdfs.tutor || !t.content.tdfs.tutor.setspec)
```

### Check DynamicAssets collection
```javascript
// Count total assets
DynamicAssets.find().count()

// List all assets
DynamicAssets.find().fetch().map(a => ({
  _id: a._id,
  name: a.name,
  userId: a.userId,
  size: a.size,
  type: a.type
}))

// Check if any assets exist
DynamicAssets.find().fetch().length > 0
```

### Check related collections
```javascript
// Component states
ComponentStates.find().count()

// Assignments
Assignments.find().count()

// Histories
Histories.find().count()

// Global experiment states
GlobalExperimentStates.find().count()
```

## Recovery Commands

### Remove corrupt TDFs (careful!)
```javascript
// Find and remove TDFs with missing structure
const corruptTdfs = Tdfs.find().fetch().filter(t =>
  !t.content ||
  !t.content.tdfs ||
  !t.content.tdfs.tutor ||
  !t.content.tdfs.tutor.setspec
);

console.log('Found', corruptTdfs.length, 'corrupt TDFs:', corruptTdfs.map(t => t._id));

// Remove them one by one (CAREFUL - this deletes data!)
// Uncomment to execute:
// corruptTdfs.forEach(t => Tdfs.remove({_id: t._id}));
```

### Clean up orphaned data
```javascript
// Get all TDF IDs
const tdfIds = Tdfs.find().fetch().map(t => t._id);

// Find component states with no matching TDF
const orphanedStates = ComponentStates.find().fetch().filter(s => !tdfIds.includes(s.TDFId));
console.log('Orphaned component states:', orphanedStates.length);

// Remove orphaned component states (CAREFUL!)
// Uncomment to execute:
// orphanedStates.forEach(s => ComponentStates.remove({_id: s._id}));

// Same for other collections
const orphanedAssignments = Assignments.find().fetch().filter(a => !tdfIds.includes(a.TDFId));
console.log('Orphaned assignments:', orphanedAssignments.length);

const orphanedHistories = Histories.find().fetch().filter(h => !tdfIds.includes(h.TDFId));
console.log('Orphaned histories:', orphanedHistories.length);

const orphanedGlobalStates = GlobalExperimentStates.find().fetch().filter(g => !tdfIds.includes(g.TDFId));
console.log('Orphaned global states:', orphanedGlobalStates.length);
```

### Complete database reset (NUCLEAR OPTION - deletes everything!)
```javascript
// WARNING: This will delete ALL uploaded content and user data!
// Only use if you want to start completely fresh

// Count before deletion
console.log('Before deletion:');
console.log('TDFs:', Tdfs.find().count());
console.log('Assets:', DynamicAssets.find().count());
console.log('Component States:', ComponentStates.find().count());
console.log('Assignments:', Assignments.find().count());
console.log('Histories:', Histories.find().count());
console.log('Global States:', GlobalExperimentStates.find().count());

// Uncomment to execute complete wipe:
// Tdfs.remove({});
// DynamicAssets.find().fetch().forEach(a => DynamicAssets.remove({_id: a._id}));
// ComponentStates.remove({});
// Assignments.remove({});
// Histories.remove({});
// GlobalExperimentStates.remove({});

// Count after deletion
console.log('After deletion:');
console.log('TDFs:', Tdfs.find().count());
console.log('Assets:', DynamicAssets.find().count());
console.log('Component States:', ComponentStates.find().count());
console.log('Assignments:', Assignments.find().count());
console.log('Histories:', Histories.find().count());
console.log('Global States:', GlobalExperimentStates.find().count());
```

## Safe inspection (always run this first)

```javascript
// Run this to see the current state without modifying anything
console.log('=== DATABASE INSPECTION ===');
console.log('TDFs:', Tdfs.find().count());
console.log('Assets:', DynamicAssets.find().count());
console.log('Component States:', ComponentStates.find().count());
console.log('Assignments:', Assignments.find().count());
console.log('Histories:', Histories.find().count());
console.log('Global States:', GlobalExperimentStates.find().count());

// Check for corrupt TDFs
const allTdfs = Tdfs.find().fetch();
const corruptCount = allTdfs.filter(t =>
  !t.content ||
  !t.content.tdfs ||
  !t.content.tdfs.tutor ||
  !t.content.tdfs.tutor.setspec
).length;

console.log('Corrupt TDFs:', corruptCount, 'out of', allTdfs.length);

// List TDFs with details
allTdfs.forEach(t => {
  const isCorrupt = !t.content?.tdfs?.tutor?.setspec;
  console.log(
    isCorrupt ? '❌' : '✓',
    t._id,
    '-',
    t.content?.tdfs?.tutor?.setspec?.lessonname || 'NO NAME',
    '(',
    t.content?.fileName || 'NO FILE',
    ')'
  );
});
```

## Usage

1. Open browser console (F12)
2. Copy and paste the "Safe inspection" command first
3. Review the output to understand what's corrupt
4. If needed, use specific recovery commands
5. Always check the results before running destructive operations

// ============================================================================
// WARNING: DESTRUCTIVE OPERATION - THIS WILL DELETE ALL DATA FROM COLLECTIONS
// ============================================================================
// This script permanently deletes data from multiple collections.
// Use ONLY in development or when you explicitly want to wipe the database.
//
// DO NOT RUN THIS ON PRODUCTION!
//
// Usage:
//   meteor mongo < reset_database.js
//   OR copy/paste into meteor mongo shell
// ============================================================================

print("=== Before Deletion ===");
print("TDFs:", db.tdfs.count());
print("Assets:", db.Assets.files.count());
print("Component States:", db.component_state.count());
print("Assignments:", db.assessments.count());
print("Histories:", db.history.count());
print("Global States:", db.global_experiment_state.count());

print("\n=== Deleting all collections ===");

db.tdfs.remove({});
db.Assets.files.remove({});
db.Assets.chunks.remove({});
db.component_state.remove({});
db.assessments.remove({});
db.history.remove({});
db.global_experiment_state.remove({});

print("\n=== After Deletion ===");
print("TDFs:", db.tdfs.count());
print("Assets:", db.Assets.files.count());
print("Component States:", db.component_state.count());
print("Assignments:", db.assessments.count());
print("Histories:", db.history.count());
print("Global States:", db.global_experiment_state.count());

print("\n=== Database Reset Complete ===");

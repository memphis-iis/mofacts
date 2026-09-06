# Shared Cluster Model Plan

## Goal

Allow learning sessions, assessment-session history events, and SPARC sessions across lessons in the same course to credit the same learner cluster-level adaptive model when they practice the same knowledge component.

The shared model must not depend on a single stimulus file, lesson order, cluster index, or numeric range allocation. Delivery can still select concrete stimuli by numeric position. Model credit is assigned by the selected or authored `clusterKC` within the current launch context.

Stimulus-set and item identities remain important for non-model analytics. They are deliberately excluded from the shared adaptive-model identity so that two different stimulus files can credit the same course-scoped cluster model without pretending they are the same item.

Learning-session cluster access should move toward the nested `setspec.clusters[]` stimulus shape as the source of truth. The legacy flattened `tdf.stimuli` array can remain as a compatibility read path during migration, but new shared-cluster model behavior should not deepen reliance on flattened rows, modulo grouping, or fixed numeric KC range allocation.

## Core Model Key

`clusterKC` is the shared model identity.

```json
{
  "clusterKC": "fractions.addition.like_denominators"
}
```

`clusterKC` may be numeric or semantic. Both are normalized to a string-compatible identity for model keying. Semantic `clusterKC` values are trimmed and lowercased before matching.

For a course-assigned launch, the learner cluster model key is:

```ts
userId + courseId + clusterKC
```

For a direct TDF launch, or for a student who is not assigned that TDF through a course, the learner cluster model key is:

```ts
userId + TDFId + clusterKC
```

Different courses do not share models at this time, even if they use the same semantic `clusterKC` names.

`stimuliSetId`, `stimulusKC`, `KCId`, and other item-level envelope fields are not part of this shared model key. They remain available for history, dashboards, item analytics, crowd statistics, media scoping, and future item-level modeling.

## Identity Contracts

Implementation must split model identity from the history/item envelope before changing any read, write, or hydration behavior.

The shared model key is the only identity used for adaptive-model sharing:

```ts
type SharedModelPracticeKey = {
  userId: string;
  contextKind: "course" | "tdf";
  contextId: string; // courseId for course launches, TDFId for direct launches
  clusterKC: string;
};
```

The history/item envelope keeps the fields needed by existing runtime code, history reconstruction, dashboards, crowd statistics, media scoping, and audit views:

```ts
type ModelPracticeEnvelopeIdentity = {
  stimuliSetId: string | number;
  clusterKC: string;
  stimulusKC: string | number;
  KCId: string | number;
  KCDefault: string | number;
  KCCluster: string;
};
```

Shared model matching must compare only `SharedModelPracticeKey`. It must not compare `stimuliSetId`, `stimulusKC`, `KCId`, or `KCDefault`.

Item analytics, history reconstruction, hidden-item tracking, crowd statistics, media scoping, and audit/debug displays must continue to use the item envelope fields that are appropriate for those features. This means the implementation should add separate helpers instead of weakening the existing item identity helpers in place:

- `normalizeClusterKC(value)` for model keying
- `resolveModelPracticeEnvelope(cluster, stimulus, context)` for stamped history/runtime fields
- `resolveSharedModelPracticeKey(userId, modelContext, envelope)` for adaptive-model reads and writes
- `modelPracticeEnvelopeMatches(...)` only for item/envelope comparisons
- `sharedModelPracticeKeyMatches(...)` only for model sharing

## KC Resolution

All learning-session and assessment-session delivery continues to select stimulus clusters by numeric position. The numeric position determines which concrete stimulus cluster is used. It is not the model identity.

After a concrete stimulus cluster is selected, model credit uses the selected cluster's resolved `clusterKC`.

Examples:

```json
{ "clusterKC": 1007 }
```

credits:

```ts
userId + contextId + "1007"
```

and:

```json
{ "clusterKC": "fractions.addition.like_denominators" }
```

credits:

```ts
userId + contextId + "fractions.addition.like_denominators"
```

Semantic `clusterKC` values are globally meaningful names. If the same semantic `clusterKC` appears in multiple TDFs assigned to the same course for the same student, they automatically credit the same course-scoped model.

Numeric `clusterKC` values remain valid in the same architecture. They are useful for existing content and local models, but semantic names are preferred for intentional cross-TDF sharing because they are easier to coordinate and audit.

`clusterKC` is the cluster-level model identity. In existing learning-session behavior, the first/default stimulus in a cluster remains the delivered and model-bearing stimulus unless a later change explicitly adds multi-stimulus-per-cluster delivery. That first stimulus should be understood as assigned to the cluster KC, not as the source of the cluster KC. If a cluster authors a semantic `clusterKC`, that normalized semantic value labels the shared model. If it does not, the existing numeric cluster KC assigned through the legacy/default stimulus path remains the local model identity.

Standard nested stimulus JSON should continue to use array order for delivery positions. The cluster's numeric position is its index in `setspec.clusters`, and each stimulus position is its index inside that cluster's `stims` array. Authors should not add redundant `clusterid`, `clustername`, or `stimulusid` fields just to express those positions.

The older `KC_MULTIPLE` numeric allocation scheme is a migration constraint, not a model contract. It currently gives each stimulus set a fixed numeric range and derives cluster/stimulus KCs from that range. This can collide or become ambiguous if a stimulus set exceeds the assumed range, and it also obscures semantic cross-TDF sharing. The implementation should avoid adding new dependencies on that range scheme.

`stimulusKC` is not part of the cluster-level sharing key. It remains a separate item identity for non-model analytics and item-level history. A stimulus KC can be assigned to, or treated as an item-level instantiation of, the cluster KC it belongs to. It must not differentiate, subdivide, qualify, or otherwise change the shared `clusterKC` model that it instantiates. Shared cluster modeling must not require or imply that `stimulusKC` equals `clusterKC`. Multi-stimulus variants under one cluster can be supported later, but this implementation should preserve the current learning-session first/default-stimulus behavior.

## Normalization Boundary

Learning sessions, assessment-session history writes, and SPARC sessions must pass through the same identity normalization boundary before model hydration or model-practice history writes.

Authoring shape:

- `clusterKC` is authored on the cluster.
- stimulus rows inside the cluster do not need to author `clusterKC`; current legacy/runtime paths may still stamp a numeric cluster KC on the first/default stimulus.
- `stimulusKC` remains an item identity under the cluster. It can be generated or authored independently for item/history purposes, and it must not be rewritten to equal `clusterKC`.
- `stimulusKC` does not create a separate model within the cluster. Multiple `stimulusKC` values under the same `clusterKC` all credit the same shared cluster model in the resolved launch context.
- numeric delivery position comes from array order, not from `clusterKC`.

Normalized runtime shape:

```ts
const resolvedClusterKC = normalizeClusterKC(cluster.clusterKC ?? firstDefaultStimulus.clusterKC);

{
  clusterKC: resolvedClusterKC,
  stimulusKC: resolvedStimulusKC,
  KCId: resolvedStimulusKC,
  KCDefault: resolvedStimulusKC,
  KCCluster: resolvedClusterKC
}
```

The normalized runtime shape is a compatibility envelope. It keeps existing item-level fields available while making `clusterKC` the single identity used for shared cluster-model state and cross-unit sharing.

`stimulusKC` remains in code and history as item identity. If it is not explicitly authored, it should be generated by the existing item identity mechanism or another explicit item-identity generator. It should not be derived from `clusterKC` merely to make shared cluster models work, and it should not be used to distinguish one shared cluster model from another.

`KCId`, `KCDefault`, and `KCCluster` are retained for compatibility. `KCCluster` collapses to the resolved `clusterKC`; `KCId` and `KCDefault` remain aligned with `stimulusKC` for item-level compatibility. Shared model reads and writes must ignore `KCId`, `KCDefault`, and `stimulusKC` when deciding whether two events credit the same cluster model.

Schema support must allow `clusterKC` at `setspec.clusters[]`. This is a schema/registry addition, not a new authoring layer. The schema should continue to allow the standard nested structure:

```json
{
  "setspec": {
    "clusters": [
      {
        "clusterKC": "fractions.lcd",
        "stims": [
          {
            "display": { "clozeText": "..." },
            "response": { "correctResponse": "least common denominator" },
            "parameter": "0,0.8"
          }
        ]
      }
    ]
  }
}
```

The older `KC_MULTIPLE`-style flattened stimulus system can continue to exist for legacy numeric content and for compatibility reads during migration. The shared-course model implementation must not require semantic `clusterKC` values to participate in numeric modulo arithmetic. For semantic KCs, delivery resolves the cluster by the unit's numeric position in `setspec.clusters[]` and then reads the selected cluster's normalized semantic `clusterKC` for model identity; when no semantic cluster label is authored, the existing numeric cluster KC remains the model identity.

## Unit Behavior

Learning sessions:

- select concrete stimulus clusters by numeric position or existing cluster-list mechanics
- normalize the selected cluster so the delivered first/default stimulus uses the selected cluster's resolved `clusterKC`
- resolve model credit from the selected cluster's `clusterKC`
- read prior model history from the resolved TDF or course context
- write model-practice history to the same resolved context
- preserve item-level `stimulusKC` values for item analytics and history without letting them subdivide the shared cluster model

Assessment sessions:

- select concrete stimulus clusters by numeric position or existing assessment schedule mechanics
- normalize the selected cluster so assessment history uses the same KC envelope as learning and SPARC sessions
- resolve model credit from the selected cluster's `clusterKC`
- write model-practice history to the resolved TDF or course context for later hydration by other units
- do not read, repeat, adapt, immediately update future learning behavior, or report against the shared adaptive model at this time

SPARC sessions:

- do not use the learning/assessment numeric cluster-list mechanism for model targeting
- use authored SPARC target indices to identify the relevant cluster
- normalize the target cluster through the same KC envelope used by learning sessions
- resolve model credit from that target cluster's `clusterKC`
- write equivalent correct/incorrect model-practice events to the resolved TDF or course context

SPARC actions are equivalent to ordinary correct and incorrect model trials for this work. Different weighting would require a later change to the logistic regression model.

## Sharing Scope

Sharing scope is determined by launch context, not by a separate TDF compatibility flag.

- If the student launches a TDF through a course assignment, matching `clusterKC` values share within that course.
- A released progressive assignment makes each member TDF available from the Practice page as an individual launch. Direct launches stay TDF-scoped and can reuse all rows carrying that source `TDFId`, including rows originally produced by a progressive launch.
- Direct-launch blocking must be enforced by the server-side launch/readiness/access path, with the practice menu using the same server-derived state for UX. Hiding or disabling a menu button alone is not sufficient.
- A card-route reload restores serialized course launch context, including progressive mode and endpoint. It must not silently reinterpret a course launch as direct practice.
- If another user is not assigned that TDF through an active course, public/direct visibility continues to work normally for that other user.
- Direct-launch behavior is TDF-local regardless of course membership. Course-context sharing occurs only when the learner launches from the Courses page.
- If the student launches a TDF outside of any active course assignment, behavior stays TDF-local.
- If the student is not enrolled in the relevant course assignment, behavior stays TDF-local.

There is no separate "course sharing" switch in the TDF. A course is enabled for a student by the teacher's course assignment.

## Sharing Detection

Two lessons share a learner cluster model when all of these match:

- same learner
- same course ID, established by course assignment launch context
- same resolved `clusterKC`

They do not need the same TDF, same stimulus file, same stimulus-set ID, same stimulus KC, same cluster index, same lesson order, or same stimulus count.

The same `clusterKC` in a different course does not share with this course. A direct TDF-local launch reads all model-practice rows carrying that TDF's source identity, even if they were written from a course or progressive launch, but it does not add other TDFs merely because their `clusterKC` matches.

## Runtime Behavior

When a learning or SPARC unit starts:

1. Resolve whether the current launch has course context for this student and TDF.
2. Resolve the concrete clusters that the current unit can credit:
   - learning sessions: eligible selected-stimulus clusters for the unit
   - SPARC sessions: authored model targets
3. Normalize each cluster through the shared KC envelope.
4. Load prior model-practice history or aggregate state for only those normalized cluster KCs in the resolved context.
5. Hydrate the current unit's adaptive model from the matching cluster state.
6. Write new model-practice updates back with the same resolved context and normalized KC envelope.

For course-assigned launches, hydration uses all prior model-practice history in the course for matching cluster KCs, not just completed units.

Within course context, shared model also means shared progress for matching `clusterKC` values. Prior course model-practice events from other lessons in the same course should hydrate the same normal reconstructed learning state that current-lesson practice would hydrate, including answered-question counters, visibility/progress state, and outcome histories. If a future lesson needs unit-only or lesson-only behavior, that should be introduced as an explicit scope flag; it is not part of this implementation.

Students may complete lessons in different orders. A lesson starts fresh for clusters the learner has not practiced yet and hydrates from previous practice for clusters the learner has already encountered in the same context.

Assessment sessions keep writing their ordinary `levelUnitType: "schedule"` row for assessment resume, dashboard, and ordinary trial-counting semantics. They also write a companion `levelUnitType: "model"` row with `modelEvidenceSource: "assessment"` so later learning-session and SPARC hydration can consume the same shared model evidence through the existing model-practice history pipeline. Dashboard and other ordinary trial-counting surfaces must ignore the companion model row so assessment attempts are not double-counted.

## History Contract

Course-assigned model-practice history writes must include course context, preferably using the existing `courseAssignment` envelope:

```ts
{
  launchSource: "courses",
  assignmentId,
  courseId,
  TDFId,
  launchMode: "individual" | "progressive",
  progressiveEndpointTdfId?,
  progressiveRevisionId?
}
```

Course-scoped history reads should query stamped course context rather than infer course membership from unstamped historical TDF rows.

The implementation should keep the existing learning-session reconstruction pipeline and extend its history read contract with resolved model context. Course context changes which rows are available to reconstruction; it does not introduce a second hydration pipeline.

For an individual course launch, the server returns model rows carrying the launched source `TDFId` in any context plus rows in the same course whose normalized `clusterKC` matches the launched lesson. For a progressive launch, the server returns rows carrying a source `TDFId` in the server-recorded ordering revision's prefix through the selected endpoint. The revision is retained across insertion, reordering, and page reloads. Rows from other TDFs outside that prefix are excluded even when their cluster names match. See `docs/course-assignments.md` for revision ownership and revocation rules.

For a TDF-local context, the cumulative model-history read remains source-`TDFId` scoped. Progressive trials preserve their original member `TDFId`, `stimuliSetId`, `stimulusKC`, `clusterKC`, and Unit 2 name, so later direct or individual launches can reconstruct the correct member model and item history.

## Progressive Course Launches

A progressive assignment is an ordered group of at least two compatible learning-session TDFs. Selecting the progressive action on member N composes members 1 through N. The endpoint member supplies Unit 1 instructions and the Unit 2 learning model/settings; selected clusters from the prefix are merged by normalized `clusterKC`, while distinct stimuli remain keyed by `stimuliSetId + stimulusKC`.

Progressive practice is unbounded: it has no positive `maxTrials` or `practiceseconds`, no group completion state, and no shared `GlobalExperimentStates` record. Teachers may insert, remove, or reorder members. New launches use the current order, an already-open session keeps its initial composition, and current membership is revalidated on every history write so removal revokes future writes without deleting prior history.

Existing unit-history reads such as SPARC interface-state replay, assessment position counting, dashboard progress, hidden-item tracking, and crowd statistics should keep their current item/session scoping unless a specific call site is deliberately moved to course-scoped cluster history. SPARC history rows can replay SPARC document/interface state because they carry SPARC-specific event fields. Non-SPARC model-practice rows do not imply SPARC document state; they only feed the shared cluster model through `levelUnitType: "model"` evidence. Learning-session resume/model hydration is deliberately moved to the shared scoped history set in course context so model state and progress move together for matching `clusterKC` values.

Model-practice history writes should also include an audit-only evidence source:

```ts
modelEvidenceSource: "learning" | "assessment" | "sparc"
```

This field does not affect scoring in this plan. It preserves provenance for debugging, reporting, and possible future evidence weighting.

For the model-practice history API, `clusterKC` is the shared model identity. `stimulusKC`, `KCId`, and `KCDefault` remain item-level envelope fields and are not used for shared cluster-model matching. `KCCluster` should collapse to the resolved `clusterKC`.

Those envelope fields are not authoring requirements for cluster-level sharing. Runtime normalization should stamp any envelope fields required by current internals without making item identity equal to cluster-model identity.

Authored learning-session clusters should only need the real source identity needed for cluster-level model credit: `clusterKC`. Stimulus-level identity remains item-scoped under the cluster and can be generated by import/runtime tooling when not authored.

SPARC authored targets should follow the same split. A SPARC target may carry the full model-practice envelope for history and audit compatibility, but its adaptive-model query/write key is resolved from only `userId`, model context, and normalized `clusterKC`.

## Reset Behavior

All destructive history-reset paths should fail clearly in course context for now, including learner lesson-progress reset, teacher/admin reset tools, and TDF runtime-data deletion.

Resetting a course-assigned TDF would conflict with the shared course model unless a separate explicit course-model reset operation is designed.

The existing `resetStudentPerformance` delivery setting resets displayed unit progress without deleting history. It can remain display-scoped, but it must not be treated as a course-model reset or used to bypass course-scoped model history.

If the TDF is not actively assigned to a course for that student, destructive reset behavior remains available and works as it does today for TDF-local history.

## Validation Rules

Fail clearly when invariants break:

- A model-practice event cannot resolve a `clusterKC`.
- A course-assigned history write is missing course context.
- A course-context reset is requested.
- A history write claims course context but the assignment/TDF/course relationship is invalid.
- The same run attempts to mix incompatible course and TDF-local contexts for the same model update.
- A shared model query attempts to match course-scoped cluster models by `stimuliSetId`, `stimulusKC`, `KCId`, or `KCDefault`.
- A progressive launch requests a member outside the assignment's current ordered prefix or supplies an item identity outside that prefix.
- A shared model key is built from an unnormalized semantic `clusterKC`.

Do not silently fall back from course context to TDF-local context for a course-context launch.

## Migration Strategy

Existing TDF-local behavior remains the default for direct launches. Released progressive membership also grants direct Practice-page access to member TDFs, and source-stamped progressive rows participate in that TDF-local reconstruction without broadening it to other TDFs.

Existing numeric `clusterKC` values remain valid. Courses that need intentional cross-TDF sharing should use semantic `clusterKC` strings for shared clusters.

Semantic `clusterKC` migration should account for trim-and-lowercase normalization. Authors should avoid names whose distinction depends only on case or surrounding whitespace.

No giant stimulus file is required. Each lesson keeps its own stimulus file. Clusters reference shared `clusterKC` names where appropriate, while stimulus rows keep item identities under those clusters.

## Implementation Steps

1. Add explicit shared-model identity types and helpers before changing hydration behavior:
   - `ModelPracticeEnvelopeIdentity`
   - `SharedModelPracticeKey`
   - `normalizeClusterKC`
   - `resolveModelPracticeEnvelope`
   - `resolveSharedModelPracticeKey`
   - separate envelope-matching and shared-key-matching helpers
2. Add validation tests proving shared model matching ignores `stimuliSetId`, `stimulusKC`, `KCId`, and `KCDefault`, while item/envelope comparisons still preserve them.
3. Add `clusterKC` to the stimulus cluster schema/registry so `setspec.clusters[]` can declare the cluster-level KC identity.
4. Add a shared KC normalization helper for cluster/stimulus runtime preparation:
   - trim and lowercase semantic `clusterKC`
   - preserve numeric `clusterKC` as a string-compatible identity for keying
   - stamp the delivered first/default stimulus with the resolved `clusterKC`
   - preserve or generate item-level `stimulusKC` values without deriving them from `clusterKC`
   - preserve the current first/default-stimulus learning-session behavior; broader multi-stimulus cluster delivery is out of scope for the first implementation
   - stamp `KCId` and `KCDefault` from resolved `stimulusKC`
   - stamp `KCCluster` from resolved `clusterKC`
5. Move learning-session cluster access toward nested `setspec.clusters[]` as the source of truth:
   - select clusters by array position in the nested stimulus file
   - keep legacy flattened `tdf.stimuli` as a compatibility read path during migration
   - avoid adding new model behavior that depends on `KC_MULTIPLE`, modulo grouping, or fixed per-stimulus-set KC ranges
6. Resolve current model context as either course-scoped or TDF-local before any model-practice read or write.
7. Extend the existing learning-session model history read so course launches scope the same reconstruction input by `userId + courseId + clusterKC`, while direct launches keep the TDF-local scope.
8. Preserve current TDF-local history behavior for direct launches and non-course-assigned students.
9. Update learning-session stimulus preparation so numeric cluster-list selection resolves by nested cluster array position and then applies the shared KC normalization envelope.
10. Update learning-session model initialization to read card/cluster identity from normalized cluster-level `clusterKC`, while keeping per-stim fields available for existing adaptive-logistic internals.
11. Update learning-session history logging so model-practice KC fields are stamped from the normalized envelope:
   - `clusterKC = resolvedClusterKC`
   - `stimulusKC = resolvedStimulusKC`
   - `KCId = resolvedStimulusKC`
   - `KCDefault = resolvedStimulusKC`
   - `KCCluster = resolvedClusterKC`
12. Update SPARC target construction so authored target indices resolve to clusters and then use the same normalized KC envelope as learning sessions, while shared model keys are resolved only from `clusterKC` plus launch context.
13. Stamp course context on model-practice history writes when the launch context is a course assignment.
14. Update learning-session and SPARC model hydration to request prior cluster state by the current unit's resolved `clusterKC` set, excluding `stimuliSetId`, `stimulusKC`, `KCId`, and `KCDefault` from shared model matching.
   - in course context, normal reconstruction uses matching course-scoped model-practice rows, so shared model and shared progress move together
   - in TDF-local context, normal reconstruction remains TDF-scoped
15. Add `modelEvidenceSource` to model-practice writes for learning, assessment, and SPARC evidence.
16. Keep assessment sessions API-compatible and ensure assessment model-practice history events write to the resolved model context without requiring assessments to read from it.
17. Allow direct practice-menu launch for a member of a released progressive assignment:
   - server-side access recognizes current progressive membership
   - direct history remains scoped to the member's source `TDFId`
   - progressive-origin trials reappear because they retain that same source identity
18. Block destructive reset paths in course context while preserving display-only progress reset behavior.
19. Add validation for shared cluster model invariants.
20. Migrate SPARC content that used legacy `clustername`, `clusterid`, or `stimulusid` as KC/position metadata to the standard nested shape with cluster-level `clusterKC`.
21. Add tests for:
   - shared semantic KC across two TDFs in one course
   - two model-practice events with the same `courseId + clusterKC` and different `stimuliSetId` / `stimulusKC` hydrating one shared model
   - numeric KC working through the same model-key path
   - no sharing across different courses
   - different students completing lessons in different orders
   - direct TDF launch remaining TDF-local
   - direct TDF launch of a released progressive member remaining TDF-local
   - progressive-origin rows hydrating the original member without importing other prefix members
   - public/direct visibility remaining available to users who are not assigned the TDF through an active course
   - non-enrolled student remaining TDF-local
   - semantic KC trim-and-lowercase normalization
   - unnormalized semantic KC failing before a shared model key is built
   - learning-session numeric position selection crediting selected cluster `clusterKC`
   - learning-session semantic `clusterKC` not requiring `KC_MULTIPLE` modulo grouping
   - learning-session cluster access using nested `setspec.clusters[]` as source of truth when available
   - legacy flattened `tdf.stimuli` remaining available as a compatibility read path
   - learning-session first/default stimulus using the resolved cluster-level `clusterKC`
   - learning-session history preserving item-level `stimulusKC`, `KCId`, and `KCDefault` while stamping `KCCluster` from resolved `clusterKC`
   - multiple `stimulusKC` values under one cluster crediting the same shared `clusterKC` model
   - shared model hydration ignoring `stimuliSetId`, `stimulusKC`, `KCId`, and `KCDefault`
   - non-model item analytics continuing to use `stimuliSetId` and `stimulusKC`
   - assessment-session history updating for later hydration but not reading or immediately adapting from the shared model
   - SPARC authored target index crediting the target cluster's course `clusterKC`
   - SPARC and learning-session practice sharing when they normalize to the same `clusterKC`
   - `modelEvidenceSource` stamped for learning, assessment, and SPARC writes
   - destructive reset paths failing in course context
   - existing TDF-local behavior remaining unchanged

## Audit Notes

Coherence:

- The plan separates delivery selection from model credit. Learning and assessment units select by numeric position; model identity comes from the selected cluster `clusterKC`.
- SPARC model credit is authored-target-index based and resolves to the target cluster's `clusterKC`; it does not depend on learning-session cluster lists.
- Course context determines sharing. The same `clusterKC` does not share across different courses.

Maintainability:

- The plan reuses existing course-assignment context instead of adding a separate TDF compatibility switch.
- Semantic KC strings are preferred for shared authoring, while numeric KCs remain valid for existing content.
- Semantic KC matching is trim-and-lowercase normalized.
- Shared model identity is simplified around `clusterKC`; item envelope fields remain item-scoped under the cluster for non-model analytics and compatibility.

Efficiency:

- Course-scoped reads should filter by `userId`, `courseAssignment.courseId`, and the current unit's resolved `clusterKC` set.
- Shared model reads should not filter by `stimuliSetId`, `stimulusKC`, `KCId`, or `KCDefault`; those fields remain useful for item analytics and audit views.
- If history replay becomes expensive, add a materialized learner-course cluster aggregate later. The first implementation should keep the source of truth in model-practice history.

## Principle

KC identity lives in `clusterKC`. Course context defines when matching `clusterKC` values share across TDFs.

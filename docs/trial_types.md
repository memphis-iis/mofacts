# MoFaCTS Trial Types Reference

## Overview

MoFaCTS supports 7 different trial types that control how questions are presented and how learners interact with them. Trial types are specified in TDF (Tutor Definition File) assessment sessions.

---

## Core Trial Types

### 'd' - Drill
**Standard practice with feedback**

- Student sees the question
- Student types or selects an answer
- System shows feedback (correct/incorrect) with the right answer
- Short timeout before continuing to next question
- Used for: Regular practice sessions where students learn from feedback

**Example flow:**
1. Question: "What is the capital of France?"
2. Student types: "London"
3. Feedback: "Incorrect. The correct answer is Paris."
4. [Brief pause, then next question]

---

### 't' - Test
**Assessment without feedback**

- Student sees the question
- Student types or selects an answer
- No feedback shown - student doesn't know if they were right or wrong
- Help button available (if configured in TDF)
- Used for: Quizzes, exams, pre/post-tests

**Example flow:**
1. Question: "What is the capital of France?"
2. Student types: "Paris"
3. [Immediately continues to next question - no feedback]

---

### 's' - Study
**Passive study with answer shown**

- Student sees the question AND answer together
- No typing required - just read and learn
- Advances automatically after timeout
- Used for: Initial learning, review sessions

**Example flow:**
1. Question: "What is the capital of France?"
2. Answer: "Paris" [shown immediately]
3. [Timed pause, then next question]

---

## Specialized Trial Types

### 'm' - Mandatory Correction
**Drill that requires correct answer entry**

- Student sees the question
- Student types or selects an answer
- If **correct**: Shows positive feedback, continues
- If **incorrect**: Student MUST re-type the correct answer before continuing
- Used for: High-stakes practice where correct answer production is critical

**Example flow (incorrect answer):**
1. Question: "What is the capital of France?"
2. Student types: "London"
3. Feedback: "Incorrect. The correct answer is Paris."
4. Prompt: "Please enter the correct answer to continue"
5. Student types: "Paris" [must match to proceed]
6. [Next question]

---

### 'n' - Drill with Timed Prompt
**Drill that shows a custom hint after incorrect answers**

- Student sees the question
- Student types or selects an answer
- If **correct**: Shows positive feedback, continues
- If **incorrect**: Shows custom prompt/hint with timeout
- After timeout expires, automatically continues (no re-entry required)
- Used for: Guided practice with scaffolding hints

**Example flow (incorrect answer):**
1. Question: "What is the capital of France?"
2. Student types: "London"
3. Feedback: "Incorrect. The correct answer is Paris."
4. Custom hint: "Remember: Paris is located on the Seine River." [shows for 3 seconds]
5. [Auto-continues after timeout]

**TDF Configuration:**
```xml
<deliveryparams>
  <forcecorrectprompt>Remember: [helpful hint here]</forcecorrectprompt>
  <forcecorrecttimeout>3000</forcecorrecttimeout>
</deliveryparams>
```

---

### 'i' - Instructional Test
**Assessment with help available**

- Identical to 't' (test) in behavior
- Help button remains enabled (if configured)
- No feedback shown
- Used for: Low-stakes practice tests, self-assessment, instructional quizzes

**Example flow:**
1. Question: "What is the capital of France?"
2. Student can click "Help" button for hints (if available)
3. Student types: "Paris"
4. [Continues to next question - no feedback]

---

### 'f' - Fast Study
**Quick review with answer shown**

- Identical to 's' (study) in behavior
- Answer shown immediately with question
- Advances automatically
- Used for: Final review, quick refresher sessions

**Semantic difference from 's':** Intended for TDF authors to distinguish between initial study ('s') and review study ('f'), though the system treats them identically.

---

## Comparison Table

| Type | Name | Student Input? | Feedback Shown? | Special Behavior | Help Button? |
|------|------|---------------|-----------------|------------------|--------------|
| **d** | Drill | Yes | Yes | Standard feedback | Disabled |
| **t** | Test | Yes | No | Assessment mode | Enabled |
| **s** | Study | No | N/A | Answer shown with question | Disabled |
| **m** | Mandatory Correction | Yes | Yes | Must re-type correct answer if wrong | Disabled |
| **n** | Drill with Prompt | Yes | Yes | Shows custom hint after wrong answer | Disabled |
| **i** | Instructional Test | Yes | No | Same as test | Enabled |
| **f** | Fast Study | No | N/A | Same as study | Disabled |

---

## When to Use Each Type

### Learning Sequences

**Initial Learning:**
```
s → s → d → d → t
(study, study, drill, drill, test)
```

**Spaced Review:**
```
s → d → t → f → t
(study, drill, test, fast review, final test)
```

**Scaffolded Practice:**
```
s → n → n → d → m → t
(study, prompted drills, standard drill, mandatory correction, test)
```

---

## Trial Type Selection in TDFs

### Schedule/Assessment Units

Trial types are specified in the assessment session template strings:

```
offset,forceButton,TYPE,location
```

**Example:**
```
0,n,d,0    # First question: drill
1,n,t,1    # Second question: test
2,n,m,2    # Third question: mandatory correction
```

Valid TYPE values: **d, t, s, m, n, i, f**

### Model/Adaptive Units

Model units use only the three core types based on item availability:
- Items marked "drill" → type 'd'
- Items marked "test" → type 't'
- Items marked "study" → type 's'

The specialized types (m, n, i, f) are **only available in schedule/assessment units**.

---

## Technical Notes

### Force Correction Mechanics

Both 'm' and 'n' types use the force correction system:

**Type 'm':**
- `isForceCorrectTrial = true` (always requires correction)
- Shows input field for re-entry
- Must match correct answer to proceed

**Type 'n':**
- `isForceCorrectTrial = true` (triggers force correction UI)
- Shows custom prompt from `forcecorrectprompt` parameter
- Uses `forcecorrecttimeout` parameter for auto-advance
- Does NOT require re-entry

### Help Button Logic

The help button is enabled for types 't' and 'i':
```javascript
if(!(testType === 't' || testType === 'i'))
  $('#helpButton').prop("disabled", true);
```

All other types disable the help button during trials.

---

## Common Patterns

### Graduated Difficulty
Start with scaffolding, reduce support over time:
```
s → n → n → d → d → t
```

### Mastery-Based
Require correct production before moving to assessment:
```
s → d → m → m → t
```

### Self-Paced Learning
Allow help during low-stakes practice:
```
s → i → i → d → t
```

### Quick Review
Rapid review before summative assessment:
```
f → f → t
```

---

## Related TDF Parameters

### For 'n' type (timed prompts):
- `forcecorrectprompt`: Custom hint text to display
- `forcecorrecttimeout`: Duration in milliseconds to show hint

### For all drill types (d, m, n):
- `correctprompt`: Timeout after correct answer (ms)
- `incorrectprompt`: Timeout after incorrect answer (ms)
- `feedbackType`: Can be "dialogue" for interactive feedback

### For all types:
- `forceCorrection`: When true, any type can require correction (overrides default behavior)

---

**Last Updated:** 2025-10-11
**Related Documentation:**
- [TDF Format Specification](tdf_format.md)
- [Delivery Parameters](delivery_params.md)
- [State Machine Implementation](STATE_MACHINE_IMPLEMENTATION_PLAN.md)

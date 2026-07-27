# Phase 2 Learning Product Design

Status: Approved
Date: 2026-07-27

## Goal

Transform the product from a one-shot answer generator into a learning loop: students practice, receive criterion-aligned feedback, revise, and track progress. Add onboarding, attempt storage, privacy controls, and Writing/Speaking separation.

## Scope

### In Scope (This Batch)

- Student onboarding: capture test type, target band, current level, exam date, language preference.
- Attempt-first modes: `practice` (student writes first), `hint` (scaffold without answer), `model` (show PEEL), `compare` (side-by-side), `revise` (re-score after edit).
- Versioned attempt storage: save original, feedback, and revision pairs.
- Official IELTS criterion feedback structure (Writing: TR/CC/LR/GRA; Speaking: FC/LR/GRA/PR) without band prediction.
- Separate Writing Task 2 and Speaking Part 3 prompt modes.
- Privacy controls: delete and export user data endpoints.
- Accessibility improvements: associated labels, live regions, keyboard navigation, reduced-motion.

### Deferred (Later Sub-Phase)

- Full content de-biasing audit (requires per-file review of all 9 topic JSONs).
- Full WCAG 2.2 AA third-party audit.
- Spaced repetition and curriculum sequencing.
- Teacher calibration and band prediction (Phase 3).

## Architecture

### Learner Profile

Create `server/learner/profile.js`:
```js
{
  testType: 'academic' | 'general',
  targetBand: number,      // 5-9
  currentLevel: number,    // self-assessed 5-9
  examDate: string | null, // ISO date
  language: 'en' | 'zh',
  createdAt: string,
}
```
Stored via MemoryStore (null in public mode, local file in dev).

### Attempt Storage

Create `server/learner/attempts.js`:
```js
{
  id: string,
  userId: string,
  command: string,
  prompt: string,
  mode: 'practice' | 'hint' | 'model' | 'compare' | 'revise',
  attempts: [
    { content: string, feedback: FeedbackResult, ts: string },
    ...
  ],
  topicId: string,
  createdAt: string,
  updatedAt: string,
}
```
Each attempt is an immutable revision pair. The latest attempt is the current version.

### Learning Modes

New `/learn` command with sub-actions:

| Mode | Flow |
|---|---|
| `/learn practice [prompt]` | Student writes first, then gets structural + criterion feedback |
| `/learn hint [prompt]` | AI gives scaffolding questions, not the answer |
| `/learn model [prompt]` | AI generates PEEL (same as /peel) but tagged as model answer |
| `/learn compare [prompt]` | Student input + AI model side-by-side with diff notes |
| `/learn revise [attemptId]` | Load prior attempt, student edits, re-score |

### Criterion Feedback

Create `server/evaluation/criterionFeedback.js`:
```js
{
  writing: {
    taskResponse: { status: 'pass|watch|fail', notes: string },
    coherence: { status, notes },
    lexical: { status, notes },
    grammar: { status, notes },
  },
  speaking: {
    fluency: { status, notes },
    lexical: { status, notes },
    grammar: { status, notes },
    pronunciation: { status, notes },
  },
  disclaimer: 'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.'
}
```

Deterministic structural checks map to criteria where possible. LLM-assisted criterion notes are optional and clearly labeled as AI-generated.

### Privacy Controls

New endpoints:
- `DELETE /api/learner/data` - delete all stored data for the authenticated/anonymous session
- `GET /api/learner/export` - export all stored data as JSON

In public mode (null store), these return `{ deleted: 0, exported: {} }`.

### Writing/Speaking Separation

Modify `server/commands/registry.js` to add `skill` field: `writing` or `speaking`.
Prompt builders select mode-appropriate templates:
- Writing: academic register, formal cohesion, complex sentences
- Speaking: natural fluency, interaction markers, simpler structures

## Acceptance Criteria

### AC-201 Onboarding
- First-time users are prompted for test type, target band, current level, exam date, language.
- Profile stored via MemoryStore; null in public mode.
- Profile can be updated via `/learn profile`.

### AC-202 Practice Mode
- Student submits own attempt before seeing any model answer.
- Feedback includes structural + criterion notes.
- Attempt saved to versioned storage.

### AC-203 Hint Mode
- AI returns scaffolding questions, not a PEEL answer.
- Student can then submit own attempt.

### AC-204 Model Mode
- AI generates PEEL (same quality as /peel).
- Tagged as model answer in attempt storage.

### AC-205 Compare Mode
- Both student and AI content displayed.
- Diff notes highlight structural and criterion differences.

### AC-206 Revise Mode
- Load prior attempt by ID.
- Student edits content.
- Re-scored with structural + criterion feedback.
- New revision appended to attempt history.

### AC-207 Criterion Feedback
- Writing feedback covers TR/CC/LR/GRA.
- Speaking feedback covers FC/LR/GRA/PR.
- No band score or prediction.
- Disclaimer on every feedback response.

### AC-208 Versioned Storage
- Every attempt saved with prompt, content, feedback, timestamp.
- Revisions append, never overwrite.
- Public mode stores nothing; local mode persists.

### AC-209 Privacy Controls
- DELETE removes all learner data.
- GET exports all learner data as JSON.
- Works correctly in both null and local store modes.

### AC-210 Writing/Speaking Separation
- Registry marks each command's skill type.
- Prompt builders use mode-appropriate templates.
- Speaking mode does not enforce academic register.

### AC-211 Accessibility
- All form labels associated with inputs.
- Loading/error/result states use live regions.
- Keyboard navigation works for all interactive elements.
- Respects `prefers-reduced-motion`.

### AC-212 Regression
- All Phase 0/1 tests remain green.
- New Phase 2 tests pass.
- Drift check passes.
- Client build passes.
- Zero vulnerabilities.

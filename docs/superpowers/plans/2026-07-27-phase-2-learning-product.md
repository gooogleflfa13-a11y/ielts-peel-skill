# Phase 2 Learning Product Implementation Plan

> Use subagent-driven development. TDD throughout.

**Goal:** Transform from answer generator to learning loop with onboarding, practice modes, criterion feedback, versioned storage, privacy controls, and Writing/Speaking separation.

**Architecture:** New learner module (profile + attempts + modes) layered on existing MemoryStore and unified pipeline. Criterion feedback as a new evaluation module. Privacy as new API endpoints. Writing/Speaking as registry field and prompt builder selection.

## Global Constraints

- Public mode remains stateless (null store).
- No band prediction or examiner claims.
- Every criterion feedback includes disclaimer.
- Attempts are append-only, never overwrite.
- No question-bank data modified.
- TDD: failing test first.

---

## File Map

### New Files
- `server/learner/profile.js`
- `server/learner/attempts.js`
- `server/learner/learnSkill.js`
- `server/evaluation/criterionFeedback.js`
- `server/api/learnerRoutes.js`
- `tests/unit/profile.test.js`
- `tests/unit/attempts.test.js`
- `tests/unit/criterionFeedback.test.js`
- `tests/unit/learnSkill.test.js`
- `tests/integration/learnerFlow.test.js`

### Modified Files
- `server/commands/registry.js` - add `learn` command, `skill` field
- `server/pipeline/executeCommand.js` - route `/learn`
- `server/app.js` - add learner routes
- `server/memory/memoryStore.js` - add profile/attempt methods
- `server/prompts/peelPrompt.js` - Writing/Speaking mode selection
- `client/src/App.jsx` - onboarding flow, learn mode UI
- `client/src/components/Onboarding.jsx` (new)
- `client/src/components/LearnPanel.jsx` (new)
- `client/src/components/CriterionFeedback.jsx` (new)

---

### Task 1: Learner Profile

**Lane:** Core
**Files:** Create `server/learner/profile.js`, `tests/unit/profile.test.js`, modify `server/memory/memoryStore.js`

- [ ] Write tests: create/validate/update profile; null store returns null; local store persists
- [ ] RED
- [ ] Implement profile module with validation (testType, targetBand 5-9, currentLevel 5-9, examDate, language)
- [ ] Add profile methods to MemoryStore interface
- [ ] GREEN

### Task 2: Attempt Storage

**Lane:** Core
**Files:** Create `server/learner/attempts.js`, `tests/unit/attempts.test.js`

- [ ] Write tests: create attempt, append revision, load by ID, list by user, delete all, export all; append-only; null store no-ops
- [ ] RED
- [ ] Implement attempts module with immutable revision history
- [ ] GREEN

### Task 3: Criterion Feedback

**Lane:** Core
**Files:** Create `server/evaluation/criterionFeedback.js`, `tests/unit/criterionFeedback.test.js`

- [ ] Write tests: Writing feedback has TR/CC/LR/GRA; Speaking has FC/LR/GRA/PR; each has status+notes; disclaimer present; no band score; deterministic checks map structural issues to criteria
- [ ] RED
- [ ] Implement criterion feedback builder mapping structural validation to official criteria
- [ ] GREEN

### Task 4: Learn Command And Modes

**Lane:** Feature
**Files:** Create `server/learner/learnSkill.js`, `tests/unit/learnSkill.test.js`, modify `server/commands/registry.js`, `server/pipeline/executeCommand.js`

- [ ] Write tests: practice requires student input before feedback; hint returns scaffolding not answer; model generates PEEL tagged as model; compare shows both; revise loads prior and re-scores
- [ ] RED
- [ ] Implement learnSkill with 5 mode handlers
- [ ] Add `learn` to registry with sub-action routing
- [ ] Wire into executeCommand
- [ ] GREEN

### Task 5: Privacy API

**Lane:** Feature
**Files:** Create `server/api/learnerRoutes.js`, `tests/integration/learnerFlow.test.js`

- [ ] Write tests: DELETE /api/learner/data removes all; GET /api/learner/export returns JSON; null store returns empty; local store returns data
- [ ] RED
- [ ] Implement learner routes with proper error handling
- [ ] Wire into app.js
- [ ] GREEN

### Task 6: Writing/Speaking Separation

**Lane:** Feature
**Files:** Modify `server/commands/registry.js`, `server/prompts/peelPrompt.js`

- [ ] Write tests: registry has skill field per command; peelPrompt selects writing vs speaking template; speaking mode does not enforce academic register
- [ ] RED
- [ ] Add skill field to registry
- [ ] Add speaking-mode prompt template (natural fluency, interaction markers)
- [ ] GREEN

### Task 7: Client Onboarding And Learn UI

**Lane:** UI
**Files:** Create `client/src/components/Onboarding.jsx`, `client/src/components/LearnPanel.jsx`, `client/src/components/CriterionFeedback.jsx`, modify `client/src/App.jsx`

- [ ] Write tests: onboarding captures profile fields; learn panel shows 5 modes; criterion feedback renders 4 dimensions; live regions announce results; keyboard navigation works
- [ ] RED
- [ ] Implement onboarding form, learn panel, criterion feedback display
- [ ] Add accessibility: associated labels, live regions, keyboard nav, reduced-motion
- [ ] GREEN + Vite build

### Task 8: Integration And Phase 2 Gate

**Lane:** Integration
**Files:** All

- [ ] Merge all tasks
- [ ] Run full test suite
- [ ] Run drift check
- [ ] Run client build
- [ ] Run audits
- [ ] Verify question-bank untouched
- [ ] Produce completion report

## Dependency Graph

```
Task 1 Profile ──> Task 2 Attempts ──> Task 4 Learn ──┐
Task 3 Criterion ──────────────────────────────────────┤
                                                       ├─> Task 8 Integration
Task 5 Privacy (follows 1+2) ──────────────────────────┤
Task 6 Writing/Speaking (follows registry) ────────────┤
Task 7 Client (follows 3+4) ───────────────────────────┘
```

Tasks 1, 3 can start in parallel. Task 2 follows 1. Task 4 follows 2+3. Task 5 follows 1+2. Task 6 independent. Task 7 follows 3+4.

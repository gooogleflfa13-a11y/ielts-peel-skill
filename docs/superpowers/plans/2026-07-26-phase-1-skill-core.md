# Phase 1 Skill Core Implementation Plan

> **For agentic workers:** Use subagent-driven development to implement task-by-task.

**Goal:** One command registry, typed schemas, unified pipeline, wizard state machine, topic routing fix, memory trust-tier separation, drift checks, and real CI.

**Architecture:** Centralize command definitions into one registry consumed by all surfaces. Consolidate sync/SSE into one execution core. Fix topic matching with word boundaries. Move learner data below system trust. Add drift verification.

**Tech Stack:** Node.js ES modules, Express, Vitest, no new runtime dependencies.

## Global Constraints

- All five commands defined in `server/commands/registry.js`.
- No raw user text in system prompts.
- Sync and SSE share one execution function.
- Drift check must pass before commit.
- No question-bank data files modified.
- TDD: failing test first, then implement.

---

## File Map

### New Files
- `server/commands/registry.js`
- `server/schemas/request.js`
- `server/schemas/response.js`
- `server/schemas/peel.js`
- `server/pipeline/executeCommand.js`
- `server/wizard/wizardState.js`
- `scripts/check-drift.mjs`
- `.github/workflows/ci.yml`
- `tests/unit/registry.test.js`
- `tests/unit/schemas.test.js`
- `tests/unit/executeCommand.test.js`
- `tests/unit/wizardState.test.js`
- `tests/unit/topicRouting.test.js`
- `tests/unit/driftCheck.test.js`
- `tests/integration/unifiedPipeline.test.js`

### Modified Files
- `server/app.js` - derive validation from registry
- `server/orchestrator.js` - delegate to unified pipeline
- `server/skills/wizardSkill.js` - use state machine
- `server/skills/peelSkill.js` - use trust-tier memory injection
- `server/skills/matrixSkill.js` - use unified pipeline
- `server/skills/scoreSkill.js` - use schema validation
- `server/skills/bankSkill.js` - use registry for capability
- `server/prompts/peelPrompt.js` - inject user_context as quoted data
- `server/knowledge/topicRetriever.js` - word boundaries, Unknown, multi-topic
- `server/memory/memoryStore.js` - typed fact interface
- `client/src/App.jsx` - derive commands from capability response
- `skill/SKILL.md` - regenerate from registry
- `Agent_System_Prompt.md` - align command list with registry

---

### Task 1: Command Registry

**Lane:** Core
**Files:** Create `server/commands/registry.js`, `tests/unit/registry.test.js`

- [ ] Write tests: registry exports 5 commands, each has name/description/inputSchema/outputContract/requiresApiKey/requiresBank/repairable
- [ ] Run RED
- [ ] Implement registry with all 5 command definitions
- [ ] Run GREEN

### Task 2: Typed Schemas

**Lane:** Core
**Files:** Create `server/schemas/{request,response,peel}.js`, `tests/unit/schemas.test.js`

- [ ] Write tests: validate peel/matrix/wizard/score/bank requests; validate PeelUnit shape; reject invalid with field detail
- [ ] Run RED
- [ ] Implement schema validators (no external deps)
- [ ] Run GREEN

### Task 3: Unified Execution Pipeline

**Lane:** Core
**Files:** Create `server/pipeline/executeCommand.js`, `tests/unit/executeCommand.test.js`, `tests/integration/unifiedPipeline.test.js`, Modify `server/orchestrator.js`

- [ ] Write tests: executeCommand returns result + events; sync adapter returns result; SSE adapter subscribes to events; both use same parse/validate/repair/finalize
- [ ] Run RED
- [ ] Implement executeCommand consolidating orchestrator logic
- [ ] Refactor orchestrator to delegate to executeCommand
- [ ] Run GREEN + full regression

### Task 4: Wizard State Machine

**Lane:** Feature
**Files:** Create `server/wizard/wizardState.js`, `tests/unit/wizardState.test.js`, Modify `server/skills/wizardSkill.js`

- [ ] Write tests: AWAITING_DETAILS emits questions; READY_TO_GENERATE emits scripts; state from history length + phase field; no persistence in AWAITING_DETAILS
- [ ] Run RED
- [ ] Implement wizardState with explicit transitions
- [ ] Refactor wizardSkill to use state machine
- [ ] Run GREEN

### Task 5: Topic Routing Fix

**Lane:** Feature
**Files:** Modify `server/knowledge/topicRetriever.js`, `tests/unit/topicRouting.test.js`

- [ ] Write tests: single strong keyword classifies; word-boundary prevents substring false match; Unknown returned for no match; multi-topic gets highest confidence
- [ ] Run RED
- [ ] Fix matching: use \b word boundaries, lower threshold for single exact match, return Unknown, add confidence scores
- [ ] Run GREEN + existing topicRetriever tests

### Task 6: Memory Trust-Tier Separation

**Lane:** Feature
**Files:** Modify `server/prompts/peelPrompt.js`, `server/memory/memoryStore.js`, `server/skills/peelSkill.js`, `tests/unit/memoryTrustTier.test.js`

- [ ] Write tests: user facts injected as quoted user_context block; system prompt contains no raw user text; injection payload in stored fact cannot reach system authority
- [ ] Run RED
- [ ] Change peelPrompt to inject fuel as quoted data block below system instructions
- [ ] Update memoryStore to return typed facts only
- [ ] Run GREEN

### Task 7: App Integration And Registry-Derived Validation

**Lane:** Integration
**Files:** Modify `server/app.js`, `server/skills/bankSkill.js`, `client/src/App.jsx`

- [ ] Write tests: app derives command list from registry; bank capability from registry; client derives commands from health response
- [ ] Run RED
- [ ] Wire app validation to registry schemas
- [ ] Wire client to capability response
- [ ] Run GREEN

### Task 8: Drift Check And CI

**Lane:** Tooling
**Files:** Create `scripts/check-drift.mjs`, `.github/workflows/ci.yml`, `tests/unit/driftCheck.test.js`, Modify `skill/SKILL.md`, `Agent_System_Prompt.md`

- [ ] Write tests: drift check passes on consistent artifacts; fails on mismatch
- [ ] Run RED
- [ ] Implement check-drift script
- [ ] Align SKILL.md and Agent_System_Prompt.md with registry
- [ ] Create CI workflow
- [ ] Run GREEN + drift check

### Task 9: Full Integration And Phase 1 Gate

**Lane:** Integration
**Files:** All

- [ ] Apply all tasks in dependency order
- [ ] Run full test suite
- [ ] Run drift check
- [ ] Run client build
- [ ] Run audits
- [ ] Verify question-bank untouched
- [ ] Produce completion report

## Dependency Graph

```
Task 1 Registry ──> Task 2 Schemas ──> Task 3 Pipeline ──┐
                                                         ├─> Task 9 Integration
Task 4 Wizard ───────────────────────────────────────────┤
Task 5 Topic routing ────────────────────────────────────┤
Task 6 Memory trust ─────────────────────────────────────┤
Task 7 App integration (follows 1+2) ────────────────────┤
Task 8 Drift+CI (follows 1) ─────────────────────────────┘
```

Tasks 1, 4, 5, 6 can start in parallel. Task 2 follows 1. Task 3 follows 2. Task 7 follows 1+2. Task 8 follows 1.

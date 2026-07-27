# Phase 1 Trustworthy Skill Core Design

Status: Approved
Date: 2026-07-26

## Goal

Establish one machine-readable command registry as the single source of truth, unify the execution pipeline, fix topic routing, separate memory trust tiers, and add drift checks so skill docs, runtime, and tests never diverge.

## Scope

### In Scope

- One command registry generating skill docs, runtime routing, help text, and contract tests.
- Typed request/response schemas for all five commands.
- Unified execution pipeline shared by sync and SSE (consolidate Phase 0's parallel paths).
- Wizard explicit state machine replacing LLM-inferred phase selection.
- Topic routing fix: phrase boundaries, single-keyword match, ambiguity handling.
- Memory trust-tier separation: learner facts as quoted untrusted data, not system instructions.
- Drift check script verifying generated artifacts match their sources.
- Real CI workflow file.

### Out Of Scope

- Authentication and tenant database (Phase 2+).
- Official IELTS band calibration (Phase 2+).
- Learner curriculum and progress tracking (Phase 2+).
- Question-bank provenance annotation (user will handle separately).
- Redis/distributed rate limiting.

## Architecture

### Command Registry

Create `server/commands/registry.js` exporting one array of command definitions:

```js
{
  name: 'peel',
  aliases: [],
  description: 'Generate one PEEL paragraph',
  inputSchema: { input: 'string', required: true },
  outputContract: { peels: 'PeelUnit[]', bottomLogic: 'string' },
  requiresApiKey: true,
  requiresBank: false,
  repairable: true,
}
```

All five commands defined here. The registry is consumed by:
- `server/app.js` for request validation and routing
- `server/orchestrator.js` for command dispatch
- `skill/SKILL.md` generation (via script)
- `tests/` contract tests
- Client capability listing

### Typed Schemas

Create `server/schemas/` with:
- `request.js` - per-command request validation
- `response.js` - per-command response shape validation
- `peel.js` - PeelUnit type with layer validation

Use lightweight runtime validation (no external dependency) with clear error codes.

### Unified Pipeline

Consolidate `runCommand` and `runCommandStream` to share one core:
```
executeCommand(request, options) -> { result, events }
```
- Sync adapter calls and returns `result`.
- SSE adapter subscribes to `events` for buffered emission.
- Both use same parse -> validate -> repair -> finalize path.
- Memory store and signal injected via options.

### Wizard State Machine

Replace LLM-inferred phase with explicit states:
- `AWAITING_DETAILS`: first invocation, emit questions only
- `READY_TO_GENERATE`: user provided answers, emit scripts + routing table
- State determined by `history.length > 0` and explicit `phase` field in request, not LLM guessing.

### Topic Routing Fix

- Use word-boundary matching, not unbounded substring.
- Permit one strong exact keyword to classify (lower threshold from 3 to 2 for single strong match).
- Add `Unknown` as explicit result instead of forced Model C fallback.
- Add multi-topic detection with confidence scores.

### Memory Trust Tier

- Learner facts stored as typed `{ topic, entity, sourceQuestion, sourceAnswer, ts }` objects.
- Injected into prompts as quoted user data in a `user_context` block, not in system instructions.
- System prompt never contains raw user text.

### Drift Checks

Create `scripts/check-drift.mjs`:
- Verify `skill/SKILL.md` command table matches registry.
- Verify `Agent_System_Prompt.md` command list matches registry.
- Verify `server/systemPrompt.js` matches `Agent_System_Prompt.md`.
- Verify client command list matches registry.
- Exit non-zero on drift.

### CI Workflow

Create `.github/workflows/ci.yml`:
- Clean install
- Drift check
- Full test suite
- Client build
- Dependency audit

## Acceptance Criteria

### AC-101 Single Registry
- All five commands defined in one file.
- App, orchestrator, skill docs, and client derive command lists from registry.
- Adding a command requires editing only the registry and its implementation.

### AC-102 Typed Schemas
- Every command request is validated against a schema before execution.
- Invalid requests return `INVALID_REQUEST` with field-level detail.
- Response shapes match documented contracts.

### AC-103 Unified Pipeline
- Sync and SSE share one execution function.
- No duplicated parse/validate/repair logic.
- SSE buffers and emits only after final validation.

### AC-104 Wizard State Machine
- Phase is determined by explicit state, not LLM inference.
- `AWAITING_DETAILS` emits questions only, never persists.
- `READY_TO_GENERATE` emits scripts only after answers received.
- No raw answers enter system prompt.

### AC-105 Topic Routing
- Single strong keyword classifies correctly.
- Word-boundary matching prevents false substring matches.
- `Unknown` returned instead of forced Model C.
- Multi-topic prompts get highest-confidence match.

### AC-106 Memory Trust Tier
- Learner facts injected as quoted `user_context` data, not system instructions.
- System prompt contains no raw user text.
- Prompt injection in stored facts cannot escalate to system authority.

### AC-107 Drift Checks
- `node scripts/check-drift.mjs` passes on all generated artifacts.
- CI runs drift check and fails on mismatch.

### AC-108 Regression
- All Phase 0 tests remain green.
- New Phase 1 tests pass.
- Client build passes.
- Zero vulnerabilities.

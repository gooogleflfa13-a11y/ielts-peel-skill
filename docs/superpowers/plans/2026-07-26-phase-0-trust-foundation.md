# Phase 0 Trust Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase 0 credential, memory, output-integrity, scoring-claim, feature-exposure, and public API risks while preserving local development behavior.

**Architecture:** Add central configuration and injectable boundaries for provider access and memory. Make output parsing and validation fail closed, buffer streaming until final validation, and turn `/score` into deterministic structural feedback. Keep the question bank unchanged but disable its public capability by default.

**Tech Stack:** Node.js ES modules, Express, OpenAI SDK, React, Vite, Tailwind CSS, Vitest, Supertest.

## Global Constraints

- Public and production operation is stateless by default.
- Local JSON memory requires explicit opt-in and remains backward-compatible.
- Request-controlled `baseUrl` is rejected, not ignored.
- `/score` remains a command name but returns no examiner or band-like score.
- `/bank` files are not deleted or modified; public capability is disabled by default.
- PEEL quality failures never return `ok: true`.
- One repair attempt maximum for generative command output.
- PEEL streaming exposes no unvalidated attempt.
- No production code is written before its focused test has failed for the expected reason.
- Do not commit, push, delete, or rewrite Git history unless the user explicitly requests it.

---

## File Map

### New Files

- `server/config.js`: parse and validate server-owned configuration.
- `server/app.js`: Express app factory with injected runners/configuration.
- `server/memory/memoryStore.js`: null and local store interface/adapters.
- `server/evaluation/structuralFeedback.js`: map parse/validation results to `/score` feedback.
- `server/utils/publicErrors.js`: stable public error definitions and normalization.
- `tests/unit/config.test.js`
- `tests/unit/memoryStore.test.js`
- `tests/unit/strictPeelParser.test.js`
- `tests/unit/structuralFeedback.test.js`
- `tests/unit/publicErrors.test.js`
- `tests/integration/httpSafety.test.js`
- `tests/integration/commandQuality.test.js`
- `tests/integration/streamSafety.test.js`

### Modified Files

- `server/index.js`: startup only; use app/config factories.
- `server/utils/llmClient.js`: fixed provider URL, timeout/cancellation, retry boundary.
- `server/utils/rateLimit.js`: `req.ip`, stable 429, injectable clock.
- `server/utils/errors.js`: serialize stable public errors.
- `server/parsing/peelParser.js`: strict labels, cardinality, and ordering.
- `server/evaluation/validator.js`: exact sentence contract and named checks.
- `server/orchestrator.js`: injected memory/config, fail-closed result, buffered SSE.
- `server/skills/peelSkill.js`: shared repair and memory context.
- `server/skills/matrixSkill.js`: fail-closed matrix contract.
- `server/skills/wizardSkill.js`: fail-closed wizard contract and memory adapter.
- `server/skills/scoreSkill.js`: structural feedback only.
- `server/skills/bankSkill.js`: feature gate.
- `server/evaluation/aiScorer.js`: remove reachable examiner path.
- `client/src/App.jsx`: remove base URL and AI score request state.
- `client/src/components/ApiKeyPanel.jsx`: remove base URL field.
- `client/src/components/CommandPanel.jsx`: structural-review copy and bank capability.
- `client/src/components/EvaluationPanel.jsx`: named checks, no pseudo-score.
- `client/src/components/ResultPanel.jsx`: disclaimer and revision actions.
- `client/tailwind.config.js`: resolve content paths from config location.
- `.env.example`, `README.md`, `skill/SKILL.md`: Phase 0 product contract.

---

### Task 1: Central Configuration And Provider Lock

**Lane:** A

**Files:**
- Create: `server/config.js`
- Test: `tests/unit/config.test.js`
- Modify: `server/utils/llmClient.js`
- Test: `tests/unit/llmClient.test.js`

**Interfaces:**
- Produces: `loadConfig(env) -> ServerConfig`
- Produces: `callLLM(options, runtime)` and `streamLLM(options, runtime)` where `runtime` contains `baseUrl`, `timeoutMs`, and `signal`.

- [ ] **Step 1: Write configuration failure tests**

```js
it('requires explicit CORS origins in public mode', () => {
  expect(() => loadConfig({ APP_MODE: 'public' })).toThrow(/CORS_ORIGINS/);
});

it('rejects an insecure provider in public mode', () => {
  expect(() => loadConfig({
    APP_MODE: 'public',
    CORS_ORIGINS: 'https://app.example.com',
    PROVIDER_BASE_URL: 'http://127.0.0.1:8080/v1',
  })).toThrow(/PROVIDER_BASE_URL/);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/config.test.js`

Expected: FAIL because `server/config.js` does not exist.

- [ ] **Step 3: Implement `loadConfig`**

Required return shape:

```js
{
  appMode: 'local' | 'public',
  providerBaseUrl: string,
  upstreamTimeoutMs: number,
  corsOrigins: string[],
  trustProxyHops: number,
  metricsToken: string | null,
  enableLocalMemory: boolean,
  enablePrivateQuestionBank: boolean,
}
```

Enforce public HTTPS provider, no credentials/query/fragment, explicit CORS, and public disabling of local memory/private bank.

- [ ] **Step 4: Run configuration tests GREEN**

Run: `npm test -- tests/unit/config.test.js`

Expected: PASS.

- [ ] **Step 5: Write LLM timeout and abort tests**

Cover:

- provider URL comes only from runtime configuration
- external signal aborts the request
- deadline maps to `UPSTREAM_TIMEOUT`
- retry occurs only before a stream emits its first chunk

- [ ] **Step 6: Run LLM tests RED**

Run: `npm test -- tests/unit/llmClient.test.js`

Expected: FAIL on missing runtime contract and timeout behavior.

- [ ] **Step 7: Implement provider runtime and bounded deadline**

Use one `AbortController` per logical call, link external cancellation, and include retry backoff inside the deadline. Never retry streaming after `hasEmittedChunk === true`.

- [ ] **Step 8: Run Task 1 tests GREEN**

Run: `npm test -- tests/unit/config.test.js tests/unit/llmClient.test.js`

Expected: PASS.

---

### Task 2: Public Errors, CORS, Rate Limit, Metrics, And App Factory

**Lane:** A

**Files:**
- Create: `server/utils/publicErrors.js`
- Create: `server/app.js`
- Modify: `server/index.js`
- Modify: `server/utils/errors.js`
- Modify: `server/utils/rateLimit.js`
- Test: `tests/unit/publicErrors.test.js`
- Test: `tests/integration/httpSafety.test.js`

**Interfaces:**
- Consumes: `ServerConfig` from Task 1.
- Produces: `createApp({ config, runCommand, runCommandStream, getMetrics })`.
- Produces: `PublicError` and `normalizePublicError(error)`.

- [ ] **Step 1: Write stable-error unit tests**

```js
it('does not expose upstream details', () => {
  const error = normalizePublicError(new Error('sk-secret failed at http://internal:9000'));
  expect(JSON.stringify(error)).not.toContain('sk-secret');
  expect(JSON.stringify(error)).not.toContain('internal:9000');
  expect(error.code).toBe('INTERNAL');
});
```

- [ ] **Step 2: Run RED, implement error mapping, run GREEN**

Run: `npm test -- tests/unit/publicErrors.test.js`

Expected after implementation: PASS for all codes in the design table.

- [ ] **Step 3: Write HTTP safety tests with Supertest**

Required cases:

```js
it('rejects request-controlled baseUrl before command execution');
it('rejects aiScore=true');
it('rejects denied CORS origins');
it('does not trust spoofed X-Forwarded-For by default');
it('returns Retry-After when rate limited');
it('hides metrics when no token exists');
it('requires exact bearer token for metrics');
```

- [ ] **Step 4: Run HTTP tests RED**

Run: `npm test -- tests/integration/httpSafety.test.js`

Expected: FAIL because `createApp` and stable middleware contracts do not exist.

- [ ] **Step 5: Implement app factory and startup split**

`server/index.js` must only load configuration, create the app, listen, and log startup. `server/app.js` owns middleware and routes. Reject `baseUrl` based on property presence, not truthiness.

- [ ] **Step 6: Implement proxy-safe rate limiting and metrics auth**

Use `req.ip`, explicit `app.set('trust proxy', config.trustProxyHops)`, `Retry-After`, and timing-safe token comparison.

- [ ] **Step 7: Run Task 2 tests GREEN**

Run: `npm test -- tests/unit/publicErrors.test.js tests/integration/httpSafety.test.js`

Expected: PASS.

---

### Task 3: Memory Store Boundary And Stateless Public Mode

**Lane:** B

**Files:**
- Create: `server/memory/memoryStore.js`
- Modify: `server/memory/userMemory.js`
- Modify: `server/skills/peelSkill.js`
- Modify: `server/skills/wizardSkill.js`
- Modify: `server/orchestrator.js`
- Test: `tests/unit/memoryStore.test.js`

**Interfaces:**
- Produces: `createNullMemoryStore()`.
- Produces: `createLocalFileMemoryStore()` wrapping the existing JSON format.
- Produces methods `getRelevantFuel`, `getWeaknessReport`, `addE2Fuel`, `recordResult`.

- [ ] **Step 1: Write no-op and backward-compatibility tests**

```js
it('null store never persists or returns cross-request data', async () => {
  const store = createNullMemoryStore();
  await store.addE2Fuel({ userId: 'default' }, { sourceAnswer: 'private' });
  expect(await store.getRelevantFuel({ userId: 'default' }, 'Education')).toEqual([]);
  expect(await store.getWeaknessReport({ userId: 'default' })).toBeNull();
});

it('local store reads the existing JSON memory schema');
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/memoryStore.test.js`

Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement store adapters**

Keep existing file functions behind the local adapter. The null adapter must contain no filesystem import.

- [ ] **Step 4: Inject store into skills/orchestrator**

Remove direct file-store imports from skill modules. Generated results must distinguish agent-generation warnings from learner-authored score feedback; do not update learner weakness from generated PEEL output.

- [ ] **Step 5: Run Task 3 tests GREEN**

Run: `npm test -- tests/unit/memoryStore.test.js tests/integration/pipeline.test.js`

Expected: PASS and no `.memory` changes in null mode.

---

### Task 4: Strict Parser And Executable PEEL Contract

**Lane:** C

**Files:**
- Modify: `server/parsing/peelParser.js`
- Modify: `server/evaluation/validator.js`
- Test: `tests/unit/strictPeelParser.test.js`
- Modify: `tests/unit/peelParser.test.js`
- Modify: `tests/unit/validator.test.js`

**Interfaces:**
- Produces parse result `{ ok, peels, issues, code }`.
- Produces validation with `passed`, named checks, issues, and compatibility summary fields only where still needed by the UI migration.

- [ ] **Step 1: Write parser mutation tests**

Cover exactly:

- valid uppercase labels
- valid lowercase labels normalized to uppercase
- duplicate labels rejected
- reordered labels rejected
- missing labels rejected
- unknown extra labels rejected
- two PEEL units parsed only when both are independently valid
- metadata boundaries do not enter L

- [ ] **Step 2: Run parser tests RED**

Run: `npm test -- tests/unit/strictPeelParser.test.js`

Expected: existing parser accepts or corrupts several invalid cases.

- [ ] **Step 3: Implement strict ordered parsing**

Parse marker tokens in document order, normalize labels, split units only at a new P after a complete L, and fail on any cardinality/order violation.

- [ ] **Step 4: Write exact-sentence validator tests**

Cover one sentence per layer, one causal connector in P, two sentences in L, weak E2, and missing layer behavior.

- [ ] **Step 5: Run validator tests RED**

Run: `npm test -- tests/unit/validator.test.js`

Expected: current validator passes at least the causal-P and two-sentence-L fixtures.

- [ ] **Step 6: Implement named checks and exact sentence boundaries**

Keep deterministic scope explicit: structural checks are not official IELTS assessment. Return actionable issues with `layer`, `code`, `evidence`, and `action`.

- [ ] **Step 7: Run Task 4 tests GREEN**

Run: `npm test -- tests/unit/strictPeelParser.test.js tests/unit/peelParser.test.js tests/unit/validator.test.js`

Expected: PASS.

---

### Task 5: Shared Repair Policy And Buffered Streaming

**Lane:** C

**Files:**
- Modify: `server/orchestrator.js`
- Modify: `server/skills/peelSkill.js`
- Modify: `server/skills/matrixSkill.js`
- Modify: `server/skills/wizardSkill.js`
- Test: `tests/integration/commandQuality.test.js`
- Test: `tests/integration/streamSafety.test.js`

**Interfaces:**
- Consumes strict parse/validation from Task 4.
- Produces final command disposition `success | quality_failed`.
- Produces buffered SSE completion without rejected chunks.

- [ ] **Step 1: Write command repair tests**

Use injected fake LLM responses:

```js
it('repairs malformed PEEL exactly once');
it('returns QUALITY_FAILED after invalid repair');
it('does not return ok:true for empty provider output');
it('fails matrix when required PEEL count is wrong');
it('fails wizard generation when required scripts are malformed');
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/integration/commandQuality.test.js`

Expected: malformed/empty outputs currently bypass or survive repair.

- [ ] **Step 3: Implement shared finalization helper**

Create one internal helper that receives command-specific parse/validate functions, performs at most one repair, and returns either success or a stable quality failure.

- [ ] **Step 4: Write streaming transcript tests**

Assert:

- invalid first attempt emits no chunk
- successful repaired answer appears once
- final failure emits only stable error
- disconnect aborts fake provider

- [ ] **Step 5: Run stream tests RED**

Run: `npm test -- tests/integration/streamSafety.test.js`

Expected: current implementation exposes invalid/duplicated content.

- [ ] **Step 6: Implement buffered SSE**

Accumulate provider output internally, apply the same finalization contract, then emit final content once. Link request close to the command abort signal.

- [ ] **Step 7: Run Task 5 tests GREEN**

Run: `npm test -- tests/integration/commandQuality.test.js tests/integration/streamSafety.test.js`

Expected: PASS.

---

### Task 6: PEEL Structural Feedback And AI Score Shutdown

**Lane:** D

**Files:**
- Create: `server/evaluation/structuralFeedback.js`
- Modify: `server/skills/scoreSkill.js`
- Modify: `server/evaluation/aiScorer.js`
- Modify: `server/orchestrator.js`
- Test: `tests/unit/structuralFeedback.test.js`
- Modify: `client/src/components/EvaluationPanel.jsx`
- Modify: `client/src/components/ResultPanel.jsx`
- Modify: `client/src/components/CommandPanel.jsx`

**Interfaces:**
- Produces `buildStructuralFeedback(parseResult, validation)` matching the approved score JSON contract.

- [ ] **Step 1: Write structural-feedback tests**

```js
it('returns no_issues_detected with disclaimer for valid PEEL');
it('returns issues_found with evidence and action');
it('returns unparseable for malformed input');
it('never returns numeric scores, semantic fields, examiner, or band text');
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/structuralFeedback.test.js`

Expected: current score response exposes validation score and optional semantic band-like values.

- [ ] **Step 3: Implement feedback builder and score command**

Make structural feedback deterministic. Remove calls to `aiSemanticScore`; retain the file only as unreachable/deprecated until cleanup, or delete it if import search proves no consumers remain.

- [ ] **Step 4: Update UI copy and rendering**

Use `PEEL Structure Review` / `PEEL 结构反馈`, named pass/fail checks, issue evidence, revision action, and disclaimer. Remove AI score toggle/panels.

- [ ] **Step 5: Run Task 6 tests GREEN**

Run: `npm test -- tests/unit/structuralFeedback.test.js`

Expected: PASS.

---

### Task 7: Bank Capability Gate And Product Contract

**Lane:** D

**Files:**
- Modify: `server/skills/bankSkill.js`
- Modify: `server/orchestrator.js`
- Modify: `server/app.js`
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/CommandPanel.jsx`
- Modify: `skill/SKILL.md`
- Modify: `README.md`
- Modify: `.env.example`
- Test: `tests/integration/httpSafety.test.js`
- Test: `tests/unit/questionBank.test.js`

**Interfaces:**
- Consumes `enablePrivateQuestionBank` configuration.
- Produces capability list omitting bank when disabled.

- [ ] **Step 1: Write bank gate tests**

```js
it('omits bank from public capabilities');
it('returns FEATURE_DISABLED for public bank requests');
it('retains existing local bank behavior when explicitly enabled');
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/integration/httpSafety.test.js tests/unit/questionBank.test.js`

Expected: bank remains available by default.

- [ ] **Step 3: Implement capability gate**

Do not edit, move, delete, or reformat question-bank data. Gate command routing and UI visibility only.

- [ ] **Step 4: Update public claims and configuration docs**

Document:

- PEEL is an argument-development scaffold
- structural feedback is not official assessment
- public mode is stateless
- bank requires explicit local enablement
- provider URL is server-configured

- [ ] **Step 5: Run claim scan**

Search public product surfaces for reachable examiner/band claims and remove current claims while preserving dated audit reports as historical evidence.

- [ ] **Step 6: Run Task 7 tests GREEN**

Run: `npm test -- tests/integration/httpSafety.test.js tests/unit/questionBank.test.js`

Expected: PASS.

---

### Task 8: Client Provider Cleanup And Tailwind Build Fix

**Lane:** D

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/ApiKeyPanel.jsx`
- Modify: `client/tailwind.config.js`
- Modify: `.env.example`

**Interfaces:**
- Client requests no longer contain `baseUrl` or `aiScore`.

- [ ] **Step 1: Add source-level client contract assertions**

Extend a focused test or static contract test to assert request payloads omit `baseUrl` and `aiScore`, and disabled bank is absent.

- [ ] **Step 2: Run RED**

Expected: current App sends both fields and renders base URL configuration.

- [ ] **Step 3: Remove fields and session storage keys**

Keep API key session-only behavior unchanged in Phase 0. Provider selection becomes server-owned.

- [ ] **Step 4: Fix Tailwind content paths**

Resolve globs relative to `client/tailwind.config.js`, not the shell working directory. Required inputs are `client/index.html` and `client/src/**/*.{js,ts,jsx,tsx}`.

- [ ] **Step 5: Verify client build**

Run: `node client/node_modules/vite/bin/vite.js build --config client/vite.config.js`

Expected: build succeeds with no Tailwind content warning and generated CSS includes application utility classes.

---

### Task 9: Integration And Phase 0 Release Gate

**Lane:** Integration

**Files:**
- Review all Phase 0 changes.
- Update existing tests whose old assertions conflict with the approved contract.
- Do not modify question-bank data.

**Interfaces:**
- Integrates Tasks 1-8.

- [ ] **Step 1: Apply lane patches in dependency order**

Order: Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5 -> Task 6 -> Task 7 -> Task 8.

- [ ] **Step 2: Resolve shared-file conflicts by contract**

Shared files include `server/orchestrator.js`, `server/app.js`, `client/src/App.jsx`, and `CommandPanel.jsx`. Preserve all approved security defaults and fail-closed behavior.

- [ ] **Step 3: Run focused security and contract suites**

Run:

```bash
npm test -- \
  tests/unit/config.test.js \
  tests/unit/memoryStore.test.js \
  tests/unit/strictPeelParser.test.js \
  tests/unit/structuralFeedback.test.js \
  tests/unit/publicErrors.test.js \
  tests/integration/httpSafety.test.js \
  tests/integration/commandQuality.test.js \
  tests/integration/streamSafety.test.js
```

Expected: PASS.

- [ ] **Step 4: Run full regression suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Run dependency audits**

Run:

```bash
npm audit --omit=dev --prefix server
npm audit --omit=dev --prefix client
```

Expected: no high or critical vulnerabilities.

- [ ] **Step 6: Run production build**

Run: `node client/node_modules/vite/bin/vite.js build --config client/vite.config.js`

Expected: success with no Tailwind content warning.

- [ ] **Step 7: Verify protected assets and clean scope**

Confirm:

- no question-bank file changed
- no `.memory` file changed or created by public tests
- no API key/base URL/provider body appears in test logs
- audit and unrelated untracked files remain untouched

- [ ] **Step 8: Produce Phase 0 completion report**

Report each acceptance criterion as pass/fail with command evidence, list residual Phase 1 risks, and do not claim production readiness beyond controlled testing.

---

## Dependency Graph

```text
Task 1 Provider config ──> Task 2 HTTP safety ─┐
                                               ├─> Task 9 Integration
Task 3 Memory policy ──────────────────────────┤
                                               │
Task 4 Parser/validator ─> Task 5 Repair/SSE ──┤
                                               │
Task 6 Score contract ─────────────────────────┤
Task 7 Bank/product contract ──────────────────┤
Task 8 Client/build ───────────────────────────┘
```

Tasks 1, 3, 4, and 6 can start in parallel. Task 2 follows Task 1. Task 5 follows Task 4. Tasks 7 and 8 can run together in Lane D after Task 6 establishes the product wording.

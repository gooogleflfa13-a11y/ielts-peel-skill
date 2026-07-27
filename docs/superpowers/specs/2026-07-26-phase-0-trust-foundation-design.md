# Phase 0 Trust Foundation Design

Status: Approved
Date: 2026-07-26

## Goal

Make the project safe enough for controlled internal/customer testing by closing credential, memory, output-integrity, scoring-claim, and public-exposure risks without introducing full authentication or deleting the question bank.

## Scope

### In Scope

- Pin provider base URL to server configuration.
- Reject request-controlled provider URLs.
- Add upstream deadline and request cancellation.
- Prevent retries after streaming output becomes externally visible.
- Disable persistent learner memory by default in public/production mode.
- Preserve explicit local JSON persistence for local development.
- Make PEEL parsing strict and validation fail closed.
- Apply one bounded repair attempt to malformed or invalid generative output.
- Buffer PEEL streaming until final validation.
- Reposition `/score` as deterministic PEEL structural feedback.
- Disable examiner-style AI scoring and band-like values.
- Disable `/bank` publicly by default while retaining local opt-in access.
- Require production CORS allowlist.
- Stop trusting raw `X-Forwarded-For`.
- Protect or disable metrics by default.
- Return stable public error codes without provider internals.
- Add test-first coverage for every changed trust boundary.

### Out Of Scope

- Full user authentication or tenant database.
- Migration of existing `.memory/*.json` to user accounts.
- Official IELTS band calibration.
- Complete official Writing/Speaking rubrics.
- Question-bank provenance or license annotation.
- Git history rewriting or deletion of question-bank data.
- Redis/distributed rate limiting.
- Full Phase 1 command-registry consolidation.
- Full Phase 2 learner curriculum and progress tracking.

## Product Decisions

1. Public and production operation is stateless by default.
2. Local persistence is an explicit opt-in capability.
3. Existing `userId` input remains temporarily accepted for compatibility but is ignored by the null store.
4. `/score` remains as a command name but means PEEL Structure Review only.
5. `aiScore=true` is rejected during Phase 0.
6. `/bank` remains in source but is disabled unless explicitly enabled for local use.
7. The question bank is not deleted or moved in Phase 0.
8. Sync PEEL generation and SSE use the same final output contract.

## Architecture

### Configuration

Add a central server configuration module with fail-fast parsing:

```text
PROVIDER_BASE_URL=https://api.openai.com/v1
UPSTREAM_TIMEOUT_MS=30000
APP_MODE=local|public
ENABLE_LOCAL_MEMORY=false
ENABLE_PRIVATE_QUESTION_BANK=false
CORS_ORIGINS=https://app.example.com
TRUST_PROXY_HOPS=0
METRICS_TOKEN=
```

Rules:

- Production/public mode requires an explicit CORS allowlist.
- Production/public mode rejects local-file memory.
- Provider URL is server-owned. Public production requires HTTPS and no credentials, query, or fragment.
- Metrics are unavailable when no metrics token is configured.

### Memory Boundary

Introduce:

```text
MemoryStore
  getRelevantFuel(context, topicId)
  getWeaknessReport(context)
  addE2Fuel(context, fact)
  recordResult(context, result)

NullMemoryStore
LocalFileMemoryStore
```

All skill modules receive the selected store through execution context. They no longer import file persistence directly.

`NullMemoryStore` returns no fuel or weakness report and performs no writes. Existing files remain untouched.

### Strict PEEL Contract

The parser returns either:

```text
{ ok: true, peels: [...] }
```

or:

```text
{ ok: false, code, issues, peels: [] }
```

For each PEEL unit:

- P, E1, E2, and L appear exactly once.
- Labels appear in order.
- No duplicate labels are accepted.
- No missing labels are accepted.
- Four-sentence mode requires one sentence per layer.

Generative commands use a shared result policy:

1. Parse.
2. Validate.
3. If invalid, perform one repair attempt with structured issues.
4. Parse and validate again.
5. If still invalid, return `ok: false`, `status: quality_failed`.

### Streaming

Phase 0 uses buffered PEEL streaming:

- Provider chunks are accumulated server-side.
- No content chunk is exposed before final validation.
- After validation succeeds, the server may emit the final content and completion event.
- If validation fails, only a stable quality error is emitted.
- Client disconnect aborts provider work and repair backoff.

This intentionally prioritizes correctness over token-by-token immediacy.

### Score Contract

`/score` returns deterministic structural feedback:

```json
{
  "command": "score",
  "feedback": {
    "scope": "peel_structure_only",
    "status": "no_issues_detected|issues_found|unparseable",
    "checks": {
      "labels": "pass|fail",
      "layerBoundaries": "pass|fail",
      "e2Concreteness": "pass|fail",
      "linkClosure": "pass|fail",
      "bannedGlue": "pass|fail"
    },
    "issues": []
  },
  "disclaimer": "PEEL structure feedback only. Not an official IELTS assessment or band estimate."
}
```

No P/E1/E2/L numeric band score, overall score, or examiner impersonation remains reachable.

### Bank Capability

- `ENABLE_PRIVATE_QUESTION_BANK=false` by default.
- Public mode always disables the bank.
- Disabled `/bank` requests return `FEATURE_DISABLED`.
- Health and client command surfaces omit bank when disabled.
- Local mode may enable the existing bank explicitly.
- Existing question-bank files remain unchanged.

### Public API Safety

- Request bodies containing `baseUrl` return `400 PROVIDER_URL_NOT_ALLOWED`.
- Rate limiting uses Express `req.ip` after explicit proxy configuration.
- Excess requests return stable `429 RATE_LIMITED` plus `Retry-After`.
- Metrics require a bearer token or remain unavailable.
- CORS denied origins receive a stable public error.
- Upstream errors map to fixed codes and messages.
- Provider URLs, response bodies, API keys, headers, and stack traces are not returned.

## Stable Error Codes

| Condition | Status | Code |
|---|---:|---|
| Request provider URL | 400 | `PROVIDER_URL_NOT_ALLOWED` |
| AI scoring requested | 400 | `AI_SCORE_DISABLED` |
| Disabled bank | 403 | `FEATURE_DISABLED` |
| Invalid input/schema | 400 | `INVALID_REQUEST` |
| Parse/quality failure | 422 | `QUALITY_FAILED` |
| Disallowed CORS origin | 403 | `CORS_FORBIDDEN` |
| Rate limit | 429 | `RATE_LIMITED` |
| Metrics auth | 401 | `METRICS_UNAUTHORIZED` |
| Provider auth | 401 | `PROVIDER_AUTH_FAILED` |
| Provider rate limit | 429 | `UPSTREAM_RATE_LIMITED` |
| Provider timeout | 504 | `UPSTREAM_TIMEOUT` |
| Provider/network failure | 502 | `UPSTREAM_UNAVAILABLE` |
| Unknown internal error | 500 | `INTERNAL` |

## Acceptance Criteria

### AC-001 Provider Lock

- A request containing `baseUrl` is rejected before command or network execution.
- API keys are sent only to the configured provider origin.

### AC-002 Stateless Public Memory

- Public/production mode creates or modifies no `.memory` file.
- Independent requests cannot observe previous fuel or weakness data.
- Local opt-in mode continues to read/write the existing JSON format.

### AC-003 Strict Parsing

- Missing, duplicate, reordered, lowercase-variant mishandling, malformed, and extra PEEL labels are covered by tests.
- Invalid structures never become successful normalized PEEL units.

### AC-004 Fail-Closed Quality

- Invalid first output causes exactly one repair attempt.
- Invalid repaired output returns `QUALITY_FAILED` and never `ok: true`.
- Matrix and wizard command-specific required structures fail closed.

### AC-005 Safe Streaming

- Rejected attempts are never emitted to clients.
- A partial provider failure cannot duplicate visible prefixes.
- Disconnect aborts outstanding provider work.

### AC-006 Structural Review Only

- `/score` returns no numeric score, semantic score, examiner role, or band claim.
- `aiScore=true` returns `AI_SCORE_DISABLED`.
- Every response includes the structural-feedback disclaimer.

### AC-007 Bank Default Disabled

- Bank is absent from public health/client capability lists.
- `/bank` returns `FEATURE_DISABLED` when not explicitly enabled.
- Local opt-in mode retains existing bank behavior.

### AC-008 Public Middleware

- Production startup fails without explicit CORS origins.
- Spoofed `X-Forwarded-For` does not bypass limits with proxy trust disabled.
- Metrics are unavailable without a configured token and reject incorrect tokens.

### AC-009 Stable Errors

- Public responses never contain injected API keys, provider response bodies, provider URLs, or stack traces.
- All expected provider failures map to documented error codes.

### AC-010 Regression

- Existing deterministic tests remain green after contract updates.
- New security, parser, validator, memory, score, bank, streaming, and HTTP tests pass.
- Client production build emits complete Tailwind styles without content warnings.

## Parallel Lane Ownership

| Lane | Write Surface | Main Tests |
|---|---|---|
| A: Provider/public safety | config, app/index, LLM client, errors, rate limit | HTTP safety, LLM timeout/error, rate limit |
| B: Memory policy | memory store modules, skill injection points | null/local store, no public writes, isolation |
| C: Output integrity | parser, validator, orchestrator/stream | parser mutations, repair exhaustion, SSE transcript |
| D: Product claims/features | score, bank gate, client/docs | score contract, bank disabled/local, claim scan |

Lanes must use isolated worktrees and must not edit another lane's files. Integration resolves shared orchestration/index changes after lane review.

## Verification

Required before Phase 0 completion:

1. Focused tests for each lane pass.
2. Full `npm test` passes.
3. Client build passes with no Tailwind content warning.
4. Security regression tests pass.
5. Public capability/claim scan passes.
6. Git diff contains no question-bank deletion or modification.

## Rollback

- Phase 0 changes are code/config only; no persistent-data migration occurs.
- Existing `.memory` files and question-bank files remain untouched.
- Local memory and bank behavior can be restored through explicit local configuration.
- Public safety defaults must not be weakened during rollback.

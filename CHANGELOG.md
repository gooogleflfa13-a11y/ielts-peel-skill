# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-08-03 (release candidate)

### Added

- **Semantic quality layer** (`server/evaluation/semanticChecks.js`): six deterministic
  rules after the structural gate — `P_TOPIC_ANCHOR`, `UNSUPPORTED_ATTRIBUTION`,
  `ENTITY_PILE`, `CIRCULAR_MECHANISM`, `ABSOLUTE_GROUP_CLAIM`, `OFF_TOPIC_EVIDENCE`.
- **Executable contract layer**: `contracts/commands.json` (peel / matrix / review +
  excluded coach/private capabilities), workflow docs under
  `skill/references/workflows/`, engine library `packages/core`, and the
  `peel-hacker` CLI (`packages/cli`) with `classify` / `review` / `generate`.
- **Evaluation regression gate**: `evals/metrics.mjs` + `tests/unit/evalCorpus.test.js`
  assert the product quality thresholds inside `npm test` (topicMacroF1 ≥ 0.85,
  semanticFalseAcceptRate ≤ 0.1, revisionTargetResolutionRate ≥ 0.85).
- **Contracts drift detection**: `scripts/check-drift.mjs` now also verifies
  contracts/commands.json aligns with the runtime registry and workflow files.
- `/score` now documents the alias `/review` in the registry and skill docs.

### Changed

- `topicRetriever` classifies plural prompt nouns via stemming (`schools` → Education)
  while keeping per-word word boundaries (`apple` never matches `app`).
- Keywords extended: `transport` (Urbanization), `community` (Society),
  `offender` (Crime), `patient` (Health).
- Validator fixes: E1 entity checks no longer false-hit abstract words; E2 concreteness
  is stem-tolerant (plurals) with an expanded indicator table; `P_CAUSAL_CHAIN`
  exempts evaluative "X is valuable because …" stances.
- Test suite grew from 335 to 373 tests across 42 files; `vitest` global timeout 15s.

### Evaluation metrics (project-authored corpus, 306 items)

| Metric | Before | After |
|---|---|---|
| topicMacroF1 | 0.80 | 1.0 |
| validatorPrecision | 0.12 | 1.0 |
| validatorRecall | 0.36 | 1.0 |
| semanticFalseAcceptRate | 0.475 | 0.0 |
| revisionTargetResolutionRate | 0.167 | 0.907 |

## [2.0.0-alpha] - 2026-07-27

- Phase 2: learner onboarding, `/learn` modes (practice/hint/model/compare/revise),
  criterion feedback, versioned attempts, privacy API, Writing/Speaking separation.

## [1.x] - 2026-07-26

- Phase 0: provider lock, stateless public memory, fail-closed quality gate,
  structural `/score`, bank gating, public API safety.
- Phase 1: command registry, typed schemas, unified pipeline, wizard state machine,
  topic routing fix, memory trust tier, drift checks, CI workflow.

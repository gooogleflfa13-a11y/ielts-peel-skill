<img width="1200" alt="IELTS PEEL Hacker banner animation" src="banner.gif?20260727" />

# IELTS PEEL Hacker

[![CI](https://github.com/gooogleflfa13-a11y/ielts-peel-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/gooogleflfa13-a11y/ielts-peel-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code%20license-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./CHANGELOG.md)

IELTS PEEL Hacker is an open-source argument-development tool for IELTS Writing Task 2 and Speaking Part 3. It turns an argument into a constrained `[P] -> [E1] -> [E2] -> [L]` structure and provides a tested local runtime for parsing, validation, revision and learning workflows.

> Independent project. Not affiliated with, approved by or endorsed by IELTS, the British Council, IDP Education or Cambridge University Press & Assessment. “IELTS” is used only to describe the exam context.

Current repository version: **2.0.0**. Until a `v2.0.0` Git tag and GitHub Release are published from a green CI run, treat this branch as a release candidate.

## What is the product?

The repository deliberately separates three surfaces:

| Surface | Purpose | What it actually provides |
|---|---|---|
| [`skill/`](./skill/) | Portable Agent Skill | A `SKILL.md` protocol and reference files interpreted by a compatible agent host |
| [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) | Raw prompt protocol | Instructions that can be pasted into a model system-message field; it does not execute the JavaScript validator |
| `client/` + `server/` | Local BYOK playground | Executable API/UI, deterministic validation, safety boundaries, local learning state and automated tests |

The Agent Skill is more than a single prompt file, but it is not the same thing as the local JavaScript runtime. A host that reads `SKILL.md` does not automatically gain the server's parser, validator, storage or HTTP controls.

## Capability matrix

| Capability | Agent Skill / raw prompt | Local playground | Evaluation boundary |
|---|---:|---:|---|
| `/peel` argument generation | Yes, model-executed | Yes, model + parser + quality gate | Structure and argument development only |
| `/matrix` transfer practice | Yes, model-executed | Yes, model + contract checks | Heuristic transfer aid |
| `/wizard` personal detail scaffolding | Yes, host conversation state | Yes, explicit state machine | User details are untrusted input |
| `/score` (alias `/review`) | Prompt-guided review | Deterministic structural checks | Not an IELTS score or band prediction |
| `/learn practice/hint/model/compare/revise` | Host-dependent | Runtime implementation | Formative feedback; not examiner-calibrated |
| `/bank` | Not part of the licensed public product | Disabled by default | Source material remains quarantined pending rights review |

### Quality gate and evaluation

The runtime applies a **two-layer deterministic quality gate** (zero LLM tokens) before any generated output is returned:

- **Structural layer** (`server/evaluation/validator.js`): labels, layer boundaries, E2 concreteness, link closure and banned discourse glue.
- **Semantic layer** (`server/evaluation/semanticChecks.js`): six heuristic rules that catch topic-less/absurd points, fabricated statistics, entity piles, circular mechanisms, categorical demographic claims and off-topic evidence (prompt-aware).

A project-authored evaluation corpus ([`evals/`](./evals/)) of 306 items gates the product's quality contract inside `npm test` (and `node scripts/run-evals.mjs`): `topicMacroF1 >= 0.85`, `semanticFalseAcceptRate <= 0.1`, `revisionTargetResolutionRate >= 0.85`.

### Evaluation limitations

- Criterion-oriented feedback is formative and has not been calibrated against blinded ratings from qualified IELTS teachers or examiners.
- It does not assess a complete essay or speaking performance and does not produce an official or predicted band score.
- Generated examples may be plausible but are not automatically fact-checked. Users must verify factual claims and citations.
- Pronunciation cannot be validly assessed from text alone.
- The evaluation corpus is project-authored synthetic data, not teacher-calibrated.

## Install the Agent Skill

Clone the repository, then choose an explicit destination. Normal dependency installation and builds never write to your home directory.

```bash
git clone https://github.com/gooogleflfa13-a11y/ielts-peel-skill.git
cd ielts-peel-skill

# Generic filesystem-based host, project-scoped
mkdir -p .agents/skills/ielts-peel-skill
cp -R skill/. .agents/skills/ielts-peel-skill/

# Explicit user-wide installers
npm run install:skill:agents
# or
npm run install:skill:grok
```

The installer commands copy into `~/.agents/skills/ielts-peel-skill` or `~/.grok/skills/ielts-peel-skill`. Review the destination before running them. Host conventions differ, so consult the host's own skill-loading documentation.

To use only the raw protocol, paste [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) into a model's system-message field. Reference JSON files are not automatically available in this mode.

## Run the local playground

Requirements: Node.js 20 or 22 and npm 10 or newer.

```bash
npm run bootstrap
npm run dev
```

Open:

- UI: <http://localhost:5173>
- API health check: <http://localhost:3001/api/health>

The browser accepts a BYOK API key and sends it to the local server, which forwards it only to the server-configured provider URL. The key is stored in browser `sessionStorage` for the current tab session; do not use the playground on an untrusted or shared machine.

The application reads environment variables from the process environment. It does **not** automatically load a root `.env` file. For example:

```bash
APP_MODE=local \
PROVIDER_BASE_URL=https://api.openai.com/v1 \
CORS_ORIGINS=http://localhost:5173 \
npm run dev
```

See [`docs/SYSTEM_MANUAL.md`](./docs/SYSTEM_MANUAL.md) for the complete configuration and API contract.

## Basic use

```text
/peel Some people think online education can replace traditional classrooms.

/matrix community relationships are weaker than in the past

/wizard education and technology

/score
[P] ...
[E1] ...
[E2] ...
[L] ...

/learn practice Some people think online education can replace traditional classrooms.
```

A valid PEEL unit has exactly four labeled sentences:

```text
[P] Abstract position or verdict.
[E1] One-directional causal mechanism.
[E2] Concrete person, place, object or observable action.
[L] One-sentence return to the point without a new claim.
```

## CLI

The repository ships an executable contract layer (`packages/`): a deterministic engine library and a `peel-hacker` CLI that reuses the same single-source implementations as the HTTP API. No server or API key is needed for the deterministic commands.

```bash
# Topic classification (plural-aware, e.g. "schools" -> Education)
npm run peel-hacker -- classify "Some people think schools should receive more investment."

# Deterministic PEEL review (structure + semantics); exit 0 = clean, 1 = issues found
npm run peel-hacker -- review --prompt "community change" "<peel text>"
printf '%s' "<peel text>" | npm run peel-hacker -- review -

# Generate one validated PEEL via the LLM (requires an API key)
npm run peel-hacker -- generate "online education vs campus" --api-key sk-...
```

The CLI's `generate` runs the full pipeline (classify -> context -> generate -> two-layer quality gate -> at most one repair) and exits non-zero when the output fails the contract.

## Architecture

```text
Agent host ----------------------> skill/SKILL.md + references

Browser -> Express app -> request schema -> sanitize -> command registry
                                      -> command implementation
                                      -> parse + two-layer validate + one repair
                                      -> response schema -> browser

CLI / library  -> packages/cli (peel-hacker) -> packages/core -> same server modules
Contracts      -> contracts/commands.json + skill/references/workflows/*.md
```

Important sources of truth:

- `server/commands/registry.js`: runtime command registry (single source of truth for commands).
- `Agent_System_Prompt.md`: source for generated system-prompt artifacts.
- `contracts/commands.json`: public command contract (peel/matrix/review) referencing workflow docs.
- `skill/`: canonical distributable skill directory.
- `scripts/check-drift.mjs`: checks command surfaces, generated prompts and the contracts file stay aligned.

All generated output passes a two-layer quality gate; `score`/`review` is deterministic (no LLM), while `peel`/`matrix`/`wizard`/`learn model` run through the gate with at most one repair attempt before a `quality_failed` response.

The checked-in `.grok/` tree is a development mirror, not a second product source. Regenerate it explicitly with `npm run sync:skill:repo-mirror`; do not edit it by hand.

> The pre-Phase-0 proposal in [`docs/EVOLUTION_BLUEPRINT.md`](docs/EVOLUTION_BLUEPRINT.md) is retained as a **historical architecture blueprint** for decision history only. It describes obsolete AI-examiner and numeric-scoring designs; the current product contract is defined by `docs/SYSTEM_MANUAL.md` and the approved Phase 0/1/2 specs under `docs/superpowers/specs/`.

## Security and privacy

- Public mode requires an explicit CORS allowlist and disables local memory and the private question-bank capability.
- Request payloads cannot select the upstream provider URL.
- API keys are removed from structured application logs.
- Invalid generated output is not returned as a successful validated result.
- Streaming output is buffered until validation completes.
- Local learning data can be exported with `GET /api/learner/export` and removed with `DELETE /api/learner/data`.
- The local learner identifier is not an authentication mechanism. Do not expose local-memory mode as a multi-tenant public service.

Please report vulnerabilities through the process in [`SECURITY.md`](./SECURITY.md). Do not include real API keys, learner data or proprietary exam material in an issue.

## Content and licensing

Source code is licensed under the [MIT License](./LICENSE). Original documentation and examples, third-party names and quarantined question-bank material have separate terms described in [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md) and [`NOTICE.md`](./NOTICE.md).

Question-bank files marked as extracted from a local PDF warehouse are **not licensed for redistribution or commercial use** by this project. They must be excluded from public release artifacts until provenance and permissions are documented. Do not submit copied commercial study material or recalled live exam content.

## Development

```bash
# Reproducible dependency install for all three packages
npm run bootstrap

# Verify generated prompt and command surfaces
node scripts/check-drift.mjs

# Run the complete test suite
npm test

# Build generated prompt artifacts and the client
npm run build
```

`npm run build` only writes inside the repository. User-wide skill installation is always a separate explicit command.

The last local verification completed **373 tests across 42 test files**, including the evaluation-corpus regression gate (the corpus metrics are asserted inside `npm test`, so quality cannot silently regress) and the contracts/registry/workflow drift checks.

For contribution rules, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Security reports: see [`SECURITY.md`](./SECURITY.md). Content and license details: [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md) and [`NOTICE.md`](./NOTICE.md).

## Release checklist

A public release is ready only when:

1. CI passes on supported Node versions.
2. `node scripts/check-drift.mjs` passes (command surfaces, prompts, contracts) and the worktree is clean.
3. Package and API versions agree on `2.0.0`.
4. The release artifact contains the canonical `skill/` package and excludes unlicensed/quarantined content.
5. The changelog is final, the commit is tagged `v2.0.0`, and release notes state the evaluation limitations.

## 中文简介

IELTS PEEL Hacker 是一个面向雅思写作 Task 2 与口语 Part 3 的论证训练工具。它包含三层交付：可移植 Agent Skill、可复制的系统协议，以及带解析、校验、隐私边界和测试的本地 Web playground。

请特别注意：

- 它不是官方 IELTS 产品，也未获 British Council、IDP 或 Cambridge 背书。
- `/score`（别名 `/review`）和 criterion feedback 只做形成性结构反馈，不预测 Band 分数。
- 生成输出须通过结构+语义双层质量门；评估语料为项目自建合成数据，未做教师校准。
- 普通安装与构建不会写入用户主目录；只有 `install:skill:*` 会显式复制到用户级 Skill 目录。
- 来源仍在核验的题库不属于已授权公开产品，不得用于公开发行或商业用途。
- 公开发布前必须以 CI、版权清理、版本 Tag 和 release artifact 为准，而不是以 README 声明为准。

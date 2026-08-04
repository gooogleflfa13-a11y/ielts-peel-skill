<img width="1200" alt="IELTS PEEL Hacker banner animation" src="banner.gif?20260727" />

# IELTS PEEL Hacker

**Language:** English | [中文](./README.zh-CN.md)

[![CI](https://github.com/mixxmax/ielts-peel-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/mixxmax/ielts-peel-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code%20license-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./CHANGELOG.md)

IELTS PEEL Hacker is an open-source argument-development tool for **IELTS Writing Task 2** and **Speaking Part 3**. It locks every argument into a constrained `[P] -> [E1] -> [E2] -> [L]` causal chain and enforces it with a deterministic, testable quality gate.

> Independent project. Not affiliated with, approved by or endorsed by IELTS, the British Council, IDP Education or Cambridge University Press & Assessment. "IELTS" is used only to describe the exam context.

Current repository version: **2.0.0** (tagged `v2.0.0`). All metrics below are green on the latest commit.

---

## Table of contents

1. [What is the product?](#what-is-the-product)
2. [How to use it](#how-to-use-it)
3. [Command reference](#command-reference)
4. [Quality gate & evaluation](#quality-gate--evaluation)
5. [Architecture](#architecture)
6. [Security & privacy](#security--privacy)
7. [Development](#development)
8. [Content & licensing](#content--licensing)
9. [中文简介](#中文简介)

---

## What is the product?

The repository deliberately separates three surfaces:

| Surface | Purpose | What it actually provides |
|---|---|---|
| [`skill/`](./skill/) | Portable Agent Skill | A `SKILL.md` protocol and reference files interpreted by a compatible agent host (Claude, Grok, Cursor, ...) |
| `client/` + `server/` | Local BYOK playground | Executable API/UI, deterministic validation, safety boundaries, local learning state and automated tests |
| `packages/` | Executable contract layer | `packages/core` engine library + `packages/cli` (`peel-hacker` command) reusing the same single-source implementations as the HTTP API |

Every generated argument must pass a **two-layer deterministic quality gate** (zero LLM tokens) before it reaches the user. The product ships with a 320-item evaluation corpus whose seven metrics are asserted inside `npm test`, so quality cannot silently regress.

## How to use it

There are three ways to use the tool. Pick the one that fits your workflow.

### 1. As an Agent Skill (in an AI chat)

Clone the repository, then install the skill into your agent host:

```bash
git clone https://github.com/mixxmax/ielts-peel-skill.git
cd ielts-peel-skill

# Generic filesystem-based host, project-scoped
mkdir -p .agents/skills/ielts-peel-skill
cp -R skill/. .agents/skills/ielts-peel-skill/

# Or use the explicit installers
npm run install:skill:agents   # -> ~/.agents/skills/ielts-peel-skill
npm run install:skill:grok     # -> ~/.grok/skills/ielts-peel-skill
```

Then just chat: `Some people think online education can replace traditional classrooms. Do you agree?` or type a slash command (`/peel`, `/matrix`, `/wizard`, `/score`, `/learn`).

To use only the raw protocol without a skill host, paste [`skill/references/SYSTEM_PROMPT.md`](./skill/references/SYSTEM_PROMPT.md) into a model's system-message field.

### 2. As a local playground (Web UI + API)

Requirements: Node.js 20 or 22, npm 10+.

```bash
npm run bootstrap
npm run dev
```

- UI: <http://localhost:5173>
- API health check: <http://localhost:3001/api/health>

The browser accepts a BYOK API key and sends it to the local server, which forwards it only to the server-configured provider URL. The key lives in browser `sessionStorage` for the current tab; do not use the playground on an untrusted or shared machine.

Environment variables are read from the process environment (no automatic `.env` loading):

```bash
APP_MODE=local \
PROVIDER_BASE_URL=https://api.openai.com/v1 \
CORS_ORIGINS=http://localhost:5173 \
npm run dev
```

Full configuration and API reference: [`docs/SYSTEM_MANUAL.md`](./docs/SYSTEM_MANUAL.md).

### 3. As a CLI (`peel-hacker`)

No server and no API key needed for the deterministic commands:

```bash
# Topic classification (plural-aware: "schools" -> Education)
npm run peel-hacker -- classify "Some people think schools should receive more investment."

# Deterministic PEEL review (structure + semantics); exit 0 = clean, 1 = issues
npm run peel-hacker -- review --prompt "community change" "<peel text>"
printf '%s' "<peel text>" | npm run peel-hacker -- review -    # read from stdin

# Generate one validated PEEL via the LLM (requires an API key)
npm run peel-hacker -- generate "online education vs campus" --api-key sk-...

# Teacher-calibration toolchain (blind review + kappa analysis)
npm run peel-hacker -- calibrate export --per-category 2 --seed 7
npm run peel-hacker -- calibrate import teacher-a.jsonl teacher-b.jsonl
```

`generate` runs the full pipeline (classify -> context -> generate -> two-layer quality gate -> at most one repair) and exits non-zero when the output fails the contract. `calibrate` is the preparation step for teacher-calibrating the evaluation corpus; see [the calibration workflow](#teacher-calibration).

## Command reference

A valid PEEL unit has exactly four labeled sentences:

```text
[P] Abstract position or verdict.
[E1] One-directional causal mechanism.
[E2] Concrete person, place, object or observable action.
[L] One-sentence return to the point without a new claim.
```

| Command | Input | Output |
|---|---|---|
| `/peel [prompt]` | One IELTS W2 / Part 3 question | Exactly 4 English lines `[P][E1][E2][L]` + one Chinese 底层逻辑 line |
| `/matrix [phenomenon]` | Social phenomenon | Model A/B/C match + base PEEL + 3 sibling PEEL kills + 逻辑同构说明 |
| `/wizard [topic bank?]` | Empty or topic keywords | First turn: 3-4 life-detail questions only. After answers: 3-4 mother PEEL scripts + routing table |
| `/score [peel text]` (alias `/review`) | User PEEL (labeled or 4 lines) | Deterministic review: labels, layer boundaries, E2 concreteness, link closure, banned glue, semantic checks |
| `/learn [mode]` | Question + optional student PEEL | Learning loop: practice / hint / model / compare / revise |
| `/bank …` | Internal speaking warehouse | Local-only capability requiring `ENABLE_PRIVATE_QUESTION_BANK=true` |

Capability matrix:

| Capability | Agent Skill / raw prompt | Local playground | Evaluation boundary |
|---|---:|---:|---|
| `/peel` generation | Yes, model-executed | Yes, model + parser + two-layer quality gate | Structure and argument development only |
| `/matrix` transfer practice | Yes, model-executed | Yes, model + contract checks | Heuristic transfer aid |
| `/wizard` personal scaffolding | Yes, host conversation state | Yes, explicit state machine | User details are untrusted input |
| `/score` `/review` | Prompt-guided review | Deterministic structural checks | Not an IELTS score or band prediction |
| `/learn` | Host-dependent | Runtime implementation | Formative feedback; not examiner-calibrated |
| `/bank` | Not part of the licensed public product | Disabled by default | Source material quarantined pending rights review |

## Quality gate & evaluation

The runtime applies a **two-layer deterministic quality gate** (zero LLM tokens) before any generated output is returned:

- **Structural layer** (`server/evaluation/validator.js`): labels, layer boundaries, E2 concreteness (stem-tolerant), link closure, banned discourse glue.
- **Semantic layer** (`server/evaluation/semanticChecks.js`): six heuristic rules that reject topic-less/absurd points, fabricated statistics, entity piles, circular mechanisms, categorical demographic claims, and off-topic evidence (prompt-aware).

A project-authored evaluation corpus ([`evals/`](./evals/)) of **320 items** gates the product's quality contract inside `npm test` (and `node scripts/run-evals.mjs`):

| Metric | Threshold | Current |
|---|---|---|
| topicMacroF1 | ≥ 0.85 | 1.0 |
| validatorPrecision | — | 1.0 |
| validatorRecall | — | 1.0 |
| semanticFalseAcceptRate | ≤ 0.1 | 0.0 |
| revisionTargetResolutionRate | ≥ 0.85 | 0.907 |
| matrixContractAccuracy | ≥ 0.9 | 1.0 |
| wizardContractAccuracy | ≥ 0.9 | 1.0 |

### Teacher calibration

The corpus is project-authored synthetic data. To move from "self-graded" to teacher-graded, the repo ships a calibration toolchain (`peel-hacker calibrate export/import`): export a blind-review batch (no expected labels leaked), have 2-3 qualified teachers annotate it, then import the annotations to get inter-rater Cohen's kappa, agreement vs the synthetic labels, and a list of disputed items. See [`evals/calibration/`](./evals/calibration/) and the CLI help.

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

The checked-in `.grok/` tree is a development mirror, not a second product source. Regenerate it explicitly with `npm run sync:skill:repo-mirror`; do not edit it by hand.

> The pre-Phase-0 proposal in [`docs/EVOLUTION_BLUEPRINT.md`](docs/EVOLUTION_BLUEPRINT.md) is retained as a **historical architecture blueprint** for decision history only. It describes obsolete AI-examiner and numeric-scoring designs; the current product contract is defined by `docs/SYSTEM_MANUAL.md` and the approved Phase 0/1/2 specs under `docs/superpowers/specs/`.

## Security & privacy

- Public mode requires an explicit CORS allowlist and disables local memory and the private question-bank capability.
- Request payloads cannot select the upstream provider URL.
- API keys are removed from structured application logs.
- Invalid generated output is never returned as a successful validated result (`quality_failed` never reports `ok: true`).
- Streaming output is buffered until validation completes.
- Local learning data can be exported with `GET /api/learner/export` and removed with `DELETE /api/learner/data`.
- The local learner identifier is not an authentication mechanism. Do not expose local-memory mode as a multi-tenant public service.

Please report vulnerabilities through the process in [`SECURITY.md`](./SECURITY.md). Do not include real API keys, learner data or proprietary exam material in an issue.

## Development

```bash
# Reproducible dependency install for all three packages
npm run bootstrap

# Verify command surfaces + contracts alignment
node scripts/check-drift.mjs

# Run the complete test suite (386 tests, incl. eval regression gate)
npm test

# Evaluation report; exits non-zero if any threshold is missed
node scripts/run-evals.mjs

# Build generated prompt artifacts and the client
npm run build
```

`npm run build` only writes inside the repository. User-wide skill installation is always a separate explicit command.

For contribution rules, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Content & licensing

Source code is licensed under the [MIT License](./LICENSE). Original documentation and examples, third-party names and quarantined question-bank material have separate terms described in [`CONTENT_LICENSE.md`](./CONTENT_LICENSE.md) and [`NOTICE.md`](./NOTICE.md).

Question-bank files marked as extracted from a local PDF warehouse are **not licensed for redistribution or commercial use** by this project. They must be excluded from public release artifacts until provenance and permissions are documented. Do not submit copied commercial study material or recalled live exam content.

## Documentation index

- [`docs/SYSTEM_MANUAL.md`](./docs/SYSTEM_MANUAL.md) — system manual (architecture, modules, security model, API reference, test strategy)
- [`docs/EVOLUTION_BLUEPRINT.md`](./docs/EVOLUTION_BLUEPRINT.md) — historical pre-Phase-0 blueprint (archive)
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — approved Phase 0/1/2 design specs
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — Phase implementation plans
- [`CHANGELOG.md`](./CHANGELOG.md) — version history
- [`PROJECT.md`](./PROJECT.md) — Chinese project overview

## 中文简介

IELTS PEEL Hacker 是一个面向雅思写作 Task 2 与口语 Part 3 的论证训练工具。它包含三层交付：可移植 Agent Skill、可复制的系统协议，以及带解析、校验、隐私边界和测试的本地 Web playground；另附 `peel-hacker` CLI 与教师校准工具链。完整中文文档见 [`README.zh-CN.md`](./README.zh-CN.md)。

请特别注意：

- 它不是官方 IELTS 产品，也未获 British Council、IDP 或 Cambridge 背书。
- `/score`（别名 `/review`）和 criterion feedback 只做形成性结构反馈，不预测 Band 分数。
- 生成输出须通过结构+语义双层质量门；评估语料为项目自建合成数据，未做教师校准。
- 普通安装与构建不会写入用户主目录；只有 `install:skill:*` 会显式复制到用户级 Skill 目录。
- 来源仍在核验的题库不属于已授权公开产品，不得用于公开发行或商业用途。
- 公开发布前必须以 CI、版权清理、版本 Tag 和 release artifact 为准，而不是以 README 声明为准。

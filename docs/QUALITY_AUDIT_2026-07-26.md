# IELTS PEEL Skill Comprehensive Quality Audit

Date: 2026-07-26

## Executive Verdict

IELTS PEEL Hacker is a distinctive prototype with a clear argument-generation method, useful topic assets, five recognizable workflows, and a functioning local playground. It is not yet a trustworthy customer-facing IELTS tutoring service.

Consolidated maturity:

| Surface | Score | Verdict |
|---|---:|---|
| Portable Agent Skill | 43/100 | Useful prototype; command and methodology drift remain |
| Evaluation system | 24/100 | Not a reliable quality oracle |
| Production readiness | 28/100 | Blocked for shared/public deployment |
| Commercial tutoring capability | 27/100 | Narrow paragraph tool, not a tutoring product |
| Overall customer readiness | 31/100 | Internal alpha |

The gap is approximately:

- 39 points to a controlled commercial beta threshold of 70/100.
- 54 points to a strong customer-ready threshold of 85/100.

The main problem is not visual polish or prompt wording. The core trust contract is currently weak:

1. The quality gate can pass structurally invalid, irrelevant, or false content.
2. The score command resembles IELTS band scoring without implementing official IELTS criteria.
3. Public deployment can expose API keys and mix personal learner memory.
4. Skill, system prompt, server runtime, and documentation implement different command contracts.
5. The question bank has insufficient provenance, licensing evidence, and content QA.

## Scope And Evidence

The audit covered:

- `skill/SKILL.md` and `skill/references/`
- `Agent_System_Prompt.md`
- all server skills, prompt builders, parser, validator, memory, metrics, and LLM client
- all unit, integration, and golden tests
- client configuration and major UI workflows
- package/build scripts and CI claims
- topic knowledge, models, E2 entities, and question bank
- README and project documentation

Verification performed:

- `npm test`: 26/26 tests passed across seven files.
- `npm audit --omit=dev` in server and client: zero reported vulnerabilities.
- Direct client build completed, but Tailwind warned that its content configuration was empty and emitted only 5.14 KB CSS.
- Root `npm run build` failed in the current environment before project build execution because the resolved npm installation was incomplete.
- Independent audit lanes reviewed agent architecture, production readiness, security/privacy, methodology, corpus provenance, testing/evaluation, maintainability, and commercial capability.

Passing tests do not contradict the audit. The current tests largely exercise happy-path offline helpers and do not cover the high-risk runtime and customer paths.

## Release Blockers

### Critical 1: Provider URL Can Exfiltrate API Keys

Evidence:

- `server/index.js:49-105` accepts caller-controlled `baseUrl` and `apiKey`.
- `server/utils/llmClient.js:6` constructs an authenticated client using that URL.

Mechanism:

A caller can submit an attacker-controlled or internal URL. The server then forwards the supplied API key in the Authorization header. Safe local probes confirmed this behavior.

Customer impact:

- API-key theft
- unauthorized provider charges
- server-side request forgery against internal services

Required fix:

- Remove arbitrary request-controlled provider URLs from public mode.
- Use server-configured provider profiles.
- If custom providers remain, allowlist exact HTTPS origins and reject loopback, private, link-local, credential-bearing, and redirecting destinations after DNS resolution.
- Apply outbound network controls and request deadlines.

### Critical 2: Anonymous Users Share Personal Memory

Evidence:

- `client/src/App.jsx:87` sends `userId: 'default'`.
- `server/index.js:57` trusts caller-supplied `userId`.
- `server/memory/userMemory.js:29-49` derives a file path from the supplied ID.
- `server/skills/wizardSkill.js:56` persists learner answers.

Mechanism:

All default browser users share one memory record. Other IDs are caller-selectable and can collide after sanitization. Personal wizard answers can influence later generations.

Customer impact:

- cross-user data leakage
- cross-user prompt/memory poisoning
- misleading personalization
- lack of deletion, retention, consent, and export controls

Required fix:

- Disable persistent memory in public mode until authentication exists.
- Derive ownership from authenticated server-side identity.
- Store typed, minimal facts rather than raw answers.
- Add consent, retention TTL, deletion/export, encryption, and tenant isolation.
- Use atomic managed persistence instead of synchronous JSON read-modify-write.

### Critical 3: The Quality Gate Is Not A Trustworthy Oracle

Evidence:

- `server/evaluation/validator.js:112-193` checks labels, banned phrases, a causal-token threshold, concrete-token hits, and link length.
- `validator.js:140` permits one causal connector in P despite the stated ban.
- `validator.js:177` rejects L only when it contains more than two sentences.
- `server/parsing/peelParser.js:8` accepts labels out of order and overwrites duplicates.
- `server/orchestrator.js:124` can return `ok: true` when validation fails.

Observed false passes:

- superficial text such as `P: Claim`, `E1: Mechanism`, and an E2 containing two concrete nouns can pass
- unsupported claims such as a phone curing cancer can satisfy the structural gate
- duplicate or out-of-order labels can be normalized into an apparently valid result
- multi-sentence layers can pass despite the four-sentence contract

Customer impact:

The product's central promise is a hard quality gate, but the gate can certify poor teaching material. This is more damaging than having no gate because it creates false confidence.

Required fix:

- Introduce a strict typed output schema.
- Require exactly one P, E1, E2, and L in order.
- Require exactly one sentence per layer when four-sentence mode is selected.
- Validate task relevance, stance consistency, causal sufficiency, E1-to-E2 relationship, L-to-P entailment, unsupported claims, and language quality.
- Return `quality_failed`, never `ok: true`, after repair exhaustion.
- Measure validator precision, recall, and false-accept rate against a labeled corpus.

### Critical 4: `/score` Is Not IELTS Scoring

Evidence:

- `server/evaluation/aiScorer.js:9-31` calls the model an IELTS examiner.
- It assigns 1-9 scores to P, E1, E2, and L.
- It does not operationalize the official IELTS Writing or Speaking criteria.

Official IELTS Writing criteria include:

- Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

Speaking has a separate rubric including fluency, grammar, vocabulary, and pronunciation.

Customer impact:

Band-like values can mislead customers about exam readiness and create consumer-trust risk.

Required fix:

- Immediately rename the current function to `PEEL structural feedback`.
- Remove `IELTS examiner` and predicted-band language.
- Add explicit `not an official IELTS score` language.
- Build separate Writing and Speaking evaluators around official criteria.
- Do not expose band estimates until calibrated against blinded qualified human ratings.

### Critical 5: Question-Bank Rights And Provenance Are Unclear

Evidence:

- `skill/references/question-bank/speaking-2026-05-08.json:6` identifies only a local PDF warehouse.
- `skill/SKILL.md:39` instructs the system not to reveal the PDF/vendor.
- The repository license does not establish ownership of embedded third-party questions.
- Corpus metadata and index counts disagree.

Customer impact:

- copyright and licensing exposure
- reputational risk
- inability to defend the content supply chain commercially

Required fix:

- Quarantine the bank from public/commercial releases until rights are verified.
- Record owner, source identifier, acquisition date, license, permission, allowed-use scope, reviewer, and correction history.
- Separate code license from content license.
- Replace questionable material with licensed, public-domain, or independently authored prompts.

## High-Severity Findings

### 1. Skill And Runtime Implement Different Products

`skill/SKILL.md:22-30` advertises five commands. The authoritative system prompt defines only three and rejects unknown commands. Runtime uses independent prompt builders rather than the generated `server/systemPrompt.js`.

Impact: portable skill, copied prompt, and web playground behave differently.

Fix: define one machine-readable command and output-contract registry. Generate skill docs, help text, runtime schemas, and contract tests from it.

### 2. Malformed Model Output Can Bypass Repair

`peelSkill.js` repairs only when at least one PEEL block and warnings exist. Empty or malformed output receives no effective repair. Matrix and wizard lack equivalent bounded repair contracts.

Fix: treat parse failure as a first-class validation error and apply a shared bounded repair policy to all generative commands.

### 3. Streaming Can Expose Rejected Or Duplicate Content

The SSE implementation emits model tokens before validation. It can append corrected output after rejected output, and transport retries can replay prefixes after partial delivery.

Fix: either buffer until validation or emit explicit attempt IDs with `reset/replace` events. Never transparently restart a generation after externally visible tokens have been emitted.

### 4. Persisted Learner Text Is Promoted Into System Trust

Raw wizard answers are persisted and later inserted into system-prompt material. Blacklist sanitization is not a safe trust boundary.

Fix: store schema-validated learner facts with provenance, consent, age, and supersession. Send them as quoted untrusted data, not system instructions.

### 5. Generated Failures Become Learner Weaknesses

`recordPeelResult` records warnings from agent-generated content and later describes them as the user's weaknesses.

Fix: separate `agent_generation_quality` from `learner_submission_quality`. Update learner profiles only from user-authored attempts or explicitly confirmed edits.

### 6. Pedagogy Overfits One Formula

The skill forces every unit into four sentences and presents Speaking Part 3 as essentially the same skeleton as Writing Task 2. It does not assess whole-essay task response, paragraph progression, lexical control, grammatical range, fluency, interaction, or pronunciation.

Fix: position PEEL as an optional argument-development scaffold. Separate Writing and Speaking modes, and teach when to use, vary, or reject the pattern.

### 7. Unsupported Evidence And Overclaiming Are Encouraged

The documentation permits invented examples while templates use phrases such as `Empirical evidence consistently demonstrates`. Topic knowledge includes deterministic ideological claims without sources or uncertainty.

Fix:

- prohibit fabricated studies, statistics, institutions, and named evidence
- label illustrative scenes as hypothetical
- prefer learner experience or clearly general examples
- represent content as claim, counterclaim, conditions, evidence status, and confidence

### 8. Build And Deployment Contracts Are Broken Or Impure

The root build depends on nested installations and invokes a sync script that writes into user home directories. A direct Vite build from root triggers a Tailwind content warning and produces an incomplete stylesheet.

Fix:

- move to npm workspaces and one lockfile
- make `npm ci && npm run build && npm start` the tested contract
- make build pure and workspace-local
- separate publishing/syncing from install/build
- fix Tailwind path resolution
- add a real CI workflow

## Medium-Severity Findings

1. Topic retrieval misses ordinary single-signal prompts because keyword weights and the confidence threshold conflict.
2. Forced Model C fallback can provide confident but arbitrary framing.
3. Topic nodes and entity banks contain stereotypes and loaded labels.
4. Question-bank data contains fragments, questionable classifications, stale counts, and poor topic balance.
5. Metrics undercount failures, misstate validation pass rates, and omit streaming token usage.
6. Health and metrics endpoints expose operational details publicly.
7. Rate limiting trusts caller-controlled forwarded addresses and is process-local.
8. CORS defaults to allowing any origin.
9. LLM requests lack deadlines, cancellation on disconnect, and attempt-level observability.
10. UI accessibility lacks associated labels, selected-state semantics, live-region announcements, reduced-motion handling, and readable small-text guarantees.
11. The "cold/merciless" tone may reduce usefulness for anxious or lower-level learners.
12. Dead and duplicated prompt/data surfaces increase drift.

## What Is Worth Keeping

1. **Distinct product concept:** satellite/drone/microscope/return is memorable and can teach abstraction levels.
2. **Skill-first packaging:** a portable `SKILL.md` plus references is a useful distribution model.
3. **Deterministic prechecks:** an offline validator is the correct direction, even though the current oracle is too shallow.
4. **Topic/entity assets:** the corpus is a useful starting point after provenance, neutrality, and QA repair.
5. **Editable result flow:** generation, editing, and revalidation can become a genuine learner revision loop.
6. **Fast baseline tests:** 26 deterministic tests provide a base for a stronger evaluation system.

## Target Product Definition

The product should be narrowed before it is expanded:

> A bilingual IELTS argument-development coach that helps learners produce, diagnose, revise, and transfer paragraph-level reasoning, while clearly separating PEEL coaching from official IELTS scoring.

It should not initially claim to be:

- a full IELTS tutor
- an official examiner
- a reliable band predictor
- a source of authentic exam questions without provenance

## Improvement Program

### Phase 0: Stop-The-Line Trust Fixes (1-2 weeks)

Goals:

- prevent credential and learner-data exposure
- remove misleading scoring claims
- stop false success states

Actions:

1. Remove request-controlled provider URLs in public mode.
2. Disable shared persistent memory or add authenticated ownership.
3. Rename `/score` to PEEL structural feedback and remove band language.
4. Make parser/validation failures return `quality_failed`.
5. Quarantine the unverified question bank.
6. Restrict CORS and metrics; correct proxy/rate-limit handling.
7. Add provider timeouts, cancellation, and stable public error codes.

Exit criteria:

- zero SSRF/API-key forwarding cases in security tests
- zero cross-user memory access tests failing
- zero invalid outputs returned with `ok: true`
- no official-examiner or predicted-band claim in product surfaces
- unlicensed bank absent from public artifacts

### Phase 1: Trustworthy Skill Core (2-6 weeks)

Goals:

- one command contract
- strict structured output
- reliable deterministic evaluation

Actions:

1. Create typed schemas for all command requests and responses.
2. Build one execution pipeline shared by sync and SSE adapters.
3. Generate skill docs and runtime behavior from one command registry.
4. Add command-specific contracts:
   - `/peel`: exactly one valid PEEL unit
   - `/matrix`: model plus four valid units plus explanation
   - `/wizard`: explicit state machine and confirmed learner facts
   - `/score`: user-authored input and formative criterion feedback
   - `/bank`: licensed content only
5. Replace prompt blacklists with trust-tier separation and typed data envelopes.
6. Repair topic routing with phrase boundaries, ambiguity, and multi-topic support.

Exit criteria:

- parser rejects 100% of missing, duplicate, reordered, and malformed labels
- command contract compliance >=95% first attempt and >=99% after one repair
- no divergence among skill, runtime, README, and tests
- all generated artifacts pass a drift check

### Phase 2: Evidence-Based Learning Product (6-12 weeks)

Goals:

- move from answer generator to learning loop
- align feedback with real IELTS expectations

Actions:

1. Add learner onboarding: test type, target band, current estimate, date, language preference.
2. Add attempt-first modes: `practice`, `hint`, `model`, `compare`, `revise`.
3. Separate Writing Task 2 and Speaking Part 3 pedagogy.
4. Implement official-criterion formative feedback without predicted bands.
5. Store versioned attempt/revision pairs and progress evidence.
6. Add neutral, sourced, and culturally reviewed topic content.
7. Improve accessibility and add privacy controls.

Exit criteria:

- >=70% of pilot learners submit a revision
- >=60% resolve the targeted issue on revision
- 100% feedback identifies criterion, quoted evidence, problem, and next action
- WCAG 2.2 AA audit has no critical findings
- privacy deletion/export workflow passes end-to-end

### Phase 3: Commercial Beta (12-20 weeks)

Goals:

- calibrate quality with qualified teachers
- establish operational reliability and support

Actions:

1. Build a stratified evaluation corpus of at least 300 cases.
2. Obtain blinded ratings from qualified IELTS teachers.
3. Measure rubric agreement, false-pass rate, hallucination rate, command compliance, and revision improvement.
4. Add CI, deployment manifests, monitoring, backups, rollback, incident response, analytics, and support workflows.
5. Conduct legal review for trademarks, claims, privacy, and question content.

Exit criteria:

- validator precision >=95%, recall >=95%, false-accept rate <=1%
- topic-routing macro-F1 >=0.90 with at least 30 cases per topic
- official-criterion score MAE <=0.5 band and weighted kappa >=0.70 before exposing band estimates
- >=99.5% availability and >=98% completed requests
- p95 feedback latency <=15 seconds
- zero critical security/privacy/accessibility findings

## Recommended Work Order

1. Security and memory isolation
2. Scoring claim correction
3. Strict parser and fail-closed quality gate
4. Single command/source-of-truth registry
5. Test and evaluation harness
6. Content provenance and methodology rewrite
7. Learner attempt/revision product loop
8. Production infrastructure, accessibility, analytics, and support

Do not begin with more topic data, UI polish, or prompt expansion. Those increase surface area while the trust foundation remains unresolved.

## Final Assessment

The current project is approximately one-third of the way to a credible customer-serving product. Its concept is strong enough to justify continued investment, but only if it is repositioned from a confident answer-and-score engine into a transparent coaching system with validated contracts.

The single highest-leverage change is:

> Replace the current permissive parser/validator and examiner-style score with a fail-closed, typed, evidence-backed coaching contract.

That change would simultaneously improve product truthfulness, output reliability, testing quality, learner trust, and commercial defensibility.

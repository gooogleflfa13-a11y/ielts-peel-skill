# Audit Findings

Evidence and interim conclusions for the comprehensive quality audit.

## Inventory
- Tests comprise 5 unit test files for parser/sanitizer/question bank/prompt/retriever/validator, one integration test, and one golden fixture.
- Runtime commands are split across five files in `server/skills/`: peel, matrix, wizard, score, and bank.
- Prompt builders exist for peel, matrix, and wizard plus a shared base; score and bank do not have matching prompt builders.
- Potential duplicated truth surfaces: `skill/references/`, `.grok/skills/ielts-peel-skill/references/`, `server/knowledge/`, and partial copies in `server/data/`.
- Build/sync tooling consists of `scripts/build-prompt.mjs` and `scripts/sync-skill.mjs`; provenance and direction still need verification.

## Definition and Architecture Evidence
- `skill/SKILL.md:22-40` defines five commands including hidden `/bank`; `Agent_System_Prompt.md:273-359` defines only wizard/peel/matrix and rejects all others. Runtime exposes all five through `server/orchestrator.js:46-95`.
- `/bank random p1` is explicitly supported while `skill/SKILL.md:70-74` excludes Part 1 chit-chat, creating a product-scope contradiction.
- P forbids causal chains (`Agent_System_Prompt.md:44-47`), but every prescribed P template expresses causality (`:49-51`). E2 requires physical entities (`:64-67`), but the empirical template (`:71`) is abstract and entity-free.
- The intended pipeline is modular, but `orchestrator.js` duplicates the peel pipeline for streaming rather than delegating to `peelSkill.js`, causing behavior drift.
- Validation does not gate success: `orchestrator.js:124-141` always returns `ok: true`; streaming completion does the same at `:303-323` even if final validation fails.
- Streaming emits unvalidated chunks at `orchestrator.js:236-245`, then appends corrected content at `:265-278`, so visible output can contain both rejected and accepted attempts.

## Parser and Validator Evidence
- Parser marker regex (`peelParser.js:8`) is unanchored, accepts labels in arbitrary order, silently overwrites duplicates, and cannot preserve structural violations for validation.
- `validatePeels([])` yields `passed: false` but no warnings (`validator.js:196-210`); retry predicates require warnings and parsed PEELs, so empty/malformed model output bypasses correction.
- Missing labels can still earn layer score because layer scoring checks warning substrings rather than field presence (`validator.js:182-189`).
- L sentence check uses `> 2` (`validator.js:176-179`), allowing two sentences despite the one-sentence contract.
- Singular physical regexes such as `student`, `classroom`, `worker` (`validator.js:50-107`) miss ordinary plurals, while arbitrary concrete proper nouns outside the fixed bank are rejected.

## Security Evidence
- Request-controlled `baseUrl` is accepted at `server/index.js:49-105` and forwarded to the OpenAI client, creating SSRF and credential-forwarding risk unless constrained elsewhere.
- `history` is passed from callers and enters LLM context without sanitization; only current input is filtered. Memory fuel is persisted and injected into the system prompt trust tier.
- Caller-controlled unauthenticated `userId` selects memory files (`index.js:57`; `userMemory.js:29-49`), allowing cross-user memory access/poisoning and sanitized-ID collisions.
- Memory path traversal is mitigated by `sanitizeId`, but writes are synchronous, non-atomic, and anonymous/default memory is shared.

## Skills and Prompt Builders
- `peelSkill.js` has one bounded quality retry, so no infinite quality loop; however, malformed output and second-attempt failure still return normally.
- `matrixSkill.js:42-71` and `wizardSkill.js:45-86` validate but never retry, reject, or repair failed generated PEELs.
- `scoreSkill.js:44-53` returns the original submitted PEEL as `content`, not the documented textual cold checklist; structured clients can inspect validation but direct command consumers do not receive the promised output.
- `matrixSkill.js` sends user input without `wrapAsTaskPayload`, unlike peel/wizard, making prompt-boundary behavior inconsistent.
- `bankSkill.js:249-279` turns a warehouse item into free text and then reclassifies it; the displayed authoritative mother topic can diverge from generated result metadata.
- The shared prompt narrows universal model selection to comparative prompts (`baseSystem.js:26-30`), while the full protocol also includes cross-cutting and vague phenomena.

## Test Quality
- Existing tests are assertion-based and meaningful at unit level: parser, sanitizer, question bank, prompt builder, topic retriever, validator.
- `tests/integration/pipeline.test.js` is an offline composition test and stops before skill/orchestrator/LLM/API execution.
- No tests cover `runPeelSkill`, `runCommand`, streaming, retries, malformed/empty provider output, endpoint schemas, memory isolation/concurrency, SSRF, or history injection.
- `tests/golden/peel-cases.json` contains output constraints, but `pipeline.test.js:8-20` asserts only topic classification and a prompt marker. Golden constraints are dead fixture data.
- The validator's nominal good-case test asserts only structure and absence of one warning; it does not require `passed === true` or zero warnings.

## Documentation and Methodology
- README is broad and bilingual, includes install/use/commands/playground/license, but claims quality is enforced (`README.md:73-76`, `:542-547`) when code can return invalid output successfully.
- README says `.github/workflows/eval.yml` runs in CI (`README.md:570`); file existence still needs confirmation.
- README methodology explicitly says fabricated examples are acceptable (`README.md:493`), which optimizes for rhetorical concreteness rather than truthful evidence and is incompatible with rigorous argument teaching.

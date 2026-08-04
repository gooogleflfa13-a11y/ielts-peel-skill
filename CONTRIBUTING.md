# Contributing

Thanks for your interest in IELTS PEEL Hacker.

## Getting started

```bash
npm run bootstrap        # install root + server + client dependencies
npm run dev              # run the local playground (server 3001, client 5173)
```

## Before opening a pull request

1. Run the full verification suite locally and make sure everything is green:

   ```bash
   npm test                    # 373 tests, including the eval regression gate
   node scripts/check-drift.mjs  # command surfaces + contracts alignment
   node scripts/run-evals.mjs    # evaluation report; must exit 0
   npm run build                 # generated prompt artifacts + client build
   ```

2. Keep the single-source-of-truth invariants intact:
   - `server/commands/registry.js` is the runtime command registry; document
     surfaces (SKILL.md, Agent_System_Prompt.md, client) derive from it.
   - `contracts/commands.json` references real `runtimeCommand`s and workflow
     files — the drift check enforces this.
   - The quality gate is deterministic and token-free; do not introduce
     LLM-based scoring into the gate.

3. Do not modify `server/knowledge/question-bank/` data or add material that
   cannot be redistributed. Question-bank provenance must stay quarantined.

4. Write tests alongside changes (unit / integration / core / cli), and update
   `docs/SYSTEM_MANUAL.md` when behaviour or file layout changes.

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

# Skill package — IELTS PEEL Hacker

This folder **is the product**.

| File | Role |
|------|------|
| `SKILL.md` | Agent entry (Claude / Cursor / Grok / any skill host) |
| `references/SYSTEM_PROMPT.md` | Full deployable system protocol |
| `references/e2-entities.json` | E2 physical entity bank |
| `references/models.json` | A/B/C reduction models |
| `references/keywords.json` | Mother-topic keyword index |

## Install

### Grok Build / Claude Code style

Copy or symlink this folder:

```bash
# User-wide (Grok)
cp -R skill ~/.grok/skills/ielts-peel-hacker

# Or project-scoped
cp -R skill .grok/skills/ielts-peel-hacker
```

Then invoke: `/ielts-peel-hacker` or natural language like “用 PEEL 写这道雅思大作文”.

### Raw LLM system prompt

Paste `references/SYSTEM_PROMPT.md` into any model’s System field.

### Optional playground

The repo `client/` + `server/` stack is a **local BYOK debugger**, not the product. See root `README.md`.

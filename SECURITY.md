# Security Policy

## Reporting a vulnerability

Please report security issues privately instead of opening a public issue.
Include a minimal reproduction, the affected version, and your contact
information.

- **Preferred:** open a GitHub security advisory for this repository
  (Settings → Security → Security advisories → New draft security advisory).
- **Fallback:** describe the issue in a GitHub issue **without** including
  real API keys, learner data, or proprietary exam material.

Do not include secrets, personal data, or copied commercial study material
in any report.

## What is in scope

- Provider URL lock and request-controlled configuration bypass.
- Prompt-injection defenses and memory trust boundaries.
- Public-mode statelessness and learner-data privacy (export/delete).
- Output-integrity failures that bypass the two-layer quality gate.

## Handling

Reports are acknowledged and triaged; fixes are released as part of the next
commit and noted in the changelog where appropriate.

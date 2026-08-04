import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkDrift, EXPECTED_COMMANDS } from '../../scripts/check-drift.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// A consistent skill command table covering all 6 commands.
const SKILL_MD_CONSISTENT = `---
name: ielts-peel-skill
---

# IELTS PEEL Hacker

## Commands

| Command | Input | Output |
|---------|-------|--------|
| \`/peel [prompt]\` | One IELTS question | 4 English lines + 1 Chinese line |
| \`/matrix [phenomenon]\` | Social phenomenon | Model match + base PEEL + 3 kills |
| \`/wizard [topic bank?]\` | Empty or topic keywords | Questions then mother scripts |
| \`/score [peel text]\` | User PEEL | Deterministic structure review |
| \`/bank …\` | Internal speaking warehouse | Local-only capability |
| \`/learn [mode]\` | Question + optional student PEEL | Learning loop: practice, hint, model, compare, revise |

## Absolute PEEL lock

Four labeled sentences.
`;

// A consistent Agent_System_Prompt.md: references all 5 commands (via the
// command inventory line) and has a first fenced code block that
// systemPrompt.js mirrors exactly. The code block itself is command-neutral
// so the "omits a command" fixture can drop commands from the whole document.
const PROMPT_BODY = `You are IELTS PEEL Hacker.

MODULE 1 - ROLE
Cold jurist-mentor.

MODULE 3 - INTERACTIVE COMMANDS
Parse user input. Dispatch to the documented command surface.

Generate. Do not chat.`;

function aspMd(commandLine) {
  return `# Agent_System_Prompt.md

## SYSTEM PROMPT

\`\`\`
${PROMPT_BODY}
\`\`\`

---

## 文件用途说明

| Module | Content |
|--------|---------|
| Module 3 | ${commandLine} 交互协议 |
`;
}

function systemPromptJs(body) {
  return (
    '// AUTO-GENERATED from Agent_System_Prompt.md by scripts/build-prompt.mjs.\n' +
    '// Do not edit by hand.\n' +
    `export const SYSTEM_PROMPT = \`${body}\`;\n`
  );
}

// A consistent contracts/commands.json: three public commands whose
// runtimeCommand values exist in the registry and whose workflow files are
// created by writeConsistentFixture, plus excluded coach/private capabilities.
const CONTRACTS_CONSISTENT = {
  schemaVersion: 1,
  status: 'draft',
  productVersion: '2.0.0',
  publicSkill: 'ielts-peel-hacker',
  commands: [
    {
      name: 'peel',
      runtimeCommand: 'peel',
      workflow: 'references/workflows/peel.md',
      deterministicStages: ['classify', 'context', 'validate'],
      stateful: false,
    },
    {
      name: 'matrix',
      runtimeCommand: 'matrix',
      workflow: 'references/workflows/matrix.md',
      deterministicStages: ['classify', 'context', 'validate'],
      stateful: false,
    },
    {
      name: 'review',
      runtimeCommand: 'score',
      workflow: 'references/workflows/review.md',
      deterministicStages: ['validate', 'review'],
      stateful: false,
    },
  ],
  excludedCapabilities: [
    { name: 'wizard', reason: 'coach extension' },
    { name: 'learn', reason: 'coach extension' },
    { name: 'bank', reason: 'private data plane' },
  ],
};

async function writeConsistentFixture(dir, overrides = {}) {
  await mkdir(join(dir, 'skill'), { recursive: true });
  await mkdir(join(dir, 'skill', 'references', 'workflows'), { recursive: true });
  await mkdir(join(dir, 'server'), { recursive: true });
  await mkdir(join(dir, 'contracts'), { recursive: true });
  await writeFile(join(dir, 'skill', 'SKILL.md'), SKILL_MD_CONSISTENT, 'utf8');
  await writeFile(
    join(dir, 'Agent_System_Prompt.md'),
    aspMd('`/wizard` `/peel` `/matrix` `/score` `/bank` `/learn`'),
    'utf8'
  );
  await writeFile(
    join(dir, 'server', 'systemPrompt.js'),
    systemPromptJs(PROMPT_BODY),
    'utf8'
  );
  await writeFile(
    join(dir, 'contracts', 'commands.json'),
    JSON.stringify(CONTRACTS_CONSISTENT, null, 2),
    'utf8'
  );
  for (const name of ['peel', 'matrix', 'review']) {
    await writeFile(
      join(dir, 'skill', 'references', 'workflows', `${name}.md`),
      `# Workflow: /${name}\n`,
      'utf8'
    );
  }
  if (overrides.skillMd) {
    await writeFile(join(dir, 'skill', 'SKILL.md'), overrides.skillMd, 'utf8');
  }
  if (overrides.aspMd) {
    await writeFile(join(dir, 'Agent_System_Prompt.md'), overrides.aspMd, 'utf8');
  }
  if (overrides.systemPromptJs) {
    await writeFile(join(dir, 'server', 'systemPrompt.js'), overrides.systemPromptJs, 'utf8');
  }
  if (overrides.contractsJson) {
    await writeFile(
      join(dir, 'contracts', 'commands.json'),
      JSON.stringify(overrides.contractsJson, null, 2),
      'utf8'
    );
  }
  if (overrides.removeWorkflow) {
    await rm(join(dir, 'skill', 'references', 'workflows', `${overrides.removeWorkflow}.md`), {
      force: true,
    });
  }
  if (overrides.noContracts) {
    await rm(join(dir, 'contracts', 'commands.json'), { force: true });
  }
}

describe('EXPECTED_COMMANDS', () => {
  it('is exactly the 6 phase-2 commands', () => {
    expect(EXPECTED_COMMANDS).toEqual(['peel', 'matrix', 'wizard', 'score', 'bank', 'learn']);
  });
});

describe('checkDrift', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'drift-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes on consistent artifacts', async () => {
    await writeConsistentFixture(dir);
    const result = await checkDrift(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when SKILL.md command table is missing a command', async () => {
    const skillMissingBank = SKILL_MD_CONSISTENT.replace(
      '| `/bank …\` | Internal speaking warehouse | Local-only capability |\n',
      ''
    );
    await writeConsistentFixture(dir, { skillMd: skillMissingBank });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/SKILL\.md/i);
    expect(result.errors.join('\n')).toMatch(/bank/);
  });

  it('fails when SKILL.md has an extra command beyond the 5', async () => {
    const skillExtra = SKILL_MD_CONSISTENT.replace(
      '## Absolute PEEL lock',
      '| `/extra [x]` | Surprise | Drift |\n\n## Absolute PEEL lock'
    );
    await writeConsistentFixture(dir, { skillMd: skillExtra });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/SKILL\.md/i);
  });

  it('fails when Agent_System_Prompt.md omits a command', async () => {
    // ASP.md references only 3 commands.
    await writeConsistentFixture(dir, {
      aspMd: aspMd('`/wizard` `/peel` `/matrix`'),
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/Agent_System_Prompt/i);
    expect(result.errors.join('\n')).toMatch(/score|bank/);
  });

  it('fails when server/systemPrompt.js drifts from the code block', async () => {
    await writeConsistentFixture(dir, {
      systemPromptJs: systemPromptJs(PROMPT_BODY + '\n\nEXTRA DRIFTED LINE'),
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/systemPrompt\.js/i);
  });

  it('fails when systemPrompt.js has no SYSTEM_PROMPT export', async () => {
    await writeConsistentFixture(dir, {
      systemPromptJs: 'export const SOMETHING_ELSE = "x";\n',
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/systemPrompt\.js/i);
  });

  it('reports all independent drifts at once', async () => {
    const skillMissing = SKILL_MD_CONSISTENT.replace(
      '| `/score [peel text]\` | User PEEL | Deterministic structure review |\n',
      ''
    );
    await writeConsistentFixture(dir, {
      skillMd: skillMissing,
      aspMd: aspMd('`/wizard` `/peel` `/matrix`'),
      systemPromptJs: systemPromptJs('DRIFTED BODY'),
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    // Three independent surfaces each reported.
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('fails when contracts/commands.json is missing', async () => {
    await writeConsistentFixture(dir, { noContracts: true });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/contracts\/commands\.json/i);
  });

  it('fails when a contracts runtimeCommand is not in the registry', async () => {
    await writeConsistentFixture(dir, {
      contractsJson: {
        ...CONTRACTS_CONSISTENT,
        commands: [
          { ...CONTRACTS_CONSISTENT.commands[0], runtimeCommand: 'ghost' },
          ...CONTRACTS_CONSISTENT.commands.slice(1),
        ],
      },
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/runtimeCommand/);
    expect(result.errors.join('\n')).toMatch(/ghost/);
  });

  it('fails when a contracts workflow file is missing', async () => {
    await writeConsistentFixture(dir, { removeWorkflow: 'review' });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/workflow file missing/);
    expect(result.errors.join('\n')).toMatch(/review\.md/);
  });

  it('fails when an excluded capability also appears in public commands', async () => {
    await writeConsistentFixture(dir, {
      contractsJson: {
        ...CONTRACTS_CONSISTENT,
        excludedCapabilities: [{ name: 'peel', reason: 'conflict' }],
      },
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/excludedCapability/);
  });

  it('fails when contracts schemaVersion drifts from 1', async () => {
    await writeConsistentFixture(dir, {
      contractsJson: { ...CONTRACTS_CONSISTENT, schemaVersion: 2 },
    });
    const result = await checkDrift(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/schemaVersion/);
  });
});

describe('real repo drift check', () => {
  it('is drift-free after alignment', async () => {
    const result = await checkDrift(REPO_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

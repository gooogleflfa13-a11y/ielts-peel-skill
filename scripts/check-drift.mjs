// scripts/check-drift.mjs
//
// Phase 1 drift check (Task 8 - Tooling lane).
//
// Verifies three command surfaces stay aligned to the Phase 1 command set:
//   1. skill/SKILL.md command table lists exactly the expected commands.
//   2. Agent_System_Prompt.md references every expected command.
//   3. server/systemPrompt.js mirrors the first fenced code block of
//      Agent_System_Prompt.md (the contract enforced by build-prompt.mjs).
//
// The command registry from Task 1 is not wired into this worktree yet, so the
// expected command set is defined locally here. Integration (Task 9) will swap
// this for the real registry import without changing the check surface.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMAND_NAMES as EXPECTED_COMMANDS } from '../server/commands/registry.js';

export { EXPECTED_COMMANDS };

const SKILL_REL = path.join('skill', 'SKILL.md');
const ASP_REL = 'Agent_System_Prompt.md';
const SYS_REL = path.join('server', 'systemPrompt.js');

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Extract command names from the SKILL.md command table (the markdown table
// directly under the `## Commands` heading). Returns a de-duplicated list.
export function extractSkillCommands(md) {
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => /^##\s+Commands\b/i.test(l));
  if (idx === -1) return [];
  const cmds = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break; // next heading ends the table
    if (!line.startsWith('|')) continue;
    const cells = line.split('|');
    const firstCell = cells[1] || '';
    const m = firstCell.match(/\/(\w+)/);
    if (m) cmds.push(m[1]);
  }
  return [...new Set(cmds)];
}

// Extract every /word command token from a markdown document.
export function extractCommandTokens(md) {
  const tokens = new Set();
  const re = /\/(\w+)/g;
  let m;
  while ((m = re.exec(md))) tokens.add(m[1]);
  return [...tokens];
}

// Mirror scripts/build-prompt.mjs: pull the first fenced code block and strip
// the leading language hint + trailing whitespace.
export function extractFirstCodeBlock(md) {
  const start = md.indexOf('```');
  if (start === -1) return null;
  const afterStart = md.indexOf('```', start + 3);
  if (afterStart === -1) return null;
  const inner = md.slice(start + 3, afterStart).replace(/^\n/, '');
  const firstNewline = inner.indexOf('\n');
  const maybeLang = inner.slice(0, firstNewline);
  const body = /^\s*$/.test(maybeLang) ? inner.slice(firstNewline + 1) : inner;
  return body.replace(/\s+$/, '');
}

// Reverse the escaping applied by build-prompt.mjs and return the
// SYSTEM_PROMPT template-literal content, or null if absent.
export function extractSystemPromptString(js) {
  const m = js.match(/export const SYSTEM_PROMPT = `([\s\S]*)`;\s*$/);
  if (!m) return null;
  return m[1]
    .replace(/\\`/g, '`')
    .replace(/\\\$\{/g, '${')
    .replace(/\\\\/g, '\\');
}

export async function checkDrift(rootDir) {
  const errors = [];
  const checks = [];

  // 1. skill/SKILL.md command table.
  const skillContent = await readIfExists(path.join(rootDir, SKILL_REL));
  if (skillContent === null) {
    errors.push(`skill/SKILL.md not found`);
  } else {
    const present = extractSkillCommands(skillContent).sort();
    const expected = [...EXPECTED_COMMANDS].sort();
    const missing = expected.filter((c) => !present.includes(c));
    const extra = present.filter((c) => !expected.includes(c));
    if (missing.length || extra.length) {
      const parts = [];
      if (missing.length) parts.push(`missing ${missing.join(', ')}`);
      if (extra.length) parts.push(`unexpected ${extra.join(', ')}`);
      errors.push(`skill/SKILL.md command table drift: ${parts.join('; ')}`);
    } else {
      checks.push('skill/SKILL.md command table matches expected commands');
    }
  }

  // 2. Agent_System_Prompt.md references every expected command.
  const aspContent = await readIfExists(path.join(rootDir, ASP_REL));
  if (aspContent === null) {
    errors.push(`Agent_System_Prompt.md not found`);
  } else {
    const tokens = new Set(extractCommandTokens(aspContent));
    const missing = EXPECTED_COMMANDS.filter((c) => !tokens.has(c));
    if (missing.length) {
      errors.push(
        `Agent_System_Prompt.md command list drift: missing ${missing.join(', ')}`
      );
    } else {
      checks.push('Agent_System_Prompt.md references all expected commands');
    }
  }

  // 3. server/systemPrompt.js mirrors Agent_System_Prompt.md first code block.
  const sysContent = await readIfExists(path.join(rootDir, SYS_REL));
  if (sysContent === null) {
    errors.push(`server/systemPrompt.js not found`);
  } else if (aspContent === null) {
    errors.push('server/systemPrompt.js cannot be verified without Agent_System_Prompt.md');
  } else {
    const codeBlock = extractFirstCodeBlock(aspContent);
    const promptStr = extractSystemPromptString(sysContent);
    if (codeBlock === null) {
      errors.push('Agent_System_Prompt.md has no fenced code block');
    } else if (promptStr === null) {
      errors.push('server/systemPrompt.js has no SYSTEM_PROMPT export');
    } else if (codeBlock !== promptStr) {
      errors.push(
        `server/systemPrompt.js drifts from Agent_System_Prompt.md code block ` +
          `(js=${promptStr.length} chars vs md=${codeBlock.length} chars)`
      );
    } else {
      checks.push('server/systemPrompt.js matches Agent_System_Prompt.md code block');
    }
  }

  // 4. contracts/commands.json aligns with the runtime registry and the
  //    referenced workflow files under skill/references/workflows/.
  const contractsRel = path.join('contracts', 'commands.json');
  const contractsContent = await readIfExists(path.join(rootDir, contractsRel));
  if (contractsContent === null) {
    errors.push('contracts/commands.json not found');
  } else {
    let contracts = null;
    try {
      contracts = JSON.parse(contractsContent);
    } catch {
      errors.push('contracts/commands.json is not valid JSON');
    }
    if (contracts) {
      const contractsErrorsBefore = errors.length;
      if (contracts.schemaVersion !== 1) {
        errors.push(
          `contracts/commands.json schemaVersion must be 1 (got ${contracts.schemaVersion})`
        );
      }
      const registryNames = new Set(EXPECTED_COMMANDS);
      const publicNames = new Set();
      for (const command of contracts.commands || []) {
        publicNames.add(command.name);
        if (!command.runtimeCommand || !registryNames.has(command.runtimeCommand)) {
          errors.push(
            `contracts command "${command.name}" runtimeCommand ` +
              `"${command.runtimeCommand}" is not in the runtime registry`
          );
        }
        if (command.workflow) {
          const workflowAbs = path.join(rootDir, 'skill', command.workflow);
          const workflowExists = await readIfExists(workflowAbs);
          if (workflowExists === null) {
            errors.push(
              `contracts command "${command.name}" workflow file missing: ${command.workflow}`
            );
          }
        }
      }
      for (const excluded of contracts.excludedCapabilities || []) {
        if (publicNames.has(excluded.name)) {
          errors.push(
            `contracts excludedCapability "${excluded.name}" also appears in public commands`
          );
        }
      }
      if (errors.length === contractsErrorsBefore) {
        checks.push('contracts/commands.json aligns with the runtime registry and workflows');
      }
    }
  }

  return { ok: errors.length === 0, errors, checks };
}

async function main() {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const result = await checkDrift(root);
  for (const c of result.checks) console.log(`  ok  ${c}`);
  for (const e of result.errors) console.error(`  FAIL  ${e}`);
  if (!result.ok) {
    console.error(`\nDrift detected: ${result.errors.length} issue(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nNo drift detected.');
  }
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main();
}

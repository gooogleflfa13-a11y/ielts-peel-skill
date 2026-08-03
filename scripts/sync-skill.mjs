// Sync Agent_System_Prompt.md -> skill/references/SYSTEM_PROMPT.md.
//
// Safe default: only repository files are updated. Copying the skill into a
// repository mirror or a user's home directory requires an explicit flag:
//   --repo-mirror
//   --install grok
//   --install agents
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function parseOptions(argv) {
  const options = { repoMirror: false, install: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-mirror') {
      options.repoMirror = true;
      continue;
    }
    if (arg === '--install') {
      const target = argv[index + 1];
      if (target !== 'grok' && target !== 'agents') {
        throw new Error('--install must be followed by "grok" or "agents"');
      }
      options.install = target;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

const options = parseOptions(args);

async function extractSystemPrompt() {
  const text = await readFile(path.join(ROOT, 'Agent_System_Prompt.md'), 'utf8');
  const start = text.indexOf('## SYSTEM PROMPT 正文');
  const chunk = start >= 0 ? text.slice(start) : text;
  const i = chunk.indexOf('```');
  const j = chunk.indexOf('```', i + 3);
  if (i < 0 || j < 0) throw new Error('No fenced system prompt in Agent_System_Prompt.md');
  return chunk.slice(i + 3, j).trim();
}

const body = await extractSystemPrompt();
const refDir = path.join(ROOT, 'skill/references');
await mkdir(refDir, { recursive: true });
await writeFile(
  path.join(refDir, 'SYSTEM_PROMPT.md'),
  `# IELTS PEEL Hacker — Full System Protocol\n\n${body}\n`,
  'utf8'
);
console.log(`[sync-skill] SYSTEM_PROMPT.md (${body.length} chars)`);

const skillSrc = path.join(ROOT, 'skill');
const mirrors = [];

if (options.repoMirror) {
  mirrors.push(path.join(ROOT, '.grok/skills/ielts-peel-skill'));
}

if (options.install) {
  const userHome = process.env.HOME;
  if (!userHome || !path.isAbsolute(userHome)) {
    throw new Error('A valid absolute HOME is required for --install');
  }
  const hostDir = options.install === 'grok' ? '.grok' : '.agents';
  mirrors.push(path.join(userHome, hostDir, 'skills/ielts-peel-skill'));
}

for (const dest of mirrors) {
  await mkdir(dest, { recursive: true });
  await cp(skillSrc, dest, { recursive: true });
  console.log(`[sync-skill] mirrored → ${dest}`);
}

if (mirrors.length === 0) {
  console.log('[sync-skill] repository prompt synced; no mirror/install target requested');
}

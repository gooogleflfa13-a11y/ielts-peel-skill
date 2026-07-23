// Sync Agent_System_Prompt.md → skill/references/SYSTEM_PROMPT.md
// and mirror skill/ → .grok/skills + optional user paths.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
const mirrors = [
  path.join(ROOT, '.grok/skills/ielts-peel-skill'),
  path.join(process.env.HOME || '', '.grok/skills/ielts-peel-skill'),
  path.join(process.env.HOME || '', '.agents/skills/ielts-peel-skill'),
].filter((p) => p && !p.startsWith(path.sep + path.sep));

for (const dest of mirrors) {
  await mkdir(dest, { recursive: true });
  await cp(skillSrc, dest, { recursive: true });
  console.log(`[sync-skill] mirrored → ${dest}`);
}

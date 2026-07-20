// scripts/build-prompt.mjs
// Extracts the SYSTEM PROMPT from Agent_System_Prompt.md and writes it to
// server/systemPrompt.js as an ES module export.
//
// The prompt lives inside the first fenced code block (``` ... ```) of
// Agent_System_Prompt.md. This keeps a single source of truth: edit the .md,
// re-run `npm run build:prompt`, and the server picks up the change.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'Agent_System_Prompt.md');
const OUT_DIR = path.join(ROOT, 'server');
const OUT = path.join(OUT_DIR, 'systemPrompt.js');

async function extractPrompt(src) {
  const text = await readFile(src, 'utf8');
  const start = text.indexOf('```');
  if (start === -1) throw new Error('No code fence found in ' + src);
  const afterStart = text.indexOf('```', start + 3);
  if (afterStart === -1) throw new Error('Unterminated code fence in ' + src);
  const inner = text.slice(start + 3, afterStart).replace(/^\n/, '');
  // The first line inside the fence is a language hint (e.g. blank or "text").
  // Agent_System_Prompt.md uses a bare ``` with the prompt directly after,
  // so we strip a leading language token only if it is itself a single word.
  const firstNewline = inner.indexOf('\n');
  const maybeLang = inner.slice(0, firstNewline);
  const body = /^\s*$/.test(maybeLang) ? inner.slice(firstNewline + 1) : inner;
  return body.replace(/\s+$/, '');
}

function toJsModule(prompt) {
  const escaped = prompt
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return (
    `// AUTO-GENERATED from Agent_System_Prompt.md by scripts/build-prompt.mjs.\n` +
    `// Do not edit by hand — edit the source .md and run \`npm run build:prompt\`.\n` +
    `export const SYSTEM_PROMPT = \`${escaped}\`;\n`
  );
}

const prompt = await extractPrompt(SRC);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, toJsModule(prompt), 'utf8');
console.log(`[build-prompt] wrote ${prompt.length} chars to server/systemPrompt.js`);

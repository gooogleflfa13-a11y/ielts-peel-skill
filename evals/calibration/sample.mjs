/**
 * Calibration tooling — batch sampling and blind-review export.
 *
 * Step 1 + 2 of the teacher-calibration workflow: sample the evaluation
 * corpus into a blind-review batch that a qualified teacher can annotate
 * WITHOUT seeing the synthetic expected label. The expected outcome is
 * deliberately absent from the exported entries.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorCases, matrixCases, wizardCases } from '../corpus.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALIBRATION_DIR = join(__dirname, '..', 'calibration');

/** Deterministic PRNG so batches are reproducible for a given seed. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toReviewEntry(item, set, index, raterCount) {
  return {
    n: index,
    id: item.id,
    set,
    category: item.category ?? item.stage ?? 'n/a',
    prompt: item.prompt ?? null,
    response: item.response,
    // The reviewer never sees the synthetic expectation.
  };
}

/**
 * Sample a blind-review batch from the corpus.
 * @param {{ perCategory?: number, seed?: number, includeSets?: string[] }} [options]
 *   perCategory: max entries per category (default: all).
 *   seed: reproducible shuffle seed (default 1).
 */
export function sampleBatch(
  { perCategory, seed = 1, includeSets = ['validator', 'matrix', 'wizard'] } = {}
) {
  const random = mulberry32(seed);
  const sources = [
    { set: 'validator', items: validatorCases },
    { set: 'matrix', items: matrixCases },
    { set: 'wizard', items: wizardCases },
  ].filter((source) => includeSets.includes(source.set));

  const entries = [];
  let n = 0;
  for (const { set, items } of sources) {
    const groups = new Map();
    for (const item of items) {
      const key = item.category ?? item.stage ?? 'n/a';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const group of groups.values()) {
      const pool = perCategory ? shuffle(group, random).slice(0, perCategory) : group;
      for (const item of pool) {
        n += 1;
        entries.push(toReviewEntry(item, set, n));
      }
    }
  }
  return entries;
}

/**
 * Export a batch to JSONL under evals/calibration/review-batch-<date>.jsonl.
 * Returns the destination path and the number of entries written.
 */
export async function exportBatch(options = {}) {
  const entries = sampleBatch(options);
  const date = new Date().toISOString().slice(0, 10);
  const dest = join(CALIBRATION_DIR, `review-batch-${date}.jsonl`);
  await mkdir(dirname(dest), { recursive: true });
  const lines = entries.map((entry) => JSON.stringify(entry));
  await writeFile(dest, lines.join('\n') + '\n', 'utf8');
  return { dest, count: entries.length };
}

/** Parse a JSONL review batch (or annotation file) into objects. */
export async function readJsonl(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

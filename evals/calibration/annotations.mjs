/**
 * Calibration tooling — annotation analysis and reconciliation report.
 *
 * Step 3 + 4 of the teacher-calibration workflow: validate teacher
 * annotations, measure inter-rater reliability (pairwise Cohen's kappa),
 * compare the teacher consensus against the synthetic expected labels, and
 * surface disputed items for human review.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorCases, matrixCases, wizardCases } from '../corpus.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALIBRATION_DIR = join(__dirname, '..', 'calibration');

const ALL_CASES = [...validatorCases, ...matrixCases, ...wizardCases];
const EXPECTED_BY_ID = new Map(ALL_CASES.map((item) => [item.id, item.expectedPass]));

/**
 * Validate one annotation line. Returns { ok, errors }.
 * Annotation shape:
 *   { id, rater, pass: true|false|null, confidence?: 'high'|'medium'|'low',
 *     issues?: string[], comment?: string, annotatedAt?: string }
 */
export function validateAnnotation(annotation) {
  const errors = [];
  if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
    return { ok: false, errors: ['annotation must be an object'] };
  }
  if (typeof annotation.id !== 'string' || !annotation.id) {
    errors.push('id is required');
  } else if (!EXPECTED_BY_ID.has(annotation.id)) {
    errors.push(`unknown id: ${annotation.id}`);
  }
  if (typeof annotation.rater !== 'string' || !annotation.rater.trim()) {
    errors.push('rater is required');
  }
  if (annotation.pass !== true && annotation.pass !== false && annotation.pass !== null) {
    errors.push('pass must be true, false, or null (uncertain)');
  }
  if (
    annotation.confidence !== undefined &&
    !['high', 'medium', 'low'].includes(annotation.confidence)
  ) {
    errors.push('confidence must be high|medium|low');
  }
  if (annotation.issues !== undefined && !Array.isArray(annotation.issues)) {
    errors.push('issues must be an array');
  }
  return { ok: errors.length === 0, errors };
}

/** Pairwise Cohen's kappa over entries where both raters gave a definite pass. */
export function cohensKappa(a, b, annotationsByRater) {
  const aMap = annotationsByRater.get(a) ?? new Map();
  const bMap = annotationsByRater.get(b) ?? new Map();
  let n11 = 0;
  let n10 = 0;
  let n01 = 0;
  let n00 = 0;
  for (const [id, aAnn] of aMap) {
    const bAnn = bMap.get(id);
    if (!bAnn || aAnn.pass === null || bAnn.pass === null) continue;
    if (aAnn.pass && bAnn.pass) n11 += 1;
    else if (aAnn.pass && !bAnn.pass) n10 += 1;
    else if (!aAnn.pass && bAnn.pass) n01 += 1;
    else n00 += 1;
  }
  const n = n11 + n10 + n01 + n00;
  if (n === 0) return { a, b, kappa: null, n: 0 };
  const po = (n11 + n00) / n;
  const aPos = (n11 + n10) / n;
  const bPos = (n11 + n01) / n;
  const pe = aPos * bPos + (1 - aPos) * (1 - bPos);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { a, b, kappa, n };
}

/** Majority consensus per entry; null when ties or all uncertain. */
export function majorityConsensus(annotationsByRater, entryIds) {
  const consensus = new Map();
  for (const id of entryIds) {
    let yes = 0;
    let no = 0;
    for (const list of annotationsByRater.values()) {
      const ann = list.get(id);
      if (!ann) continue;
      if (ann.pass === true) yes += 1;
      else if (ann.pass === false) no += 1;
    }
    if (yes > no) consensus.set(id, true);
    else if (no > yes) consensus.set(id, false);
    else consensus.set(id, null);
  }
  return consensus;
}

/**
 * Build the calibration report from annotation files.
 * @param {Array<{file: string, annotations: object[]}>} annotatedFiles
 */
export function buildCalibrationReport(annotatedFiles) {
  const errors = [];
  const annotationsByRater = new Map();
  const entryIds = new Set();
  const batch = annotatedFiles[0]?.file.split('/').pop().replace(/\.jsonl?$/, '') ?? 'unknown';

  for (const { file, annotations } of annotatedFiles) {
    for (const annotation of annotations) {
      const validation = validateAnnotation(annotation);
      if (!validation.ok) {
        errors.push({ file, id: annotation?.id, errors: validation.errors });
        continue;
      }
      if (!annotationsByRater.has(annotation.rater)) {
        annotationsByRater.set(annotation.rater, new Map());
      }
      annotationsByRater.get(annotation.rater).set(annotation.id, annotation);
      entryIds.add(annotation.id);
    }
  }

  const raters = [...annotationsByRater.keys()];
  const pairwiseKappa = [];
  for (let i = 0; i < raters.length; i += 1) {
    for (let j = i + 1; j < raters.length; j += 1) {
      pairwiseKappa.push(cohensKappa(raters[i], raters[j], annotationsByRater));
    }
  }

  const consensus = majorityConsensus(annotationsByRater, entryIds);
  const disputed = [];
  const agreed = [];
  for (const id of entryIds) {
    const teacher = consensus.get(id);
    if (teacher === null) continue; // no usable consensus
    const synthetic = EXPECTED_BY_ID.get(id);
    const item = ALL_CASES.find((caseItem) => caseItem.id === id);
    const record = {
      id,
      set: item?.set ?? (item?.stage ? 'wizard' : 'validator'),
      category: item?.category ?? item?.stage ?? 'n/a',
      syntheticExpected: synthetic,
      teacherConsensus: teacher,
    };
    if (teacher === synthetic) agreed.push(record);
    else disputed.push(record);
  }

  const withConsensus = agreed.length + disputed.length;
  const report = {
    generatedAt: new Date().toISOString(),
    batch,
    raters,
    nEntries: entryIds.size,
    nAnnotated: [...annotationsByRater.values()].reduce(
      (sum, list) => sum + list.size,
      0
    ),
    nInvalidAnnotations: errors.length,
    pairwiseKappa,
    agreement: {
      withSynthetic: withConsensus ? agreed.length / withConsensus : null,
      nAgreed: agreed.length,
      nDisputed: disputed.length,
      nWithoutConsensus: [...consensus.values()].filter((value) => value === null).length,
    },
    disputed,
    invalid: errors.slice(0, 25),
  };
  return report;
}

/** Write the report (JSON + human-readable MD) under evals/calibration/. */
export async function writeCalibrationReport(report) {
  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = join(CALIBRATION_DIR, `calibration-report-${date}.json`);
  const mdPath = join(CALIBRATION_DIR, `calibration-report-${date}.md`);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const kappaLines = report.pairwiseKappa
    .map(({ a, b, kappa, n }) => `- ${a} × ${b}: κ = ${kappa === null ? 'n/a' : kappa.toFixed(3)} (n=${n})`)
    .join('\n');
  const disputeLines = report.disputed
    .map(
      (d) =>
        `- ${d.id} [${d.set}/${d.category}]: synthetic=${d.syntheticExpected}, teacher=${d.teacherConsensus}`
    )
    .join('\n');
  const md = [
    `# Calibration report (${report.batch})`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Raters: ${report.raters.join(', ')}`,
    `- Entries: ${report.nEntries} (annotations: ${report.nAnnotated})`,
    `- Agreement with synthetic labels: ${report.agreement.withSynthetic === null ? 'n/a' : (report.agreement.withSynthetic * 100).toFixed(1)}%`,
    `  (agreed ${report.agreement.nAgreed} / disputed ${report.agreement.nDisputed} / no consensus ${report.agreement.nWithoutConsensus})`,
    '',
    '## Inter-rater reliability',
    kappaLines || '- (need at least two raters with definite pass labels)',
    '',
    '## Disputed items (teacher consensus differs from synthetic expectation)',
    disputeLines || '- none',
    '',
    '> Disputes are input for a human decision: adjust the corpus expectation,',
    '> refine the quality gate, or re-annotate after clarifying the rubric.',
  ].join('\n');
  await writeFile(mdPath, md + '\n', 'utf8');
  return { jsonPath, mdPath };
}

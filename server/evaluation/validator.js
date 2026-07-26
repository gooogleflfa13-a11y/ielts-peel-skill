import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2_BANK = JSON.parse(
  readFileSync(join(__dirname, '../knowledge/e2-entities.json'), 'utf-8')
);

// Full multi-word phrases for high-precision matching
const ALL_E2_PHRASES = [];
// Distinctive content words (len>=5) for loose E1-pollution checks only
const ALL_E2_TERMS = new Set();
for (const topic of Object.values(E2_BANK)) {
  for (const arr of Object.values(topic)) {
    for (const term of arr) {
      const lower = term.toLowerCase();
      ALL_E2_PHRASES.push(lower);
      for (const word of lower.split(/\s+/)) {
        if (
          word.length >= 5 &&
          !/^(these|those|their|there|about|which|where|while|would|could|should|being|after|before|through|during)$/.test(
            word
          )
        ) {
          ALL_E2_TERMS.add(word);
        }
      }
    }
  }
}

const BANNED_PATTERNS = [
  /\bfirst of all\b/i,
  /\bfirstly\b/i,
  /\bsecondly\b/i,
  /\bthirdly\b/i,
  /\bfinally\b/i,
  /\bin conclusion\b/i,
  /\bto sum up\b/i,
  /\ball in all\b/i,
  /\bon the one hand\b/i,
  /\bon the other hand\b/i,
  /\bin my humble opinion\b/i,
  /\bas we all know\b/i,
  /\bneedless to say\b/i,
  /\bit goes without saying\b/i,
];

const PHYSICAL_INDICATORS = [
  /\bschool\b/i,
  /\bclassroom\b/i,
  /\bhospital\b/i,
  /\bfactory\b/i,
  /\bprison\b/i,
  /\bcourt\b/i,
  /\bcompany\b/i,
  /\bfirm\b/i,
  /\bcorporation\b/i,
  /\bchild\b/i,
  /\bteen\b/i,
  /\bparent\b/i,
  /\bteacher\b/i,
  /\bdoctor\b/i,
  /\bnurse\b/i,
  /\bworker\b/i,
  /\bstudent\b/i,
  /\bpatient\b/i,
  /\boffice\b/i,
  /\bwhiteboard\b/i,
  /\bCCTV\b/i,
  /\bsolar\b/i,
  /\bplastic\b/i,
  /\bice cap\b/i,
  /\bsubway\b/i,
  /\bmetro\b/i,
  /\bhighway\b/i,
  /\bcommuter\b/i,
  /\bgym\b/i,
  /\bcanteen\b/i,
  /\bInstagram\b/i,
  /\bTikTok\b/i,
  /\bYouTube\b/i,
  /\bvideo\b/i,
  /\bapp\b/i,
  /\bphone\b/i,
  /\bscreen\b/i,
  /\bgame\b/i,
  /\bpark\b/i,
  /\bforest\b/i,
  /\briver\b/i,
  /\bocean\b/i,
  /\bfish\b/i,
  /\bbird\b/i,
  /\bexhaust\b/i,
  /\bwaste\b/i,
  /\btrash\b/i,
  /\bgarbage\b/i,
  /\bsmog\b/i,
  /\bseminar\b/i,
  /\bcampus\b/i,
  /\buniversity\b/i,
  /\bsupermarket\b/i,
  /\bfamily\b/i,
  /\bneighbor\b/i,
  /\brestaurant\b/i,
];

const CLOSURE_CUE = /^(?:thus|therefore|hence|consequently|overall|as a result|so)\b/i;
const CLOSURE_STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'because',
  'before',
  'being',
  'consequently',
  'could',
  'develops',
  'from',
  'hence',
  'into',
  'matter',
  'matters',
  'overall',
  'remains',
  'result',
  'should',
  'supports',
  'therefore',
  'these',
  'this',
  'those',
  'thus',
  'with',
  'would',
]);

function meaningfulTerms(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.filter((word) => word.length >= 4 && !CLOSURE_STOP_WORDS.has(word)) || []
  );
}

/**
 * @param {{ P: string, E1: string, E2: string, L: string }} peel
 */
export function validatePeel(peel) {
  const warnings = [];
  const issues = [];
  const score = { structure: 0, layers: 0, vocabs: 0, physical: 0 };
  const checks = {
    labels: 'pass',
    layerBoundaries: 'pass',
    e2Concreteness: 'pass',
    linkClosure: 'pass',
    bannedGlue: 'pass',
  };
  const addIssue = ({ layer = null, code, evidence, action, message }) => {
    issues.push({ layer, code, evidence, action });
    warnings.push(message);
  };

  const missing = [];
  if (!peel?.P?.trim()) missing.push('P');
  if (!peel?.E1?.trim()) missing.push('E1');
  if (!peel?.E2?.trim()) missing.push('E2');
  if (!peel?.L?.trim()) missing.push('L');
  if (missing.length > 0) {
    checks.labels = 'fail';
    for (const layer of missing) {
      addIssue({
        layer,
        code: 'MISSING_LAYER',
        evidence: `[${layer}] is empty or absent`,
        action: `Provide exactly one sentence for [${layer}].`,
        message: `Missing labels: ${layer}`,
      });
    }
  } else {
    score.structure = 1;
  }

  for (const layer of ['P', 'E1', 'E2', 'L']) {
    const body = peel?.[layer]?.trim();
    if (!body) continue;
    const sentenceCount = Array.from(
      new Intl.Segmenter('en', { granularity: 'sentence' }).segment(body)
    ).filter((part) => part.segment.trim()).length;
    if (sentenceCount !== 1) {
      checks.layerBoundaries = 'fail';
      if (layer === 'L') checks.linkClosure = 'fail';
      addIssue({
        layer,
        code: 'SENTENCE_COUNT',
        evidence: `${sentenceCount} sentences in [${layer}]`,
        action: `Rewrite [${layer}] as exactly one sentence.`,
        message: `${layer} must contain exactly one sentence`,
      });
    }
    if (!/[.!?。！？](?:["'”’\)\]])?$/.test(body)) {
      checks.layerBoundaries = 'fail';
      if (layer === 'L') checks.linkClosure = 'fail';
      addIssue({
        layer,
        code: 'TERMINAL_PUNCTUATION',
        evidence: body,
        action: `End [${layer}] with sentence-ending punctuation.`,
        message: `${layer} lacks terminal punctuation`,
      });
    }
  }

  const allText = [peel?.P, peel?.E1, peel?.E2, peel?.L].join(' ');
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(allText)) {
      checks.bannedGlue = 'fail';
      addIssue({
        code: 'BANNED_GLUE',
        evidence: allText.match(pat)?.[0] || String(pat),
        action: 'Remove formulaic discourse glue from the PEEL body.',
        message: `Banned discourse glue detected: ${pat}`,
      });
    }
  }

  if (peel?.P) {
    if (/\bfor example\b/i.test(peel.P)) {
      checks.layerBoundaries = 'fail';
      addIssue({
        layer: 'P',
        code: 'P_EXAMPLE',
        evidence: 'for example',
        action: 'Keep P abstract and move examples to E2.',
        message: 'P contains "for example"',
      });
    }
    if (/\bsuch as\b/i.test(peel.P)) {
      checks.layerBoundaries = 'fail';
      addIssue({
        layer: 'P',
        code: 'P_EXAMPLE',
        evidence: 'such as',
        action: 'Keep P abstract and move examples to E2.',
        message: 'P contains "such as"',
      });
    }
    const causeCount = (
      peel.P.match(/\b(because|leads to|results in|causes?|triggers?|due to)\b/gi) || []
    ).length;
    if (causeCount > 0) {
      checks.layerBoundaries = 'fail';
      addIssue({
        layer: 'P',
        code: 'P_CAUSAL_CHAIN',
        evidence: peel.P,
        action: 'State only the abstract verdict in P; move causality to E1.',
        message: 'P has a causal chain — keep abstract',
      });
    }
  }

  if (peel?.E1) {
    const e1Lower = peel.E1.toLowerCase();
    let e1EntityCount = 0;
    for (const term of ALL_E2_TERMS) {
      if (e1Lower.includes(term)) e1EntityCount++;
    }
    if (e1EntityCount > 2) {
      checks.layerBoundaries = 'fail';
      addIssue({
        layer: 'E1',
        code: 'E1_CONCRETE_ENTITY',
        evidence: peel.E1,
        action: 'Move concrete people, places, objects, and actions to E2.',
        message: 'E1 contains concrete entities — move to E2',
      });
    }
  }

  if (peel?.E2) {
    let physicalScore = 0;
    for (const pat of PHYSICAL_INDICATORS) {
      if (pat.test(peel.E2)) physicalScore++;
    }
    // Prefer full-phrase bank hits to avoid common-word false positives
    const e2Lower = peel.E2.toLowerCase();
    let bankHits = 0;
    for (const phrase of ALL_E2_PHRASES) {
      if (phrase.length >= 4 && e2Lower.includes(phrase)) bankHits++;
    }
    if (physicalScore === 0 && bankHits === 0) {
      checks.e2Concreteness = 'fail';
      addIssue({
        layer: 'E2',
        code: 'E2_NOT_CONCRETE',
        evidence: peel.E2,
        action: 'Add a concrete person, place, object, or observable action.',
        message: 'E2 lacks ANY physical entity — add a concrete person/place/object/action',
      });
      score.physical = 0;
    } else if (physicalScore + bankHits < 2) {
      checks.e2Concreteness = 'fail';
      addIssue({
        layer: 'E2',
        code: 'E2_WEAKLY_CONCRETE',
        evidence: peel.E2,
        action: 'Use at least two concrete indicators in E2.',
        message: 'E2 is weak on physicality — goal: 2+ concrete indicators',
      });
      score.physical = 0.5;
    } else {
      score.physical = 1;
    }
  }

  if (peel?.L && /\b(for example|such as)\b/i.test(peel.L)) {
    checks.linkClosure = 'fail';
    addIssue({
      layer: 'L',
      code: 'L_NEW_EXAMPLE',
      evidence: peel.L,
      action: 'Close back to P without adding an example or new claim.',
      message: 'L introduces new example material',
    });
  }

  if (peel?.P?.trim() && peel?.L?.trim()) {
    const pTerms = meaningfulTerms(peel.P);
    const lTerms = meaningfulTerms(peel.L);
    const overlap = [...pTerms].filter((term) => lTerms.has(term));
    if (!CLOSURE_CUE.test(peel.L.trim()) || overlap.length === 0) {
      checks.linkClosure = 'fail';
      addIssue({
        layer: 'L',
        code: 'L_NOT_CLOSED',
        evidence: overlap.length
          ? 'L repeats P language but lacks an explicit closing cue.'
          : 'L has no meaningful lexical overlap with P.',
        action: 'Begin with a closing cue and restate at least one key term from P.',
        message: 'L does not close explicitly back to P',
      });
    }
  }

  if (!warnings.some((w) => w.includes('P has') || w.includes('P contains'))) {
    score.layers += 0.25;
  }
  if (!warnings.some((w) => w.includes('E1 contains'))) score.layers += 0.25;
  if (!warnings.some((w) => w.includes('E2 lacks') || w.includes('E2 is weak'))) {
    score.layers += 0.25;
  }
  if (!warnings.some((w) => w.includes('L is too'))) score.layers += 0.25;

  score.vocabs = score.physical;

  return {
    passed: issues.length === 0,
    checks,
    issues,
    warnings,
    score,
  };
}

export function validatePeels(peels) {
  const list = Array.isArray(peels) ? peels : [];
  const results = list.map((peel) => validatePeel(peel));
  const n = Math.max(results.length, 1);
  const checkNames = [
    'labels',
    'layerBoundaries',
    'e2Concreteness',
    'linkClosure',
    'bannedGlue',
  ];
  return {
    passed: results.length > 0 && results.every((r) => r.passed),
    checks: Object.fromEntries(
      checkNames.map((name) => [
        name,
        results.length > 0 && results.every((result) => result.checks[name] === 'pass')
          ? 'pass'
          : 'fail',
      ])
    ),
    issues: results.flatMap((result, peelIndex) =>
      result.issues.map((issue) => ({ ...issue, peelIndex }))
    ),
    details: results,
    summary: {
      structure: results.reduce((s, r) => s + r.score.structure, 0) / n,
      layers: results.reduce((s, r) => s + r.score.layers, 0) / n,
      physical: results.reduce((s, r) => s + r.score.physical, 0) / n,
      totalWarnings: results.reduce((s, r) => s + r.warnings.length, 0),
    },
    allWarnings: results.flatMap((r) => r.warnings),
  };
}

/**
 * Detect simple entity hits for frontend highlighter
 */
export function detectEntities(text) {
  if (!text) return [];
  const found = [];
  const lower = text.toLowerCase();
  for (const [topic, groups] of Object.entries(E2_BANK)) {
    for (const [type, terms] of Object.entries(groups)) {
      for (const term of terms) {
        if (lower.includes(term.toLowerCase())) {
          found.push({
            word: term,
            type: type === 'scenes' ? 'scene' : type === 'objects' ? 'object' : 'people',
            topic,
          });
        }
      }
    }
  }
  // dedupe by word
  const seen = new Set();
  return found.filter((e) => {
    if (seen.has(e.word)) return false;
    seen.add(e.word);
    return true;
  });
}

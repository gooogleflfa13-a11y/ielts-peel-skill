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

/**
 * @param {{ P: string, E1: string, E2: string, L: string }} peel
 */
export function validatePeel(peel) {
  const warnings = [];
  const score = { structure: 0, layers: 0, vocabs: 0, physical: 0 };

  const missing = [];
  if (!peel?.P?.trim()) missing.push('P');
  if (!peel?.E1?.trim()) missing.push('E1');
  if (!peel?.E2?.trim()) missing.push('E2');
  if (!peel?.L?.trim()) missing.push('L');
  if (missing.length > 0) {
    warnings.push(`Missing labels: ${missing.join(', ')}`);
  } else {
    score.structure = 1;
  }

  const allText = [peel?.P, peel?.E1, peel?.E2, peel?.L].join(' ');
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(allText)) {
      warnings.push(`Banned discourse glue detected: ${pat}`);
    }
  }

  if (peel?.P) {
    if (/\bfor example\b/i.test(peel.P)) warnings.push('P contains "for example"');
    if (/\bsuch as\b/i.test(peel.P)) warnings.push('P contains "such as"');
    const causeCount = (
      peel.P.match(/\b(because|leads to|results in|causes?|triggers?|due to)\b/gi) || []
    ).length;
    if (causeCount > 1) warnings.push('P has excessive causal chains — keep abstract');
  }

  if (peel?.E1) {
    const e1Lower = peel.E1.toLowerCase();
    let e1EntityCount = 0;
    for (const term of ALL_E2_TERMS) {
      if (e1Lower.includes(term)) e1EntityCount++;
    }
    if (e1EntityCount > 2) warnings.push('E1 contains concrete entities — move to E2');
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
      warnings.push(
        '⚠️ E2 lacks ANY physical entity — add a concrete person/place/object/action'
      );
      score.physical = 0;
    } else if (physicalScore + bankHits < 2) {
      warnings.push('E2 is weak on physicality — goal: 2+ concrete indicators');
      score.physical = 0.5;
    } else {
      score.physical = 1;
    }
  }

  if (peel?.L) {
    if (peel.L.split(/[.?!]/).filter((s) => s.trim()).length > 2) {
      warnings.push('L is too long — should be one sentence max');
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

  return { warnings, score };
}

export function validatePeels(peels) {
  const list = Array.isArray(peels) ? peels : [];
  const results = list.map((peel) => validatePeel(peel));
  const n = Math.max(results.length, 1);
  return {
    passed: results.length > 0 && results.every((r) => r.warnings.length === 0),
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

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPIC_KEYWORDS = JSON.parse(
  readFileSync(join(__dirname, '../knowledge/keywords.json'), 'utf-8')
);

/**
 * Heuristic semantic quality layer for generated PEEL output.
 *
 * Sits AFTER the structural gate (labels, sentence boundaries, E2 physicality,
 * link closure) and catches defects that structure alone cannot see:
 *
 *  - P_TOPIC_ANCHOR:           P names no IELTS topic keyword -> verdict is
 *                              unfalsifiable / absurd (e.g. "Cats improve democracy").
 *  - UNSUPPORTED_ATTRIBUTION:  E2 cites precise statistics or "proved/found"
 *                              research claims without a real source.
 *  - ENTITY_PILE:              E2 is a comma-separated entity list with no
 *                              observable action (e.g. "a teacher, a nurse, a bus...").
 *  - CIRCULAR_MECHANISM:       E1 restates P's own terms instead of a mechanism.
 *  - ABSOLUTE_GROUP_CLAIM:     E1/P assigns a trait to a whole demographic group
 *                              ("young people are impulsive", "naturally responsible").
 *  - OFF_TOPIC_EVIDENCE:       E2's concrete scene belongs to a topic different
 *                              from the prompt's topic (when a prompt is supplied).
 *
 * All checks are deterministic and token-free. `prompt` is optional: without it
 * OFF_TOPIC_EVIDENCE is skipped, the rest still run.
 */

function stemWord(word) {
  return word
    .toLowerCase()
    .replace(/ies$/i, 'y')
    .replace(/sses$/i, 'ss')
    .replace(/ing$/i, '')
    .replace(/ed$/i, '')
    .replace(/s$/i, '')
    .replace(/ment$/i, '');
}

function matchesKeyword(text, keyword) {
  const lowerText = text.toLowerCase();
  if (keyword.includes(' ') || keyword.includes('-')) {
    return lowerText.includes(keyword.toLowerCase());
  }
  const kwStem = stemWord(keyword);
  if (!kwStem) return false;
  return lowerText
    .split(/[^a-z]+/)
    .some((word) => stemWord(word) === kwStem);
}

/**
 * Topic hits using stem-tolerant keyword matching (plurals like "schools"
 * match the keyword "school"). Unlike classifyTopic's exact word-boundary
 * rule, this is used only for semantic anchoring, so it tolerates inflection.
 */
function topicHits(text) {
  const hits = new Set();
  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (matchesKeyword(text, keyword)) {
        hits.add(topicId);
        break;
      }
    }
  }
  return hits;
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'an', 'and', 'are', 'as', 'at', 'be',
  'because', 'been', 'before', 'between', 'but', 'by', 'could', 'did', 'do',
  'does', 'during', 'for', 'from', 'had', 'has', 'have', 'if', 'in', 'into',
  'is', 'it', 'its', 'just', 'may', 'might', 'more', 'most', 'must', 'no',
  'not', 'of', 'on', 'only', 'or', 'over', 'per', 'so', 'than', 'that', 'the',
  'their', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
  'under', 'was', 'were', 'when', 'which', 'while', 'who', 'whom', 'will',
  'with', 'would', 'should', 'very',
]);

function terms(text) {
  const list = (text || '').toLowerCase().match(/[a-z]+/g) || [];
  return new Set(list.filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function stem(word) {
  return word
    .replace(/ies$/i, 'y')
    .replace(/sses$/i, 'ss')
    .replace(/ing$/i, '')
    .replace(/ed$/i, '')
    .replace(/ment$/i, '')
    .replace(/s$/i, '');
}

function stemmedTerms(text) {
  return new Set([...terms(text)].map(stem));
}

function sharedStemmedCount(a, b) {
  const aTerms = stemmedTerms(a);
  const bTerms = stemmedTerms(b);
  let shared = 0;
  for (const term of aTerms) {
    if (bTerms.has(term)) shared += 1;
  }
  return shared;
}

const ATTRIBUTION_NUMBER = /\b\d+(?:\.\d+)?\s*(?:percent|per\s*cent|%)\b/i;
const ATTRIBUTION_CLAIM = /\b(?:proved?|found|showed?|revealed|confirmed|reported|claimed)\b/i;
const ATTRIBUTION_AUTHORITY = /\b(?:university|institute|research|study|studies|survey|statistics|scientists?|experts?)\b/i;

const E2_ACTION_VERB =
  /\b(?:use|uses|used|place|places|placed|walk|walks|walked|check|checks|checked|sign|signs|signed|measure|measures|measured|attend|attends|visited|visit|visits|buy|buys|bought|sell|sells|cook|cooks|teach|teaches|learn|learns|build|builds|drive|drives|read|reads|write|writes|talk|talks|form|forms|hold|holds|open|opens|pick|picks|reload|reloads|catch|catches|wear|wears|install|installs|replace|replaces|deter|deters|wait|waits|stand|stands|move|moves|prepare|prepares|refer|refers|share|shares|discuss|discusses|observe|observes|correct|corrects|put|puts|carry|carries|deliver|delivers|pay|pays|scan|scans|swipe|swipes|submit|submits|operate|operates|monitor|monitors|place)\b/i;

const CAUSAL_LINK = /\b(?:because|since|as a result|leads? to)\b/i;

const ABSOLUTE_TRAIT = /\b(?:always|never|naturally|inherently|inevitably|by nature)\b/i;
const DEMOGRAPHIC_GROUP =
  /\b(?:older|elderly|young|teenage)\s+people\b|\b(?:women|men|immigrants?|foreigners?|teenagers?|the poor|the rich)\b/i;

function issue(layer, code, evidence, action, message) {
  return { layer, code, evidence, action, message };
}

/**
 * @param {{ P?: string, E1?: string, E2?: string, L?: string }} peel
 * @param {{ prompt?: string }} [options]
 * @returns {Array<{layer, code, evidence, action, message}>}
 */
export function semanticQualityIssues(peel, { prompt } = {}) {
  const issues = [];
  const P = peel?.P?.trim?.() || '';
  const E1 = peel?.E1?.trim?.() || '';
  const E2 = peel?.E2?.trim?.() || '';

  // 1. P must name a concrete IELTS topic (guard against absurd verdicts).
  if (P && topicHits(P).size === 0) {
    issues.push(
      issue(
        'P',
        'P_TOPIC_ANCHOR',
        P,
        'Anchor P to a concrete IELTS topic (education, technology, environment, ...) so the verdict is falsifiable.',
        'P has no topic anchor - verdict is unfalsifiable or absurd'
      )
    );
  }

  // 2. E2 must not fabricate precise statistics or research attribution.
  if (E2 && ATTRIBUTION_NUMBER.test(E2) && (ATTRIBUTION_CLAIM.test(E2) || ATTRIBUTION_AUTHORITY.test(E2))) {
    issues.push(
      issue(
        'E2',
        'UNSUPPORTED_ATTRIBUTION',
        E2,
        'Remove fabricated statistics or unsourced research claims; use an observable everyday scene instead.',
        'E2 cites unsupported statistics or research attribution'
      )
    );
  }

  // 3. E2 must be a scene with an action, not a comma-separated entity list.
  if (E2 && E2.split(',').length >= 4 && !E2_ACTION_VERB.test(E2)) {
    issues.push(
      issue(
        'E2',
        'ENTITY_PILE',
        E2,
        'Replace the entity list with one concrete person doing one observable action in a specific place.',
        'E2 is a comma-separated entity pile without an observable action'
      )
    );
  }

  // 4. E1 must introduce a mechanism, not restate P's own terms.
  if (P && E1 && CAUSAL_LINK.test(E1) && sharedStemmedCount(P, E1) >= 2 && topicHits(E1).size === 0) {
    issues.push(
      issue(
        'E1',
        'CIRCULAR_MECHANISM',
        E1,
        'State a real cause-effect mechanism in E1; do not restate the point in different words.',
        'E1 restates P instead of explaining a mechanism'
      )
    );
  }

  // 5. No absolute trait assigned to a whole demographic group.
  if (E1 && ABSOLUTE_TRAIT.test(E1) && DEMOGRAPHIC_GROUP.test(E1)) {
    issues.push(
      issue(
        'E1',
        'ABSOLUTE_GROUP_CLAIM',
        E1,
        'Remove categorical claims about a demographic group; describe conditions and observable behaviour instead.',
        'E1 assigns an absolute trait to a demographic group'
      )
    );
  }

  // 6. E2's scene should belong to the prompt's topic when a prompt is known.
  if (prompt && E2) {
    const promptTopics = topicHits(prompt);
    const e2Topics = topicHits(E2);
    if (
      promptTopics.size > 0 &&
      e2Topics.size > 0 &&
      ![...e2Topics].some((topicId) => promptTopics.has(topicId))
    ) {
      issues.push(
        issue(
          'E2',
          'OFF_TOPIC_EVIDENCE',
          E2,
          `Use a concrete scene related to ${[...promptTopics][0]} instead of a different topic's example.`,
          'E2 evidence belongs to a different topic than the prompt'
        )
      );
    }
  }

  return issues;
}

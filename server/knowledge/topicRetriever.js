import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOPIC_KEYWORDS = JSON.parse(
  readFileSync(join(__dirname, 'keywords.json'), 'utf-8')
);

const TOPIC_FILE_MAP = {
  Education: 'education.json',
  Technology: 'technology.json',
  Environment: 'environment.json',
  Crime: 'crime.json',
  Government: 'government.json',
  Media: 'media.json',
  Urbanization: 'urbanization.json',
  Society: 'society.json',
  Health: 'health.json',
};

// Pre-computed keyword weights for faster classification.
// Multi-word / hyphenated phrases are strong indicators (weight 3);
// single words are moderate indicators (weight 2) so that one exact
// word-boundary match clears the classification threshold.
const KEYWORD_WEIGHTS = {
  phrase: 3,
  word: 2,
};
const CLASSIFY_THRESHOLD = 2;
const CONFIDENCE_DIVISOR = 4;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKeywordEntries() {
  const entries = [];
  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      const isPhrase = kw.includes(' ') || kw.includes('-');
      entries.push({
        topicId,
        keyword: kw,
        lower: kw.toLowerCase(),
        weight: isPhrase ? KEYWORD_WEIGHTS.phrase : KEYWORD_WEIGHTS.word,
        isPhrase,
      });
    }
  }
  return entries;
}

const KEYWORD_ENTRIES = buildKeywordEntries();

/**
 * Classify the input into a topic using word-boundary matching only.
 *
 * @param {string} input
 * @returns {{
 *   topicId: string|null,
 *   label: string,
 *   score: number,
 *   confidence: number,
 *   matchedKeywords: string[],
 *   allScores: Record<string, number>,
 *   matchedTopics: Array<{ topicId: string, score: number, confidence: number, matchedKeywords: string[] }>,
 * }}
 */
export function classifyTopic(input) {
  const lower = (input || '').toLowerCase();
  const allScores = {};
  const allMatched = {};
  for (const topicId of Object.keys(TOPIC_KEYWORDS)) {
    allScores[topicId] = 0;
    allMatched[topicId] = [];
  }

  for (const entry of KEYWORD_ENTRIES) {
    if (!wordBoundaryMatch(lower, entry.lower, entry.isPhrase)) continue;
    allScores[entry.topicId] += entry.weight;
    if (!allMatched[entry.topicId].includes(entry.keyword)) {
      allMatched[entry.topicId].push(entry.keyword);
    }
  }

  const matchedTopics = Object.keys(allScores)
    .filter((topicId) => allScores[topicId] >= CLASSIFY_THRESHOLD)
    .map((topicId) => ({
      topicId,
      score: allScores[topicId],
      confidence: Math.min(allScores[topicId] / CONFIDENCE_DIVISOR, 1),
      matchedKeywords: allMatched[topicId],
    }))
    .sort((a, b) => b.score - a.score);

  if (matchedTopics.length === 0) {
    return {
      topicId: null,
      label: 'Unknown',
      score: 0,
      confidence: 0,
      matchedKeywords: [],
      allScores,
      matchedTopics: [],
    };
  }

  const top = matchedTopics[0];
  return {
    topicId: top.topicId,
    label: top.topicId,
    score: top.score,
    confidence: top.confidence,
    matchedKeywords: top.matchedKeywords,
    allScores,
    matchedTopics,
  };
}

function wordBoundaryMatch(haystack, needleLower, isPhrase) {
  if (!needleLower) return false;
  try {
    const pattern = new RegExp(`\\b${escapeRegex(needleLower)}\\b`, 'i');
    return pattern.test(haystack);
  } catch {
    return false;
  }
}

/**
 * @param {string|null} topicId
 */
export function loadTopicKnowledge(topicId) {
  if (!topicId) return null;
  const filename = TOPIC_FILE_MAP[topicId] || `${topicId.toLowerCase()}.json`;
  try {
    const data = readFileSync(join(__dirname, 'topics', filename), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * One-shot: input → classify → load knowledge
 */
export function retrieveTopic(input) {
  const classification = classifyTopic(input);
  if (!classification.topicId) {
    return { classification, knowledge: null };
  }
  const knowledge = loadTopicKnowledge(classification.topicId);
  return { classification, knowledge };
}

/**
 * Match reduction model A/B/C for matrix-style prompts.
 * Returns an explicit Unknown marker when no trigger matches instead of
 * forcing Model C.
 */
export function matchReductionModel(input) {
  const models = JSON.parse(readFileSync(join(__dirname, 'models.json'), 'utf-8'));
  const lower = (input || '').toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [id, model] of Object.entries(models)) {
    let score = 0;
    for (const t of model.trigger || []) {
      if (wordBoundaryMatch(lower, String(t).toLowerCase(), String(t).includes(' '))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = { id, ...model, score };
    }
  }
  if (best) return best;
  return {
    id: 'Unknown',
    name: 'Unknown (no reduction model matched)',
    trigger: [],
    axes: {},
    skeleton: '',
    score: 0,
  };
}

/**
 * Optional: vector-based semantic similarity (requires embeddings)
 * Placeholder for future enhancement - can integrate with sentence-transformers or similar
 */
export async function classifyTopicSemantic(input, embedder) {
  // Future: use sentence embeddings for semantic topic classification
  // For now, fall back to keyword-based
  return classifyTopic(input);
}

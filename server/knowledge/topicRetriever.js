import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOPIC_KEYWORDS = JSON.parse(
  readFileSync(join(__dirname, 'keywords.json'), 'utf-8')
);

// Weighted keyword categories for better disambiguation
const KEYWORD_CATEGORIES = {
  primary: 3,      // Strong topic indicators
  secondary: 2,    // Moderate indicators
  tertiary: 1,     // Weak/contextual indicators
};

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

// Pre-computed keyword weights for faster classification
let KEYWORD_WEIGHTS = null;

function buildKeywordWeights() {
  if (KEYWORD_WEIGHTS) return KEYWORD_WEIGHTS;
  
  const weights = {};
  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (!weights[k]) weights[k] = {};
      // Primary: exact phrase with spaces (more specific)
      if (k.includes(' ') || k.includes('-')) {
        weights[k][topicId] = (weights[k][topicId] || 0) + KEYWORD_CATEGORIES.primary;
      } else {
        // Single words get lower weight to avoid false positives
        weights[k][topicId] = (weights[k][topicId] || 0) + KEYWORD_CATEGORIES.secondary;
      }
    }
  }
  KEYWORD_WEIGHTS = weights;
  return weights;
}

/**
 * @param {string} input
 * @returns {{ topicId: string|null, score: number, matchedKeywords: string[], allScores: Record<string, number> }}
 */
export function classifyTopic(input) {
  const lower = (input || '').toLowerCase();
  const keywordWeights = buildKeywordWeights();
  
  let bestTopic = null;
  let bestScore = 0;
  let matchedKeywords = [];
  const allScores = {};

  // Score each topic using weighted keyword matching
  for (const topicId of Object.keys(TOPIC_KEYWORDS)) {
    let score = 0;
    const matched = [];
    
    for (const [keyword, topicWeights] of Object.entries(keywordWeights)) {
      if (topicWeights[topicId] && lower.includes(keyword)) {
        const weight = topicWeights[topicId];
        score += weight;
        matched.push(keyword);
      }
    }
    
    // Boost for exact phrase matches (word boundaries)
    for (const kw of TOPIC_KEYWORDS[topicId]) {
      if (kw.includes(' ')) {
        try {
          if (new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(lower)) {
            score += KEYWORD_CATEGORIES.primary;
            if (!matched.includes(kw)) matched.push(kw);
          }
        } catch { /* ignore */ }
      }
    }
    
    allScores[topicId] = score;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topicId;
      matchedKeywords = matched;
    }
  }

  // Threshold: require minimum weighted score
  if (bestScore >= 3) {
    return { topicId: bestTopic, score: bestScore, matchedKeywords, allScores };
  }
  return { topicId: null, score: 0, matchedKeywords: [], allScores };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Match reduction model A/B/C for matrix-style prompts
 */
export function matchReductionModel(input) {
  const models = JSON.parse(readFileSync(join(__dirname, 'models.json'), 'utf-8'));
  const lower = (input || '').toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [id, model] of Object.entries(models)) {
    let score = 0;
    for (const t of model.trigger || []) {
      if (lower.includes(String(t).toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { id, ...model, score };
    }
  }
  return best || { id: 'C', ...models.C, score: 0 };
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

/**
 * Internal question warehouse — material data plane.
 * Not a user-facing downloadable "题库文件"; consumed by skills only.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = join(__dirname, 'question-bank');
const DEFAULT_BANK = 'speaking-2026-05-08.json';

let _cache = null;

export function loadBank(filename = DEFAULT_BANK) {
  if (_cache && _cache.__file === filename) return _cache;
  const path = join(BANK_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(`Question warehouse not found: ${filename}`);
  }
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  data.__file = filename;
  // id index
  data.__byId = new Map();
  for (const item of data.part1 || []) data.__byId.set(item.id, item);
  for (const item of data.part2 || []) data.__byId.set(item.id, item);
  _cache = data;
  return data;
}

export function warehouseMeta() {
  const bank = loadBank();
  return {
    ...bank.meta,
    // never expose file path to clients as a product surface
    surface: 'embedded_data_plane',
  };
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param {{ part?: 'P1'|'P2'|'P3'|'any', mother?: string, keyword?: string }} filters
 */
export function randomQuestion(filters = {}) {
  const bank = loadBank();
  const part = (filters.part || 'any').toUpperCase();
  const keyword = (filters.keyword || '').trim().toLowerCase();
  const mother = filters.mother || null;

  let pool = [];

  if (part === 'P1' || part === 'ANY') {
    for (const t of bank.part1) {
      if (mother && t.mother_topic !== mother) continue;
      if (keyword && !matchKeyword(t, keyword)) continue;
      for (const q of t.questions || []) {
        pool.push({
          kind: 'P1',
          topicId: t.id,
          topic: t.topic,
          mother_topic: t.mother_topic,
          question: q,
          season_tag: t.season_tag,
          links: t.links,
        });
      }
    }
  }

  if (part === 'P2' || part === 'ANY') {
    for (const t of bank.part2) {
      if (mother && t.mother_topic !== mother) continue;
      if (keyword && !matchKeyword(t, keyword)) continue;
      pool.push({
        kind: 'P2',
        topicId: t.id,
        topic: t.topic,
        mother_topic: t.mother_topic,
        question: t.cue_card?.prompt || t.topic,
        bullets: t.cue_card?.bullets || [],
        season_tag: t.season_tag,
        links: t.links,
        part3_preview: (t.part3 || []).slice(0, 2),
      });
    }
  }

  if (part === 'P3') {
    for (const t of bank.part2) {
      if (mother && t.mother_topic !== mother) continue;
      if (keyword && !matchKeyword(t, keyword)) continue;
      for (const q of t.part3 || []) {
        pool.push({
          kind: 'P3',
          topicId: t.id,
          topic: t.topic,
          mother_topic: t.mother_topic,
          question: q,
          season_tag: t.season_tag,
          links: t.links,
          p2_anchor: t.cue_card?.prompt,
        });
      }
    }
  }

  const item = pickRandom(pool);
  if (!item) return null;
  return presentQuestion(item);
}

function matchKeyword(topic, keyword) {
  const blob = JSON.stringify(topic).toLowerCase();
  return blob.includes(keyword);
}

/** Strip internal warehouse fields for surface presentation */
export function presentQuestion(item) {
  return {
    // stable id for follow-up /peel without exposing bank as a "file"
    ref: item.topicId || item.id,
    part: item.kind || item.part,
    topic: item.topic,
    mother_topic: item.mother_topic,
    prompt: item.question,
    bullets: item.bullets || undefined,
    p2_anchor: item.p2_anchor || undefined,
    part3_preview: item.part3_preview || undefined,
    // soft season tag only, no vendor watermark
    season: item.season_tag || undefined,
  };
}

export function getTopicById(id) {
  const bank = loadBank();
  return bank.__byId.get(id) || null;
}

export function searchTopics(keyword, { limit = 12 } = {}) {
  const bank = loadBank();
  const k = (keyword || '').toLowerCase().trim();
  if (!k) return [];
  const hits = [];
  for (const t of [...bank.part1, ...bank.part2]) {
    if (matchKeyword(t, k)) {
      hits.push({
        ref: t.id,
        part: t.part,
        topic: t.topic,
        mother_topic: t.mother_topic,
        sample:
          t.part === 'P1'
            ? (t.questions || [])[0]
            : t.cue_card?.prompt || t.topic,
      });
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

/**
 * Horizontal = same mother / sibling topics
 * Vertical = P1↔P2/P3 chain
 */
export function analyzeLinks(refOrKeyword) {
  const bank = loadBank();
  let topic = bank.__byId.get(refOrKeyword);
  if (!topic) {
    const hits = searchTopics(refOrKeyword, { limit: 1 });
    if (hits[0]) topic = bank.__byId.get(hits[0].ref);
  }
  if (!topic) return null;

  const resolve = (id) => {
    const t = bank.__byId.get(id);
    if (!t) return null;
    return {
      ref: t.id,
      part: t.part,
      topic: t.topic,
      mother_topic: t.mother_topic,
      sample:
        t.part === 'P1'
          ? (t.questions || [])[0]
          : t.cue_card?.prompt || t.topic,
    };
  };

  const horizontal = (topic.links?.horizontal || [])
    .map(resolve)
    .filter(Boolean);
  const vertical = (topic.links?.vertical || []).map(resolve).filter(Boolean);

  // same-mother extras
  const sameMother = [...bank.part1, ...bank.part2]
    .filter((t) => t.mother_topic === topic.mother_topic && t.id !== topic.id)
    .slice(0, 8)
    .map((t) => resolve(t.id))
    .filter(Boolean);

  return {
    focus: {
      ref: topic.id,
      part: topic.part,
      topic: topic.topic,
      mother_topic: topic.mother_topic,
      season: topic.season_tag,
    },
    analysis: {
      horizontal: {
        meaning: '同母题横向迁移：表面不同、底层逻辑节点可复用',
        items: horizontal.length ? horizontal : sameMother,
      },
      vertical: {
        meaning:
          topic.part === 'P1'
            ? '纵向延伸：该 P1 可升维到的 P2/P3 讨论链'
            : '纵向下沉：该 P2/P3 可挂靠的 P1 热身话题',
        items: vertical,
      },
      peel_route: {
        mother_topic: topic.mother_topic,
        suggested_command:
          topic.part === 'P1'
            ? `/peel ${ (topic.questions || [])[0] || topic.topic }`
            : `/peel ${topic.part3?.[0] || topic.cue_card?.prompt || topic.topic}`,
        note: 'P1 口语可轻量 PEEL；P3 与大作文共用完整 PEEL 骨架',
      },
    },
  };
}

/** Build a PEEL-ready prompt string from a warehouse item */
export function toPeelInput(topic, { prefer = 'auto' } = {}) {
  if (!topic) return '';
  if (topic.part === 'P1') {
    const q = topic.questions?.[0] || topic.topic;
    return `Speaking Part 1 style: ${q}`;
  }
  if (prefer === 'p2' || (prefer === 'auto' && !topic.part3?.length)) {
    const bullets = (topic.cue_card?.bullets || []).join('; ');
    return `Speaking Part 2: ${topic.cue_card?.prompt || topic.topic}. Cover: ${bullets}`;
  }
  // default for P2 topics: use a Part 3 discussion question (better PEEL fit)
  const p3 = topic.part3?.[0];
  if (p3) {
    return `Speaking Part 3 / academic discussion: ${p3} (related cue: ${topic.cue_card?.prompt || topic.topic})`;
  }
  return topic.cue_card?.prompt || topic.topic;
}

export function stats() {
  const bank = loadBank();
  const mothers = {};
  for (const t of [...bank.part1, ...bank.part2]) {
    mothers[t.mother_topic] = (mothers[t.mother_topic] || 0) + 1;
  }
  return {
    meta: warehouseMeta(),
    mothers,
  };
}

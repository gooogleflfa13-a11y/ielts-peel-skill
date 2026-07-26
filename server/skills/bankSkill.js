import {
  randomQuestion,
  searchTopics,
  analyzeLinks,
  getTopicById,
  toPeelInput,
  stats,
  warehouseMeta,
} from '../knowledge/questionBank.js';
import { runPeelSkill } from './peelSkill.js';
import { log } from '../utils/logger.js';

/**
 * Parse /bank subcommands from free text.
 * /bank random [p1|p2|p3] [keyword]
 * /bank search <keyword>
 * /bank links <ref|keyword>
 * /bank peel <ref|keyword>   → hidden warehouse + PEEL generation
 * /bank stats
 */
export function parseBankCommand(input) {
  let s = (input || '').trim();
  s = s.replace(/^\/bank\s*/i, '').trim();
  if (!s) return { action: 'random', args: {} };

  const [head, ...rest] = s.split(/\s+/);
  const action = head.toLowerCase();
  const tail = rest.join(' ').trim();

  if (['random', 'rand', '抽题', '随机'].includes(action)) {
    const parts = tail.split(/\s+/).filter(Boolean);
    let part = 'any';
    let keyword = '';
    if (parts[0] && /^(p1|p2|p3|any|part1|part2|part3)$/i.test(parts[0])) {
      part = parts[0].replace(/part/i, 'P').toUpperCase();
      if (part === 'PART1') part = 'P1';
      if (part === 'PART2') part = 'P2';
      if (part === 'PART3') part = 'P3';
      keyword = parts.slice(1).join(' ');
    } else {
      keyword = tail;
    }
    return { action: 'random', args: { part, keyword } };
  }

  if (['search', 'find', '搜', '搜索'].includes(action)) {
    return { action: 'search', args: { keyword: tail } };
  }

  if (['links', 'link', 'graph', '关联', '横纵'].includes(action)) {
    return { action: 'links', args: { query: tail } };
  }

  if (['peel', 'answer', '答', '作答'].includes(action)) {
    return { action: 'peel', args: { query: tail } };
  }

  if (['stats', 'meta', '统计'].includes(action)) {
    return { action: 'stats', args: {} };
  }

  // bare keyword → search + random hybrid
  return { action: 'random', args: { part: 'any', keyword: s } };
}

function formatRandom(item) {
  if (!item) {
    return {
      content: 'No matching question in warehouse. Try another filter.',
      parsed: { peels: [], meta: null, model: null, raw: '' },
    };
  }
  const lines = [
    `## DRAW`,
    `Part: ${item.part} · Mother: ${item.mother_topic || '—'} · ref:\`${item.ref}\``,
    ``,
    `**Prompt**`,
    item.prompt,
  ];
  if (item.bullets?.length) {
    lines.push(``, `**Cue bullets**`);
    item.bullets.forEach((b) => lines.push(`- ${b}`));
  }
  if (item.part3_preview?.length) {
    lines.push(``, `**P3 teaser**`);
    item.part3_preview.forEach((q) => lines.push(`- ${q}`));
  }
  lines.push(
    ``,
    `---`,
    `Next: \`/bank peel ${item.ref}\` · \`/bank links ${item.ref}\` · \`/peel <paste prompt>\``,
    `_Source: embedded speaking warehouse (not a separate user file)._`
  );
  const content = lines.join('\n');
  return {
    content,
    parsed: { peels: [], meta: `题库抽题 · ${item.part} · ${item.mother_topic}`, model: null, raw: content },
    bank: { mode: 'random', item },
  };
}

function formatLinks(analysis) {
  if (!analysis) {
    return {
      content: 'No topic matched. Try /bank search <keyword>.',
      parsed: { peels: [], meta: null, model: null, raw: '' },
    };
  }
  const { focus, analysis: a } = analysis;
  const lines = [
    `## LINK MAP`,
    `Focus: **${focus.topic}** (${focus.part}) · Mother: ${focus.mother_topic} · ref:\`${focus.ref}\``,
    ``,
    `### 横向 Horizontal — ${a.horizontal.meaning}`,
  ];
  for (const it of a.horizontal.items.slice(0, 8)) {
    lines.push(`- [\`${it.ref}\`] ${it.part} · ${it.topic} — ${it.sample || ''}`);
  }
  lines.push(``, `### 纵向 Vertical — ${a.vertical.meaning}`);
  if (!a.vertical.items.length) lines.push(`- (no vertical edges scored)`);
  for (const it of a.vertical.items.slice(0, 8)) {
    lines.push(`- [\`${it.ref}\`] ${it.part} · ${it.topic} — ${it.sample || ''}`);
  }
  lines.push(
    ``,
    `### PEEL route`,
    `- Mother node: **${a.peel_route.mother_topic}**`,
    `- ${a.peel_route.note}`,
    `- Try: \`${a.peel_route.suggested_command}\``,
    `- Or: \`/bank peel ${focus.ref}\``
  );
  const content = lines.join('\n');
  return {
    content,
    parsed: { peels: [], meta: `题库横纵 · ${focus.mother_topic}`, model: null, raw: content },
    bank: { mode: 'links', analysis },
  };
}

export async function runBankSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  enablePrivateQuestionBank = false,
}) {
  if (!enablePrivateQuestionBank) {
    throw Object.assign(new Error('The private question bank is disabled.'), {
      code: 'FEATURE_DISABLED',
      status: 403,
    });
  }

  const { action, args } = parseBankCommand(input);
  log('INFO', 'bank.action', { action, args });

  if (action === 'stats') {
    const s = stats();
    const content = [
      `## WAREHOUSE STATS`,
      `Surface: embedded data plane (hidden material base)`,
      `Part1 topics: ${s.meta.counts?.part1_topics}`,
      `Part2 topics: ${s.meta.counts?.part2_topics}`,
      `P1 questions: ${s.meta.counts?.part1_questions}`,
      `P3 questions: ${s.meta.counts?.part3_questions}`,
      ``,
      `Mother distribution:`,
      ...Object.entries(s.mothers).map(([k, v]) => `- ${k}: ${v}`),
    ].join('\n');
    return {
      content,
      parsed: { peels: [], meta: '题库底仓统计', model: null, raw: content },
      usage: null,
      topic: null,
      validation: { passed: true, details: [], summary: { structure: 1, layers: 1, physical: 1, totalWarnings: 0 }, allWarnings: [] },
      entities: [],
      retries: 0,
      bank: { mode: 'stats', stats: s },
    };
  }

  if (action === 'search') {
    const hits = searchTopics(args.keyword || '', { limit: 15 });
    const lines = [
      `## SEARCH \`${args.keyword || ''}\``,
      hits.length ? '' : 'No hits.',
      ...hits.map(
        (h) => `- [\`${h.ref}\`] **${h.part}** · ${h.topic} · ${h.mother_topic}\n  ${h.sample || ''}`
      ),
      ``,
      `Use: \`/bank peel <ref>\` or \`/bank links <ref>\``,
    ];
    const content = lines.join('\n');
    return {
      content,
      parsed: { peels: [], meta: '题库搜索', model: null, raw: content },
      usage: null,
      topic: null,
      validation: { passed: true, details: [], summary: { structure: 1, layers: 1, physical: 1, totalWarnings: 0 }, allWarnings: [] },
      entities: [],
      retries: 0,
      bank: { mode: 'search', hits },
    };
  }

  if (action === 'links') {
    const analysis = analyzeLinks(args.query || '');
    const formatted = formatLinks(analysis);
    return {
      ...formatted,
      usage: null,
      topic: analysis ? { id: analysis.focus.mother_topic, score: 1 } : null,
      validation: { passed: true, details: [], summary: { structure: 1, layers: 1, physical: 1, totalWarnings: 0 }, allWarnings: [] },
      entities: [],
      retries: 0,
    };
  }

  if (action === 'peel') {
    const q = args.query || '';
    let topic = getTopicById(q);
    if (!topic) {
      const hits = searchTopics(q, { limit: 1 });
      if (hits[0]) topic = getTopicById(hits[0].ref);
    }
    if (!topic) {
      // try random with keyword then peel
      const drawn = randomQuestion({ keyword: q, part: 'any' });
      if (drawn) topic = getTopicById(drawn.ref);
    }
    if (!topic) {
      return {
        content: 'Warehouse miss. Try /bank search <keyword> first.',
        parsed: { peels: [], meta: null, model: null, raw: '' },
        usage: null,
        topic: null,
        validation: { passed: true, details: [], summary: { structure: 0, layers: 0, physical: 0, totalWarnings: 0 }, allWarnings: [] },
        entities: [],
        retries: 0,
      };
    }

    if (!apiKey) {
      return {
        content: 'API Key required for /bank peel (generation). Drawing is free via /bank random.',
        parsed: { peels: [], meta: null, model: null, raw: '' },
        usage: null,
        topic: null,
        validation: { passed: true, details: [], summary: { structure: 0, layers: 0, physical: 0, totalWarnings: 0 }, allWarnings: [] },
        entities: [],
        retries: 0,
      };
    }

    const peelInput = toPeelInput(topic, { prefer: 'auto' });
    const peelResult = await runPeelSkill({
      input: peelInput,
      history,
      apiKey,
      baseUrl,
      model,
      userId,
    });

    const header = [
      `## BANK → PEEL`,
      `ref:\`${topic.id}\` · ${topic.part} · **${topic.topic}** · Mother: ${topic.mother_topic}`,
      ``,
      `**Hidden warehouse prompt**`,
      peelInput,
      ``,
      `---`,
      ``,
    ].join('\n');

    return {
      ...peelResult,
      content: header + (peelResult.content || ''),
      bank: {
        mode: 'peel',
        ref: topic.id,
        topic: topic.topic,
        mother_topic: topic.mother_topic,
        peelInput,
      },
    };
  }

  // default: random
  const item = randomQuestion({
    part: args.part || 'any',
    keyword: args.keyword || '',
  });
  const formatted = formatRandom(item);
  return {
    ...formatted,
    usage: null,
    topic: item ? { id: item.mother_topic, score: 1 } : null,
    validation: { passed: true, details: [], summary: { structure: 1, layers: 1, physical: 1, totalWarnings: 0 }, allWarnings: [] },
    entities: [],
    retries: 0,
  };
}

export { warehouseMeta };
